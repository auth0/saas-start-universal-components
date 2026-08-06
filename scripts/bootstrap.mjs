#!/usr/bin/env node
import {
  applyActionTriggerBindingsChanges,
  applyAddDefaultRoleActionChanges,
  applyAddRoleToTokensActionChanges,
  applySecurityPoliciesActionChanges,
} from "./utils/actions.mjs"
import { applyBrandingChanges } from "./utils/branding.mjs"
// Import apply functions
import {
  applyDashboardClientChanges,
  applyManagementClientChanges,
  applyManagementClientGrantChanges,
  applyMyAccountClientGrantChanges,
  applyMyOrgClientGrantChanges,
} from "./utils/clients.mjs"
import {
  applyConnectionProfileChanges,
  applyDatabaseConnectionChanges,
} from "./utils/connections.mjs"
import {
  buildChangePlan,
  discoverExistingResources,
  displayChangePlan,
} from "./utils/discovery.mjs"
import { writeEnvFile } from "./utils/env-writer.mjs"
import { confirmWithUser } from "./utils/helpers.mjs"
import { applyUserAttributeProfileChanges } from "./utils/profiles.mjs"
import {
  applyMyAccountResourceServerChanges,
  applyMyOrgResourceServerChanges,
  MYORG_API_SCOPES,
} from "./utils/resource-servers.mjs"
import {
  applyAdminRoleChanges,
  applyMemberRoleChanges,
} from "./utils/roles.mjs"
import {
  applyEmailTemplatesChanges,
  applyMFAFactorsChanges,
  applyPromptSettingsChanges,
  applyTenantSettingsChanges,
} from "./utils/tenant-config.mjs"
import {
  checkAuth0CLI,
  checkNodeVersion,
  validateAuth0Session,
  validateRequiredScopes,
  validateTenant,
} from "./utils/validation.mjs"

// ============================================================================
// Main Bootstrap Flow
// ============================================================================

async function main() {
  console.log("\n🚀 Auth0 B2B SaaS Starter - Bootstrap Script\n")

  // Parse command-line arguments
  const args = process.argv.slice(2)

  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: node scripts/bootstrap.mjs <tenant-domain>")
    console.log("\nArguments:")
    console.log(
      "  tenant-domain  Required. The Auth0 tenant domain to configure."
    )
    console.log("                 Must match your Auth0 CLI active tenant.")
    console.log("\nExample:")
    console.log("  node scripts/bootstrap.mjs my-tenant.us.auth0.com")
    console.log("\nPrerequisites:")
    console.log("  1. Login to Auth0 CLI: auth0 login")
    console.log("  2. Select your tenant: auth0 tenants use <tenant-domain>")
    console.log(
      "\nNote: Tenant name is required as a safety measure to prevent accidentally"
    )
    console.log("      configuring the wrong tenant.")
    process.exit(0)
  }

  const tenantName = args[0] // Required: tenant domain to verify against CLI

  // Step 1: Validation
  console.log("📋 Step 1: Pre-flight Checks")
  checkNodeVersion()
  await checkAuth0CLI()
  await validateAuth0Session()
  const domain = await validateTenant(tenantName)
  console.log("")

  // Feature: Full SaaStart Experience
  console.log("\n" + "=".repeat(80))
  console.log("Full SaaStart Experience")
  console.log(
    `Configuring both My Organization and My Account APIs for the complete SaaStart demo (organization management + user self-service MFA).`
  )
  console.log("=".repeat(80))
  console.log("")

  // Step 2: Discovery
  console.log("🔍 Step 2: Resource Discovery")
  const resources = await discoverExistingResources(domain)
  console.log("")

  // Step 3: Validate required scopes
  console.log("🔐 Step 3: Validating API Scopes")
  await validateRequiredScopes(resources, domain)
  console.log("")

  // Step 4: Build Change Plan (includes user prompts for actions)
  console.log("📝 Step 4: Analyzing Changes")
  const plan = await buildChangePlan(resources, domain)
  console.log("")

  // Step 5: Display Plan
  console.log("📝 Step 5: Display Plan")
  displayChangePlan(plan)

  // Check if there are any changes to apply
  const hasChanges = checkForChanges(plan)

  if (!hasChanges) {
    console.log(
      "✅ Bootstrap complete! Tenant is already properly configured.\n"
    )
    process.exit(0)
  }

  // Step 6: User Confirmation
  console.log("📝 Step 6: User Confirmation")
  const confirmed = await confirmWithUser(
    "Do you want to proceed with these changes? (yes/no): "
  )
  if (!confirmed) {
    console.log("\n❌ Bootstrap cancelled by user.\n")
    process.exit(0)
  }
  console.log("")

  // Step 7: Apply Changes
  console.log("⚙️  Step 7: Applying Changes\n")

  // 7a. Tenant Configuration
  console.log("Configuring Tenant...")
  await applyTenantSettingsChanges(plan.tenantConfig.settings)
  await applyPromptSettingsChanges(plan.tenantConfig.prompts)
  await applyEmailTemplatesChanges(plan.tenantConfig.emailTemplates)
  await applyMFAFactorsChanges(plan.tenantConfig.mfaFactors)
  console.log("")

  // 7b. Branding
  console.log("Configuring Branding...")
  await applyBrandingChanges(plan.branding)
  console.log("")

  // 7c. Profiles (needed for Dashboard Client)
  console.log("Configuring Profiles...")
  const connectionProfile = await applyConnectionProfileChanges(
    plan.connectionProfile
  )
  const userAttributeProfile = await applyUserAttributeProfileChanges(
    plan.userAttributeProfile
  )
  console.log("")

  // 7d. Management Client
  console.log("Configuring Management Client...")
  const managementClient = await applyManagementClientChanges(
    plan.clients.management
  )
  await applyManagementClientGrantChanges(
    plan.clientGrants.management,
    domain,
    managementClient.client_id
  )
  console.log("")

  // 7e. Dashboard Client (refresh-token policies + scopes for both APIs)
  console.log("Configuring Dashboard Client...")
  const dashboardClient = await applyDashboardClientChanges(
    plan.clients.dashboard,
    connectionProfile.id,
    userAttributeProfile.id,
    domain,
    MYORG_API_SCOPES,
    plan.myAccountApiScopes
  )
  console.log("")

  // 7f. Resource Servers
  console.log("Configuring My Organization API...")
  const myOrgResourceServer = await applyMyOrgResourceServerChanges(
    plan.resourceServer,
    domain
  )
  console.log("")

  console.log("Configuring My Account API...")
  await applyMyAccountResourceServerChanges(
    plan.myAccountResourceServer,
    domain
  )
  console.log("")

  // 7g. Grant API access to Dashboard Client
  console.log("Configuring Client Grants...")
  await applyMyOrgClientGrantChanges(
    plan.clientGrants.myOrg,
    domain,
    dashboardClient.client_id
  )
  await applyMyAccountClientGrantChanges(
    plan.clientGrants.myAccount,
    domain,
    dashboardClient.client_id
  )
  console.log("")

  // 7h. Database Connection
  console.log("Configuring Database Connection...")
  const connection = await applyDatabaseConnectionChanges(
    plan.connection,
    managementClient.client_id,
    dashboardClient.client_id
  )
  console.log("")

  // 7i. Roles
  console.log("Configuring Roles...")
  const adminRole = await applyAdminRoleChanges(plan.roles.admin)
  const memberRole = await applyMemberRoleChanges(plan.roles.member)
  console.log("")

  // 7j. Actions
  console.log("Configuring Actions...")
  const securityPoliciesAction = await applySecurityPoliciesActionChanges(
    plan.actions.securityPolicies,
    dashboardClient.client_id
  )
  const addDefaultRoleAction = await applyAddDefaultRoleActionChanges(
    plan.actions.addDefaultRole,
    domain,
    managementClient.client_id,
    managementClient.client_secret,
    memberRole.id
  )
  const addRoleToTokensAction = await applyAddRoleToTokensActionChanges(
    plan.actions.addRoleToTokens
  )
  console.log("")

  // 7k. Action Trigger Bindings
  console.log("Configuring Action Trigger Bindings...")
  await applyActionTriggerBindingsChanges(
    plan.actions.bindings,
    addDefaultRoleAction,
    addRoleToTokensAction,
    securityPoliciesAction
  )
  console.log("")

  // Step 8: Generate .env.local
  console.log("📝 Step 9: Generating .env.local file\n")
  await writeEnvFile(
    domain,
    managementClient.client_id,
    managementClient.client_secret,
    dashboardClient.client_id,
    dashboardClient.client_secret,
    myOrgResourceServer.identifier,
    adminRole.id,
    memberRole.id,
    connection.id
  )

  // Done!
  console.log("\n✅ Bootstrap complete!\n")
  console.log("Next steps:")
  console.log("  1. Review the generated .env.local file")
  console.log("  2. Run 'npm run dev' to start the development server")
  console.log("  3. Navigate to http://localhost:3000\n")
}

/**
 * Check if there are any changes to apply.
 * @param {object} plan - The change plan
 * @returns {boolean} True if there are changes to apply
 */
function checkForChanges(plan) {
  return (
    plan.clients.management.action !== "skip" ||
    plan.clients.dashboard.action !== "skip" ||
    plan.clientGrants.management.action !== "skip" ||
    plan.clientGrants.myOrg.action !== "skip" ||
    plan.clientGrants.myAccount.action !== "skip" ||
    plan.connection.action !== "skip" ||
    plan.connectionProfile.action !== "skip" ||
    plan.userAttributeProfile.action !== "skip" ||
    plan.resourceServer.action !== "skip" ||
    plan.myAccountResourceServer.action !== "skip" ||
    plan.roles.admin.action !== "skip" ||
    plan.roles.member.action !== "skip" ||
    plan.actions.securityPolicies.action !== "skip" ||
    plan.actions.addDefaultRole.action !== "skip" ||
    plan.actions.addRoleToTokens.action !== "skip" ||
    plan.actions.bindings.action !== "skip" ||
    plan.tenantConfig.settings.action !== "skip" ||
    plan.tenantConfig.prompts.action !== "skip" ||
    plan.tenantConfig.emailTemplates.action !== "skip" ||
    plan.tenantConfig.mfaFactors.action !== "skip" ||
    plan.branding.action !== "skip"
  )
}

// Run the main function
main().catch((error) => {
  console.error("\n❌ Bootstrap failed:", error.message)
  process.exit(1)
})
