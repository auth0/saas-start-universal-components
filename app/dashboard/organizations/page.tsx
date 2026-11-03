import { appClient } from "@/lib/auth0"

import { OrganizationsTable } from "./organizations-table"

interface OrganizationsPageProps {
  searchParams: Promise<{ confirmDelete?: string }>
}

export default async function OrganizationsPage({
  searchParams,
}: OrganizationsPageProps) {
  const session = await appClient.getSession()
  const { confirmDelete } = await searchParams

  return (
    <div className="border-border bg-field rounded-2xl border p-2 shadow-sm">
      <div className="mx-auto max-w-6xl">
        <OrganizationsTable
          currentOrganizationId={session!.user.org_id!}
          deleteConfirmationOrganizationId={confirmDelete}
        />
      </div>
    </div>
  )
}
