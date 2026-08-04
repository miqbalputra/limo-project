"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import type { NavigationItem } from "@/components/dashboard/navigation";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { WaliChildSelector } from "@/components/dashboard/wali-child-selector";

type DashboardShellProps = {
  actor: {
    name: string;
    email: string;
    role: string;
  };
  navigation: NavigationItem[];
  notifications: {
    unreadCount: number;
    items: {
      id: string;
      subject: string | null;
      body: string;
      status: string;
      template: string;
      createdAt: string;
      readAt: string | null;
    }[];
  };
  waliChildren?: { id: string; name: string; nomorInduk: string }[];
  selectedWaliChildId?: string | null;
  children: ReactNode;
};

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h16" /></svg>
  );
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
}

export function DashboardShell({ actor, navigation, notifications, waliChildren, selectedWaliChildId, children }: DashboardShellProps) {
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [localReadNotificationIds, setLocalReadNotificationIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const homeHref = navigation[0]?.href || "/admin";
  const activeItem = [...navigation]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || (item.href !== homeHref && pathname.startsWith(`${item.href}/`))) ?? navigation[0];
  const sections = navigation.reduce<Record<string, NavigationItem[]>>((result, item) => {
    (result[item.section] ||= []).push(item);
    return result;
  }, {});
  const searchResults = search.trim()
    ? navigation.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 6)
    : [];
  const profileHref = navigation.find((item) => item.label === "Profil")?.href;
  const locallyRead = new Set(localReadNotificationIds);
  const unreadCount = Math.max(0, notifications.unreadCount - localReadNotificationIds.length);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        window.requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
      }

      if (event.key === "Escape") {
        setIsSidebarOpen(false);
        setIsNotificationOpen(false);
        setIsProfileOpen(false);
        setSearch("");
      }
    }

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  async function markNotificationRead(id: string) {
    const item = notifications.items.find((notification) => notification.id === id);
    if (!item || item.readAt || locallyRead.has(id)) {
      return;
    }

    const response = await fetch(`/api/v1/notifications/${id}/read`, { method: "POST" });
    if (response.ok) {
      setLocalReadNotificationIds((current) => [...current, id]);
    }
  }

  function toggleSidebar() {
    if (window.innerWidth >= 1024) {
      setIsSidebarCollapsed((collapsed) => !collapsed);
    } else {
      setIsSidebarOpen((open) => !open);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <a href="#dashboard-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-gray-900 focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white">Lewati ke konten utama</a>
      {isSidebarOpen ? (
        <button type="button" aria-label="Tutup navigasi" className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-[1px] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      ) : null}

      <aside
        id="dashboard-sidebar"
        className={`fixed left-0 top-0 z-50 flex h-screen w-[290px] flex-col border-r border-gray-200 bg-white transition-all duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${isSidebarCollapsed ? "lg:w-[90px]" : "lg:w-[290px]"}`}
      >
        <div className={`flex h-20 shrink-0 items-center border-b border-gray-100 ${isSidebarCollapsed ? "justify-center px-3" : "justify-between px-5"}`}>
          <Link href={homeHref} className="flex min-w-0 items-center gap-3" onClick={() => setIsSidebarOpen(false)}>
            <Image src="/logo.jpg" width={40} height={40} alt="LIMO" className="size-10 shrink-0 rounded-xl border border-gray-200 bg-white object-contain shadow-theme-xs" priority />
            {!isSidebarCollapsed ? (
              <span className="min-w-0">
                <span className="block text-lg font-bold leading-5 text-gray-900">LIMO</span>
                <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Language Club</span>
              </span>
            ) : null}
          </Link>
          {!isSidebarCollapsed ? (
            <button type="button" aria-label="Tutup menu" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden" onClick={() => setIsSidebarOpen(false)}><MenuIcon open /></button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <nav className="space-y-6" aria-label="Navigasi dashboard">
            {Object.entries(sections).map(([section, items]) => (
              <div key={section}>
                <p className={`mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 ${isSidebarCollapsed ? "lg:text-center lg:text-[0]" : ""}`}>
                  {isSidebarCollapsed ? <span className="inline-block text-base leading-none text-gray-300">...</span> : section}
                </p>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const isActive = activeItem?.href === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          title={isSidebarCollapsed ? item.label : undefined}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 text-theme-sm font-medium transition-colors ${
                            isSidebarCollapsed ? "lg:justify-center" : ""
                          } ${isActive ? "bg-brand-50 text-brand-600" : "text-gray-700 hover:bg-gray-100"}`}
                        >
                          <DashboardIcon name={item.icon} className={`size-5 shrink-0 ${isActive ? "text-brand-500" : "text-gray-500 group-hover:text-gray-700"}`} />
                          {!isSidebarCollapsed ? <span className="truncate">{item.label}</span> : <span className="lg:hidden">{item.label}</span>}
                          {isActive && !isSidebarCollapsed ? <span className="ml-auto size-1.5 rounded-full bg-brand-500" /> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {!isSidebarCollapsed ? (
          <div className="m-4 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100">
            <p className="text-theme-xs font-semibold text-gray-700">LIMO System</p>
            <p className="mt-1 text-[11px] leading-4 text-gray-500">English & Arabic learning management.</p>
            <span className="mt-3 inline-flex rounded-full bg-success-50 px-2.5 py-1 text-[10px] font-semibold text-success-700">Data aman & tersimpan</span>
          </div>
        ) : null}
      </aside>

      <div className={`transition-[padding] duration-300 ${isSidebarCollapsed ? "lg:pl-[90px]" : "lg:pl-[290px]"}`}>
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-xl">
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:min-h-[72px] lg:px-8">
            <button type="button" aria-label="Toggle sidebar" aria-expanded={isSidebarOpen || isSidebarCollapsed} aria-controls="dashboard-sidebar" className="grid size-11 shrink-0 place-items-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-theme-xs hover:bg-gray-50" onClick={toggleSidebar}>
              <MenuIcon open={isSidebarOpen} />
            </button>

            <div className="relative hidden w-full max-w-[430px] lg:block">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon /></span>
              <input
                ref={searchRef}
                 value={search}
                 onChange={(event) => setSearch(event.target.value)}
                 id="dashboard-search"
                 aria-label="Cari menu atau halaman"
                 role="combobox"
                 aria-expanded={searchResults.length > 0}
                 aria-controls="dashboard-search-results"
                 placeholder="Cari menu atau halaman..."
                className="h-11 w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-12 pr-16 text-theme-sm text-gray-800 shadow-theme-xs outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-400">Ctrl K</span>
              {searchResults.length > 0 ? (
                <div id="dashboard-search-results" role="listbox" className="absolute left-0 right-0 top-12 rounded-xl border border-gray-200 bg-white p-2 shadow-theme-lg">
                  {searchResults.map((item) => (
                    <Link key={item.href} role="option" href={item.href} onClick={() => setSearch("")} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-theme-sm text-gray-700 hover:bg-gray-50">
                      <DashboardIcon name={item.icon} className="size-5 text-gray-400" />{item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            {waliChildren ? <WaliChildSelector options={waliChildren} selectedId={selectedWaliChildId ?? null} /> : null}
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="relative">
                <button type="button" aria-label="Notifikasi" aria-expanded={isNotificationOpen} aria-controls="notification-panel" onClick={() => setIsNotificationOpen((open) => !open)} className="relative grid size-10 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-theme-xs hover:bg-gray-50 sm:size-11">
                  <BellIcon />
                  {unreadCount > 0 ? <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-error-500 px-1 text-[10px] font-bold leading-4 text-white">{unreadCount}</span> : null}
                </button>
                {isNotificationOpen ? (
                  <div id="notification-panel" role="region" aria-label="Daftar notifikasi" className="absolute right-0 top-[52px] z-20 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg sm:w-96">
                    <div className="flex items-center justify-between border-b border-gray-100 px-2 pb-3">
                      <div><p className="text-theme-sm font-semibold text-gray-800">Notifikasi</p><p className="text-theme-xs text-gray-500">{notifications.items.length} aktivitas terbaru</p></div>
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold text-brand-600">{unreadCount} belum dibaca</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto py-2">
                      {notifications.items.length > 0 ? notifications.items.map((item) => (
                         <button type="button" key={item.id} onClick={() => void markNotificationRead(item.id)} className={`w-full rounded-xl px-3 py-2.5 text-left hover:bg-gray-50 ${item.readAt || locallyRead.has(item.id) ? "opacity-70" : ""}`}>
                           <div className="flex items-start gap-3">
                             <span className={`mt-1 size-2 shrink-0 rounded-full ${item.readAt || locallyRead.has(item.id) ? "bg-gray-300" : "bg-brand-500"}`} />
                             <div className="min-w-0">
                              <p className="truncate text-theme-sm font-semibold text-gray-800">{item.subject || item.template}</p>
                              <p className="mt-1 line-clamp-2 text-theme-xs leading-5 text-gray-500">{item.body}</p>
                               <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">{formatNotificationDate(item.createdAt)} / {item.readAt || locallyRead.has(item.id) ? "DIBACA" : "BARU"}</p>
                             </div>
                           </div>
                         </button>
                      )) : <p className="px-3 py-6 text-center text-theme-sm text-gray-500">Belum ada notifikasi.</p>}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="relative">
                <button type="button" aria-label="Buka menu akun" aria-expanded={isProfileOpen} aria-controls="profile-panel" onClick={() => setIsProfileOpen((open) => !open)} className="flex items-center gap-3 rounded-lg p-1.5 text-left hover:bg-gray-50">
                  <span className="grid size-9 place-items-center rounded-full bg-brand-50 text-theme-sm font-bold text-brand-600 ring-1 ring-brand-100 sm:size-10">{actor.name.slice(0, 1).toUpperCase()}</span>
                  <span className="hidden max-w-40 sm:block"><span className="block truncate text-theme-sm font-semibold text-gray-800">{actor.name}</span><span className="block text-theme-xs text-gray-500">{actor.role}</span></span>
                  <svg viewBox="0 0 20 20" className={`hidden size-4 text-gray-400 transition sm:block ${isProfileOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
                </button>
                {isProfileOpen ? (
                  <div id="profile-panel" role="region" aria-label="Menu akun" className="absolute right-0 top-[52px] w-64 rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg">
                    <div className="border-b border-gray-100 px-2 pb-3"><p className="truncate text-theme-sm font-semibold text-gray-800">{actor.name}</p><p className="truncate text-theme-xs text-gray-500">{actor.email}</p></div>
                    {profileHref ? <Link href={profileHref} onClick={() => setIsProfileOpen(false)} className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-theme-sm font-medium text-gray-700 hover:bg-gray-50"><DashboardIcon name="profile" className="size-5 text-gray-400" />Profil</Link> : null}
                    <Link href="/ubah-password" onClick={() => setIsProfileOpen(false)} className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-theme-sm font-medium text-gray-700 hover:bg-gray-50"><DashboardIcon name="lock" className="size-5 text-gray-400" />Ubah Password</Link>
                    <div className="mt-1 px-1"><LogoutButton /></div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div className="border-b border-gray-100 bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-2 text-theme-xs text-gray-500"><Link href={homeHref} className="hover:text-brand-500">Dashboard</Link><span>/</span><span className="font-medium text-gray-700">{activeItem?.label || "Halaman"}</span></div>
        </div>

        <div id="dashboard-content" tabIndex={-1} className="mx-auto w-full max-w-[1600px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </div>
    </div>
  );
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
