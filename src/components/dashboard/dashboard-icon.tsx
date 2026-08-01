import type { SVGProps } from "react";

export type DashboardIconName =
  | "audit"
  | "billing"
  | "classes"
  | "dashboard"
  | "exam"
  | "guardian"
  | "help"
  | "levels"
  | "lock"
  | "materials"
  | "presensi"
  | "profile"
  | "program"
  | "progress"
  | "registration"
  | "student"
  | "teacher"
  | "users";

const paths: Record<DashboardIconName, React.ReactNode> = {
  dashboard: <><path d="M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z" /></>,
  registration: <><path d="M7 3h10a2 2 0 0 1 2 2v16H5V5a2 2 0 0 1 2-2Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  student: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  guardian: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 15.5a4.5 4.5 0 0 1 6.5 4" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1 .8-1.7 1.2-1.7 2.7M12 17h.01" /></>,
  teacher: <><circle cx="8" cy="8" r="3" /><path d="M3 20a5 5 0 0 1 10 0M14 5h7v9h-5M17 9h2" /></>,
  program: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z" /></>,
  levels: <><path d="M4 18h16M6 18v-4h4v4M10 14V9h4v5M14 9V4h4v5" /></>,
  classes: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8 9h8M8 13h5" /></>,
  billing: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  users: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 15a4 4 0 0 1 6 3.5" /></>,
  audit: <><path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-3Z" /><path d="m9 12 2 2 4-5" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  materials: <><path d="M6 3h9l4 4v14H6V3Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  exam: <><path d="M7 3h10a2 2 0 0 1 2 2v16H5V5a2 2 0 0 1 2-2Z" /><path d="m8 9 1.5 1.5L12 8M14 9h2M8 15h8" /></>,
  presensi: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18m-13 5 2 2 5-5" /></>,
  progress: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
};

export function DashboardIcon({ name, ...props }: { name: DashboardIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
