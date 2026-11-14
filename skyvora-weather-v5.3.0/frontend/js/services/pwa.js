const BUILD_VERSION = "5.3.0";

export async function registerPWA() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext)
    return { supported: false };
  try {
    const hadController = Boolean(navigator.serviceWorker.controller);
    if (hadController) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          const refreshKey = `skyvora-sw-refreshed-${BUILD_VERSION}`;
          if (sessionStorage.getItem(refreshKey) === "1") return;
          sessionStorage.setItem(refreshKey, "1");
          window.location.reload();
        },
        { once: true },
      );
    }

    const registration = await navigator.serviceWorker.register(
      "/service-worker.js",
      {
        updateViaCache: "none",
      },
    );
    registration.update().catch(() => {});
    return { supported: true, registration };
  } catch (error) {
    console.warn("[pwa] Service worker registration failed:", error.message);
    return { supported: true, error: error.message };
  }
}

/**
 * Capture Chrome's install event so Skyvora can expose its own Install button.
 * The DevTools "Banner not shown" notice is expected until the user presses that button:
 * the deferred prompt must be invoked from a real user gesture and can only be used once.
 */
export function installPromptHandler(onAvailable, onInstalled) {
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    onAvailable?.(true);
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    onAvailable?.(false);
    onInstalled?.();
  });

  return async () => {
    if (!deferredPrompt) return false;
    const installEvent = deferredPrompt;
    deferredPrompt = null;
    onAvailable?.(false);
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    return choice?.outcome === "accepted";
  };
}
