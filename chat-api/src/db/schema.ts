import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull(),
  message: text("message").notNull(),
  reply: text("reply").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Type inference for Drizzle queries
export type ChatInsert = typeof chats.$inferSelect;
export type ChatSelect = typeof chats.$inferInsert;
export type UserInsert = typeof users.$inferSelect;
export type UserSelect = typeof users.$inferInsert;