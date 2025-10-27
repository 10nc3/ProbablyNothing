export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  whatsappNumber: string;
}

export interface TwilioMessage {
  sid: string;
  from: string;
  to: string;
  body: string;
  dateCreated: string;
  status: string;
}

export async function fetchWhatsAppMessages(
  config: TwilioConfig,
  limit: number = 20
): Promise<TwilioMessage[]> {
  const { accountSid, authToken, whatsappNumber } = config;
  
  const url = new URL(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`);
  url.searchParams.append("To", whatsappNumber);
  url.searchParams.append("PageSize", limit.toString());
  
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.messages.map((msg: any) => ({
      sid: msg.sid,
      from: msg.from,
      to: msg.to,
      body: msg.body,
      dateCreated: msg.date_created,
      status: msg.status,
    }));
  } catch (error: any) {
    throw new Error(`Failed to fetch Twilio messages: ${error.message}`);
  }
}

export async function testTwilioConnection(
  accountSid: string,
  authToken: string
): Promise<boolean> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
}
