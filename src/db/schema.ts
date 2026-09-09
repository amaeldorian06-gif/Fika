import { pgTable, text, timestamp, boolean, uuid, integer, json, pgEnum, decimal } from "drizzle-orm/pg-core";

export const adminRoleEnum = pgEnum("AdminRole", ["SUPERADMIN", "OPERATOR", "FINANCE", "QUALITY"]);

export const adminUsers = pgTable("admin_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: adminRoleEnum("role").default("OPERATOR").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderStatusEnum = pgEnum("OrderStatus", ["NEW", "QUALIFYING", "QUOTED", "AWAITING_CONFIRMATION", "PAID", "ASSIGNED", "IN_PROGRESS", "QUALITY_CHECK", "READY", "DELIVERED", "COMPLETED", "CANCELLED", "DISPUTED"]);

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  phone: text("phone").unique(),
  name: text("name"),
  email: text("email"),
  totalSpent: decimal("total_spent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const experts = pgTable("experts", {
  id: text("id").primaryKey(),
  phone: text("phone").unique().notNull(),
  name: text("name").notNull(),
  cityId: text("city_id"),
  zoneId: text("zone_id"),
  status: text("status").default("ACTIVE"),
  successRate: integer("success_rate"),
  completedTasks: integer("completed_tasks").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  status: orderStatusEnum("status").default("NEW").notNull(),
  customerId: text("customer_id").notNull(),
  source: text("source"),
  totalPrice: decimal("total_price"),
  marginAmount: decimal("margin_amount"),
  marginPercent: decimal("margin_percent"),
  paymentStatus: text("payment_status").default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  source: text("source"),
  serviceSlug: text("service_slug"),
  categorySlug: text("category_slug"),
  cityId: text("city_id"),
  whatsappPayload: text("whatsapp_payload"),
  status: text("status").default("NEW"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
