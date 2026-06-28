/**
 * Lead Scoring Service
 * Inachambua mazungumzo ya kila contact na kutoa score 0-100
 * Score inaongezeka kulingana na keywords, mara ya mawasiliano, na muda
 */

import { getDb } from '../db/db.js';

// Keywords zinazoonyesha nia ya kununua (High Intent)
const HIGH_INTENT_KEYWORDS = [
  // Swahili
  'bei', 'gharama', 'bei gani', 'je mnauza', 'ninataka', 'nataka kununua',
  'ununuzi', 'order', 'niambie bei', 'kwa bei', 'naomba', 'ninatumia',
  'naweza kununua', 'nitanunua', 'nipe', 'tuma', 'delivery', 'lini',
  'malipo', 'mpesa', 'tigopesa', 'lipa', 'niambie', 'niongeze', 'nipe taarifa',
  'inapatikana', 'ipo', 'ina', 'orodha', 'catalog', 'bidhaa',
  // English
  'price', 'cost', 'how much', 'want to buy', 'purchase', 'order',
  'buy', 'interested', 'available', 'stock', 'payment', 'when can',
  'send me', 'i want', 'need', 'delivery', 'shipping'
];

// Keywords za hatua ya juu zaidi (Very High Intent)
const VERY_HIGH_INTENT_KEYWORDS = [
  'ninaomba order', 'ninataka kuorder', 'nataka kuagiza', 'ninatumia sasa',
  'nipe account', 'number ya kulipa', 'confirm order', 'nimeshalipa',
  'ready to buy', 'place order', 'confirm my order', 'i will pay',
  'send your account', 'mpesa namba'
];

// Keywords za hatua ya chini (Low Intent / Just Browsing)
const LOW_INTENT_KEYWORDS = [
  'habari', 'hujambo', 'hello', 'hi', 'mambo', 'sema', 'uko',
  'asante', 'ok', 'sawa', 'nzuri', 'vizuri', 'thanks', 'okay'
];

/**
 * Hesabu lead score ya contact moja
 * @param {number} userId - User ID
 * @param {number} contactId - Contact ID
 * @returns {object} - { score, reasons }
 */
export async function calculateLeadScore(userId, contactId) {
  const db = getDb();
  
  try {
    const contact = await db.get(
      'SELECT * FROM contacts WHERE id = ? AND user_id = ?',
      [contactId, userId]
    );
    if (!contact) return { score: 0, reasons: [] };

    const messages = await db.all(
      `SELECT * FROM messages 
       WHERE user_id = ? AND contact_id = ? AND direction = 'incoming'
       ORDER BY timestamp DESC LIMIT 50`,
      [userId, contactId]
    );

    let score = 0;
    const reasons = [];

    // === FACTOR 1: Message Count (max 20 points) ===
    const msgCount = contact.message_count || messages.length;
    if (msgCount >= 20) { score += 20; reasons.push('Mazungumzo mengi (20+)'); }
    else if (msgCount >= 10) { score += 15; reasons.push('Mazungumzo ya kati (10+)'); }
    else if (msgCount >= 5) { score += 10; reasons.push('Mazungumzo kadhaa (5+)'); }
    else if (msgCount >= 2) { score += 5; reasons.push('Mawasiliano ya awali'); }

    // === FACTOR 2: Intent Keywords (max 40 points) ===
    const allText = messages.map(m => (m.text || '').toLowerCase()).join(' ');
    
    let keywordScore = 0;
    let foundVeryHigh = false;
    let foundHigh = 0;

    for (const keyword of VERY_HIGH_INTENT_KEYWORDS) {
      if (allText.includes(keyword)) {
        foundVeryHigh = true;
        break;
      }
    }

    for (const keyword of HIGH_INTENT_KEYWORDS) {
      if (allText.includes(keyword)) {
        foundHigh++;
      }
    }

    if (foundVeryHigh) {
      keywordScore = 40;
      reasons.push('Nia ya kununua ni kubwa sana 🔥');
    } else if (foundHigh >= 5) {
      keywordScore = 30;
      reasons.push('Maneno mengi ya kununua (5+)');
    } else if (foundHigh >= 3) {
      keywordScore = 20;
      reasons.push('Maneno ya kununua (3+)');
    } else if (foundHigh >= 1) {
      keywordScore = 10;
      reasons.push('Maneno ya riba ya kununua');
    }
    score += keywordScore;

    // === FACTOR 3: Recency (max 20 points) ===
    if (contact.last_seen) {
      const hoursSinceLastSeen = (Date.now() - new Date(contact.last_seen).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastSeen <= 1) { score += 20; reasons.push('Alituma ujumbe saa moja iliyopita'); }
      else if (hoursSinceLastSeen <= 24) { score += 15; reasons.push('Alituma ujumbe leo'); }
      else if (hoursSinceLastSeen <= 72) { score += 10; reasons.push('Alituma ujumbe siku 3 zilizopita'); }
      else if (hoursSinceLastSeen <= 168) { score += 5; reasons.push('Alituma ujumbe wiki hii'); }
    }

    // === FACTOR 4: Has replied to AI (max 10 points) ===
    const outgoingCount = await db.get(
      `SELECT COUNT(*) as count FROM messages 
       WHERE user_id = ? AND contact_id = ? AND direction = 'outgoing'`,
      [userId, contactId]
    );
    if (outgoingCount?.count >= 3) {
      score += 10;
      reasons.push('Anaendelea kuzungumza na agent');
    }

    // === FACTOR 5: Tags (max 10 points) ===
    if (contact.tags) {
      const tags = contact.tags.toLowerCase();
      if (tags.includes('hot') || tags.includes('vip') || tags.includes('interested')) {
        score += 10;
        reasons.push('Tagged as hot/vip/interested');
      } else if (tags.includes('warm') || tags.includes('prospect')) {
        score += 5;
        reasons.push('Tagged as warm/prospect');
      }
    }

    // Cap at 100
    score = Math.min(100, Math.max(0, score));

    // Save score to contact
    await db.run(
      'UPDATE contacts SET lead_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [score, contactId, userId]
    );

    // Save to history
    await db.run(
      'INSERT INTO lead_score_history (user_id, contact_id, score, reason) VALUES (?, ?, ?, ?)',
      [userId, contactId, score, reasons.join('; ')]
    );

    return { score, reasons };
  } catch (err) {
    console.error('Lead scoring error:', err);
    return { score: 0, reasons: [] };
  }
}

/**
 * Fanya recalculation ya scores zote kwa user mmoja
 */
export async function recalculateAllScores(userId) {
  const db = getDb();
  const contacts = await db.all(
    'SELECT id FROM contacts WHERE user_id = ? AND opt_out = 0',
    [userId]
  );
  
  const results = [];
  for (const contact of contacts) {
    const result = await calculateLeadScore(userId, contact.id);
    results.push({ contactId: contact.id, ...result });
  }
  return results;
}

/**
 * Pata contacts walioshinda kwa score (top leads)
 */
export async function getTopLeads(userId, limit = 10) {
  const db = getDb();
  return db.all(
    `SELECT c.*, 
     (SELECT score FROM lead_score_history WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) as latest_score_reason
     FROM contacts c 
     WHERE c.user_id = ? AND c.opt_out = 0
     ORDER BY c.lead_score DESC 
     LIMIT ?`,
    [userId, limit]
  );
}

/**
 * Pata grade ya score (A, B, C, D, F)
 */
export function getScoreGrade(score) {
  if (score >= 80) return { grade: 'A', label: 'Hot 🔥', color: '#ef4444' };
  if (score >= 60) return { grade: 'B', label: 'Warm 🌡️', color: '#f97316' };
  if (score >= 40) return { grade: 'C', label: 'Medium 📊', color: '#eab308' };
  if (score >= 20) return { grade: 'D', label: 'Cool 🌊', color: '#3b82f6' };
  return { grade: 'F', label: 'Cold ❄️', color: '#6b7280' };
}
