import type { Express } from "express";
import { createServer, type Server } from "http";
import { createHmac } from "crypto";
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
      const previousConfig = await storage.getConfiguration("default");
      const config = await storage.upsertConfiguration(validated);
      
      // Handle polling mode: restart if active and not using webhooks
      const shouldRestart = config.isActive && !config.useWebhook && (
        !previousConfig || 
        previousConfig.pollingInterval !== config.pollingInterval ||
        previousConfig.useWebhook !== config.useWebhook ||
        !previousConfig.isActive
      );
      
      if (shouldRestart) {
        await startProcessing(config);
      } else if (!config.isActive || config.useWebhook) {
        // Stop polling if bot is inactive or switched to webhook mode
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

  // Twilio webhook endpoint for real-time message notifications
  app.post("/api/webhooks/twilio", async (req, res) => {
    try {
      const config = await storage.getConfiguration("default");
      
      if (!config || !config.twilioAuthToken) {
        res.status(403).send("Forbidden");
        return;
      }
      
      // Verify Twilio signature using raw body
      const twilioSignature = req.get("X-Twilio-Signature") || "";
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const rawBody = (req as any).rawBody ? (req as any).rawBody.toString("utf-8") : "";
      
      if (!verifyTwilioSignature(config.twilioAuthToken, url, rawBody, twilioSignature)) {
        console.log("Invalid Twilio signature");
        res.status(403).send("Forbidden");
        return;
      }
      
      // Return TwiML response immediately
      res.set("Content-Type", "text/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
      
      // Process webhook asynchronously
      if (!config.isActive || !config.useWebhook) {
        console.log("Webhook received but bot not configured for webhook mode");
        return;
      }
      
      // Extract Twilio message data from webhook payload
      const { MessageSid, From, Body, DateCreated } = req.body;
      
      if (!MessageSid || !From || !Body) {
        console.log("Invalid webhook payload:", req.body);
        return;
      }
      
      // Check if message already exists
      const existing = await storage.getMessageByMessageId(MessageSid);
      if (existing) {
        console.log(`Message ${MessageSid} already processed, skipping`);
        return;
      }
      
      // Create message record
      const message = await storage.createMessage({
        messageId: MessageSid,
        from: From,
        body: Body,
        receivedAt: DateCreated ? new Date(DateCreated) : new Date(),
        processedAt: null,
        status: "pending",
        errorMessage: null,
      });
      
      // Process the message
      processSingleMessage(message, config).catch((error) => {
        console.error(`Failed to process webhook message ${message.id}:`, error);
      });
      
    } catch (error: any) {
      console.error("Error handling Twilio webhook:", error.message);
      // Don't send error response since we already sent TwiML
    }
  });

  // Start automatic processing if configured for polling mode
  const config = await storage.getConfiguration("default");
  if (config?.isActive && !config.useWebhook) {
    await startProcessing(config);
  }

  const httpServer = createServer(app);
  return httpServer;
}

let isProcessing = false;

async function startProcessing(config: any) {
  stopProcessing();
  
  const intervalMinutes = parseInt(config.pollingInterval) || 5;
  const intervalMs = intervalMinutes * 60 * 1000;
  
  console.log(`Starting message processing every ${intervalMinutes} minute(s)`);
  
  // Process immediately on start
  processMessages(config).catch(console.error);
  
  // Then schedule recurring processing with fresh config each time
  processingInterval = setInterval(() => {
    (async () => {
      try {
        const freshConfig = await storage.getConfiguration("default");
        if (freshConfig && freshConfig.isActive) {
          processMessages(freshConfig).catch(console.error);
        }
      } catch (error) {
        console.error("Error fetching configuration in polling interval:", error);
      }
    })();
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
  // Guard against overlapping executions
  if (isProcessing) {
    console.log("Processing already in progress, skipping this run");
    return;
  }
  
  isProcessing = true;
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
      
      await processSingleMessage(message, config);
    }
  } catch (error: any) {
    console.error("Error processing messages:", error.message);
  } finally {
    isProcessing = false;
  }
}

function verifyTwilioSignature(
  authToken: string,
  url: string,
  rawBody: string,
  signature: string
): boolean {
  // Twilio signature validation using raw URL-encoded body
  // Parse the raw body to get form params
  const params = new URLSearchParams(rawBody);
  const sortedParams: string[] = [];
  
  // Sort and concatenate params with URL
  Array.from(params.keys()).sort().forEach((key) => {
    sortedParams.push(key + params.get(key));
  });
  
  const data = url + sortedParams.join("");
  
  // Create HMAC-SHA1 hash
  const hmac = createHmac("sha1", authToken);
  hmac.update(data, "utf-8");
  const expectedSignature = hmac.digest("base64");
  
  // Use timing-safe comparison
  const crypto = require("crypto");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

async function processSingleMessage(message: any, config: any) {
  try {
    // Parse invite using AI
    console.log(`Parsing message ${message.id}...`);
    const invite = await parseInviteMessage(message.body);
    
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
