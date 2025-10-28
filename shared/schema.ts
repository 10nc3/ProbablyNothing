import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Configuration table for storing Twilio and calendar settings
export const configurations = pgTable("configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().default("default"),
  
  // Twilio settings
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"),
  twilioWhatsappNumber: text("twilio_whatsapp_number"),
  
  // Calendar service configuration
  calendarService: text("calendar_service").notNull().default("google"), // google, outlook, custom
  calendarEndpoint: text("calendar_endpoint"), // for custom webhooks
  calendarAccessToken: text("calendar_access_token"), // OAuth token for Google/Outlook
  
  // Bot settings
  pollingInterval: text("polling_interval").notNull().default("5"), // minutes
  isActive: boolean("is_active").notNull().default(false),
  useWebhook: boolean("use_webhook").notNull().default(false), // true for webhook, false for polling
  
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConfigurationSchema = createInsertSchema(configurations).omit({
  id: true,
  updatedAt: true,
});

export type InsertConfiguration = z.infer<typeof insertConfigurationSchema>;
export type Configuration = typeof configurations.$inferSelect;

// WhatsApp messages table
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: text("message_id").notNull().unique(), // Twilio message SID
  from: text("from").notNull(),
  body: text("body").notNull(),
  receivedAt: timestamp("received_at").notNull(),
  processedAt: timestamp("processed_at"),
  status: text("status").notNull().default("pending"), // pending, processed, failed
  errorMessage: text("error_message"),
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
});

export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;

// Calendar events table
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => whatsappMessages.id),
  
  // Event details extracted by AI
  title: text("title").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  location: text("location"),
  description: text("description"),
  attendees: text("attendees").array(),
  
  // Calendar service response
  externalEventId: text("external_event_id"), // ID from Google/Outlook/etc
  calendarService: text("calendar_service").notNull(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

// Extended types for frontend
export type MessageWithEvent = WhatsappMessage & {
  event?: CalendarEvent; // For backward compatibility
  events?: CalendarEvent[]; // Multiple events support
};

export type ProcessingStatus = {
  isActive: boolean;
  lastChecked?: string;
  messagesProcessed: number;
  eventsCreated: number;
  errors: number;
};
