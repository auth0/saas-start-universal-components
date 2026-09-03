"use client"

import { useRouter } from "next/navigation"
import { OrganizationMemberManagement } from "@auth0/universal-components-react"

export default function Members() {
  const router = useRouter()
  return (
    <div className="space-y-2 p-6">
      <OrganizationMemberManagement
        viewMemberDetailsAction={{
          onAfter: ({ userId, tab }) => {
            router.push(`/dashboard/organization/members/${userId}${tab ? `?tab=${tab}` : ''}`);
          },
        }}
      />
    </div>
  )
}
