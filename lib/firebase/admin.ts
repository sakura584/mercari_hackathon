import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

function isUsingEmulator(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-letting-go";

  if (isUsingEmulator()) {
    return initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    storageBucket: `${projectId}.appspot.com`,
  });
}

// Tracked on globalThis (not a module-level `let`) because Next.js dev-mode
// hot reloads re-evaluate this module — resetting a plain module variable —
// while the underlying Firestore instance from firebase-admin persists,
// causing a duplicate `.settings()` call to throw.
const globalForFirestore = globalThis as unknown as { __firestoreSettingsApplied?: boolean };

export function getAdminFirestore(): Firestore {
  const db = getFirestore(getAdminApp());
  if (!globalForFirestore.__firestoreSettingsApplied) {
    // Repositories write plain domain objects that may have optional
    // fields left as `undefined` (e.g. Session.note, Item.sourceImageId).
    // Firestore rejects `undefined` values by default; this makes it skip
    // them instead, matching how the rest of the plan's repositories are written.
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (err) {
      // A prior hot-reload cycle may have already applied settings to this
      // same underlying Firestore instance before resetting our tracking
      // flag; Firestore throws on a second call regardless of who made it.
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("already been initialized")) throw err;
    }
    globalForFirestore.__firestoreSettingsApplied = true;
  }
  return db;
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}
