"use client"

import { useRouter } from "next/navigation"
import type { UserOrganization } from "@auth0/universal-components-core"
import { OrganizationTable } from "@auth0/universal-components-react"

import { signInToOrganization } from "@/lib/sign-in-to-organization"

const SETTINGS_PATH = "/dashboard/organization/general"

interface OrganizationsTableProps {
  currentOrganizationId: string
}

export function OrganizationsTable({
  currentOrganizationId,
}: OrganizationsTableProps) {
  const router = useRouter()

  // Editing lives in the settings of the signed-in organization, so another
  // organization is opened by signing in to it first.
  const openSettings = (organization: UserOrganization) => {
    if (organization.id === currentOrganizationId) {
      router.push(SETTINGS_PATH)
    } else {
      signInToOrganization(organization.id, SETTINGS_PATH)
    }
  }

  return (
    <OrganizationTable
      onEditOrganization={openSettings}
      currentOrganizationId={currentOrganizationId}
      deleteAction={{
        // The session belonged to the deleted organization, so sign in again and
        // pick one of the remaining organizations.
        onAfter: () => {
          window.location.assign("/auth/login?returnTo=/dashboard")
          return true
        },
      }}
      onCreateOrganization={() => router.push("/dashboard/organizations/new")}
    />
  )
}
