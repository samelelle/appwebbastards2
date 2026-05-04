import { supabase } from "./supabaseClient";

// Recupera l'userId corrente dalla localStorage (come usato in meetingAccess.js)
export function getCurrentUserId() {
  try {
    return localStorage.getItem("bb-current-chat-user-id");
  } catch {
    return null;
  }
}

async function resolveCurrentUserId() {
  const existing = getCurrentUserId();
  if (existing) return existing;
  if (!supabase) return null;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return null;

    let resolved = null;
    if (user.email) {
      const { data: byEmail } = await supabase
        .from("iscritti")
        .select("id")
        .ilike("email", user.email)
        .limit(1)
        .maybeSingle();
      resolved = byEmail?.id ? String(byEmail.id) : null;
    }

    if (!resolved && user.id) {
      const { data: byId } = await supabase
        .from("iscritti")
        .select("id")
        .eq("id", user.id)
        .limit(1)
        .maybeSingle();
      resolved = byId?.id ? String(byId.id) : null;
    }

    if (resolved) {
      try {
        localStorage.setItem("bb-current-chat-user-id", resolved);
      } catch {
        // Ignore storage failures.
      }
    }
    return resolved;
  } catch {
    return null;
  }
}

function hasPushSupport() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function getVapidPublicKey() {
  const fromClientEnv = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (fromClientEnv) return fromClientEnv;

  try {
    const response = await fetch("/api/vapid-public-key");
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return payload?.publicKey || null;
  } catch {
    return null;
  }
}

// Registra il service worker e iscrive l'utente alle push, salvando la subscription su Supabase
export async function subscribeUserToPush(options = {}) {
  const { interactive = false } = options;
  if (!hasPushSupport()) {
    return { ok: false, reason: "unsupported_or_insecure_context" };
  }
  try {
    // Registra il service worker (assicurati che il path sia corretto)
    const registration =
      (await navigator.serviceWorker.getRegistration("/push-sw.js")) ??
      (await navigator.serviceWorker.register("/push-sw.js"));

    // Permesso notifiche: sui browser moderni spesso richiede un gesto utente.
    let permission = Notification.permission;
    if (permission === "default") {
      if (!interactive) return { ok: false, reason: "needs_user_gesture" };
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return { ok: false, reason: permission };

    // Sostituisci con la tua chiave pubblica VAPID (base64 url safe)
    const VAPID_PUBLIC_KEY = await getVapidPublicKey();
    if (!VAPID_PUBLIC_KEY) throw new Error("VAPID public key mancante");

    // Usa subscription esistente o creane una nuova
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));

    // Salva la subscription su Supabase
    const userId = await resolveCurrentUserId();
    if (!userId) throw new Error("userId non trovato");

    const subscriptionJson = subscription.toJSON();

    // Preferisci API server-side (bypassa RLS) se presente.
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    try {
      const response = await fetch("/api/save-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id: userId,
          subscription: subscriptionJson,
        }),
      });
      if (response.ok) return { ok: true, via: "api" };
      const apiErrorBody = await response.json().catch(() => null);
      if (response.status !== 404) {
        const bodyError =
          apiErrorBody?.error ||
          apiErrorBody?.message ||
          apiErrorBody?.details?.message ||
          null;
        return {
          ok: false,
          reason: `api_error_${response.status}`,
          details: {
            status: response.status,
            body: apiErrorBody,
            message: bodyError,
          },
        };
      }
      // fallback su insert diretto se l'API non esiste o non è configurata
    } catch {
      // ignore, fallback below
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subscriptionJson.endpoint,
        keys: subscriptionJson.keys,
      },
      { onConflict: "endpoint" }
    );
    if (error) {
      const msg = String(error?.message || "");
      if (msg.toLowerCase().includes("no unique") || msg.toLowerCase().includes("on conflict")) {
        // Fallback (può fallire con RLS): elimina + inserisci.
        await supabase.from("push_subscriptions").delete().eq("endpoint", subscriptionJson.endpoint);
        const { error: insError } = await supabase.from("push_subscriptions").insert({
          user_id: userId,
          endpoint: subscriptionJson.endpoint,
          keys: subscriptionJson.keys,
        });
        if (insError) return { ok: false, reason: "supabase_error", details: insError };
        return { ok: true, via: "direct_delete_insert" };
      }
      return { ok: false, reason: "supabase_error", details: error };
    }
    return { ok: true, via: "direct" };
  } catch (e) {
    console.warn("Errore iscrizione push:", e);
    return { ok: false, reason: "exception", details: e };
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
