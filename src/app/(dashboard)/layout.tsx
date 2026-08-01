import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/server/auth/session";
import { getNavigationForRole } from "@/components/dashboard/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { listDashboardNotifications } from "@/server/services/notification-service";
import { getSelectedWaliStudentId, listWaliSelectorChildren } from "@/server/dal/wali-selector-dal";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const actor = await getCurrentActor();

  if (!actor) {
    redirect("/login");
  }

  const navigation = getNavigationForRole(actor.role);
  const notifications = await listDashboardNotifications(actor);
  const waliChildren = actor.role === "WALI" ? await listWaliSelectorChildren(actor) : undefined;
  const selectedWaliChildId = actor.role === "WALI" ? await getSelectedWaliStudentId(actor) : null;

  return <DashboardShell actor={actor} navigation={navigation} notifications={notifications} waliChildren={waliChildren} selectedWaliChildId={selectedWaliChildId}>{children}</DashboardShell>;
}
