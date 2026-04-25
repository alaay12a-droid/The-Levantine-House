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
  isDelivery?: boolean;
  isDhabiha?: boolean;
  isOccasions?: boolean;
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
  chicken_full: require("@/assets/images/chicken_full.png"),
  chicken_half: require("@/assets/images/chicken_half.png"),
  chicken_mandi: require("@/assets/images/chicken_mandi.png"),
  meat_full: require("@/assets/images/meat_full.png"),
  meat_nefs: require("@/assets/images/meat_nefs.png"),
  meat_half: require("@/assets/images/meat_half.png"),
  meat_mandi: require("@/assets/images/meat_mandi.png"),
  oreo_dessert: require("@/assets/images/oreo_dessert.jpg"),
  tatli: require("@/assets/images/tatli.jpg"),
  muhalabia: require("@/assets/images/muhalabia.jpg"),
  kunafa: require("@/assets/images/kunafa.png"),
  pepsi: require("@/assets/images/pepsi.jpg"),
  delivery_car: require("@/assets/images/delivery_car.jpg"),
  dhabiha: require("@/assets/images/dhabiha.png"),
  ramadan: require("@/assets/images/ramadan.png"),
  eid_fitr: require("@/assets/images/eid_fitr.png"),
  eid_adha: require("@/assets/images/eid_adha.png"),
  national_day: require("@/assets/images/national_day.png"),
  occasions: require("@/assets/images/occasions.png"),
  rice: require("@/assets/images/rice.jpg"),
  rice_mandi: require("@/assets/images/rice_mandi.jpg"),
  maqbous_chicken: require("@/assets/images/maqbous_chicken.jpg"),
  maqbous_half: require("@/assets/images/maqbous_half.jpg"),
  molokhia: require("@/assets/images/molokhia.jpg"),
};

export const MENU_CATEGORIES: MenuCategory[] = [
  {
    id: "chicken",
    name: "الدجاج",
    icon: "🍗",
    items: [
      { id: "c1", name: "مندي دجاج حبة كاملة", price: 28, category: "chicken", description: "بدون رز", imageKey: "chicken_full" },
      { id: "c2", name: "مندي دجاج نص حبة", price: 15, category: "chicken", description: "بدون رز", imageKey: "chicken_half" },
      { id: "c3", name: "رز مندي", price: 7, category: "chicken", imageKey: "rice_mandi" },
      { id: "c4", name: "رز بشاور", price: 7, category: "chicken", imageKey: "rice" },
    ],
  },
  {
    id: "meat",
    name: "اللحوم",
    icon: "🥩",
    items: [
      { id: "m1", name: "لحم مندي بلدي - تيس كامل", price: 1400, category: "meat", imageKey: "meat_full" },
      { id: "m2", name: "لحم مندي بلدي - نص تيس", price: 700, category: "meat", imageKey: "meat_half" },
      { id: "m3", name: "لحم مندي بلدي - ربع تيس", price: 350, category: "meat", imageKey: "meat_half" },
      { id: "m4", name: "لحم مندي - نفر", price: 90, category: "meat", imageKey: "meat_nefs" },
    ],
  },
  {
    id: "mains",
    name: "الأطباق الرئيسية",
    icon: "🍽️",
    items: [
      { id: "ma1", name: "مضغوط دجاج حبة كاملة مع الرز", price: 44, category: "mains", imageKey: "maqbous_chicken" },
      { id: "ma2", name: "مضغوط دجاج نص حبة مع الرز", price: 22, category: "mains", imageKey: "maqbous_half" },
    ],
  },
  {
    id: "sides",
    name: "الإيدامات",
    icon: "🥘",
    items: [
      { id: "s1", name: "إيدام ملوخية صغير", price: 4, category: "sides", imageKey: "molokhia" },
      { id: "s2", name: "إيدام ملوخية كبير", price: 6, category: "sides", imageKey: "molokhia" },
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
      { id: "d4", name: "كنافة قشطة", price: 8, category: "desserts", imageKey: "kunafa" },
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
      { id: "e2", name: "قرصان صغير", price: 4, category: "extras" },
      { id: "e3", name: "قرصان كبير", price: 6, category: "extras" },
    ],
  },
  {
    id: "dhabiha",
    name: "الذبائح",
    icon: "🐑",
    isDhabiha: true,
    items: [
      { id: "dh1", name: "ذبيحة كاملة - تيس بلدي", price: 0, category: "dhabiha", description: "اتصل للسعر", imageKey: "dhabiha" },
      { id: "dh2", name: "ذبيحة العيد والمناسبات", price: 0, category: "dhabiha", description: "الطبق الملكي لمناسباتكم", imageKey: "dhabiha" },
    ],
  },
  {
    id: "occasions",
    name: "عروض المناسبات",
    icon: "🎉",
    isOccasions: true,
    items: [
      { id: "oc1", name: "عروض رمضان الكريم",        price: 0, category: "occasions", description: "أسعار مميزة طوال الشهر الكريم", imageKey: "ramadan"      },
      { id: "oc2", name: "عروض عيد الفطر المبارك",  price: 0, category: "occasions", description: "احتفل مع أهلك بأشهى المأكولات",  imageKey: "eid_fitr"     },
      { id: "oc3", name: "عروض عيد الأضحى المبارك", price: 0, category: "occasions", description: "ذبائح وولائم العيد",              imageKey: "eid_adha"     },
      { id: "oc4", name: "عروض اليوم الوطني",        price: 0, category: "occasions", description: "احتفالاً باليوم الوطني السعودي", imageKey: "national_day"  },
      { id: "oc5", name: "عروض المناسبات الخاصة",   price: 0, category: "occasions", description: "أعراس • مآتم • تجمعات",          imageKey: "occasions"     },
    ],
  },
  {
    id: "delivery",
    name: "التوصيل",
    icon: "🚗",
    isDelivery: true,
    items: [],
  },
];

export const ALL_ITEMS: MenuItem[] = MENU_CATEGORIES.flatMap((cat) => cat.items);
