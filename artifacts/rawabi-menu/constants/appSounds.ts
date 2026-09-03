export type SoundOption = "default" | "chime" | "bell" | "short" | "silent" | "custom";

export interface SoundChoice {
  id: SoundOption;
  name: string;
  emoji: string;
  desc: string;
}

export const SOUND_CHOICES: SoundChoice[] = [
  { id: "default", name: "الافتراضي",    emoji: "🔔", desc: "الصوت الأصلي للتطبيق" },
  { id: "chime",   name: "رنين هادئ",   emoji: "🎵", desc: "ثلاث نغمات متصاعدة" },
  { id: "bell",    name: "جرس",          emoji: "🛎️", desc: "جرس كلاسيكي واضح" },
  { id: "short",   name: "تنبيه قصير",  emoji: "📢", desc: "نبضة مزدوجة سريعة" },
  { id: "silent",  name: "صامت",         emoji: "🔕", desc: "بدون أي صوت" },
];

export const SOUND_KEYS = {
  muted:       "thelevantinehouse_snd_muted",
  order:       "thelevantinehouse_snd_order",
  message:     "thelevantinehouse_snd_message",
  delivery:    "thelevantinehouse_snd_delivery",
  customOrder:    "thelevantinehouse_snd_custom_order",
  customMessage:  "thelevantinehouse_snd_custom_message",
  customDelivery: "thelevantinehouse_snd_custom_delivery",
};

export function getCustomKey(soundKey: string): string {
  if (soundKey === SOUND_KEYS.order)    return SOUND_KEYS.customOrder;
  if (soundKey === SOUND_KEYS.message)  return SOUND_KEYS.customMessage;
  if (soundKey === SOUND_KEYS.delivery) return SOUND_KEYS.customDelivery;
  return soundKey + "_custom_uri";
}
