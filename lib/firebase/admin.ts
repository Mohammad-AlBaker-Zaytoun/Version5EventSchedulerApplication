import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { getServerEnv } from '@/lib/env';

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

type FirebaseAdminGlobals = {
  __mlms_admin_app?: App;
  __mlms_admin_auth?: Auth;
  __mlms_admin_db?: Firestore;
  __mlms_admin_db_settings_applied?: boolean;
};

const globalForFirebaseAdmin = globalThis as typeof globalThis & FirebaseAdminGlobals;

function getFirebaseAdminApp(): App {
  if (globalForFirebaseAdmin.__mlms_admin_app) {
    cachedApp = globalForFirebaseAdmin.__mlms_admin_app;
    return cachedApp;
  }

  if (cachedApp) {
    return cachedApp;
  }

  const env = getServerEnv();

  cachedApp =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });

  globalForFirebaseAdmin.__mlms_admin_app = cachedApp;
  return cachedApp;
}

export function getAdminAuth(): Auth {
  if (globalForFirebaseAdmin.__mlms_admin_auth) {
    cachedAuth = globalForFirebaseAdmin.__mlms_admin_auth;
    return cachedAuth;
  }

  if (cachedAuth) {
    return cachedAuth;
  }

  cachedAuth = getAuth(getFirebaseAdminApp());
  globalForFirebaseAdmin.__mlms_admin_auth = cachedAuth;
  return cachedAuth;
}

export function getAdminDb(): Firestore {
  if (globalForFirebaseAdmin.__mlms_admin_db) {
    cachedDb = globalForFirebaseAdmin.__mlms_admin_db;
    return cachedDb;
  }

  if (cachedDb) {
    return cachedDb;
  }

  const db = getFirestore(getFirebaseAdminApp());

  if (!globalForFirebaseAdmin.__mlms_admin_db_settings_applied) {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('Firestore has already been initialized')) {
        throw error;
      }
    } finally {
      globalForFirebaseAdmin.__mlms_admin_db_settings_applied = true;
    }
  }

  cachedDb = db;
  globalForFirebaseAdmin.__mlms_admin_db = db;
  return cachedDb;
}
