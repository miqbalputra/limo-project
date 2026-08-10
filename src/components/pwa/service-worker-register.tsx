"use client";

import { useEffect, useRef, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" };

export function ServiceWorkerRegister() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isInstallDismissed, setIsInstallDismissed] = useState(false);
  const [isUpdateDismissed, setIsUpdateDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const reloadAfterControllerChange = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    let isDisposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let removeInstallingStateListener: (() => void) | undefined;

    const showWaitingWorker = () => {
      const worker = registration?.waiting;

      if (!worker || isDisposed) {
        return;
      }

      setWaitingWorker(worker);
      setIsUpdateDismissed(false);
    };

    const observeInstallingWorker = (worker: ServiceWorker | null) => {
      removeInstallingStateListener?.();
      removeInstallingStateListener = undefined;

      if (!worker) {
        return;
      }

      const handleStateChange = () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          showWaitingWorker();
        }
      };

      worker.addEventListener("statechange", handleStateChange);
      removeInstallingStateListener = () => worker.removeEventListener("statechange", handleStateChange);
      handleStateChange();
    };

    const handleUpdateFound = () => {
      observeInstallingWorker(registration?.installing ?? null);
    };

    const handleControllerChange = () => {
      if (isDisposed) {
        return;
      }

      setWaitingWorker(null);
      setIsUpdating(false);

      if (reloadAfterControllerChange.current) {
        reloadAfterControllerChange.current = false;
        window.location.reload();
      }
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setIsInstallDismissed(false);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstallDismissed(true);
      setIsInstalling(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registered) => {
        if (isDisposed) {
          return;
        }

        registration = registered;
        registered.addEventListener("updatefound", handleUpdateFound);
        showWaitingWorker();
        observeInstallingWorker(registered.installing);
      })
      .catch(() => {
        // PWA enhancement must not block the application.
      });

    return () => {
      isDisposed = true;
      removeInstallingStateListener?.();
      registration?.removeEventListener("updatefound", handleUpdateFound);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      return;
    }

    setIsInstalling(true);

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      // The browser can revoke a deferred prompt before it is shown.
    } finally {
      setInstallPrompt(null);
      setIsInstalling(false);
    }
  }

  function updateApp() {
    if (!waitingWorker) {
      return;
    }

    reloadAfterControllerChange.current = true;
    setIsUpdating(true);

    try {
      waitingWorker.postMessage(SKIP_WAITING_MESSAGE);
    } catch {
      reloadAfterControllerChange.current = false;
      setIsUpdating(false);
    }
  }

  const showUpdateNotice = waitingWorker && !isUpdateDismissed;
  const showInstallNotice = installPrompt && !isInstallDismissed;

  if (!showUpdateNotice && !showInstallNotice) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-3 px-4 sm:items-end">
      {showUpdateNotice ? (
        <aside className="pointer-events-auto w-full max-w-md rounded-xl border border-limo-blue-200 bg-white p-4 shadow-theme-lg" aria-label="Pembaruan aplikasi tersedia">
          <p className="text-theme-sm font-semibold text-gray-900" role="status">
            Pembaruan LIMO siap digunakan
          </p>
          <p className="mt-1 text-theme-sm text-gray-600">Perbarui saat Anda siap untuk menggunakan versi terbaru.</p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsUpdateDismissed(true)}
              disabled={isUpdating}
              className="tailadmin-button-outline px-3 py-2"
            >
              Nanti
            </button>
            <button type="button" onClick={updateApp} disabled={isUpdating} className="tailadmin-button-primary px-3 py-2">
              {isUpdating ? "Memperbarui..." : "Perbarui sekarang"}
            </button>
          </div>
        </aside>
      ) : null}

      {showInstallNotice ? (
        <aside className="pointer-events-auto w-full max-w-md rounded-xl border border-limo-blue-200 bg-white p-4 shadow-theme-lg" aria-label="Pasang aplikasi LIMO">
          <p className="text-theme-sm font-semibold text-gray-900" role="status">
            Pasang LIMO di perangkat ini
          </p>
          <p className="mt-1 text-theme-sm text-gray-600">Akses beranda LIMO lebih cepat dari layar utama perangkat Anda.</p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsInstallDismissed(true)}
              disabled={isInstalling}
              className="tailadmin-button-outline px-3 py-2"
            >
              Nanti
            </button>
            <button type="button" onClick={installApp} disabled={isInstalling} className="tailadmin-button-primary px-3 py-2">
              {isInstalling ? "Menyiapkan..." : "Pasang aplikasi"}
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
