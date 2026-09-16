/** iOS WKWebView envoie parfois SIGNED_OUT tout seul. On garde la session mémoire, sans setSession. */

export type IosSignedOutAction = "keep" | "clear";

export function decideIosSignedOut(opts: {
  explicitSignOut: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
}): IosSignedOutAction {
  if (opts.explicitSignOut) return "clear";
  if (!opts.accessToken || !opts.refreshToken) return "clear";
  return "keep";
}
