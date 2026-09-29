import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { TodoList } from "@/components/dashboard/todo-list";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listTodoItems } from "@/server/services/todo-service";

export const metadata = { title: "Daftar Tugas Guru" };

export default async function GuruTodoPage() {
  const actor = await requireActor();
  await requirePermission(actor, "guru.class.manage");
  const { items } = await listTodoItems(actor);
  return <main className="space-y-6"><DashboardHero eyebrow="Tindakan Guru" title="Daftar Tugas Guru" description="Draf, jawaban yang belum dinilai, sesi yang belum difinalkan, dan nilai yang belum diterbitkan." /><TodoList items={items} /></main>;
}
