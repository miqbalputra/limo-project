import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/server/auth/session";
import { getNavigationForActor } from "@/components/dashboard/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { listDashboardNotifications, syncGuruPendingNotifications } from "@/server/services/notification-service";
import { listWaliSelectorChildren } from "@/server/dal/wali-selector-dal";

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

  const navigation = await getNavigationForActor(actor);
  if (actor.role === "GURU") {
    await syncGuruPendingNotifications(actor);
  }
  const notifications = await listDashboardNotifications(actor);
  const waliChildren = actor.role === "WALI" ? await listWaliSelectorChildren(actor) : undefined;

  return <DashboardShell actor={actor} navigation={navigation} notifications={notifications} waliChildren={waliChildren}>{children}</DashboardShell>;
}
