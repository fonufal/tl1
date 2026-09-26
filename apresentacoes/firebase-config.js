export const FIREBASE_CONFIG = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "__FIREBASE_AUTH_DOMAIN__",
  projectId: "__FIREBASE_PROJECT_ID__",
  appId: "__FIREBASE_APP_ID__"
};

export const MAIL_WEBAPP_URL = "__APPS_SCRIPT_WEBAPP_URL__";
export const APP_BASE_URL = "https://fonufal.github.io/tl1/apresentacoes/";

export function isFirebaseConfigured() {
  return Object.values(FIREBASE_CONFIG).every(value => value && !String(value).startsWith("__"));
}

export function isMailConfigured() {
  return MAIL_WEBAPP_URL && !MAIL_WEBAPP_URL.startsWith("__");
}
