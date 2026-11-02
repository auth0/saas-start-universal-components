import { appClient } from "@/lib/auth0"

import { OrganizationsTable } from "./organizations-table"

export default async function OrganizationsPage() {
  const session = await appClient.getSession()

  return (
    <div className="border-border bg-field rounded-2xl border p-2 shadow-sm">
      <div className="mx-auto max-w-6xl">
        <OrganizationsTable currentOrganizationId={session!.user.org_id!} />
      </div>
    </div>
  )
}
