export interface MenuItemSize {
  name: string;
  price: number;
  enabled: boolean;
}

export interface MenuItemOptionChoice {
  name: string;
  extraPrice: number;
  available: boolean;
}

export interface MenuItemOptionGroup {
  groupName: string;
  required: boolean;
  choices: MenuItemOptionChoice[];
}

export interface MenuItem {
  id: string;
  name: string;
  nameEn?: string;
  price: number;
  category: string;
  description?: string;
  descriptionEn?: string;
  imageKey?: string;
  imageUrl?: string;
  stock?: number | null;
  sizes?: MenuItemSize[];
  options?: MenuItemOptionGroup[];
  riceTypes?: MenuItemOptionChoice[];
  additions?: MenuItemOptionChoice[];
  calories?: number | null;
  walkingMinutes?: number | null;
}

export interface MenuCategory {
  id: string;
  name: string;
  nameEn?: string;
  icon: string;
  items: MenuItem[];
  isDelivery?: boolean;
  isDhabiha?: boolean;
  isOccasions?: boolean;
}

export const RESTAURANT_INFO = {
  name: "البيت الشامي",
  tagline: "للمذاق فن وأصول",
  taglineEn: "A Fine Art of Taste",
  nameEn: "The Levantine House",
  phone: "",
  whatsapp: "",
  location: "",
  locationEn: "",
  instagram: "",
  dhabihaPhone: "",
  dhabihaWhatsapp: "",
};

// Menu data and product images are server-owned. A failed API request must
// never fall back to content inherited from another restaurant.
export const FOOD_IMAGES: Record<string, never> = {};
export const MENU_CATEGORIES: MenuCategory[] = [];
export const ALL_ITEMS: MenuItem[] = [];