export type AuthenticationSource = "LOCAL" | "GOOGLE" | "WORKSPACE_SSO";

export function requiresApplicationPasswordChange(
  authenticationSource: AuthenticationSource,
  mustChangePassword: boolean,
) {
  return authenticationSource === "LOCAL" && mustChangePassword;
}
