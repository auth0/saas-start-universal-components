import { AppRouterPageRoute } from "@auth0/nextjs-auth0/server"
import {
  UserMFAManagement,
  UserPasskeyManagement,
} from "@auth0/universal-components-react"

import { appClient } from "@/lib/auth0"
import { PageHeader } from "@/components/page-header"

export default appClient.withPageAuthRequired(
  async function Profile() {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Security"
          description="Manage your account's security settings."
        />

        <UserMFAManagement hideHeader />

        <UserPasskeyManagement />
      </div>
    )
  } as AppRouterPageRoute,
  { returnTo: "/dashboard/account/security" }
) as React.FC