import type { ParsedInvite } from "./openai";

export interface CalendarServiceConfig {
  service: string;
  endpoint?: string;
  accessToken?: string;
}

export async function createCalendarEvent(
  invite: ParsedInvite,
  config: CalendarServiceConfig
): Promise<string> {
  switch (config.service) {
    case "google":
      return createGoogleCalendarEvent(invite, config.accessToken!);
    case "outlook":
      return createOutlookCalendarEvent(invite, config.accessToken!);
    case "custom":
      return createCustomWebhookEvent(invite, config.endpoint!);
    default:
      throw new Error(`Unsupported calendar service: ${config.service}`);
  }
}

async function createGoogleCalendarEvent(
  invite: ParsedInvite,
  accessToken: string
): Promise<string> {
  const url = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  
  const event = {
    summary: invite.title,
    description: invite.description,
    location: invite.location,
    start: {
      dateTime: invite.startTime,
      timeZone: "UTC",
    },
    end: {
      dateTime: invite.endTime || invite.startTime,
      timeZone: "UTC",
    },
    attendees: invite.attendees?.map((email) => ({ email })),
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    
    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.id;
  } catch (error: any) {
    throw new Error(`Failed to create Google Calendar event: ${error.message}`);
  }
}

async function createOutlookCalendarEvent(
  invite: ParsedInvite,
  accessToken: string
): Promise<string> {
  const url = "https://graph.microsoft.com/v1.0/me/events";
  
  const event = {
    subject: invite.title,
    body: {
      contentType: "HTML",
      content: invite.description || "",
    },
    location: {
      displayName: invite.location || "",
    },
    start: {
      dateTime: invite.startTime,
      timeZone: "UTC",
    },
    end: {
      dateTime: invite.endTime || invite.startTime,
      timeZone: "UTC",
    },
    attendees: invite.attendees?.map((email) => ({
      emailAddress: { address: email },
      type: "required",
    })),
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    
    if (!response.ok) {
      throw new Error(`Outlook API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.id;
  } catch (error: any) {
    throw new Error(`Failed to create Outlook Calendar event: ${error.message}`);
  }
}

async function createCustomWebhookEvent(
  invite: ParsedInvite,
  endpoint: string
): Promise<string> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invite),
    });
    
    if (!response.ok) {
      throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.id || data.eventId || "custom-event-id";
  } catch (error: any) {
    throw new Error(`Failed to send event to custom webhook: ${error.message}`);
  }
}
