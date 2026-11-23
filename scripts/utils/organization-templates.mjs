import ora from "ora"

import { auth0ApiCall } from "./auth0-api.mjs"
import { ChangeAction, createChangeItem } from "./change-plan.mjs"
import {
  MY_ORG_ALLOWED_STRATEGIES,
  MY_ORG_CONNECTION_DELETION_BEHAVIOR,
  MY_ORG_THIRD_PARTY_CLIENT_ACCESS,
  myOrgSharedSettings,
} from "./clients.mjs"

// Constants
export const ORGANIZATION_TEMPLATE_NAME = "SaaStart-Org-Template"
// Deleting an organization is only allowed when the caller is its only member.
export const ORGANIZATION_DELETION_BEHAVIOR = "allow_if_empty"
// New domains start off, and admins may switch discovery on or off.
export const ORGANIZATION_DISCOVERY_POLICY = {
  default_value: false,
  allowed_values: [true, false],
}

const sameValues = (a, b) =>
  JSON.stringify([...(a ?? [])].sort()) ===
  JSON.stringify([...(b ?? [])].sort())

/**
 * Whether a template's use_for_organization_discovery policy matches the one SaaStart needs.
 */
function discoveryPolicyMatches(policy) {
  if (
    !policy ||
    policy.default_value !== ORGANIZATION_DISCOVERY_POLICY.default_value
  ) {
    return false
  }
  return sameValues(
    policy.allowed_values,
    ORGANIZATION_DISCOVERY_POLICY.allowed_values
  )
}

/**
 * The My Organization settings on a template that differ from the dashboard client's.
 * A dashboard client ID that is undefined has not been created yet, so it counts as different.
 * @returns {string[]} Names of the fields that differ
 */
function myOrgSettingsDrift(template, dashboardClientId) {
  const drift = []
  if (
    template.connection_deletion_behavior !==
    MY_ORG_CONNECTION_DELETION_BEHAVIOR
  ) {
    drift.push("connection_deletion_behavior")
  }
  if (
    !template.allowed_strategies ||
    !sameValues(template.allowed_strategies, MY_ORG_ALLOWED_STRATEGIES)
  ) {
    drift.push("allowed_strategies")
  }
  if (
    !dashboardClientId ||
    template.invitation_landing_client_id !== dashboardClientId
  ) {
    drift.push("invitation_landing_client_id")
  }
  const access = template.third_party_client_access
  if (
    !access ||
    access.default_value !== MY_ORG_THIRD_PARTY_CLIENT_ACCESS.default_value ||
    !sameValues(
      access.allowed_values,
      MY_ORG_THIRD_PARTY_CLIENT_ACCESS.allowed_values
    )
  ) {
    drift.push("third_party_client_access")
  }
  return drift
}

/**
 * The Auth0 CLI can succeed while printing the API's error body, so treat one as an error.
 */
function throwIfApiError(response, fallbackMessage) {
  if (!response) throw new Error(fallbackMessage)
  if (response.statusCode && response.statusCode >= 400) {
    throw new Error(response.message || response.error || fallbackMessage)
  }
  return response
}

/**
 * Fetch the tenant's organization templates.
 * Returns null when they are unavailable (not enabled on the tenant, or a missing scope).
 */
export async function fetchOrganizationTemplates() {
  try {
    const response = await auth0ApiCall("get", "organization-templates")
    if (!response || response.statusCode) return null
    return Array.isArray(response)
      ? response
      : response.organization_templates || []
  } catch {
    return null
  }
}

// ============================================================================
// CHECK FUNCTIONS - Determine what changes are needed
// ============================================================================

/**
 * Describe how another default template differs from what SaaStart needs.
 * It is never changed, so these are only reported.
 */
function describeOtherDefaultIssues(template, dashboardClientId) {
  const issues = []
  if (!template.admin_roles_assignment?.length) {
    issues.push("it assigns no admin role (creating an organization needs one)")
  }
  if (
    template.organization_deletion_behavior !== ORGANIZATION_DELETION_BEHAVIOR
  ) {
    issues.push(
      `its organization_deletion_behavior is "${template.organization_deletion_behavior ?? "unset"}" rather than "${ORGANIZATION_DELETION_BEHAVIOR}"`
    )
  }
  if (!template.use_for_organization_discovery) {
    issues.push(
      "it sets no use_for_organization_discovery policy (the discovery controls stay hidden)"
    )
  } else if (!discoveryPolicyMatches(template.use_for_organization_discovery)) {
    issues.push(
      "its use_for_organization_discovery policy differs from SaaStart's (default false, both values allowed), so the discovery switches may be locked or start on"
    )
  }
  const drift = myOrgSettingsDrift(template, dashboardClientId)
  if (drift.length > 0) {
    issues.push(`its ${drift.join(", ")} differ from the dashboard client's`)
  }
  return issues
}

/**
 * Check if the default Organization Template needs to be created or has drifted.
 * The tenant's default template applies to every organization that has no template of its own,
 * and creating an organization from My Account needs one that assigns an admin role.
 * It also carries the My Organization settings shared with the dashboard client (connection
 * deletion behavior, allowed strategies, invitation landing client, third-party client access).
 * An ID that is not created yet counts as drift.
 * @param {Array|null} existingTemplates - Result of fetchOrganizationTemplates
 * @param {object} refs - IDs to link: connectionProfileId, userAttributeProfileId, adminRoleId, dashboardClientId
 */
export function checkOrganizationTemplateChanges(existingTemplates, refs) {
  const {
    connectionProfileId,
    userAttributeProfileId,
    adminRoleId,
    dashboardClientId,
  } = refs

  if (existingTemplates === null) {
    return createChangeItem(ChangeAction.SKIP, {
      resource: "Organization Template",
      name: ORGANIZATION_TEMPLATE_NAME,
      note: "Organization Templates are unavailable on this tenant (they must be enabled, and the Auth0 CLI login needs the read/create/update:organization_templates scopes)",
    })
  }

  const existing = existingTemplates.find(
    (t) => t.name === ORGANIZATION_TEMPLATE_NAME
  )

  // Never replace a default template the tenant already uses; only report on it.
  const otherDefault = existingTemplates.find(
    (t) => t.is_default && t.name !== ORGANIZATION_TEMPLATE_NAME
  )
  if (otherDefault && !existing?.is_default) {
    const issues = describeOtherDefaultIssues(otherDefault, dashboardClientId)
    return createChangeItem(ChangeAction.SKIP, {
      resource: "Organization Template",
      name: ORGANIZATION_TEMPLATE_NAME,
      note: `"${otherDefault.name}" is already the default Organization Template and was left unchanged${
        issues.length > 0 ? `, but ${issues.join(" and ")}` : ""
      }`,
    })
  }

  if (!existing) {
    return createChangeItem(ChangeAction.CREATE, {
      resource: "Organization Template",
      name: ORGANIZATION_TEMPLATE_NAME,
    })
  }

  const updates = {}
  const changes = []

  if (!existing.is_default) {
    updates.makeDefault = true
    changes.push("Make it the default Organization Template")
  }
  if (
    existing.organization_deletion_behavior !== ORGANIZATION_DELETION_BEHAVIOR
  ) {
    updates.deletionBehavior = true
    changes.push(
      `Set organization_deletion_behavior to "${ORGANIZATION_DELETION_BEHAVIOR}" (currently "${existing.organization_deletion_behavior ?? "unset"}")`
    )
  }
  if (!adminRoleId || !existing.admin_roles_assignment?.includes(adminRoleId)) {
    updates.adminRole = true
    changes.push("Assign the admin role")
  }
  if (
    !connectionProfileId ||
    existing.connection_profile_id !== connectionProfileId
  ) {
    updates.connectionProfile = true
    changes.push("Link the connection profile")
  }
  if (
    !userAttributeProfileId ||
    existing.user_attribute_profile_id !== userAttributeProfileId
  ) {
    updates.userAttributeProfile = true
    changes.push("Link the user attribute profile")
  }
  const myOrgDrift = myOrgSettingsDrift(existing, dashboardClientId)
  if (myOrgDrift.length > 0) {
    updates.myOrgSettings = true
    changes.push(`Set ${myOrgDrift.join(", ")} to match the dashboard client`)
  }
  if (!discoveryPolicyMatches(existing.use_for_organization_discovery)) {
    updates.discovery = true
    changes.push("Set the use_for_organization_discovery policy")
  }

  if (changes.length === 0) {
    return createChangeItem(ChangeAction.SKIP, {
      resource: "Organization Template",
      name: ORGANIZATION_TEMPLATE_NAME,
      existing,
    })
  }

  return createChangeItem(ChangeAction.UPDATE, {
    resource: "Organization Template",
    name: ORGANIZATION_TEMPLATE_NAME,
    existing,
    updates: { ...updates, changes },
    summary: changes.join(", "),
  })
}

// ============================================================================
// APPLY FUNCTIONS - Execute changes based on cached plan
// ============================================================================

/**
 * Build the PATCH body that fixes the drift found by checkOrganizationTemplateChanges.
 */
function buildTemplatePatch(updates, existing, refs) {
  const patch = {}
  if (updates.makeDefault) patch.is_default = true
  if (updates.deletionBehavior) {
    patch.organization_deletion_behavior = ORGANIZATION_DELETION_BEHAVIOR
  }
  if (updates.adminRole && refs.adminRoleId) {
    // Keep any roles that were added to the template by hand.
    patch.admin_roles_assignment = [
      ...new Set([
        ...(existing.admin_roles_assignment ?? []),
        refs.adminRoleId,
      ]),
    ]
  }
  if (updates.connectionProfile && refs.connectionProfileId) {
    patch.connection_profile_id = refs.connectionProfileId
  }
  if (updates.userAttributeProfile && refs.userAttributeProfileId) {
    patch.user_attribute_profile_id = refs.userAttributeProfileId
  }
  if (updates.myOrgSettings) {
    Object.assign(patch, myOrgSharedSettings(refs.dashboardClientId))
  }
  return patch
}

/**
 * Set the discovery policy in its own request, so a tenant that rejects the field still gets the
 * rest of the template. A failure only warns.
 * @returns {Promise<object|null>} The updated organization template, or null when it couldn't be set
 */
async function applyDiscoveryPolicy(templateId) {
  const spinner = ora({
    text: `Setting the organization discovery policy`,
  }).start()
  try {
    const updated = throwIfApiError(
      await auth0ApiCall("patch", `organization-templates/${templateId}`, {
        use_for_organization_discovery: ORGANIZATION_DISCOVERY_POLICY,
      }),
      "the tenant didn't accept the policy (missing scope or field)"
    )
    spinner.succeed(`Set the organization discovery policy`)
    return updated
  } catch (e) {
    spinner.warn(
      `Could not set the organization discovery policy: ${e.message}`
    )
    return null
  }
}

/**
 * Apply Organization Template changes.
 * Failures are reported as warnings so the rest of the bootstrap still completes.
 * @param {object} changePlan - Change item from checkOrganizationTemplateChanges
 * @param {object} refs - IDs to link: connectionProfileId, userAttributeProfileId, adminRoleId, dashboardClientId
 * @returns {Promise<object|null>} The organization template, or null when unavailable
 */
export async function applyOrganizationTemplateChanges(changePlan, refs) {
  const {
    connectionProfileId,
    userAttributeProfileId,
    adminRoleId,
    dashboardClientId,
  } = refs

  if (changePlan.action === ChangeAction.SKIP && !changePlan.existing) {
    const spinner = ora({ text: `Organization Template` }).start()
    spinner.warn(`Skipped Organization Template: ${changePlan.note}`)
    return null
  }

  if (changePlan.action === ChangeAction.SKIP) {
    const spinner = ora({ text: `Organization Template is up to date` }).start()
    spinner.succeed()
    return changePlan.existing
  }

  const spinner = ora({
    text: `Configuring the default Organization Template`,
  }).start()

  try {
    let template = changePlan.existing

    if (changePlan.action === ChangeAction.CREATE) {
      template = await auth0ApiCall("post", "organization-templates", {
        name: ORGANIZATION_TEMPLATE_NAME,
        is_default: true,
        organization_deletion_behavior: ORGANIZATION_DELETION_BEHAVIOR,
        enforce_permission_ceiling: false,
        enforce_self_assignment_restriction: false,
        connection_profile_id: connectionProfileId ?? null,
        user_attribute_profile_id: userAttributeProfileId ?? null,
        // Roles given to the user who creates an organization from My Account.
        admin_roles_assignment: adminRoleId ? [adminRoleId] : null,
        // The same My Organization settings as the dashboard client, which already exists here.
        ...myOrgSharedSettings(dashboardClientId),
      })
      throwIfApiError(template, "Missing scope create:organization_templates")
    } else if (changePlan.action === ChangeAction.UPDATE) {
      const patch = buildTemplatePatch(changePlan.updates, template, refs)
      if (Object.keys(patch).length > 0) {
        template = await auth0ApiCall(
          "patch",
          `organization-templates/${template.id}`,
          patch
        )
        throwIfApiError(template, "Missing scope update:organization_templates")
      }
    }

    spinner.succeed(`Configured the default Organization Template`)

    if (
      changePlan.action === ChangeAction.CREATE ||
      changePlan.updates?.discovery
    ) {
      // Keep the template's own fields (such as its id) even if the response is partial
      template = { ...template, ...(await applyDiscoveryPolicy(template.id)) }
    }
    return template
  } catch (e) {
    spinner.warn(`Could not configure the Organization Template: ${e.message}`)
    return null
  }
}
