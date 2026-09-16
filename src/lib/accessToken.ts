let token: string | undefined;

export function rememberAccessToken(value: string | undefined): void {
  token = value || undefined;
}

export function currentAccessToken(): string | undefined {
  return token;
}
