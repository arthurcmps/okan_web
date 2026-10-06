import {
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

import { auth, functions } from "../firebase.js";

import {
  normalizeAcademyMembershipContext
} from "../models/academy-membership-context.mjs";

const getMembershipContextCallable =
  httpsCallable(functions, "getAcademyMembershipContext");

export async function getAcademyMembershipContext({ academyId } = {}) {
  if (
    typeof academyId !== "string" ||
    academyId.length === 0 ||
    academyId.trim() !== academyId ||
    academyId.includes("/") ||
    academyId === "." ||
    academyId === ".."
  ) {
    throw new Error("INVALID_ACADEMY_ID");
  }

  const userId = auth.currentUser?.uid;

  if (!userId) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }

  const response = await getMembershipContextCallable({
    academyId
  });

  // Descarta respostas iniciadas antes de logout ou troca de conta.
  if (auth.currentUser?.uid !== userId) {
    throw new Error("AUTHENTICATION_CHANGED");
  }

  return normalizeAcademyMembershipContext(response.data, {
    academyId,
    userId
  });
}