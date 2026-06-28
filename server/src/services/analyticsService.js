/**
 * Analytics Service
 * Inakusanya na kuchakata takwimu za matumizi ya AgentNKO
 */

import { getDb } from '../db/db.js';

/**
 * Record daily analytics kwa kila message inayoingia au kutoka
 */
export async function recordMessageAnalytic(userId, direction, isAI = false, responseTimeMs = 0) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  
  try {
    await db.run(
      `INSERT INTO analytics_daily (user_id, date, incoming_count, outgoing_count, ai_responses, manual_responses, avg_response_time_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         incoming_count = incoming_count + ?,
         outgoing_count = outgoing_count + ?,
         ai_responses = ai_responses + ?,
         manual_responses = manual_responses + ?,
         avg_response_time_ms = CASE 
           WHEN avg_response_time_ms = 0 THEN ?
           ELSE (avg_response_time_ms + ?) / 2
         END`,
      [
        userId, today,
        direction === 'incoming' ? 1 : 0,
        direction === 'outgoing' ? 1 : 0,
        isAI && direction === 'outgoing' ? 1 : 0,
        !isAI && direction === 'outgoing' ? 1 : 0,
        responseTimeMs,
        // Update values
        direction === 'incoming' ? 1 : 0,
        direction === 'outgoing' ? 1 : 0,
        isAI && direction === 'outgoing' ? 1 : 0,
        !isAI && direction === 'outgoing' ? 1 : 0,
        responseTimeMs,
        responseTimeMs
      ]
    );
  } catch (err) {
    console.error('Analytics record error:', err);
  }
}

/**
 * Record new contact
 */
export async function recordNewContact(userId) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  
  try {
    await db.run(
      `INSERT INTO analytics_daily (user_id, date, new_contacts)
       VALUES (?, ?, 1)
       ON CONFLICT(user_id, date) DO UPDATE SET new_contacts = new_contacts + 1`,
      [userId, today]
    );
  } catch (err) {
    console.error('Analytics new contact error:', err);
  }
}

/**
 * Pata takwimu za overview kwa muda fulani
 */
export async function getAnalyticsOverview(userId, days = 30) {
  const db = getDb();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().slice(0, 10);

  const dailyData = await db.all(
    `SELECT * FROM analytics_daily 
     WHERE user_id = ? AND date >= ? 
     ORDER BY date ASC`,
    [userId, startDateStr]
  );

  // Jumla za kipindi
  const totals = dailyData.reduce((acc, row) => ({
    incoming: acc.incoming + row.incoming_count,
    outgoing: acc.outgoing + row.outgoing_count,
    ai_responses: acc.ai_responses + row.ai_responses,
    manual_responses: acc.manual_responses + row.manual_responses,
    new_contacts: acc.new_contacts + row.new_contacts,
    total_messages: acc.total_messages + row.incoming_count + row.outgoing_count,
  }), { incoming: 0, outgoing: 0, ai_responses: 0, manual_responses: 0, new_contacts: 0, total_messages: 0 });

  // Conversion rate (manual calculation - messages that got replies)
  const conversionRate = totals.incoming > 0 
    ? Math.round((totals.outgoing / totals.incoming) * 100) 
    : 0;

  // AI vs Manual ratio
  const aiRate = (totals.ai_responses + totals.manual_responses) > 0
    ? Math.round((totals.ai_responses / (totals.ai_responses + totals.manual_responses)) * 100)
    : 0;

  return {
    period_days: days,
    totals,
    conversion_rate: conversionRate,
    ai_automation_rate: aiRate,
    daily_data: dailyData,
  };
}

/**
 * Pata top keywords kutoka messages za incoming
 */
export async function getTopKeywords(userId, days = 30, limit = 20) {
  const db = getDb();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const messages = await db.all(
    `SELECT text FROM messages 
     WHERE user_id = ? AND direction = 'incoming' AND timestamp >= ?
     AND text IS NOT NULL`,
    [userId, startDate.toISOString()]
  );

  // Count word frequency
  const wordCount = {};
  const stopWords = new Set([
    'na', 'ya', 'wa', 'la', 'kwa', 'ni', 'je', 'au', 'hii', 'hizo', 'hiyo',
    'ka', 'si', 'we', 'me', 'you', 'the', 'is', 'a', 'an', 'in', 'on', 'at',
    'to', 'for', 'of', 'and', 'or', 'but', 'it', 'be', 'as', 'do', 'if',
    'ok', 'sawa', 'nzuri', 'asante', 'thanks', 'hi', 'hello', 'habari'
  ]);

  for (const msg of messages) {
    if (!msg.text) continue;
    const words = msg.text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
    
    for (const word of words) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  }

  return Object.entries(wordCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Pata stats za response time
 */
export async function getResponseTimeStats(userId, days = 30) {
  const db = getDb();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await db.get(
    `SELECT 
       AVG(response_time_ms) as avg_ms,
       MIN(response_time_ms) as min_ms,
       MAX(response_time_ms) as max_ms,
       COUNT(*) as count
     FROM messages 
     WHERE user_id = ? AND direction = 'outgoing' 
     AND response_time_ms > 0 AND timestamp >= ?`,
    [userId, startDate.toISOString()]
  );

  return {
    avg_seconds: stats?.avg_ms ? Math.round(stats.avg_ms / 1000) : 0,
    min_seconds: stats?.min_ms ? Math.round(stats.min_ms / 1000) : 0,
    max_seconds: stats?.max_ms ? Math.round(stats.max_ms / 1000) : 0,
    total_responses: stats?.count || 0,
  };
}

/**
 * Pata contacts wapya kwa wiki hii vs wiki iliyopita
 */
export async function getContactGrowth(userId) {
  const db = getDb();
  
  const thisWeekStart = new Date();
  thisWeekStart.setDate(thisWeekStart.getDate() - 7);
  
  const lastWeekStart = new Date();
  lastWeekStart.setDate(lastWeekStart.getDate() - 14);

  const thisWeek = await db.get(
    'SELECT COUNT(*) as count FROM contacts WHERE user_id = ? AND created_at >= ?',
    [userId, thisWeekStart.toISOString()]
  );
  
  const lastWeek = await db.get(
    'SELECT COUNT(*) as count FROM contacts WHERE user_id = ? AND created_at >= ? AND created_at < ?',
    [userId, lastWeekStart.toISOString(), thisWeekStart.toISOString()]
  );

  const thisCount = thisWeek?.count || 0;
  const lastCount = lastWeek?.count || 0;
  const growth = lastCount > 0 ? Math.round(((thisCount - lastCount) / lastCount) * 100) : 0;

  return { this_week: thisCount, last_week: lastCount, growth_percent: growth };
}
