import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConfigurationSchema, insertWhatsappMessageSchema, insertCalendarEventSchema } from "@shared/schema";
import { parseInviteMessage } from "./openai";
import { fetchWhatsAppMessages, testTwilioConnection } from "./twilio";
import { createCalendarEvent } from "./calendar";

let processingInterval: NodeJS.Timeout | null = null;

export async function registerRoutes(app: Express): Promise<Server> {
  // Get configuration
  app.get("/api/configuration", async (req, res) => {
    try {
      const config = await storage.getConfiguration("default");
      if (!config) {
        return res.json({
          userId: "default",
          twilioAccountSid: "",
          twilioAuthToken: "",
          twilioWhatsappNumber: "",
          calendarService: "google",
          calendarEndpoint: "",
          calendarAccessToken: "",
          pollingInterval: "5",
          isActive: false,
        });
      }
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Save/update configuration
  app.post("/api/configuration", async (req, res) => {
    try {
      const validated = insertConfigurationSchema.parse(req.body);
      const config = await storage.upsertConfiguration(validated);
      
      // Restart processing if configuration changed
      if (config.isActive) {
        await startProcessing(config);
      } else {
        stopProcessing();
      }
      
      res.json(config);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Test Twilio connection
  app.post("/api/test-connection", async (req, res) => {
    try {
      const { twilioAccountSid, twilioAuthToken } = req.body;
      
      if (!twilioAccountSid || !twilioAuthToken) {
        return res.status(400).json({ error: "Missing credentials" });
      }
      
      const isValid = await testTwilioConnection(twilioAccountSid, twilioAuthToken);
      
      if (isValid) {
        res.json({ success: true, message: "Connection successful" });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get processing status
  app.get("/api/status", async (req, res) => {
    try {
      const status = await storage.getProcessingStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get message history
  app.get("/api/messages", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const messages = await storage.getMessages(limit);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Manual trigger to process messages
  app.post("/api/process-messages", async (req, res) => {
    try {
      const config = await storage.getConfiguration("default");
      if (!config) {
        return res.status(400).json({ error: "Configuration not found" });
      }
      
      await processMessages(config);
      res.json({ success: true, message: "Processing started" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start automatic processing if configured
  const config = await storage.getConfiguration("default");
  if (config?.isActive) {
    await startProcessing(config);
  }

  const httpServer = createServer(app);
  return httpServer;
}

async function startProcessing(config: any) {
  stopProcessing();
  
  const intervalMinutes = parseInt(config.pollingInterval) || 5;
  const intervalMs = intervalMinutes * 60 * 1000;
  
  console.log(`Starting message processing every ${intervalMinutes} minute(s)`);
  
  // Process immediately on start
  processMessages(config).catch(console.error);
  
  // Then schedule recurring processing
  processingInterval = setInterval(() => {
    processMessages(config).catch(console.error);
  }, intervalMs);
}

function stopProcessing() {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
    console.log("Stopped message processing");
  }
}

async function processMessages(config: any) {
  try {
    console.log("Processing WhatsApp messages...");
    
    if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioWhatsappNumber) {
      console.log("Twilio not configured, skipping processing");
      return;
    }
    
    // Fetch recent messages from Twilio
    const twilioMessages = await fetchWhatsAppMessages({
      accountSid: config.twilioAccountSid,
      authToken: config.twilioAuthToken,
      whatsappNumber: config.twilioWhatsappNumber,
    });
    
    (storage as any).setLastChecked(new Date());
    
    console.log(`Found ${twilioMessages.length} messages from Twilio`);
    
    // Process each message
    for (const twilioMsg of twilioMessages) {
      // Check if we've already processed this message
      const existing = await storage.getMessageByMessageId(twilioMsg.sid);
      if (existing) {
        continue;
      }
      
      // Create message record
      const message = await storage.createMessage({
        messageId: twilioMsg.sid,
        from: twilioMsg.from,
        body: twilioMsg.body,
        receivedAt: new Date(twilioMsg.dateCreated),
        processedAt: null,
        status: "pending",
        errorMessage: null,
      });
      
      try {
        // Parse invite using AI
        console.log(`Parsing message ${message.id}...`);
        const invite = await parseInviteMessage(twilioMsg.body);
        
        // Create calendar event
        console.log(`Creating calendar event for message ${message.id}...`);
        const externalEventId = await createCalendarEvent(invite, {
          service: config.calendarService,
          endpoint: config.calendarEndpoint,
          accessToken: config.calendarAccessToken,
        });
        
        // Store event in database
        await storage.createCalendarEvent({
          messageId: message.id,
          title: invite.title,
          startTime: new Date(invite.startTime),
          endTime: invite.endTime ? new Date(invite.endTime) : null,
          location: invite.location || null,
          description: invite.description || null,
          attendees: invite.attendees || null,
          externalEventId,
          calendarService: config.calendarService,
        });
        
        // Update message status
        await storage.updateMessageStatus(message.id, "processed", new Date());
        console.log(`Successfully processed message ${message.id}`);
      } catch (error: any) {
        console.error(`Failed to process message ${message.id}:`, error.message);
        await storage.updateMessageStatus(
          message.id,
          "failed",
          new Date(),
          error.message
        );
      }
    }
  } catch (error: any) {
    console.error("Error processing messages:", error.message);
  }
}
