/** iOS WKWebView envoie parfois SIGNED_OUT tout seul. On restaure au plus une fois par cooldown. */

export const IOS_AUTH_RESTORE_COOLDOWN_MS = 30_000;

export type IosSignedOutAction = "restore" | "keep" | "clear";

export function decideIosSignedOut(opts: {
  explicitSignOut: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
  restoring: boolean;
  restoreDisabled: boolean;
  lastRestoreAt: number;
  now: number;
}): IosSignedOutAction {
  if (opts.explicitSignOut) return "clear";
  if (!opts.accessToken || !opts.refreshToken) return "clear";
  if (opts.restoring || opts.restoreDisabled) return "keep";
  if (opts.lastRestoreAt > 0 && opts.now - opts.lastRestoreAt < IOS_AUTH_RESTORE_COOLDOWN_MS) {
    return "keep";
  }
  return "restore";
}
