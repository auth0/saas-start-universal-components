"use client"

import { useRouter } from "next/navigation"
import { OrganizationCreate } from "@auth0/universal-components-react"

import { signInToOrganization } from "@/lib/sign-in-to-organization"

export default function CreateOrganizationPage() {
  const router = useRouter()

  return (
    <div className="border-border bg-field rounded-2xl border p-2 shadow-sm">
      <div className="mx-auto max-w-6xl">
        <OrganizationCreate
          backButton={{
            onClick: () => router.push("/dashboard/organizations"),
          }}
          createAction={{
            // Open the new organization, which needs a session for it.
            onAfter: (_values, created) => {
              if (created) signInToOrganization(created.id, "/dashboard")
              return true
            },
          }}
        />
      </div>
    </div>
  )
}
