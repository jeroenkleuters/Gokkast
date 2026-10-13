// localStorage kan ontbreken of gooien (privévenster, geblokkeerde data).

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export const KEYS = {
  sound: "gokkast-geluid",
} as const;
