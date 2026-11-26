import type { NextRequest } from "next/server"

import { appClient, onboardingClient } from "./lib/auth0" // Adjust path if your auth0 client is elsewhere

export async function middleware(request: NextRequest) {
  if (request.url.includes("/onboarding")) {
    return await onboardingClient.middleware(request)
  }

  const response = await appClient.middleware(request)

  // Vercel treats a middleware response with a Location header as a redirect and drops
  // its body, even when the status is not a redirect. The My Organization API sends
  // Location on 201 responses (such as starting an identity provider test), so remove
  // it from proxied responses that are not redirects to keep the body.
  if (
    request.nextUrl.pathname.startsWith("/my-org/") &&
    response.headers.has("location") &&
    (response.status < 300 || response.status >= 400)
  ) {
    response.headers.delete("location")
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|icon.png).*)",
  ],
}
