import { NextResponse } from "next/server"

import { appClient } from "@/lib/auth0"

// The auth proxy in @auth0/nextjs-auth0 forwards `/my-org/<path>` but not the bare `/my-org`,
// which is where deleting the organization lives, so forward it here with the session's
// My Organization access token.
export async function DELETE() {
  const domain = `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}`
  const { token } = await appClient.getAccessToken({
    audience: `${domain}/my-org/`,
    scope: "delete:my_org:organizations",
  })

  const response = await fetch(`${domain}/my-org`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })

  return new NextResponse(
    response.status === 204 ? null : await response.text(),
    {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      },
    }
  )
}
