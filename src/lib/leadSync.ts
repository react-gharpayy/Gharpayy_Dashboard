export const LEADS_UPDATED_AT_KEY = 'gharpayy:leads:updated-at';

export function broadcastLeadsUpdated() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LEADS_UPDATED_AT_KEY, String(Date.now()));
  } catch {
    // Ignore storage errors in private mode or restricted contexts.
  }
}

export function getLeadsUpdatedStamp() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LEADS_UPDATED_AT_KEY);
  } catch {
    return null;
  }
}
