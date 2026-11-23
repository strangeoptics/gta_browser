export interface GameSettings {
  mouseSensitivity: number; // 0.5 .. 2.0
  invertMouseY: boolean;
  sfxVolume: number; // 0 .. 1
  musicVolume: number; // 0 .. 1
  performanceMode: boolean;
}

export interface SavedGarageVehicle {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  color: string;
  tuned?: boolean;
  hydraulics?: boolean;
}

export interface SaveProgress {
  cash: number;
  completedMissions: number;
  launcherUnlocked: boolean;
  armor: number;
  outfitIndex: number;
  ownedPets?: string[];
  rooftopBarOwned?: boolean;
  completedMissionIds?: string[];
  storyChapter?: number; // 0..5 (number of completed story chapters)
  paramedicRescues?: number;
  maxHpUnlocked?: boolean;
  starterBonusApplied?: boolean;
  savedGarageVehicles?: SavedGarageVehicle[];
}

export interface PlayerProfile {
  id: string;
  name: string;
  createdAt: number;
  lastPlayedAt: number;
  progress: SaveProgress;
  settings: GameSettings;
}

interface ProfilesStore {
  activeProfileId: string;
  profiles: PlayerProfile[];
}

const LEGACY_SETTINGS_KEY = 'vice_dusk_settings_v1';
const LEGACY_PROGRESS_KEY = 'vice_dusk_progress_v1';
const PROFILES_KEY = 'vice_dusk_profiles_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  invertMouseY: false,
  sfxVolume: 0.75,
  musicVolume: 0.7,
  performanceMode: false,
};

export const DEFAULT_PROGRESS: SaveProgress = {
  cash: 300,
  completedMissions: 0,
  launcherUnlocked: false,
  armor: 0,
  outfitIndex: 0,
  ownedPets: [],
  rooftopBarOwned: false,
  completedMissionIds: [],
  storyChapter: 0,
  paramedicRescues: 0,
  maxHpUnlocked: false,
  starterBonusApplied: true,
};

function sanitizeSettings(parsed?: Partial<GameSettings> | null): GameSettings {
  if (!parsed) return { ...DEFAULT_SETTINGS };
  return {
    mouseSensitivity:
      typeof parsed.mouseSensitivity === 'number'
        ? Math.max(0.5, Math.min(2.0, parsed.mouseSensitivity))
        : DEFAULT_SETTINGS.mouseSensitivity,
    invertMouseY: Boolean(parsed.invertMouseY),
    sfxVolume:
      typeof parsed.sfxVolume === 'number'
        ? Math.max(0, Math.min(1, parsed.sfxVolume))
        : DEFAULT_SETTINGS.sfxVolume,
    musicVolume:
      typeof parsed.musicVolume === 'number'
        ? Math.max(0, Math.min(1, parsed.musicVolume))
        : DEFAULT_SETTINGS.musicVolume,
    performanceMode: Boolean(parsed.performanceMode),
  };
}

function sanitizeProgress(parsed?: Partial<SaveProgress> | null): SaveProgress {
  if (!parsed) return { ...DEFAULT_PROGRESS, ownedPets: [], completedMissionIds: [] };
  const rawCash = typeof parsed.cash === 'number' ? Math.max(0, Math.floor(parsed.cash)) : DEFAULT_PROGRESS.cash;
  const starterApplied = Boolean(parsed.starterBonusApplied);
  const cash = !starterApplied && rawCash < DEFAULT_PROGRESS.cash ? DEFAULT_PROGRESS.cash : rawCash;
  return {
    cash,
    completedMissions:
      typeof parsed.completedMissions === 'number' ? Math.max(0, Math.floor(parsed.completedMissions)) : 0,
    launcherUnlocked: Boolean(parsed.launcherUnlocked),
    armor: typeof parsed.armor === 'number' ? Math.max(0, Math.min(100, parsed.armor)) : 0,
    outfitIndex: typeof parsed.outfitIndex === 'number' ? Math.max(0, Math.floor(parsed.outfitIndex)) % 5 : 0,
    ownedPets: Array.isArray(parsed.ownedPets)
      ? parsed.ownedPets.filter((p): p is string => typeof p === 'string')
      : [],
    rooftopBarOwned: Boolean(parsed.rooftopBarOwned),
    completedMissionIds: Array.isArray(parsed.completedMissionIds)
      ? parsed.completedMissionIds.filter((id): id is string => typeof id === 'string')
      : [],
    storyChapter:
      typeof parsed.storyChapter === 'number' ? Math.max(0, Math.min(5, Math.floor(parsed.storyChapter))) : 0,
    paramedicRescues:
      typeof parsed.paramedicRescues === 'number' ? Math.max(0, Math.floor(parsed.paramedicRescues)) : 0,
    maxHpUnlocked: Boolean(parsed.maxHpUnlocked),
    starterBonusApplied: true,
  };
}

function sanitizeName(name: string, fallback: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ').slice(0, 22);
  return cleaned.length > 0 ? cleaned : fallback;
}

function generateProfileId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

let cachedStore: ProfilesStore | null = null;

function persistStore(store: ProfilesStore): void {
  cachedStore = store;
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(store));
  } catch {
    // ignore storage quota / private mode errors
  }
}

function loadStore(): ProfilesStore {
  if (cachedStore) return cachedStore;

  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProfilesStore>;
      if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
        const profiles: PlayerProfile[] = parsed.profiles.map((p, idx) => ({
          id: typeof p?.id === 'string' && p.id.length > 0 ? p.id : generateProfileId(),
          name: sanitizeName(typeof p?.name === 'string' ? p.name : '', `Spieler ${idx + 1}`),
          createdAt: typeof p?.createdAt === 'number' ? p.createdAt : Date.now(),
          lastPlayedAt: typeof p?.lastPlayedAt === 'number' ? p.lastPlayedAt : Date.now(),
          progress: sanitizeProgress(p?.progress),
          settings: sanitizeSettings(p?.settings),
        }));
        const activeId =
          typeof parsed.activeProfileId === 'string' && profiles.some((p) => p.id === parsed.activeProfileId)
            ? parsed.activeProfileId
            : profiles[0].id;
        cachedStore = { activeProfileId: activeId, profiles };
        return cachedStore;
      }
    }
  } catch {
    // fall through to migration / default store
  }

  // One-time migration from legacy single-player keys into "Spieler 1"
  let legacyProgress: Partial<SaveProgress> | null = null;
  let legacySettings: Partial<GameSettings> | null = null;
  try {
    const rawP = localStorage.getItem(LEGACY_PROGRESS_KEY);
    if (rawP) legacyProgress = JSON.parse(rawP) as Partial<SaveProgress>;
    const rawS = localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (rawS) legacySettings = JSON.parse(rawS) as Partial<GameSettings>;
  } catch {
    // ignore
  }

  const now = Date.now();
  const initialProfile: PlayerProfile = {
    id: generateProfileId(),
    name: 'Spieler 1',
    createdAt: now,
    lastPlayedAt: now,
    progress: sanitizeProgress(legacyProgress),
    settings: sanitizeSettings(legacySettings),
  };
  const store: ProfilesStore = {
    activeProfileId: initialProfile.id,
    profiles: [initialProfile],
  };
  persistStore(store);
  return store;
}

export function listProfiles(): PlayerProfile[] {
  return loadStore().profiles;
}

export function getActiveProfile(): PlayerProfile {
  const store = loadStore();
  return store.profiles.find((p) => p.id === store.activeProfileId) ?? store.profiles[0];
}

export function setActiveProfile(profileId: string): PlayerProfile | null {
  const store = loadStore();
  const target = store.profiles.find((p) => p.id === profileId);
  if (!target) return null;
  store.activeProfileId = target.id;
  target.lastPlayedAt = Date.now();
  persistStore(store);
  return target;
}

export function createProfile(name: string): PlayerProfile {
  const store = loadStore();
  const now = Date.now();
  const fallbackName = `Spieler ${store.profiles.length + 1}`;
  const profile: PlayerProfile = {
    id: generateProfileId(),
    name: sanitizeName(name, fallbackName),
    createdAt: now,
    lastPlayedAt: now,
    progress: sanitizeProgress(null),
    settings: sanitizeSettings(null),
  };
  store.profiles.push(profile);
  store.activeProfileId = profile.id;
  persistStore(store);
  return profile;
}

export function renameProfile(profileId: string, newName: string): PlayerProfile | null {
  const store = loadStore();
  const target = store.profiles.find((p) => p.id === profileId);
  if (!target) return null;
  target.name = sanitizeName(newName, target.name);
  persistStore(store);
  return target;
}

export function deleteProfile(profileId: string): PlayerProfile | null {
  const store = loadStore();
  if (store.profiles.length <= 1) return null;
  const idx = store.profiles.findIndex((p) => p.id === profileId);
  if (idx < 0) return null;
  store.profiles.splice(idx, 1);
  if (store.activeProfileId === profileId) {
    store.activeProfileId = store.profiles[0].id;
  }
  persistStore(store);
  return getActiveProfile();
}

export function loadSettings(): GameSettings {
  return { ...getActiveProfile().settings };
}

export function saveSettings(settings: GameSettings): void {
  const store = loadStore();
  const active = getActiveProfile();
  active.settings = sanitizeSettings(settings);
  active.lastPlayedAt = Date.now();
  persistStore(store);
}

export function loadProgress(): SaveProgress {
  return sanitizeProgress(getActiveProfile().progress);
}

export function saveProgress(progress: SaveProgress): void {
  const store = loadStore();
  const active = getActiveProfile();
  active.progress = sanitizeProgress(progress);
  active.lastPlayedAt = Date.now();
  persistStore(store);
}

export function clearProgress(): void {
  const store = loadStore();
  const active = getActiveProfile();
  active.progress = sanitizeProgress(null);
  active.lastPlayedAt = Date.now();
  persistStore(store);
}
