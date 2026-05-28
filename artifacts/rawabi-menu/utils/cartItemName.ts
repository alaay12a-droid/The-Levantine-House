import { CartCustomization } from "@/context/CartContext";

const MEAT_SIZES = ["ربع", "نصف", "كامل"];

/**
 * Returns a display-friendly name for a cart item.
 * - Chicken: replaces "حبة كاملة" with "نصف" when half is chosen.
 * - Meat: replaces the suffix after the last " - " with the chosen size label
 *   (e.g. "حنيذ بلدي - كامل" + size "نصف" → "حنيذ بلدي - نصف").
 */
export function resolveCartItemName(
  baseName: string,
  customization?: CartCustomization
): string {
  const size = customization?.size;
  if (!size) return baseName;

  if (size === "نصف" && baseName.includes("حبة كاملة")) {
    return baseName.replace("حبة كاملة", "نصف");
  }

  if (MEAT_SIZES.includes(size)) {
    const dashIdx = baseName.lastIndexOf(" - ");
    if (dashIdx !== -1) {
      return baseName.slice(0, dashIdx) + " - " + size;
    }
  }

  return baseName;
}

/**
 * Returns customization parts for the subtitle / order notes,
 * omitting the size when it has already been embedded in the name.
 */
export function resolveCustomizationParts(
  customization?: CartCustomization
): string[] {
  const parts: string[] = [];
  const size = customization?.size;

  const sizeInName =
    size === "نصف" ||
    size === "حبة كاملة" ||
    (size !== undefined && MEAT_SIZES.includes(size));

  if (size && !sizeInName) parts.push(size);
  if (customization?.riceType) parts.push(customization.riceType);
  if (customization?.addon) parts.push(customization.addon);
  return parts;
}
