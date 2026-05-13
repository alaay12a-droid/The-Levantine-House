import { CartCustomization } from "@/context/CartContext";

/**
 * Returns a display-friendly name for a cart item.
 * When the customer picks "نصف" size on a whole-chicken item,
 * replaces "حبة كاملة" in the base name with "نصف" so the
 * receipt/invoice clearly reads "نصف" instead of "حبة كاملة".
 */
export function resolveCartItemName(
  baseName: string,
  customization?: CartCustomization
): string {
  if (customization?.size === "نصف" && baseName.includes("حبة كاملة")) {
    return baseName.replace("حبة كاملة", "نصف");
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
  const sizeInName =
    customization?.size === "نصف" || customization?.size === "حبة كاملة";
  if (customization?.size && !sizeInName) parts.push(customization.size);
  if (customization?.riceType) parts.push(customization.riceType);
  if (customization?.addon) parts.push(customization.addon);
  return parts;
}
