import { useAppConfig, BG_THEMES } from "@/context/AppConfigContext";
import colors from "@/constants/colors";

export function useColors() {
  const { config, loaded } = useAppConfig();
  const palette = colors.light;

  if (!loaded) {
    return { ...palette, radius: colors.radius };
  }

  const themeColors = BG_THEMES[config.bgTheme] ?? BG_THEMES["dark-brown"];

  return {
    ...palette,
    ...themeColors,
    gold: config.accentColor,
    accent: config.accentColor,
    radius: colors.radius,
  };
}
