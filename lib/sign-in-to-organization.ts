/**
 * Signs in to another organization and comes back to `returnTo`.
 * Switching needs a new organization-scoped session, and auth routes need a full navigation.
 */
export function signInToOrganization(organizationId: string, returnTo: string) {
  const params = new URLSearchParams({ organization: organizationId, returnTo })
  window.location.assign(`/auth/login?${params.toString()}`)
}
