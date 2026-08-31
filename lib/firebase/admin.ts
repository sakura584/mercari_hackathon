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

let firestoreSettingsApplied = false;

export function getAdminFirestore(): Firestore {
  const db = getFirestore(getAdminApp());
  if (!firestoreSettingsApplied) {
    // Repositories write plain domain objects that may have optional
    // fields left as `undefined` (e.g. Session.note, Item.sourceImageId).
    // Firestore rejects `undefined` values by default; this makes it skip
    // them instead, matching how the rest of the plan's repositories are written.
    db.settings({ ignoreUndefinedProperties: true });
    firestoreSettingsApplied = true;
  }
  return db;
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}
