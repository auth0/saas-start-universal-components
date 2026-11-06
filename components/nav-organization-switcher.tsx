"use client"

import { useRouter } from "next/navigation"
import { OrganizationSwitcher } from "@auth0/universal-components-react"

import { signInToOrganization } from "@/lib/sign-in-to-organization"

interface NavOrganizationSwitcherProps {
  currentOrganizationId: string
  currentOrganizationName?: string
}

export function NavOrganizationSwitcher({
  currentOrganizationId,
  currentOrganizationName,
}: NavOrganizationSwitcherProps) {
  const router = useRouter()

  return (
    <div className="w-64">
      <OrganizationSwitcher
        currentOrganizationId={currentOrganizationId}
        currentOrganizationName={currentOrganizationName}
        onSwitchOrganization={(organization) =>
          signInToOrganization(organization.id, "/dashboard")
        }
        onCreateOrganization={() => router.push("/dashboard/organizations/new")}
      />
    </div>
  )
}
