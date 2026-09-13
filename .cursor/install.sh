#!/usr/bin/env bash
# =============================================================================
# Easy Dunya - Cloud Agent install (durable setup, runs once to build snapshot)
# -----------------------------------------------------------------------------
# Installs system packages (Docker + fuse-overlayfs), the Supabase CLI, and the
# frontend dependencies, wires up .env for the local Supabase stack, and
# best-effort pre-pulls the Supabase images so a fresh boot starts quickly.
# Must be idempotent and terminate (no long-running processes started here).
# =============================================================================
set -euo pipefail

SUPABASE_CLI_VERSION="v2.117.0"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

log() { printf '\n\033[1;34m[install]\033[0m %s\n' "$*"; }

# --- 1. System packages: Docker engine + fuse-overlayfs (for nested Docker) ---
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker and fuse-overlayfs via apt"
  export DEBIAN_FRONTEND=noninteractive
  sudo apt-get update -qq
  # --force-confold avoids interactive conffile prompts (e.g. /etc/fuse.conf)
  sudo apt-get install -y -qq -o Dpkg::Options::=--force-confold \
    docker.io fuse-overlayfs
else
  log "Docker already installed: $(docker --version)"
fi

# fuse-overlayfs is the storage driver that works inside the Cloud Agent VM.
sudo mkdir -p /etc/docker
echo '{ "storage-driver": "fuse-overlayfs" }' | sudo tee /etc/docker/daemon.json >/dev/null
sudo groupadd -f docker
sudo usermod -aG docker "$(id -un)" || true

# --- 2. Supabase CLI ---------------------------------------------------------
if ! command -v supabase >/dev/null 2>&1; then
  log "Installing Supabase CLI ${SUPABASE_CLI_VERSION}"
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/supabase.tar.gz" \
    "https://github.com/supabase/cli/releases/download/${SUPABASE_CLI_VERSION}/supabase_linux_amd64.tar.gz"
  tar -xzf "$tmp/supabase.tar.gz" -C "$tmp"
  sudo mv "$tmp/supabase" /usr/local/bin/supabase
  sudo chmod +x /usr/local/bin/supabase
  rm -rf "$tmp"
else
  log "Supabase CLI already installed: $(supabase --version)"
fi

# --- 3. Frontend dependencies ------------------------------------------------
log "Installing npm dependencies (npm ci)"
npm ci

# --- 4. Local environment file ----------------------------------------------
# .env is git-ignored; point the app at the local Supabase stack (port 54321).
# These anon/URL values are the well-known Supabase local-dev defaults.
if [ ! -f .env ]; then
  cp .env.example .env
fi
LOCAL_URL="http://localhost:54321"
LOCAL_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
sed -i "s#^VITE_SUPABASE_URL=.*#VITE_SUPABASE_URL=${LOCAL_URL}#" .env
sed -i "s#^VITE_SUPABASE_ANON_KEY=.*#VITE_SUPABASE_ANON_KEY=${LOCAL_ANON}#" .env

# --- 5. Best-effort pre-pull of Supabase images (baked into the snapshot) ----
# Start dockerd temporarily so the images are cached on disk. Non-fatal: if the
# build environment cannot run nested Docker, `start.sh` will pull on first boot.
log "Attempting to pre-pull Supabase images (best-effort)"
"$REPO_DIR/.cursor/start.sh" --install-prepull || \
  log "Pre-pull skipped (nested Docker unavailable during install); start.sh will pull on first boot"

log "install complete"
