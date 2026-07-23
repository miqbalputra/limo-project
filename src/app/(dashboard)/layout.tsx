import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/server/auth/session";
import { getNavigationForRole } from "@/components/dashboard/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

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

  return <DashboardShell actor={actor} navigation={navigation}>{children}</DashboardShell>;
}
