export type SoundOption = "default" | "chime" | "bell" | "short" | "silent";

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
  muted:    "rawabi_snd_muted",
  order:    "rawabi_snd_order",
  message:  "rawabi_snd_message",
  delivery: "rawabi_snd_delivery",
};
