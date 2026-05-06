
import { hasSupabaseConfig, supabase } from './supabaseClient';

const maintenanceStorageKey = 'bb-maintenance-mode';


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
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .single();
    if (error || !data) {
      cacheMaintenanceMode(false);
      return false;
    }
    const enabled = data.value?.enabled === true;
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
  const payload = { enabled, updatedAt: new Date().toISOString() };
  const { error } = await supabase
    .from('app_settings')
    .upsert([
      { key: 'maintenance_mode', value: payload }
    ], { onConflict: ['key'] });
  if (error) {
    throw error;
  }
  return enabled;
}