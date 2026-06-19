import { atom, useAtom } from "jotai";

export interface GameSettings {
  hapticsEnabled: boolean;
  devHudEnabled: boolean;
}

const settingsAtom = atom<GameSettings>({
  hapticsEnabled: true,
  devHudEnabled: true,
});

export function useSettings() {
  return useAtom(settingsAtom);
}
