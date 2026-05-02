import { useEffect, useRef, useCallback } from "react";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";

const SOUND_ASSET = require("@/assets/sounds/notification.wav");

export function useChatSound() {
  const player = useAudioPlayer(SOUND_ASSET);

  const playAlert = useCallback(async () => {
    try {
      player.seekTo(0);
      player.play();
    } catch {}
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }, [player]);

  return { playAlert };
}

/**
 * Watches a numeric "unread count" and fires playAlert whenever it increases.
 */
export function useChatUnreadAlert(unreadCount: number) {
  const { playAlert } = useChatSound();
  const prevRef       = useRef(unreadCount);
  const initialised   = useRef(false);

  useEffect(() => {
    if (!initialised.current) {
      initialised.current = true;
      prevRef.current = unreadCount;
      return;
    }
    if (unreadCount > prevRef.current) {
      playAlert();
    }
    prevRef.current = unreadCount;
  }, [unreadCount, playAlert]);
}
