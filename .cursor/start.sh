#!/usr/bin/env bash
# =============================================================================
# Easy Dunya - Cloud Agent start (per-boot runtime reconciliation)
# -----------------------------------------------------------------------------
# Brings up the local backend on every boot: fixes nested-Docker networking,
# starts the Docker daemon, and starts the local Supabase stack (which applies
# supabase/migrations and seed.sql). Idempotent: tolerates re-runs and an
# already-running daemon/stack. Returns once Supabase is ready.
# =============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Services not needed for local app development (keeps startup lean/fast).
SUPABASE_EXCLUDE="vector,pooler,imgproxy,edge-runtime"

log() { printf '\n\033[1;32m[start]\033[0m %s\n' "$*"; }

# --- 1. Nested-Docker firewall fix -------------------------------------------
# The Cloud Agent VM ships a legacy iptables FORWARD chain with policy DROP that
# silently drops container-to-container traffic (Docker 29 programs nftables
# instead). Allow forwarding so Supabase containers can reach the database.
sudo iptables-legacy -P FORWARD ACCEPT 2>/dev/null || true

# --- 2. Docker daemon --------------------------------------------------------
if ! sudo docker info >/dev/null 2>&1; then
  log "Starting Docker daemon"
  sudo mkdir -p /var/log
  sudo bash -c 'nohup dockerd >/var/log/dockerd.log 2>&1 &'
  for _ in $(seq 1 60); do
    if sudo docker info >/dev/null 2>&1; then break; fi
    sleep 1
  done
  if ! sudo docker info >/dev/null 2>&1; then
    log "ERROR: Docker daemon did not become ready"; tail -n 30 /var/log/dockerd.log || true
    exit 1
  fi
else
  log "Docker daemon already running"
fi

# Make the socket usable by the agent user without a re-login for group changes.
sudo chmod 666 /var/run/docker.sock || true

# --- 3. Supabase local stack -------------------------------------------------
# Idempotent: `supabase start` is a no-op if the stack is already running.
log "Starting Supabase local stack"
if ! supabase start -x "$SUPABASE_EXCLUDE" >/tmp/supabase-start.log 2>&1; then
  log "First 'supabase start' attempt failed; retrying after 'supabase stop'"
  supabase stop >/dev/null 2>&1 || true
  supabase start -x "$SUPABASE_EXCLUDE"
fi

# In install-time pre-pull mode we only need the images cached; stop to leave a
# clean, non-running state in the snapshot (start reconciles on the next boot).
if [ "${1:-}" = "--install-prepull" ]; then
  log "Pre-pull complete; stopping stack for a clean snapshot"
  supabase stop >/dev/null 2>&1 || true
  exit 0
fi

log "Supabase is up. API: http://localhost:54321  Studio: http://localhost:54323"
log "start complete"
