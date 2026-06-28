/**
 * Webhook Service
 * Inatuma HTTP POST requests kwenda URLs za nje kwa events mbalimbali
 * Inasaidia integration na Zapier, Make.com, n8n, na mifumo mingine
 */

import { getDb } from '../db/db.js';
import { randomBytes, createHmac } from 'crypto';

// Event types zinazosaidika
export const WEBHOOK_EVENTS = {
  NEW_MESSAGE: 'new_message',
  NEW_CONTACT: 'new_contact',
  NEW_ORDER: 'new_order',
  ORDER_STATUS_CHANGED: 'order_status_changed',
  CAMPAIGN_COMPLETED: 'campaign_completed',
  CONTACT_OPT_OUT: 'contact_opt_out',
  LEAD_SCORE_CHANGED: 'lead_score_changed',
  PAYMENT_RECEIVED: 'payment_received',
};

/**
 * Tuma webhook kwa event fulani
 */
export async function triggerWebhook(userId, eventType, data) {
  const db = getDb();
  
  try {
    // Pata webhooks za user ambazo zinashughulikia event hii
    const webhooks = await db.all(
      `SELECT * FROM webhooks 
       WHERE user_id = ? AND active = 1 AND events LIKE ?`,
      [userId, `%${eventType}%`]
    );

    if (webhooks.length === 0) return;

    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const webhook of webhooks) {
      await sendWebhookRequest(webhook, payload);
    }
  } catch (err) {
    console.error('Webhook trigger error:', err);
  }
}

/**
 * Tuma HTTP POST request kwenda webhook URL
 */
async function sendWebhookRequest(webhook, payload) {
  const db = getDb();
  
  try {
    const payloadStr = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'AgentNKO-Webhook/1.0',
      'X-AgentNKO-Event': payload.event,
      'X-AgentNKO-Timestamp': payload.timestamp,
    };

    // Add signature if secret is set
    if (webhook.secret) {
      const signature = createHmac('sha256', webhook.secret)
        .update(payloadStr)
        .digest('hex');
      headers['X-AgentNKO-Signature'] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      await db.run(
        `UPDATE webhooks SET 
           last_triggered = CURRENT_TIMESTAMP,
           success_count = success_count + 1 
         WHERE id = ?`,
        [webhook.id]
      );
      console.log(`✅ Webhook ${webhook.id} triggered successfully for event: ${payload.event}`);
    } else {
      await db.run(
        'UPDATE webhooks SET fail_count = fail_count + 1 WHERE id = ?',
        [webhook.id]
      );
      console.error(`Webhook ${webhook.id} failed with status: ${response.status}`);
    }
  } catch (err) {
    await db.run(
      'UPDATE webhooks SET fail_count = fail_count + 1 WHERE id = ?',
      [webhook.id]
    );
    console.error(`Webhook ${webhook.id} error:`, err.message);
  }
}

/**
 * Generate API key mpya kwa user
 */
export function generateApiKey() {
  return 'nko_' + randomBytes(32).toString('hex');
}

/**
 * Thibitisha API key na pata user
 */
export async function verifyApiKey(apiKey) {
  const db = getDb();
  return db.get('SELECT * FROM users WHERE api_key = ?', [apiKey]);
}

/**
 * Test webhook kwa kutuma sample payload
 */
export async function testWebhook(webhookId, userId) {
  const db = getDb();
  const webhook = await db.get(
    'SELECT * FROM webhooks WHERE id = ? AND user_id = ?',
    [webhookId, userId]
  );
  
  if (!webhook) throw new Error('Webhook not found');
  
  const testPayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook from AgentNKO',
      webhook_id: webhookId,
    }
  };

  await sendWebhookRequest(webhook, testPayload);
  return { success: true };
}
