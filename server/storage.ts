import {
  type Configuration,
  type InsertConfiguration,
  type WhatsappMessage,
  type InsertWhatsappMessage,
  type CalendarEvent,
  type InsertCalendarEvent,
  type MessageWithEvent,
  type ProcessingStatus,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Configuration
  getConfiguration(userId: string): Promise<Configuration | undefined>;
  upsertConfiguration(config: InsertConfiguration): Promise<Configuration>;
  
  // WhatsApp Messages
  getMessages(limit?: number): Promise<MessageWithEvent[]>;
  getMessageByMessageId(messageId: string): Promise<WhatsappMessage | undefined>;
  createMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
  updateMessageStatus(
    id: string,
    status: string,
    processedAt?: Date,
    errorMessage?: string
  ): Promise<void>;
  
  // Calendar Events
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  getEventsByMessageId(messageId: string): Promise<CalendarEvent[]>;
  
  // Processing Status
  getProcessingStatus(): Promise<ProcessingStatus>;
}

export class MemStorage implements IStorage {
  private configurations: Map<string, Configuration>;
  private messages: Map<string, WhatsappMessage>;
  private events: Map<string, CalendarEvent>;
  private lastChecked?: Date;

  constructor() {
    this.configurations = new Map();
    this.messages = new Map();
    this.events = new Map();
  }

  async getConfiguration(userId: string): Promise<Configuration | undefined> {
    return Array.from(this.configurations.values()).find(
      (config) => config.userId === userId
    );
  }

  async upsertConfiguration(insertConfig: InsertConfiguration): Promise<Configuration> {
    const existing = await this.getConfiguration(insertConfig.userId);
    
    if (existing) {
      const updated: Configuration = {
        id: existing.id,
        userId: insertConfig.userId,
        twilioAccountSid: insertConfig.twilioAccountSid ?? existing.twilioAccountSid,
        twilioAuthToken: insertConfig.twilioAuthToken ?? existing.twilioAuthToken,
        twilioWhatsappNumber: insertConfig.twilioWhatsappNumber ?? existing.twilioWhatsappNumber,
        calendarService: insertConfig.calendarService ?? existing.calendarService,
        calendarEndpoint: insertConfig.calendarEndpoint ?? existing.calendarEndpoint,
        calendarAccessToken: insertConfig.calendarAccessToken ?? existing.calendarAccessToken,
        pollingInterval: insertConfig.pollingInterval ?? existing.pollingInterval,
        isActive: insertConfig.isActive ?? existing.isActive,
        updatedAt: new Date(),
      };
      this.configurations.set(existing.id, updated);
      return updated;
    }
    
    const id = randomUUID();
    const config: Configuration = {
      id,
      userId: insertConfig.userId,
      twilioAccountSid: insertConfig.twilioAccountSid ?? null,
      twilioAuthToken: insertConfig.twilioAuthToken ?? null,
      twilioWhatsappNumber: insertConfig.twilioWhatsappNumber ?? null,
      calendarService: insertConfig.calendarService,
      calendarEndpoint: insertConfig.calendarEndpoint ?? null,
      calendarAccessToken: insertConfig.calendarAccessToken ?? null,
      pollingInterval: insertConfig.pollingInterval,
      isActive: insertConfig.isActive,
      updatedAt: new Date(),
    };
    this.configurations.set(id, config);
    return config;
  }

  async getMessages(limit: number = 50): Promise<MessageWithEvent[]> {
    const messages = Array.from(this.messages.values())
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
      .slice(0, limit);

    return Promise.all(
      messages.map(async (message) => {
        const events = await this.getEventsByMessageId(message.id);
        return {
          ...message,
          event: events[0],
        };
      })
    );
  }

  async getMessageByMessageId(messageId: string): Promise<WhatsappMessage | undefined> {
    return Array.from(this.messages.values()).find(
      (msg) => msg.messageId === messageId
    );
  }

  async createMessage(insertMessage: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const id = randomUUID();
    const message: WhatsappMessage = {
      id,
      ...insertMessage,
      processedAt: insertMessage.processedAt || null,
      errorMessage: insertMessage.errorMessage || null,
    };
    this.messages.set(id, message);
    return message;
  }

  async updateMessageStatus(
    id: string,
    status: string,
    processedAt?: Date,
    errorMessage?: string
  ): Promise<void> {
    const message = this.messages.get(id);
    if (message) {
      message.status = status;
      if (processedAt) message.processedAt = processedAt;
      if (errorMessage) message.errorMessage = errorMessage;
      this.messages.set(id, message);
    }
  }

  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const id = randomUUID();
    const event: CalendarEvent = {
      id,
      ...insertEvent,
      endTime: insertEvent.endTime || null,
      location: insertEvent.location || null,
      description: insertEvent.description || null,
      attendees: insertEvent.attendees || null,
      externalEventId: insertEvent.externalEventId || null,
      createdAt: new Date(),
    };
    this.events.set(id, event);
    return event;
  }

  async getEventsByMessageId(messageId: string): Promise<CalendarEvent[]> {
    return Array.from(this.events.values()).filter(
      (event) => event.messageId === messageId
    );
  }

  async getProcessingStatus(): Promise<ProcessingStatus> {
    const messages = Array.from(this.messages.values());
    const processedMessages = messages.filter((m) => m.status === "processed");
    const failedMessages = messages.filter((m) => m.status === "failed");
    const config = await this.getConfiguration("default");

    return {
      isActive: config?.isActive ?? false,
      lastChecked: this.lastChecked?.toISOString(),
      messagesProcessed: processedMessages.length,
      eventsCreated: this.events.size,
      errors: failedMessages.length,
    };
  }

  setLastChecked(date: Date): void {
    this.lastChecked = date;
  }
}

export const storage = new MemStorage();
