import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { TodoList } from "@/components/dashboard/todo-list";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listTodoItems } from "@/server/services/todo-service";

export const metadata = { title: "Daftar Tugas Siswa" };

export default async function StudentTodoPage() {
  const actor = await requireActor();
  await requirePermission(actor, "siswa.todo.view");
  const { items } = await listTodoItems(actor);
  return <main className="space-y-6"><DashboardHero eyebrow="Tindakan Belajar" title="Daftar Tugas Saya" description="Tugas, revisi, dan ujian yang membutuhkan perhatian. Aktivitas yang sudah selesai tidak muncul lagi di daftar." /><TodoList items={items} /></main>;
}
