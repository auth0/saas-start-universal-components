"use client"

import { OrganizationDetailsEdit } from "@auth0/universal-components-react"

import { PageHeader } from "@/components/page-header"

export default function GeneralSettings() {
  return (
    <div className="space-y-2">
      <PageHeader
        title="General Settings"
        description="Update your organization's general settings."
      />

      <OrganizationDetailsEdit
        hideHeader={true}
        deleteAction={{
          // The session belongs to the deleted organization, so sign out.
          onAfter: () => {
            window.location.assign("/auth/logout")
            return true
          },
        }}
      />
    </div>
  )
}
