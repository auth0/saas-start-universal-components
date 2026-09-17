"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { OrganizationMemberDetail, OrganizationMemberDetailTab } from "@auth0/universal-components-react"

export default function MemberDetailPage() {
  const router = useRouter()
  const params = useParams()
  const user_id = decodeURIComponent(params.user_id as string)
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') as OrganizationMemberDetailTab;

  return (
    <div className="p-6 pt-8">
      <OrganizationMemberDetail
        userId={user_id}
        initialTab={tab}
        onBack={() => router.push("/dashboard/organization/members")}
      />
    </div>
  )
}
