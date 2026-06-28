/**
 * Scheduler Service
 * Inashughulikia scheduled messages na recurring campaigns
 * Timezone: Africa/Dar_es_Salaam (EAT +3)
 */

import { getDb } from '../db/db.js';
import { getSession } from './whatsappManager.js';

let schedulerInterval = null;

/**
 * Anza scheduler ya background
 * Inachunguza kila dakika moja kama kuna messages za kutuma
 */
export function startScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  console.log('📅 Scheduled Message Scheduler started...');
  
  // Run immediately, then every minute
  processScheduledMessages();
  schedulerInterval = setInterval(processScheduledMessages, 60 * 1000);
}

/**
 * Simama scheduler
 */
export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('📅 Scheduler stopped.');
  }
}

/**
 * Chunguza na tuma messages zilizopangwa
 */
async function processScheduledMessages() {
  const db = getDb();
  const now = new Date();
  const nowStr = now.toISOString();

  try {
    // Pata scheduled messages ambazo zimefika wakati wake
    const dueMessages = await db.all(
      `SELECT * FROM scheduled_messages 
       WHERE status = 'pending' AND scheduled_at <= ? 
       ORDER BY scheduled_at ASC`,
      [nowStr]
    );

    for (const scheduledMsg of dueMessages) {
      await sendScheduledMessage(scheduledMsg);
    }
  } catch (err) {
    console.error('Scheduler processing error:', err);
  }
}

/**
 * Tuma scheduled message moja
 */
async function sendScheduledMessage(scheduledMsg) {
  const db = getDb();
  
  try {
    // Mark as sending
    await db.run(
      'UPDATE scheduled_messages SET status = ? WHERE id = ?',
      ['sending', scheduledMsg.id]
    );

    const session = getSession(scheduledMsg.user_id);
    if (!session || session.status !== 'connected') {
      await db.run(
        'UPDATE scheduled_messages SET status = ? WHERE id = ?',
        ['failed', scheduledMsg.id]
      );
      console.log(`Scheduled msg ${scheduledMsg.id}: WhatsApp not connected for user ${scheduledMsg.user_id}`);
      return;
    }

    // Pata contacts wanaohusika
    let contacts = [];
    if (scheduledMsg.target_type === 'all') {
      contacts = await db.all(
        'SELECT * FROM contacts WHERE user_id = ? AND opt_out = 0',
        [scheduledMsg.user_id]
      );
    } else if (scheduledMsg.target_type === 'tag') {
      contacts = await db.all(
        'SELECT * FROM contacts WHERE user_id = ? AND tags LIKE ? AND opt_out = 0',
        [scheduledMsg.user_id, `%${scheduledMsg.target_value}%`]
      );
    } else if (scheduledMsg.target_type === 'segment') {
      // Load segment and apply filters
      const segment = await db.get(
        'SELECT * FROM contact_segments WHERE id = ? AND user_id = ?',
        [scheduledMsg.target_value, scheduledMsg.user_id]
      );
      if (segment) {
        contacts = await applySegmentFilters(scheduledMsg.user_id, JSON.parse(segment.filter_rules));
      }
    } else if (scheduledMsg.target_type === 'phone') {
      const contact = await db.get(
        'SELECT * FROM contacts WHERE user_id = ? AND phone_number = ? AND opt_out = 0',
        [scheduledMsg.user_id, scheduledMsg.target_value]
      );
      if (contact) contacts = [contact];
    }

    let sentCount = 0;
    const DELAY_MS = 2000; // 2 seconds between messages

    for (const contact of contacts) {
      try {
        const jid = `${contact.phone_number}@s.whatsapp.net`;
        await session.sock.sendMessage(jid, { text: scheduledMsg.message });
        
        // Log to messages
        await db.run(
          `INSERT INTO messages (user_id, contact_id, sender_phone, recipient_phone, text, direction)
           VALUES (?, ?, ?, ?, ?, 'outgoing')`,
          [scheduledMsg.user_id, contact.id, session.sock.user?.id?.split(':')[0] || '', contact.phone_number, scheduledMsg.message]
        );
        
        sentCount++;
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      } catch (sendErr) {
        console.error(`Failed to send scheduled msg to ${contact.phone_number}:`, sendErr.message);
      }
    }

    // Handle recurring messages
    if (scheduledMsg.schedule_type === 'recurring' && scheduledMsg.cron_expression) {
      const nextDate = getNextCronDate(scheduledMsg.cron_expression);
      await db.run(
        `UPDATE scheduled_messages SET 
           status = 'pending', 
           scheduled_at = ?,
           sent_count = sent_count + ?,
           sent_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nextDate.toISOString(), sentCount, scheduledMsg.id]
      );
      console.log(`Recurring message ${scheduledMsg.id} rescheduled for ${nextDate.toISOString()}`);
    } else {
      await db.run(
        `UPDATE scheduled_messages SET 
           status = 'sent', 
           sent_at = CURRENT_TIMESTAMP,
           sent_count = ?
         WHERE id = ?`,
        [sentCount, scheduledMsg.id]
      );
    }

    console.log(`✅ Scheduled message ${scheduledMsg.id} sent to ${sentCount} contacts.`);
  } catch (err) {
    await db.run(
      'UPDATE scheduled_messages SET status = ? WHERE id = ?',
      ['failed', scheduledMsg.id]
    );
    console.error(`Scheduled message ${scheduledMsg.id} failed:`, err.message);
  }
}

/**
 * Hesabu tarehe inayofuata kulingana na cron expression (simplified)
 * Inasaidia: daily, weekly (every Monday), monthly
 */
function getNextCronDate(cronExpression) {
  const next = new Date();
  
  // Simple cron patterns
  if (cronExpression === 'daily') {
    next.setDate(next.getDate() + 1);
    next.setHours(8, 0, 0, 0); // 8 AM EAT
  } else if (cronExpression === 'weekly_monday') {
    const day = next.getDay();
    const daysUntilMonday = day === 0 ? 1 : (8 - day) % 7 || 7;
    next.setDate(next.getDate() + daysUntilMonday);
    next.setHours(8, 0, 0, 0);
  } else if (cronExpression === 'weekly_friday') {
    const day = next.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    next.setDate(next.getDate() + daysUntilFriday);
    next.setHours(8, 0, 0, 0);
  } else if (cronExpression === 'monthly') {
    next.setMonth(next.getMonth() + 1);
    next.setDate(1);
    next.setHours(8, 0, 0, 0);
  } else {
    // Default: next day
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

/**
 * Apply segment filters kupata contacts
 */
export async function applySegmentFilters(userId, filterRules) {
  const db = getDb();
  let query = 'SELECT * FROM contacts WHERE user_id = ? AND opt_out = 0';
  const params = [userId];

  for (const rule of filterRules) {
    if (rule.field === 'tags' && rule.value) {
      query += ' AND tags LIKE ?';
      params.push(`%${rule.value}%`);
    } else if (rule.field === 'lead_score_gte') {
      query += ' AND lead_score >= ?';
      params.push(parseInt(rule.value));
    } else if (rule.field === 'lead_score_lte') {
      query += ' AND lead_score <= ?';
      params.push(parseInt(rule.value));
    } else if (rule.field === 'inactive_days') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(rule.value));
      query += ' AND (last_seen IS NULL OR last_seen < ?)';
      params.push(cutoff.toISOString());
    } else if (rule.field === 'active_days') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(rule.value));
      query += ' AND last_seen >= ?';
      params.push(cutoff.toISOString());
    } else if (rule.field === 'message_count_gte') {
      query += ' AND message_count >= ?';
      params.push(parseInt(rule.value));
    }
  }

  return db.all(query, params);
}

/**
 * Unda scheduled message mpya
 */
export async function createScheduledMessage(userId, data) {
  const db = getDb();
  
  const result = await db.run(
    `INSERT INTO scheduled_messages 
     (user_id, name, message, target_type, target_value, schedule_type, scheduled_at, cron_expression, timezone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId, data.name, data.message,
      data.target_type || 'all', data.target_value || null,
      data.schedule_type || 'once', data.scheduled_at,
      data.cron_expression || null,
      data.timezone || 'Africa/Dar_es_Salaam'
    ]
  );
  
  return result.lastID;
}
