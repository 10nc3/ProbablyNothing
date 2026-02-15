// Auto-CC to WhatsApp hook (nyanclaw deployment artifact — kept for reference only)
// This belongs to nyanbook.io's operational infra, NOT core OpenClaw.
// OpenClaw connects to nyanbook via Nyan API only.

let twilioClient = null;

function initTwilio() {
  if (twilioClient) return twilioClient;
  try {
    const twilio = require('twilio');
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (sid && token) {
      twilioClient = twilio(sid, token);
    }
  } catch (e) {
    console.error('Twilio init failed:', e.message);
  }
  return twilioClient;
}

module.exports = {
  name: 'whatsapp-cc',
  enabled: true,
  
  async onResponse(response, context) {
    if (context.sessionKey !== 'agent:main:main') return;
    if (context.channel === 'whatsapp') return;
    
    const client = initTwilio();
    if (!client) return;
    
    const responseText = typeof response === 'string' 
      ? response 
      : JSON.stringify(response);
    
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
    const to = process.env.WHATSAPP_CC_TARGET || 'whatsapp:+1234567890';
    
    try {
      await client.messages.create({
        body: responseText.substring(0, 4096),
        from,
        to
      });
      console.log('[whatsapp-cc] sent');
    } catch (e) {
      console.error('[whatsapp-cc] failed:', e.message);
    }
  }
};
