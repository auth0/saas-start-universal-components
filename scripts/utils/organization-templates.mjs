import ora from "ora"

import { auth0ApiCall } from "./auth0-api.mjs"
import { ChangeAction, createChangeItem } from "./change-plan.mjs"

// Constants
// The Management API calls Organization Profiles "organization templates".
export const ORGANIZATION_PROFILE_NAME = "SaaStart-Org-Profile"
// Deleting an organization is only allowed when the caller is its only member.
export const ORGANIZATION_DELETION_BEHAVIOR = "allow_if_empty"

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
 * Describe how another default profile differs from what SaaStart needs.
 * It is never changed, so these are only reported.
 */
function describeOtherDefaultIssues(template) {
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
  return issues
}

/**
 * Check if the default Organization Profile needs to be created or has drifted.
 * The tenant's default profile applies to every organization that has no profile of its own,
 * and creating an organization from My Account needs one that assigns an admin role.
 * An ID that is not created yet counts as drift.
 * @param {Array|null} existingTemplates - Result of fetchOrganizationTemplates
 * @param {object} refs - IDs to link: connectionProfileId, userAttributeProfileId, adminRoleId
 */
export function checkOrganizationTemplateChanges(existingTemplates, refs) {
  const { connectionProfileId, userAttributeProfileId, adminRoleId } = refs

  if (existingTemplates === null) {
    return createChangeItem(ChangeAction.SKIP, {
      resource: "Organization Profile",
      name: ORGANIZATION_PROFILE_NAME,
      note: "Organization Profiles are unavailable on this tenant (they must be enabled, and the Auth0 CLI login needs the read/create/update:organization_templates scopes)",
    })
  }

  const existing = existingTemplates.find(
    (t) => t.name === ORGANIZATION_PROFILE_NAME
  )

  // Never replace a default profile the tenant already uses; only report on it.
  const otherDefault = existingTemplates.find(
    (t) => t.is_default && t.name !== ORGANIZATION_PROFILE_NAME
  )
  if (otherDefault && !existing?.is_default) {
    const issues = describeOtherDefaultIssues(otherDefault)
    return createChangeItem(ChangeAction.SKIP, {
      resource: "Organization Profile",
      name: ORGANIZATION_PROFILE_NAME,
      note: `"${otherDefault.name}" is already the default Organization Profile and was left unchanged${
        issues.length > 0 ? `, but ${issues.join(" and ")}` : ""
      }`,
    })
  }

  if (!existing) {
    return createChangeItem(ChangeAction.CREATE, {
      resource: "Organization Profile",
      name: ORGANIZATION_PROFILE_NAME,
    })
  }

  const updates = {}
  const changes = []

  if (!existing.is_default) {
    updates.makeDefault = true
    changes.push("Make it the default Organization Profile")
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

  if (changes.length === 0) {
    return createChangeItem(ChangeAction.SKIP, {
      resource: "Organization Profile",
      name: ORGANIZATION_PROFILE_NAME,
      existing,
    })
  }

  return createChangeItem(ChangeAction.UPDATE, {
    resource: "Organization Profile",
    name: ORGANIZATION_PROFILE_NAME,
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
    // Keep any roles that were added to the profile by hand.
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
  return patch
}

/**
 * Apply Organization Profile changes.
 * Failures are reported as warnings so the rest of the bootstrap still completes.
 * @param {object} changePlan - Change item from checkOrganizationTemplateChanges
 * @param {object} refs - IDs to link: connectionProfileId, userAttributeProfileId, adminRoleId
 * @returns {Promise<object|null>} The organization template, or null when unavailable
 */
export async function applyOrganizationTemplateChanges(changePlan, refs) {
  const { connectionProfileId, userAttributeProfileId, adminRoleId } = refs

  if (changePlan.action === ChangeAction.SKIP && !changePlan.existing) {
    const spinner = ora({ text: `Organization Profile` }).start()
    spinner.warn(`Skipped Organization Profile: ${changePlan.note}`)
    return null
  }

  if (changePlan.action === ChangeAction.SKIP) {
    const spinner = ora({ text: `Organization Profile is up to date` }).start()
    spinner.succeed()
    return changePlan.existing
  }

  const spinner = ora({
    text: `Configuring the default Organization Profile`,
  }).start()

  try {
    let template = changePlan.existing

    if (changePlan.action === ChangeAction.CREATE) {
      template = await auth0ApiCall("post", "organization-templates", {
        name: ORGANIZATION_PROFILE_NAME,
        is_default: true,
        organization_deletion_behavior: ORGANIZATION_DELETION_BEHAVIOR,
        enforce_permission_ceiling: false,
        enforce_self_assignment_restriction: false,
        connection_profile_id: connectionProfileId ?? null,
        user_attribute_profile_id: userAttributeProfileId ?? null,
        // Roles given to the user who creates an organization from My Account.
        admin_roles_assignment: adminRoleId ? [adminRoleId] : null,
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

    spinner.succeed(`Configured the default Organization Profile`)
    return template
  } catch (e) {
    spinner.warn(`Could not configure the Organization Profile: ${e.message}`)
    return null
  }
}
