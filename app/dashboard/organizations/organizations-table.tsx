"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { UserOrganization } from "@auth0/universal-components-core"
import { OrganizationTable } from "@auth0/universal-components-react"

import { signInToOrganization } from "@/lib/sign-in-to-organization"

const ORGANIZATIONS_PATH = "/dashboard/organizations"
const SETTINGS_PATH = "/dashboard/organization/general"

interface OrganizationsTableProps {
  currentOrganizationId: string
  deleteConfirmationOrganizationId?: string
}

export function OrganizationsTable({
  currentOrganizationId,
  deleteConfirmationOrganizationId,
}: OrganizationsTableProps) {
  const router = useRouter()

  // Kept in state so the confirmation still opens after the URL is cleared, and
  // a refresh does not open it again.
  const [confirmDeleteId] = useState(deleteConfirmationOrganizationId)
  useEffect(() => {
    if (deleteConfirmationOrganizationId) router.replace(ORGANIZATIONS_PATH)
  }, [deleteConfirmationOrganizationId, router])

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
      deleteConfirmationOrganizationId={confirmDeleteId}
      deleteAction={{
        // Only the signed-in organization can be deleted, so sign in to this one
        // and come back here to confirm.
        onSwitchOrganization: (organization) => {
          const params = new URLSearchParams({ confirmDelete: organization.id })
          signInToOrganization(
            organization.id,
            `${ORGANIZATIONS_PATH}?${params}`
          )
        },
        // The session belonged to the deleted organization, so sign in again and
        // pick one of the remaining organizations.
        onAfter: () => {
          window.location.assign("/auth/login?returnTo=/dashboard")
          return true
        },
      }}
      onCreateOrganization={() => router.push(`${ORGANIZATIONS_PATH}/new`)}
    />
  )
}
