import "server-only";

import { getEnv } from "@/server/env";
import { NotFoundError } from "@/server/errors/application-error";

export type FeatureFlagKey =
  | "studentPortalEnabled"
  | "learningModulesEnabled"
  | "assignmentsEnabled"
  | "gradebookEnabled"
  | "classDiscussionEnabled"
  | "periodicReportsEnabled"
  | "guardianAssistedSubmissionEnabled";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

const developmentDefaults: FeatureFlags = {
  studentPortalEnabled: true,
  learningModulesEnabled: true,
  assignmentsEnabled: true,
  gradebookEnabled: true,
  classDiscussionEnabled: true,
  periodicReportsEnabled: true,
  guardianAssistedSubmissionEnabled: false,
};

const productionDefaults: FeatureFlags = {
  studentPortalEnabled: false,
  learningModulesEnabled: false,
  assignmentsEnabled: false,
  gradebookEnabled: false,
  classDiscussionEnabled: false,
  periodicReportsEnabled: false,
  guardianAssistedSubmissionEnabled: false,
};

export function getFeatureFlags(): FeatureFlags {
  const env = getEnv();
  const defaults = env.NODE_ENV === "production" ? productionDefaults : developmentDefaults;

  return {
    studentPortalEnabled: env.STUDENT_PORTAL_ENABLED ?? defaults.studentPortalEnabled,
    learningModulesEnabled: env.LEARNING_MODULES_ENABLED ?? defaults.learningModulesEnabled,
    assignmentsEnabled: env.ASSIGNMENTS_ENABLED ?? defaults.assignmentsEnabled,
    gradebookEnabled: env.GRADEBOOK_ENABLED ?? defaults.gradebookEnabled,
    classDiscussionEnabled: env.CLASS_DISCUSSION_ENABLED ?? defaults.classDiscussionEnabled,
    periodicReportsEnabled: env.PERIODIC_REPORTS_ENABLED ?? defaults.periodicReportsEnabled,
    guardianAssistedSubmissionEnabled: env.GUARDIAN_ASSISTED_SUBMISSION_ENABLED ?? defaults.guardianAssistedSubmissionEnabled,
  };
}

export function isFeatureEnabled(flag: FeatureFlagKey) {
  return getFeatureFlags()[flag];
}

export function requireFeature(flag: FeatureFlagKey, message = "Fitur belum diaktifkan") {
  if (!isFeatureEnabled(flag)) {
    throw new NotFoundError(message);
  }
}
