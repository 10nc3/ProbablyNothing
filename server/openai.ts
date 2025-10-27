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
