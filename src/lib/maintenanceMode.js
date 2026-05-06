import { hasSupabaseConfig, supabase } from './supabaseClient';

const maintenanceStorageKey = 'bb-maintenance-mode';
const maintenanceBucket = 'chat-audio';
const maintenanceFilePath = 'system/maintenance.json';

function readCachedMaintenanceMode() {
  try {
    return localStorage.getItem(maintenanceStorageKey) === '1';
  } catch {
    return false;
  }
}

function cacheMaintenanceMode(enabled) {
  try {
    if (enabled) {
      localStorage.setItem(maintenanceStorageKey, '1');
      return;
    }
    localStorage.removeItem(maintenanceStorageKey);
  } catch {
    // Ignore storage write failures.
  }
}

export function getCachedMaintenanceMode() {
  return readCachedMaintenanceMode();
}

export async function fetchSharedMaintenanceMode() {
  if (!hasSupabaseConfig || !supabase) {
    return readCachedMaintenanceMode();
  }

  try {
    const { data, error } = await supabase.storage.from(maintenanceBucket).download(maintenanceFilePath);
    if (error) {
      cacheMaintenanceMode(false);
      return false;
    }

    const text = await data.text();
    const parsed = JSON.parse(text || '{}');
    const enabled = parsed?.enabled === true;
    cacheMaintenanceMode(enabled);
    return enabled;
  } catch {
    return readCachedMaintenanceMode();
  }
}

export async function updateSharedMaintenanceMode(enabled) {
  cacheMaintenanceMode(enabled);

  if (!hasSupabaseConfig || !supabase) {
    return enabled;
  }

  const payload = JSON.stringify({
    enabled,
    updatedAt: new Date().toISOString(),
  });

  const { error } = await supabase.storage
    .from(maintenanceBucket)
    .upload(maintenanceFilePath, new Blob([payload], { type: 'application/json' }), {
      upsert: true,
      contentType: 'application/json',
    });

  if (error) {
    throw error;
  }

  return enabled;
}