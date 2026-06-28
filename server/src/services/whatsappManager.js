import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import pino from 'pino';
import { getDb } from '../db/db.js';
import { askAI } from './aiService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionsDir = path.resolve(__dirname, '../../sessions');

// Ensure sessions directory exists
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

// In-memory registry of active sockets/connections
const activeSessions = new Map();

export async function initAllSessions() {
  const db = getDb();
  const sessions = await db.all('SELECT user_id FROM whatsapp_sessions WHERE status = "connected"');
  console.log(`Restoring ${sessions.length} active WhatsApp sessions...`);
  for (const session of sessions) {
    try {
      startWhatsappSession(session.user_id);
    } catch (err) {
      console.error(`Failed to restore session for user ${session.user_id}:`, err);
    }
  }
}

export async function startWhatsappSession(userId) {
  // If already active, return the existing state or socket
  if (activeSessions.has(userId)) {
    return activeSessions.get(userId);
  }

  const db = getDb();
  const userSessionPath = path.join(sessionsDir, `user_${userId}`);
  
  // Make sure path exists
  if (!fs.existsSync(userSessionPath)) {
    fs.mkdirSync(userSessionPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(userSessionPath);
  const { version } = await fetchLatestBaileysVersion();

  // Create quiet logger
  const logger = pino({ level: 'silent' });

  const makeSocket = makeWASocket.default || makeWASocket;

  const sock = makeSocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    mobile: false
  });

  const sessionObj = {
    sock,
    status: 'disconnected',
    qr: null
  };
  activeSessions.set(userId, sessionObj);

  // Listen to credentials update
  sock.ev.on('creds.update', saveCreds);

  // Listen to connection update
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr);
      sessionObj.status = 'qr';
      sessionObj.qr = qrDataUrl;

      // Update in db
      await db.run(
        `INSERT INTO whatsapp_sessions (user_id, status, qr_code, updated_at)
         VALUES (?, 'qr', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET status = 'qr', qr_code = ?, updated_at = CURRENT_TIMESTAMP`,
        [userId, qrDataUrl, qrDataUrl]
      );
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom) 
        ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
        : true;

      console.log(`Connection closed for user ${userId}. Reconnecting: ${shouldReconnect}`);
      
      sessionObj.status = 'disconnected';
      sessionObj.qr = null;
      activeSessions.delete(userId);

      await db.run(
        `INSERT INTO whatsapp_sessions (user_id, status, qr_code, updated_at)
         VALUES (?, 'disconnected', NULL, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET status = 'disconnected', qr_code = NULL, updated_at = CURRENT_TIMESTAMP`,
        [userId]
      );

      if (shouldReconnect) {
        // Re-establish session after 5s
        setTimeout(() => startWhatsappSession(userId), 5000);
      }
    } else if (connection === 'open') {
      const phone = sock.user.id.split(':')[0];
      sessionObj.status = 'connected';
      sessionObj.qr = null;

      console.log(`WhatsApp connection OPEN for user ${userId} (${phone})`);

      await db.run(
        `INSERT INTO whatsapp_sessions (user_id, phone_number, status, qr_code, updated_at)
         VALUES (?, ?, 'connected', NULL, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET phone_number = ?, status = 'connected', qr_code = NULL, updated_at = CURRENT_TIMESTAMP`,
        [userId, phone, phone]
      );
    }
  });

  // Listen to incoming messages
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      // Ignore self messages and group messages
      if (msg.key.fromMe) continue;
      const remoteJid = msg.key.remoteJid;
      if (remoteJid.endsWith('@g.us')) continue; // Ignore groups
      
      const phone = remoteJid.split('@')[0];
      const text = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || 
                   '';

      if (!text) continue;

      console.log(`Incoming message from ${phone} to user ${userId}: "${text}"`);

      // 1. Log or create contact in CRM
      let contact = await db.get(
        'SELECT * FROM contacts WHERE user_id = ? AND phone_number = ?',
        [userId, phone]
      );

      if (!contact) {
        const contactName = msg.pushName || phone;
        await db.run(
          `INSERT INTO contacts (user_id, phone_number, name, tags, notes)
           VALUES (?, ?, ?, 'lead', '')`,
          [userId, phone, contactName]
        );
        contact = await db.get(
          'SELECT * FROM contacts WHERE user_id = ? AND phone_number = ?',
          [userId, phone]
        );
      }

      // 2. Log message to history
      await db.run(
        `INSERT INTO messages (user_id, contact_id, sender_phone, recipient_phone, text, direction)
         VALUES (?, ?, ?, ?, ?, 'incoming')`,
        [userId, contact.id, phone, sock.user.id.split(':')[0], text]
      );

      // 3. Trigger AI agent if configuration enabled
      const aiConfig = await db.get('SELECT * FROM ai_configs WHERE user_id = ?', [userId]);
      if (aiConfig && aiConfig.enabled === 1) {
        // Fetch recent message history for context
        const history = await db.all(
          `SELECT text, direction FROM messages 
           WHERE user_id = ? AND contact_id = ? 
           ORDER BY timestamp DESC LIMIT 5`,
          [userId, contact.id]
        );
        
        // Reverse history to chronological order
        const sortedHistory = history.reverse();
        
        // Create context prompt
        const promptContext = sortedHistory.map(h => 
          `${h.direction === 'incoming' ? 'Customer' : 'Assistant'}: ${h.text}`
        ).join('\n') + `\nAssistant:`;

        try {
          // Check SaaS plan limit or active status
          const user = await db.get('SELECT plan, active_until FROM users WHERE id = ?', [userId]);
          const isPlanActive = !user.active_until || new Date(user.active_until) > new Date();
          
          if (!isPlanActive) {
            console.log(`Skipping AI response: user ${userId} plan expired`);
            continue;
          }

          const responseText = await askAI(promptContext, aiConfig.system_prompt, aiConfig);
          
          if (responseText) {
            // Send reply
            await sock.sendMessage(remoteJid, { text: responseText });

            // Log outgoing message to history
            await db.run(
              `INSERT INTO messages (user_id, contact_id, sender_phone, recipient_phone, text, direction)
               VALUES (?, ?, ?, ?, ?, 'outgoing')`,
              [userId, contact.id, sock.user.id.split(':')[0], phone, responseText]
            );
          }
        } catch (aiErr) {
          console.error(`AI execution failed for user ${userId}:`, aiErr);
        }
      }
    }
  });

  return sessionObj;
}

export async function stopWhatsappSession(userId) {
  const session = activeSessions.get(userId);
  if (session) {
    try {
      await session.sock.logout();
    } catch (err) {
      console.error(`Error logging out session for user ${userId}:`, err);
    }
    session.sock.end();
    activeSessions.delete(userId);
  }

  const db = getDb();
  await db.run(
    `UPDATE whatsapp_sessions SET status = 'disconnected', qr_code = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [userId]
  );
}

export function getSession(userId) {
  return activeSessions.get(userId);
}

// Bulk sender with random delays to prevent banning
export async function sendBroadcast(userId, contactsList, textMessage) {
  const session = activeSessions.get(userId);
  if (!session || session.status !== 'connected') {
    throw new Error('WhatsApp session is not connected');
  }

  const db = getDb();

  for (const contact of contactsList) {
    const formattedJid = `${contact.phone_number}@s.whatsapp.net`;
    try {
      // Send message
      await session.sock.sendMessage(formattedJid, { text: textMessage });

      // Log to database
      await db.run(
        `INSERT INTO messages (user_id, contact_id, sender_phone, recipient_phone, text, direction)
         VALUES (?, ?, ?, ?, ?, 'outgoing')`,
        [userId, contact.id, session.sock.user.id.split(':')[0], contact.phone_number, textMessage]
      );

      // Random delay between 3 and 7 seconds to minimize ban risk
      const delay = Math.floor(Math.random() * 4000) + 3000;
      await new Promise(resolve => setTimeout(resolve, delay));

    } catch (err) {
      console.error(`Failed to send broadcast message to ${contact.phone_number}:`, err);
    }
  }
}
