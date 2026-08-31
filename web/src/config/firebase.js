/* ============ FIREBASE ============
   Extracted in stage 3 of docs/PERFORMANCE_REFACTORING_PLAN.md.
   Relies on the Firebase compat SDK being loaded beforehand via classic
   (non-module) <script src> tags in index.html — those execute before this
   module does (module scripts are deferred, same as classic scripts loaded
   after them in document order), so the global `firebase` object is always
   ready by the time this file runs. */
export const firebaseConfig = {
  apiKey: "AIzaSyDCK3pV2ktSrfJp78JbFedOligFtFacprY",
  authDomain: "thenew-hub.firebaseapp.com",
  projectId: "thenew-hub",
  storageBucket: "thenew-hub.firebasestorage.app",
  messagingSenderId: "762300775329",
  appId: "1:762300775329:web:2f5e604fb199bf716729e0"
};

/* global firebase */
firebase.initializeApp(firebaseConfig);
export const db = firebase.firestore();

// Some ad blockers, VPNs, and Private Relay silently drop Firestore's default
// streaming connection (causing requests to hang forever instead of failing fast).
// Auto-detecting and falling back to long-polling works around this reliably.
db.settings({ experimentalAutoDetectLongPolling: true, merge: true });
