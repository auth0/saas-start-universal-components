import { NextResponse } from "next/server"
import { AuthorizationError } from "@auth0/nextjs-auth0/errors"
import { Auth0Client } from "@auth0/nextjs-auth0/server"
import { ManagementClient } from "auth0"

export const managementClient = new ManagementClient({
  domain: process.env.AUTH0_MANAGEMENT_API_DOMAIN,
  clientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
  clientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
})

export const onboardingClient = new Auth0Client({
  domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN,
  clientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
  clientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
  appBaseUrl: process.env.APP_BASE_URL,
  secret: process.env.SESSION_ENCRYPTION_SECRET,
  routes: {
    callback: "/onboarding/callback",
    login: "/onboarding/signup",
    logout: "/",
  },
  authorizationParameters: {
    screen_hint: "signup",
  },
})

const MY_ORG_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "read:my_org:details",
  "update:my_org:details",
  "delete:my_org:organizations",
  "create:my_org:identity_providers",
  "read:my_org:identity_providers",
  "update:my_org:identity_providers",
  "delete:my_org:identity_providers",
  "update:my_org:identity_providers_detach",
  "read:my_org:domains",
  "delete:my_org:domains",
  "create:my_org:domains",
  "update:my_org:domains",
  "create:my_org:identity_providers_domains",
  "delete:my_org:identity_providers_domains",
  "read:my_org:identity_providers_scim_tokens",
  "create:my_org:identity_providers_scim_tokens",
  "delete:my_org:identity_providers_scim_tokens",
  "create:my_org:identity_providers_provisioning",
  "update:my_org:identity_providers_provisioning",
  "read:my_org:identity_providers_provisioning",
  "delete:my_org:identity_providers_provisioning",
  "read:my_org:configuration",
  "read:my_org:user_stores",
  "read:my_org:member_invitations",
  "delete:my_org:member_invitations",
  "create:my_org:member_invitations",
  "read:my_org:member_roles",
  "delete:my_org:member_roles",
  "create:my_org:member_roles",
  "read:my_org:members",
  "delete:my_org:memberships",
]

const MY_ACCOUNT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "create:me:authentication_methods",
  "read:me:authentication_methods",
  "update:me:authentication_methods",
  "delete:me:authentication_methods",
  "read:me:factors",
  "read:me:organizations",
  "create:me:organizations",
]

export const appClient = new Auth0Client({
  domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  appBaseUrl: process.env.APP_BASE_URL,
  secret: process.env.SESSION_ENCRYPTION_SECRET,
  authorizationParameters: {
    audience: `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/my-org/`,
    scope: {
      [`https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/me/`]:
        MY_ACCOUNT_SCOPES.join(" "),
      [`https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/my-org/`]:
        MY_ORG_SCOPES.join(" "),
    },
  },
  httpTimeout: 20000, // 20 seconds
  async onCallback(error, ctx) {
    const appBaseUrl = ctx.appBaseUrl ?? process.env.APP_BASE_URL!

    if (!error) {
      return NextResponse.redirect(new URL(ctx.returnTo || "/", appBaseUrl))
    }

    // Declining the sign-in to another organization keeps the current session,
    // so go back to the page the user came from instead of showing the error.
    // Organization flows start from the organizations table, and the query is
    // dropped so the declined action does not run.
    if (
      error instanceof AuthorizationError &&
      error.cause?.code === "access_denied"
    ) {
      const returnTo = new URL(ctx.returnTo || "/", appBaseUrl)
      const path = returnTo.pathname.startsWith("/dashboard/organization")
        ? "/dashboard/organizations"
        : returnTo.pathname
      return NextResponse.redirect(new URL(path, appBaseUrl))
    }

    return new NextResponse(error.message, { status: 500 })
  },
  async beforeSessionSaved(session) {
    // For some reason is needed to delay the session persistance
    // and custom claim to have be stored within the session
    return { ...session }
  },
})
