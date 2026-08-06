import { User } from "@auth0/nextjs-auth0/types"

const ROLES_CLAIM_KEY = `${process.env.CUSTOM_CLAIMS_NAMESPACE}/roles`

export const roles = {
  member: process.env.AUTH0_MEMBER_ROLE_ID,
  admin: process.env.AUTH0_ADMIN_ROLE_ID,
}

export type Role = keyof typeof roles

export function getRole(user: User) {
  const userRoles = user[ROLES_CLAIM_KEY] as string[] | undefined

  // if user has admin role, return admin (takes precedence)
  if (userRoles?.includes("admin")) {
    return "admin"
  }

  // if no role is assigned, set them to the default member role
  return userRoles?.[0] ?? "member"
}
