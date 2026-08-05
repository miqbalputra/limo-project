import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { TodoList } from "@/components/dashboard/todo-list";
import { requireActor, requireRole } from "@/server/auth/session";
import { listTodoItems } from "@/server/services/todo-service";

export const metadata = { title: "To-do Siswa" };

export default async function StudentTodoPage() {
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { items } = await listTodoItems(actor);
  return <main className="space-y-6"><DashboardHero eyebrow="Tindakan Belajar" title="To-do Saya" description="Tugas, revisi, dan ujian yang membutuhkan perhatian. Aktivitas yang sudah selesai tidak muncul lagi di daftar." /><TodoList items={items} /></main>;
}
