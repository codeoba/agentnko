import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import pino from 'pino';
import { getDb } from '../db/db.js';
import { askAI } from './aiService.js';
import { generateReceiptPdf } from './receiptService.js';
import { createWooCommerceOrder } from './wooService.js';

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
      
      // Determine if message is audio
      const isAudio = !!(msg.message?.audioMessage);
      let text = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || 
                   '';
      
      let audioBase64 = null;
      if (isAudio) {
        try {
          console.log(`Downloading audio message from ${phone}...`);
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          audioBase64 = buffer.toString('base64');
          text = "[Customer sent a voice message]";
        } catch (err) {
          console.error("Failed to download voice note:", err);
        }
      }

      if (!text && !audioBase64) continue;

      console.log(`Incoming message from ${phone} to user ${userId}: "${text}"`);

      // 1. Log or create contact in CRM
      let contact = await db.get(
        'SELECT * FROM contacts WHERE user_id = ? AND phone_number = ?',
        [userId, phone]
      );

      if (!contact) {
        const contactName = msg.pushName || phone;
        await db.run(
          `INSERT INTO contacts (user_id, phone_number, name, tags, notes, agent_mode)
           VALUES (?, ?, ?, 'lead', '', 'sales')`,
          [userId, phone, contactName]
        );
        contact = await db.get(
          'SELECT * FROM contacts WHERE user_id = ? AND phone_number = ?',
          [userId, phone]
        );
      }

      // Upsert cart activity whenever a potential order is in progress
      if (text.toLowerCase().includes('order') || text.toLowerCase().includes('sukari') || text.toLowerCase().includes('bei') || text.toLowerCase().includes('mchele') || text.toLowerCase().includes('kitenge') || text.toLowerCase().includes('jeans')) {
        await db.run(
          `INSERT INTO carts (user_id, contact_id, cart_data, last_activity, reminder_sent) 
           VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0)
           ON CONFLICT(contact_id) DO UPDATE SET last_activity = CURRENT_TIMESTAMP, reminder_sent = 0`,
          [userId, contact.id, text]
        );
      }

      // 2. Log message to history
      await db.run(
        `INSERT INTO messages (user_id, contact_id, sender_phone, recipient_phone, text, direction)
         VALUES (?, ?, ?, ?, ?, 'incoming')`,
        [userId, contact.id, phone, sock.user.id.split(':')[0], text]
      );

      // Evaluate Rules Engine Automations
      let ruleBypassedAI = false;
      try {
        const activeRules = await db.all('SELECT * FROM automations WHERE user_id = ? AND active = 1', [userId]);
        for (const rule of activeRules) {
          if (rule.trigger_type === 'message_received') {
            let matched = false;
            const msgLower = text.toLowerCase().trim();
            const valLower = (rule.condition_value || '').toLowerCase().trim();

            if (rule.condition_type === 'always') {
              matched = true;
            } else if (rule.condition_type === 'equals' && msgLower === valLower) {
              matched = true;
            } else if (rule.condition_type === 'contains' && msgLower.includes(valLower)) {
              matched = true;
            } else if (rule.condition_type === 'starts_with' && msgLower.startsWith(valLower)) {
              matched = true;
            }

            if (matched) {
              console.log(`Automation Rule "${rule.name}" triggered for message: "${text}"`);
              
              if (rule.action_type === 'send_message') {
                await sock.sendMessage(phone + '@s.whatsapp.net', { text: rule.action_value });
                await db.run(
                  `INSERT INTO messages (user_id, contact_id, sender_phone, recipient_phone, text, direction)
                   VALUES (?, ?, ?, ?, ?, 'outgoing')`,
                  [userId, contact.id, sock.user.id.split(':')[0], phone, rule.action_value]
                );
                ruleBypassedAI = true;
              } else if (rule.action_type === 'add_tag') {
                let tagsArray = contact.tags ? contact.tags.split(',').map(t => t.trim()) : [];
                if (!tagsArray.includes(rule.action_value)) {
                  tagsArray.push(rule.action_value);
                  await db.run('UPDATE contacts SET tags = ? WHERE id = ?', [tagsArray.join(', '), contact.id]);
                  contact.tags = tagsArray.join(', ');
                }
              } else if (rule.action_type === 'remove_tag') {
                let tagsArray = contact.tags ? contact.tags.split(',').map(t => t.trim()) : [];
                tagsArray = tagsArray.filter(t => t !== rule.action_value);
                await db.run('UPDATE contacts SET tags = ? WHERE id = ?', [tagsArray.join(', '), contact.id]);
                contact.tags = tagsArray.join(', ');
              } else if (rule.action_type === 'disable_ai') {
                await db.run('UPDATE contacts SET ai_disabled = 1 WHERE id = ?', [contact.id]);
                contact.ai_disabled = 1;
              } else if (rule.action_type === 'enable_ai') {
                await db.run('UPDATE contacts SET ai_disabled = 0 WHERE id = ?', [contact.id]);
                contact.ai_disabled = 0;
              }

              await db.run('UPDATE automations SET runs_count = runs_count + 1 WHERE id = ?', [rule.id]);
            }
          }
        }
      } catch (ruleErr) {
        console.error('Error evaluating automation rules:', ruleErr);
      }

      // 3. Trigger AI agent if configuration enabled and not disabled for this contact
      const aiConfig = await db.get('SELECT * FROM ai_configs WHERE user_id = ?', [userId]);
      if (aiConfig && aiConfig.enabled === 1 && contact.ai_disabled !== 1 && !ruleBypassedAI) {
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

          // Fetch products & coupons
          const products = await db.all('SELECT name, price, description, status FROM products WHERE user_id = ?', [userId]);
          const coupons = await db.all('SELECT code, discount_type, value FROM coupons WHERE user_id = ? AND active = 1', [userId]);

          let dynamicContext = '\n\n';
          if (products.length > 0) {
            dynamicContext += 'ORODHA YA BIDHAA ZILIZOPO GHALANI NA BEI ZAKE:\n';
            products.forEach(p => {
              dynamicContext += `- ${p.name}: Bei TZS ${p.price.toLocaleString()} (${p.description || ''}) - Hali: ${p.status === 'available' ? 'Ipo' : 'Imekwisha'}\n`;
            });
          } else {
            dynamicContext += 'Hakuna bidhaa zilizosajiliwa kwenye catalog kwa sasa.\n';
          }

          if (coupons.length > 0) {
            dynamicContext += '\nKUPONI ZA PUNGUZO ZILIZO HAI (COUPONS):\n';
            coupons.forEach(c => {
              dynamicContext += `- Code: ${c.code} (${c.discount_type === 'percentage' ? c.value + '%' : c.value.toLocaleString() + ' TZS'} Off)\n`;
            });
            dynamicContext += 'Mteja akitaja kuponi mojawapo kati ya hizi, piga hesabu ya punguzo na mpe bei mpya ya kulipa wakati wa kuhitimisha order yake.\n';
          }

          // Select prompt based on agent mode
          let activePrompt = aiConfig.system_prompt;
          if (contact.agent_mode === 'support') {
            activePrompt = aiConfig.support_prompt || activePrompt;
          }

          // Inject Department switching instruction
          activePrompt += `\n\nMAELEKEZO YA ROUTING YA IDARA (MUHIMU SANA):
- Ikiwa wewe kwa sasa ni Sales Agent na mteja anahitaji msaada wa kiufundi au anataka kulalamika au anaongelea matatizo ya delivery/malipo, hakikisha unaandika tag hii mwishoni kabisa mwa jibu lako: [ROUTE: support]
- Ikiwa wewe kwa sasa ni Support Agent na mteja anataka kununua bidhaa, kuuliza bei ya bidhaa, au kuanza kutoa order, hakikisha unaandika tag hii mwishoni kabisa mwa jibu lako: [ROUTE: sales]
- Usionyeshe tag hii kama chaguo, iandike tu mwishoni mwa ujumbe wako pale inapohitajika kubadili idara.

- Pia ikiwa utathibitisha kuorder kwa mteja (kutoa namba ya order), hakikisha unaongeza tag hii mwishoni mwa ujumbe ili mfumo wetu utengeneze PDF stakabadhi kiotomatiki: [RECEIPT_DATA: {"items":[{"name":"Sukari","price":3000,"quantity":2}],"discount":0,"customerName":"Jina la Mteja","deliveryAddress":"Anuani"}] - data iwe na muundo huu wa JSON sahihi.`;

          const combinedSystemPrompt = activePrompt + dynamicContext;
          const responseText = await askAI(promptContext, combinedSystemPrompt, aiConfig, audioBase64);
          
          if (responseText) {
            let cleanedResponse = responseText;
            
            // 1. Check for Route switching tags
            if (responseText.includes('[ROUTE: support]')) {
              cleanedResponse = responseText.replace('[ROUTE: support]', '').trim();
              await db.run("UPDATE contacts SET agent_mode = 'support' WHERE id = ?", [contact.id]);
              console.log(`Dynamic Route: Switched contact ${contact.phone_number} to Support Mode`);
            } else if (responseText.includes('[ROUTE: sales]')) {
              cleanedResponse = responseText.replace('[ROUTE: sales]', '').trim();
              await db.run("UPDATE contacts SET agent_mode = 'sales' WHERE id = ?", [contact.id]);
              console.log(`Dynamic Route: Switched contact ${contact.phone_number} to Sales Mode`);
            }

            // 2. Check for PDF receipt generation tag
            let receiptPath = null;
            if (cleanedResponse.includes('[RECEIPT_DATA:')) {
              try {
                const startIdx = cleanedResponse.indexOf('[RECEIPT_DATA:');
                const endIdx = cleanedResponse.indexOf(']', startIdx);
                const jsonStr = cleanedResponse.slice(startIdx + 14, endIdx);
                const receiptData = JSON.parse(jsonStr);
                
                // Clean the output message
                cleanedResponse = (cleanedResponse.slice(0, startIdx) + cleanedResponse.slice(endIdx + 1)).trim();
                
                // Try to sync with WooCommerce
                let finalOrderId = Math.floor(Math.random() * 900000) + 100000;
                try {
                  const wooOrderId = await createWooCommerceOrder(userId, {
                    customerName: receiptData.customerName || contact.name,
                    customerPhone: phone,
                    deliveryAddress: receiptData.deliveryAddress || 'Pick-up',
                    items: receiptData.items || []
                  });
                  if (wooOrderId) {
                    finalOrderId = wooOrderId;
                  }
                } catch (wErr) {
                  console.error("WooCommerce order sync error:", wErr);
                }

                // Generate PDF
                receiptPath = await generateReceiptPdf({
                  orderId: finalOrderId,
                  brandName: aiConfig.provider === 'gemini' ? 'AgentNKO Store' : 'AgentNKO Commerce',
                  customerName: receiptData.customerName || contact.name,
                  customerPhone: phone,
                  deliveryAddress: receiptData.deliveryAddress || 'Pick-up',
                  items: receiptData.items || [],
                  discount: receiptData.discount || 0
                });
                
              } catch (pdfErr) {
                console.error("Failed to parse receipt data or generate PDF:", pdfErr);
              }
            }

            // Send reply
            await sock.sendMessage(remoteJid, { text: cleanedResponse });

            // If PDF receipt was generated, send it!
            if (receiptPath && fs.existsSync(receiptPath)) {
              await sock.sendMessage(remoteJid, {
                document: fs.readFileSync(receiptPath),
                mimetype: 'application/pdf',
                fileName: `Stakabadhi_Order_${phone}.pdf`
              });
              // Delete temp file after sending
              try {
                fs.unlinkSync(receiptPath);
              } catch (_) {}
            }

            // Log outgoing message to history
            await db.run(
              `INSERT INTO messages (user_id, contact_id, sender_phone, recipient_phone, text, direction)
               VALUES (?, ?, ?, ?, ?, 'outgoing')`,
              [userId, contact.id, sock.user.id.split(':')[0], phone, cleanedResponse]
            );
          }
        } catch (aiErr) {
          console.error(`AI execution failed for user ${userId}:`, aiErr);
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

// Abandoned Cart Scheduler
export function startAbandonedCartScheduler() {
  console.log("Abandoned Cart Scheduler Initialized successfully.");
  setInterval(async () => {
    const db = getDb();
    try {
      // Find carts modified more than 30 minutes ago, where reminder_sent = 0
      const dateLimit = new Date(Date.now() - 30 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const carts = await db.all(
        `SELECT c.*, co.phone_number, co.user_id as merchant_id 
         FROM carts c 
         JOIN contacts co ON c.contact_id = co.id 
         WHERE c.reminder_sent = 0 AND c.last_activity <= ?`,
        [dateLimit]
      );
      
      for (const cart of carts) {
        const session = activeSessions.get(cart.merchant_id);
        if (session && session.status === 'connected') {
          const formattedJid = `${cart.phone_number}@s.whatsapp.net`;
          const reminderText = `Habari! Tuliona ulikuwa unaongeza bidhaa kwenye kikapu chako hivi karibuni lakini haujakamilisha oda yako. Je, unahitaji msaada wowote kukamilisha ununuzi wako? Tunafurahi kukusaidia! 😊`;
          
          await session.sock.sendMessage(formattedJid, { text: reminderText });
          
          // Log message
          await db.run(
            `INSERT INTO messages (user_id, contact_id, sender_phone, recipient_phone, text, direction)
             VALUES (?, ?, ?, ?, ?, 'outgoing')`,
            [cart.merchant_id, cart.contact_id, session.sock.user.id.split(':')[0], cart.phone_number, reminderText]
          );
          
          // Update cart status
          await db.run('UPDATE carts SET reminder_sent = 1 WHERE id = ?', [cart.id]);
          console.log(`Sent abandoned cart reminder to ${cart.phone_number}`);
        }
      }
    } catch (err) {
      console.error("Error in Abandoned Cart Scheduler:", err);
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}
