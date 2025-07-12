import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  is_email_verified: boolean("is_email_verified").default(false).notNull(),
  email_verification_token: text("email_verification_token"),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), 
  title: text("title").notNull(), // title of the conversation
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(), 
});

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  conversation_id: serial("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }), 
  message: text("message").notNull(),
  reply: text("reply").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Type inference for Drizzle queries
export type UserInsert = typeof users.$inferInsert;
export type UserSelect = typeof users.$inferSelect;
export type ConversationInsert = typeof conversations.$inferInsert;
export type ConversationSelect = typeof conversations.$inferSelect;
export type ChatInsert = typeof chats.$inferInsert;
export type ChatSelect = typeof chats.$inferSelect;