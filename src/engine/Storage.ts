export interface GameSettings {
  mouseSensitivity: number; // 0.5 .. 2.0
  invertMouseY: boolean;
  sfxVolume: number; // 0 .. 1
  musicVolume: number; // 0 .. 1
  performanceMode: boolean;
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
  starterBonusApplied?: boolean;
}

const SETTINGS_KEY = 'vice_dusk_settings_v1';
const PROGRESS_KEY = 'vice_dusk_progress_v1';

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
  starterBonusApplied: true,
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
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
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota / private mode errors
  }
}

export function loadProgress(): SaveProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<SaveProgress>;
    const rawCash = typeof parsed.cash === 'number' ? Math.max(0, Math.floor(parsed.cash)) : DEFAULT_PROGRESS.cash;
    const starterApplied = Boolean(parsed.starterBonusApplied);
    // One-time migration for existing $0 saves so players immediately start with at least $300
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
      starterBonusApplied: true,
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(progress: SaveProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage quota / private mode errors
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
}
