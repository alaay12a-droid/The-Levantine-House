export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  imageKey?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  icon: string;
  items: MenuItem[];
}

export const RESTAURANT_INFO = {
  name: "روابي المندي",
  tagline: "للمذاق فن وأصول",
  nameEn: "Rawabi Al Mandi",
  phone: "0530707042",
  whatsapp: "966530707042",
  location: "تبوك - حي الروضة",
  instagram: "@rwabi-almndi",
};

export const FOOD_IMAGES: Record<string, any> = {
  chicken_mandi: require("@/assets/images/chicken_mandi.png"),
  meat_mandi: require("@/assets/images/meat_mandi.png"),
  oreo_dessert: require("@/assets/images/oreo_dessert.jpg"),
  tatli: require("@/assets/images/tatli.jpg"),
  muhalabia: require("@/assets/images/muhalabia.jpg"),
  pepsi: require("@/assets/images/pepsi.jpg"),
};

export const MENU_CATEGORIES: MenuCategory[] = [
  {
    id: "chicken",
    name: "الدجاج",
    icon: "🍗",
    items: [
      { id: "c1", name: "مندي دجاج حبة كاملة", price: 28, category: "chicken", description: "بدون رز", imageKey: "chicken_mandi" },
      { id: "c2", name: "رز مندي", price: 7, category: "chicken" },
      { id: "c3", name: "رز بشاور", price: 7, category: "chicken" },
    ],
  },
  {
    id: "meat",
    name: "اللحوم",
    icon: "🥩",
    items: [
      { id: "m1", name: "لحم مندي بلدي - تيس كامل", price: 1400, category: "meat", imageKey: "meat_mandi" },
      { id: "m2", name: "لحم مندي بلدي - نص تيس", price: 700, category: "meat", imageKey: "meat_mandi" },
      { id: "m3", name: "لحم مندي بلدي - ربع تيس", price: 350, category: "meat", imageKey: "meat_mandi" },
      { id: "m4", name: "لحم مندي", price: 90, category: "meat", imageKey: "meat_mandi" },
    ],
  },
  {
    id: "mains",
    name: "الأطباق الرئيسية",
    icon: "🍽️",
    items: [
      { id: "ma1", name: "مضغوط دجاج حبة كاملة مع الرز", price: 42, category: "mains", imageKey: "chicken_mandi" },
      { id: "ma2", name: "مضغوط دجاج نص حبة مع الرز", price: 21, category: "mains", imageKey: "chicken_mandi" },
    ],
  },
  {
    id: "sides",
    name: "الإيدامات",
    icon: "🥘",
    items: [
      { id: "s1", name: "إيدام ملوخية صغير", price: 4, category: "sides" },
      { id: "s2", name: "إيدام ملوخية كبير", price: 6, category: "sides" },
      { id: "s3", name: "إيدام مصقع صغير", price: 4, category: "sides" },
      { id: "s4", name: "إيدام مصقع كبير", price: 6, category: "sides" },
      { id: "s5", name: "إيدام فرن كبير", price: 6, category: "sides" },
    ],
  },
  {
    id: "salads",
    name: "السلطات",
    icon: "🥗",
    items: [
      { id: "sa1", name: "سلطة خيار باللبن", price: 3, category: "salads" },
      { id: "sa2", name: "سلطة خضراء", price: 3, category: "salads" },
      { id: "sa3", name: "طحينة سائلة", price: 3, category: "salads" },
    ],
  },
  {
    id: "desserts",
    name: "الحلويات",
    icon: "🍮",
    items: [
      { id: "d1", name: "حلا أوريو", price: 4, category: "desserts", imageKey: "oreo_dessert" },
      { id: "d2", name: "حلا تاتلي", price: 4, category: "desserts", imageKey: "tatli" },
      { id: "d3", name: "حلا مهلبية", price: 4, category: "desserts", imageKey: "muhalabia" },
    ],
  },
  {
    id: "drinks",
    name: "المشروبات",
    icon: "🥤",
    items: [
      { id: "dr1", name: "بيبسي عائلة", price: 9, category: "drinks", imageKey: "pepsi" },
      { id: "dr2", name: "بيبسي وسط 1 لتر", price: 5, category: "drinks", imageKey: "pepsi" },
      { id: "dr3", name: "بيبسي علبة", price: 2.5, category: "drinks", imageKey: "pepsi" },
      { id: "dr4", name: "لبن", price: 2.5, category: "drinks" },
    ],
  },
  {
    id: "extras",
    name: "إضافات",
    icon: "✨",
    items: [
      { id: "e1", name: "كنافة قشطة", price: 8, category: "extras" },
      { id: "e2", name: "قرصان صغير", price: 4, category: "extras" },
      { id: "e3", name: "قرصان كبير", price: 6, category: "extras" },
    ],
  },
];

export const ALL_ITEMS: MenuItem[] = MENU_CATEGORIES.flatMap((cat) => cat.items);
