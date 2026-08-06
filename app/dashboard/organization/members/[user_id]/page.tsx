"use client"

import { useParams, useRouter } from "next/navigation"
import { OrganizationMemberDetail } from "@auth0/universal-components-react"

export default function MemberDetailPage() {
  const router = useRouter()
  const params = useParams()
  const user_id = decodeURIComponent(params.user_id as string)

  return (
    <div className="p-6 pt-8">
      <OrganizationMemberDetail
        userId={user_id}
        onBack={() => router.push("/dashboard/organization/members")}
      />
    </div>
  )
}
