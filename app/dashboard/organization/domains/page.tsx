"use client"

import { DomainTable } from "@auth0/universal-components-react"

export default function Domains() {
  return (
    <div className="space-y-2 p-6">
      <DomainTable
        customMessages={{
          domain_table: {
            header: {
              title: "Domains",
              description: "Configure Domains for your organization.",
              create_button_text: "Add new Domain",
            }
          }
        }}
      />
    </div>
  )
}
