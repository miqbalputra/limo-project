import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { TodoList } from "@/components/dashboard/todo-list";
import { requireActor, requireRole } from "@/server/auth/session";
import { listTodoItems } from "@/server/services/todo-service";

export const metadata = { title: "Daftar Tugas Anak" };

export default async function WaliTodoPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { items } = await listTodoItems(actor);
  return <main className="space-y-6"><DashboardHero eyebrow="Pendampingan Anak" title="Daftar Tugas Anak" description="Tugas, revisi, ujian, dan jadwal terdekat yang perlu diperhatikan untuk semua anak yang terhubung." /><TodoList items={items} /></main>;
}
