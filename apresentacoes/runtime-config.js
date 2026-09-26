import { FIREBASE_CONFIG } from "./firebase-config.js?v=20260926-1737";

export { FIREBASE_CONFIG };

export const MAIL_WEBAPP_URL = "__APPS_SCRIPT_WEBAPP_URL__";
export const APP_BASE_URL = "https://fonufal.github.io/tl1/apresentacoes/";

export function isFirebaseConfigured() {
  return Object.values(FIREBASE_CONFIG).every(
    value => value && !String(value).startsWith("__")
  );
}

export function isMailConfigured() {
  return MAIL_WEBAPP_URL && !MAIL_WEBAPP_URL.startsWith("__");
}
