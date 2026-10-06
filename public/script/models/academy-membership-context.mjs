const ALLOWED_ROLES = Object.freeze([
  "gym_admin",
  "professor",
  "aluno"
]);

const ALLOWED_STATUSES = Object.freeze([
  "pending",
  "active",
  "suspended",
  "ended"
]);

function isObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function isIdentifier(value) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes("/") &&
    value !== "." &&
    value !== "..";
}

export function normalizeAcademyMembershipContext(
  response,
  { academyId, userId } = {}
) {
  if (!isIdentifier(academyId) || !isIdentifier(userId)) {
    throw new Error("INVALID_MEMBERSHIP_CONTEXT");
  }

  if (
    !isObject(response) ||
    !Object.hasOwn(response, "membership")
  ) {
    throw new Error("INVALID_MEMBERSHIP_RESPONSE");
  }

  if (response.membership === null) {
    return null;
  }

  const membership = response.membership;

  if (!isObject(membership) || membership.schemaVersion !== 1) {
    throw new Error("INVALID_MEMBERSHIP_SCHEMA");
  }

  if (
    membership.academyId !== academyId ||
    membership.userId !== userId
  ) {
    throw new Error("MEMBERSHIP_CONTEXT_MISMATCH");
  }

  if (
    typeof membership.membershipId !== "string" ||
    !/^membership_[a-f0-9]{64}$/.test(membership.membershipId)
  ) {
    throw new Error("INVALID_MEMBERSHIP_ID");
  }

  const roles = membership.roles;

  if (
    !Array.isArray(roles) ||
    roles.length === 0 ||
    roles.length > ALLOWED_ROLES.length ||
    new Set(roles).size !== roles.length ||
    !roles.every((role) => ALLOWED_ROLES.includes(role))
  ) {
    throw new Error("INVALID_MEMBERSHIP_ROLES");
  }

  if (!ALLOWED_STATUSES.includes(membership.status)) {
    throw new Error("INVALID_MEMBERSHIP_STATUS");
  }

  const expectedCanManage =
    membership.status === "active" &&
    roles.includes("gym_admin");

  if (
    typeof membership.canManage !== "boolean" ||
    membership.canManage !== expectedCanManage
  ) {
    throw new Error("INVALID_MEMBERSHIP_PERMISSION");
  }

  return Object.freeze({
    membershipId: membership.membershipId,
    schemaVersion: 1,
    academyId,
    userId,
    roles: Object.freeze([...roles].sort()),
    status: membership.status,
    canManage: membership.canManage
  });
}