import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const VERSION_STORAGE_KEY = 'pluton_app_version';

/**
 * Handles two PWA update scenarios:
 *
 * 1. **Workbox precache update** — When a new frontend build is deployed, Workbox detects
 *    that the precache manifest changed and sets `needRefresh`. We immediately activate
 *    the new service worker so the page reloads with fresh assets.
 *
 * 2. **Backend version mismatch** — Compares the server's `X-App-Version` header
 *    (stored on `window.plutonVersion` by `validateAuth`) against the last known version
 *    in localStorage. On mismatch (e.g. docker/binary upgrade), unregisters all service
 *    workers, clears all caches, and hard-reloads. This catches cases where the SW update
 *    check hasn't fired yet (long-lived tabs, cached sw.js, etc.).
 */
export function usePwaAutoUpdate() {
   const {
      offlineReady: [offlineReady, setOfflineReady],
      needRefresh: [needRefresh],
      updateServiceWorker,
   } = useRegisterSW();

   const versionCheckedRef = useRef(false);

   // Workbox detected a new service worker with updated assets
   useEffect(() => {
      if (needRefresh) {
         updateServiceWorker(true);
      }
      if (offlineReady) {
         console.log('PWA is ready for offline use.');
         setOfflineReady(false);
      }
   }, [needRefresh, offlineReady, setOfflineReady, updateServiceWorker]);

   // Backend version mismatch check
   useEffect(() => {
      if (versionCheckedRef.current) return;

      const serverVersion = (window as any).plutonVersion;
      if (!serverVersion || serverVersion === 'unknown') return;

      const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);

      if (storedVersion && storedVersion !== serverVersion) {
         versionCheckedRef.current = true;
         clearCachesAndReload(serverVersion);
      } else if (!storedVersion) {
         localStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
      }
   });
}

async function clearCachesAndReload(newVersion: string) {
   try {
      if ('serviceWorker' in navigator) {
         const registrations = await navigator.serviceWorker.getRegistrations();
         await Promise.all(registrations.map((r) => r.unregister()));
      }
      if ('caches' in window) {
         const cacheNames = await caches.keys();
         await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
   } catch (e) {
      console.error('Failed to clear caches:', e);
   }

   localStorage.setItem(VERSION_STORAGE_KEY, newVersion);
   window.location.reload();
}
