/* ============ FIREBASE ============
   Bundled via npm (compat API) — no CDN <script> dependency, so ad blockers or
   an unreachable gstatic.com cannot leave the page without a database. */
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
export { firebase };
export const firebaseConfig = {
  apiKey: "AIzaSyDCK3pV2ktSrfJp78JbFedOligFtFacprY",
  authDomain: "thenew-hub.firebaseapp.com",
  projectId: "thenew-hub",
  storageBucket: "thenew-hub.firebasestorage.app",
  messagingSenderId: "762300775329",
  appId: "1:762300775329:web:2f5e604fb199bf716729e0"
};

firebase.initializeApp(firebaseConfig);
export const db = firebase.firestore();

// Some ad blockers, VPNs, and Private Relay silently drop Firestore's default
// streaming connection (causing requests to hang forever instead of failing fast).
// Auto-detecting and falling back to long-polling works around this reliably.
db.settings({ experimentalAutoDetectLongPolling: true, merge: true });
