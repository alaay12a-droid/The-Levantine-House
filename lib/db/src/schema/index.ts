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
  status: orderStatusEnum("status").default("pending").notNull(),
  paymentMethod: text("payment_method").default("cash").notNull(),
  notes: text("notes"),
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
