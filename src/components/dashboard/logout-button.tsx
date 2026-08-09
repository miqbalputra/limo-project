"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function logout() {
    setIsSubmitting(true);

    try {
      await requestJson("/api/v1/auth/logout", { method: "POST", fallbackMessage: "Logout gagal diproses" });
      const registrations = await navigator.serviceWorker?.getRegistrations?.();
      registrations?.forEach((registration) => registration.active?.postMessage({ type: "PURGE_LIMO_CACHE" }));
      router.replace("/login");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={isSubmitting}
      className="tailadmin-button-outline w-full px-3 py-2"
    >
      {isSubmitting ? "Keluar..." : "Logout"}
    </button>
  );
}
