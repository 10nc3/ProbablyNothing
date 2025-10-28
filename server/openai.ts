import OpenAI from "openai";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export interface ParsedInvite {
  title: string;
  startTime: string; // ISO 8601 format
  endTime?: string; // ISO 8601 format
  location?: string;
  description?: string;
  attendees?: string[];
}

export async function parseInviteMessage(messageBody: string): Promise<ParsedInvite> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are an AI assistant that extracts calendar event details from text messages. 
Extract the following information if available:
- title: A brief title for the event
- startTime: The event start date and time in ISO 8601 format
- endTime: The event end date and time in ISO 8601 format (if mentioned)
- location: The location of the event
- description: Any additional details about the event
- attendees: List of people attending (email addresses or names)

Always respond with valid JSON only. If a field is not mentioned, omit it from the response.
For dates, assume the current year if not specified. Use reasonable defaults for time if not specified (e.g., 9:00 AM).`,
      },
      {
        role: "user",
        content: `Parse this invite message and extract event details:\n\n${messageBody}`,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 500,
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const parsed = JSON.parse(content);
  
  // Validate required fields
  if (!parsed.title || !parsed.startTime) {
    throw new Error("Could not extract required event details (title and start time)");
  }

  return parsed as ParsedInvite;
}

export async function parseInviteMessages(messageBody: string): Promise<ParsedInvite[]> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are an AI assistant that extracts calendar event details from text messages. 
A message may contain ONE or MULTIPLE event invites. Extract ALL events mentioned.

For each event, extract the following information if available:
- title: A brief title for the event
- startTime: The event start date and time in ISO 8601 format
- endTime: The event end date and time in ISO 8601 format (if mentioned)
- location: The location of the event
- description: Any additional details about the event
- attendees: List of people attending (email addresses or names)

Respond with valid JSON in this format:
{
  "events": [
    { "title": "...", "startTime": "...", ... },
    { "title": "...", "startTime": "...", ... }
  ]
}

If only one event is found, return an array with one event.
For dates, assume the current year if not specified. Use reasonable defaults for time if not specified (e.g., 9:00 AM).
If a field is not mentioned, omit it from the response.`,
      },
      {
        role: "user",
        content: `Parse this message and extract all event details:\n\n${messageBody}`,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 1000,
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const parsed = JSON.parse(content);
  
  // Validate events array exists
  if (!parsed.events || !Array.isArray(parsed.events) || parsed.events.length === 0) {
    throw new Error("No events found in message");
  }

  // Validate each event has required fields
  for (const event of parsed.events) {
    if (!event.title || !event.startTime) {
      throw new Error("Could not extract required event details (title and start time) for all events");
    }
  }

  return parsed.events as ParsedInvite[];
}

export async function generateConfirmationMessage(events: ParsedInvite[]): Promise<string> {
  const eventDetails = events.map((event, index) => 
    `Event ${events.length > 1 ? index + 1 : ''}:
Title: ${event.title}
Start: ${event.startTime}
${event.endTime ? `End: ${event.endTime}` : ''}
${event.location ? `Location: ${event.location}` : ''}
${event.description ? `Description: ${event.description}` : ''}`
  ).join('\n\n');

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are a friendly calendar assistant that confirms event creation. 
Generate a short, natural confirmation message that acknowledges all ${events.length} event${events.length > 1 ? 's' : ''}.

For multiple events:
- Start with a friendly acknowledgment mentioning the count
- List each event briefly with title and time
- Keep it concise and professional

For single event:
- Acknowledge the creation
- Include the title, date and time
- Mention location if provided

Keep it natural and professional. Don't use emojis.`,
      },
      {
        role: "user",
        content: `Generate a confirmation message for ${events.length === 1 ? 'this calendar event' : 'these calendar events'}:\n\n${eventDetails}`,
      },
    ],
    max_completion_tokens: 300,
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  return content.trim();
}
