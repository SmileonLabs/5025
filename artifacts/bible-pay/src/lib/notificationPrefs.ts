export interface NotificationPrefs {
  mission: boolean;
  charge: boolean;
  newMission: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = { mission: true, charge: true, newMission: true };

function prefsKey(childId: number) {
  return `biblepay:notifPrefs:${childId}`;
}

function lastSeenKey(childId: number) {
  return `biblepay:notifLastSeen:${childId}`;
}

export function getNotificationPrefs(childId: number): NotificationPrefs {
  try {
    const raw = localStorage.getItem(prefsKey(childId));
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setNotificationPrefs(childId: number, prefs: NotificationPrefs) {
  try {
    localStorage.setItem(prefsKey(childId), JSON.stringify(prefs));
  } catch {}
}

export function getLastSeen(childId: number): number {
  try {
    const raw = localStorage.getItem(lastSeenKey(childId));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export function setLastSeen(childId: number, ts: number) {
  try {
    localStorage.setItem(lastSeenKey(childId), String(ts));
  } catch {}
}
