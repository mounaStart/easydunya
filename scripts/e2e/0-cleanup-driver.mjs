#!/usr/bin/env node
/**
 * Libère le chauffeur test (termine les voyages in_progress bloquants).
 * Usage: npm run test:e2e:cleanup
 */
import { loginDriver, releaseDriverLock } from "../lib/e2e-client.mjs";

async function main() {
  console.log("══════════════════════════════════════════");
  console.log(" E2E — Libérer le chauffeur test");
  console.log("══════════════════════════════════════════\n");

  const { supabase, userId } = await loginDriver();
  const ended = await releaseDriverLock(supabase, userId);

  if (ended.length === 0) {
    console.log("✓ Aucun voyage bloquant — chauffeur libre.");
  } else {
    console.log(`\n✅ ${ended.length} voyage(s) terminé(s).`);
  }

  await supabase.auth.signOut();
  console.log("");
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
