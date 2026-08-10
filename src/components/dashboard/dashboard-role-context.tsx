"use client";

import { createContext, useContext, type ReactNode } from "react";

export type DashboardRole = "ADMIN" | "GURU" | "WALI" | "SISWA";

type DashboardRoleContextValue = {
  role: DashboardRole;
  homeHref: "/admin" | "/guru" | "/wali" | "/siswa";
};

const dashboardHomeHrefByRole: Record<DashboardRole, DashboardRoleContextValue["homeHref"]> = {
  ADMIN: "/admin",
  GURU: "/guru",
  WALI: "/wali",
  SISWA: "/siswa",
};

const dashboardRoleLabels: Record<DashboardRole, string> = {
  ADMIN: "Admin",
  GURU: "Guru",
  WALI: "Wali",
  SISWA: "Siswa",
};

const DashboardRoleContext = createContext<DashboardRoleContextValue | null>(null);

function toDashboardRole(role: string): DashboardRole | null {
  switch (role) {
    case "ADMIN":
    case "GURU":
    case "WALI":
    case "SISWA":
      return role;
    default:
      return null;
  }
}

export function DashboardRoleProvider({ role, children }: { role: string; children: ReactNode }) {
  const dashboardRole = toDashboardRole(role);
  // This only provides display and recovery metadata; server routes retain authorization checks.
  const value = dashboardRole ? { role: dashboardRole, homeHref: dashboardHomeHrefByRole[dashboardRole] } : null;

  return <DashboardRoleContext.Provider value={value}>{children}</DashboardRoleContext.Provider>;
}

export function useDashboardRole() {
  return useContext(DashboardRoleContext);
}

export function getDashboardRoleLabel(role: DashboardRole) {
  return dashboardRoleLabels[role];
}
