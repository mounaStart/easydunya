/** Les invites système (GPS puis notifications) ne se chevauchent pas. */
export const LOCATION_PROMPT_SETTLED = "ed-location-prompt-settled";

export function signalLocationPromptSettled(): void {
  window.dispatchEvent(new CustomEvent(LOCATION_PROMPT_SETTLED));
}

export function onLocationPromptSettled(handler: () => void): () => void {
  window.addEventListener(LOCATION_PROMPT_SETTLED, handler);
  return () => window.removeEventListener(LOCATION_PROMPT_SETTLED, handler);
}
