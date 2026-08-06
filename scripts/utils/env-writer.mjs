import { existsSync, readFileSync, writeFileSync } from "fs"
import ora from "ora"

import { CUSTOM_CLAIMS_NAMESPACE } from "./actions.mjs"

/**
 * Write .env.local file with all required environment variables
 * Merges with .env.local.user if it exists
 */
export async function writeEnvFile(
  domain,
  managementClientId,
  managementClientSecret,
  dashboardClientId,
  dashboardClientSecret,
  myOrgResourceServerId,
  adminRoleId,
  memberRoleId,
  connectionId
) {
  const spinner = ora({
    text: `Writing .env.local file`,
  }).start()

  try {
    // Build bootstrap-managed configuration
    const envContent = `# Auth0 Configuration (managed by bootstrap script)
SESSION_ENCRYPTION_SECRET='${generateRandomSecret()}'
APP_BASE_URL='http://localhost:3000'
NEXT_PUBLIC_AUTH0_DOMAIN='${domain}'
AUTH0_CLIENT_ID='${dashboardClientId}'
AUTH0_CLIENT_SECRET='${dashboardClientSecret}'

# Management API Configuration
AUTH0_MANAGEMENT_CLIENT_ID='${managementClientId}'
AUTH0_MANAGEMENT_CLIENT_SECRET='${managementClientSecret}'
AUTH0_MANAGEMENT_API_DOMAIN='${domain}'

# My Organization API Configuration
AUTH0_MYORG_RESOURCE_SERVER_ID='${myOrgResourceServerId}'

# Roles
AUTH0_ADMIN_ROLE_ID='${adminRoleId}'
AUTH0_MEMBER_ROLE_ID='${memberRoleId}'

# Database Connection Configuration
DEFAULT_CONNECTION_ID='${connectionId}'

# The namespace used to prefix custom claims (e.g., https://example.com)
CUSTOM_CLAIMS_NAMESPACE='${CUSTOM_CLAIMS_NAMESPACE}'
`

    // Check if .env.local.user exists and merge it
    let finalContent = envContent
    if (existsSync(".env.local.user")) {
      const userEnvContent = readFileSync(".env.local.user", "utf8")
      finalContent = `${envContent}
# User-specific configuration (from .env.local.user)
${userEnvContent}
`
      spinner.text = "Writing .env.local file (merged with .env.local.user)"
    }

    writeFileSync(".env.local", finalContent)
    spinner.succeed()
  } catch (e) {
    spinner.fail(`Failed to write .env.local file`)
    throw e
  }
}

/**
 * Generate a random secret for AUTH0_SECRET
 */
function generateRandomSecret() {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0")
  ).join("")
}
