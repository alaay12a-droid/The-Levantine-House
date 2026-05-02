import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const SOUND_ASSET = require("@/assets/sounds/notification.wav");

/* ──────────────────────────────────────────────────────────────
   Cross-platform sound player:
   - Web  → HTML5 Audio API (works without any native module)
   - Native → expo-av Audio.Sound (already installed)
────────────────────────────────────────────────────────────── */

let avSoundRef: { stopAsync: () => Promise<unknown>; setPositionAsync: (ms: number) => Promise<unknown>; playAsync: () => Promise<unknown> } | null = null;

async function getAvSound() {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Audio } = require("expo-av") as typeof import("expo-av");
    if (!avSoundRef) {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(SOUND_ASSET, { volume: 1 });
      avSoundRef = sound;
    }
    return avSoundRef;
  } catch {
    return null;
  }
}

export function useChatSound() {
  const webAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      try {
        webAudioRef.current = new Audio(SOUND_ASSET);
      } catch {}
    } else {
      getAvSound().catch(() => {});
    }
  }, []);

  const playAlert = useCallback(async () => {
    // ── Haptics (works on native; silent no-op on web) ──
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    // ── Sound ──
    if (Platform.OS === "web") {
      try {
        if (webAudioRef.current) {
          webAudioRef.current.currentTime = 0;
          await webAudioRef.current.play();
        }
      } catch {}
    } else {
      try {
        const sound = await getAvSound();
        if (sound) {
          await sound.stopAsync().catch(() => {});
          await sound.setPositionAsync(0);
          await sound.playAsync();
        }
      } catch {}
    }
  }, []);

  return { playAlert };
}

/**
 * Watches a numeric count and fires playAlert whenever it INCREASES.
 * Ignores the very first value (mount) to avoid spurious alerts on load.
 */
export function useChatUnreadAlert(count: number) {
  const { playAlert } = useChatSound();
  const prevRef     = useRef(count);
  const mountedRef  = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevRef.current = count;
      return;
    }
    if (count > prevRef.current) {
      playAlert();
    }
    prevRef.current = count;
  }, [count, playAlert]);
}
