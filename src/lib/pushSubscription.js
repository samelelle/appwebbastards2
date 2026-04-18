import { supabase } from "./supabaseClient";

// Recupera l'userId corrente dalla localStorage (come usato in meetingAccess.js)
export function getCurrentUserId() {
  try {
    return localStorage.getItem("bb-current-chat-user-id");
  } catch {
    return null;
  }
}

// Registra il service worker e iscrive l'utente alle push, salvando la subscription su Supabase
export async function subscribeUserToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    // Registra il service worker (assicurati che il path sia corretto)
    const registration = await navigator.serviceWorker.register("/push-sw.js");
    // Chiedi permesso
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    // Sostituisci con la tua chiave pubblica VAPID (base64 url safe)
    const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!VAPID_PUBLIC_KEY) throw new Error("VAPID public key mancante");

    // Iscrivi l'utente
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Salva la subscription su Supabase
    const userId = getCurrentUserId();
    if (!userId) throw new Error("userId non trovato");
    await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      keys: subscription.toJSON().keys,
    });
  } catch (e) {
    // Silenzia errori
    console.warn("Errore iscrizione push:", e);
  }
}

// Utility per convertire la chiave VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}