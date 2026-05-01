import { pgTable, serial, text, integer, jsonb, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "preparing",
  "ready",
  "done",
]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  dailyNumber: integer("daily_number").notNull().default(0),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address"),
  items: jsonb("items").notNull(),
  totalPrice: integer("total_price").notNull(),
  deliveryFee: integer("delivery_fee").notNull().default(0),
  status: orderStatusEnum("status").default("pending").notNull(),
  paymentMethod: text("payment_method").default("cash").notNull(),
  notes: text("notes"),
  customerPushToken: text("customer_push_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;

export const menuItemsTable = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  itemId: text("item_id").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: integer("price").notNull(),
  available: boolean("available").notNull().default(true),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  stock: integer("stock"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MenuItem = typeof menuItemsTable.$inferSelect;

export const occasionsTable = pgTable("occasions", {
  id: serial("id").primaryKey(),
  occasionId: text("occasion_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  imageKey: text("image_key"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Occasion = typeof occasionsTable.$inferSelect;

export const bannersTable = pgTable("banners", {
  id: serial("id").primaryKey(),
  bannerId: text("banner_id").notNull().unique(),
  imageUrl: text("image_url").notNull(),
  imageKey: text("image_key"),
  title: text("title"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Banner = typeof bannersTable.$inferSelect;

export const combosTable = pgTable("combos", {
  id: serial("id").primaryKey(),
  comboId: text("combo_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  imageUrl: text("image_url"),
  imageKey: text("image_key"),
  components: jsonb("components").notNull().default([]),
  available: boolean("available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Combo = typeof combosTable.$inferSelect;

export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pushTokensTable = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PushToken = typeof pushTokensTable.$inferSelect;
