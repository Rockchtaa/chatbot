import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull(),
  message: text("message").notNull(),
  reply: text("reply").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export type ChatInsert = typeof chats.$inferInsert;
export type ChatSelect = typeof chats.$inferSelect;