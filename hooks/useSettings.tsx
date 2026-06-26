import { atom, useAtom } from "jotai";

export interface GameSettings {
  hapticsEnabled: boolean;
}

const settingsAtom = atom<GameSettings>({
  hapticsEnabled: true,
});

export function useSettings() {
  return useAtom(settingsAtom);
}
