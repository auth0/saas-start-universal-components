"use client"

import React from "react"
// import "@auth0/universal-components-react/styles"
import { Auth0ComponentProvider } from "@auth0/universal-components-react/rwa"
import { useTheme } from "next-themes"

interface ClientProviderProps {
  children: React.ReactNode
}

export function ClientProvider({ children }: ClientProviderProps) {
  const { resolvedTheme } = useTheme()
  return (
    <Auth0ComponentProvider
      mode="proxy"
      proxyConfig={{
        baseUrl: "/",
      }}
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN}
      themeSettings={{
        mode: resolvedTheme === "dark" ? "dark" : "light",
        theme: "default",
      }}
    >
      {children}
    </Auth0ComponentProvider>
  )
}
