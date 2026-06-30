import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { initDb, getDb } from './db/db.js';
import { 
  startWhatsappSession, 
  stopWhatsappSession, 
  getSession, 
  initAllSessions,
  sendBroadcast,
  startAbandonedCartScheduler 
} from './services/whatsappManager.js';
import { askAI } from './services/aiService.js';
import { initiatePayment, getPaymentStatus } from './services/paymentService.js';
import { syncWooCommerceProducts } from './services/wooService.js';
import { calculateLeadScore, recalculateAllScores, getTopLeads } from './services/leadScoringService.js';
import { getAnalyticsOverview, getTopKeywords, getResponseTimeStats, getContactGrowth } from './services/analyticsService.js';
import { startScheduler, applySegmentFilters, createScheduledMessage } from './services/schedulerService.js';
import { generateApiKey, verifyApiKey, testWebhook, triggerWebhook, WEBHOOK_EVENTS } from './services/webhookService.js';
import { createOrder, updateOrderStatus, getOrdersWithContacts, getOrderStats } from './services/orderService.js';
import { seedDefaultTemplates } from './db/templateSeeds.js';
import { sendWhatsAppMessage } from './services/whatsappService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'agentnko-super-secret-key-12345';

app.use(cors());
app.use(express.json());

// Initialize Database and Start App
async function startServer() {
  await initDb();
  
  const db = getDb();
  // Seed Super Admin
  const adminEmail = 'nurwaka@gmail.com';
  const existingAdmin = await db.get('SELECT * FROM users WHERE email = ?', [adminEmail]);
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Mdandu22//', 10);
    const result = await db.run(
      `INSERT INTO users (name, email, password, plan, role) 
       VALUES ('Super Admin', ?, ?, 'premium', 'admin')`,
      [adminEmail, hashedPassword]
    );
    await db.run(
      `INSERT INTO ai_configs (user_id, provider, model, system_prompt, enabled) 
       VALUES (?, 'gemini', 'gemini-2.0-flash', 'Wewe ni msaidizi mkuu wa huduma kwa wateja (AI Agent). Jibu wateja kwa adabu na urafiki ukitumia Kiswahili kizuri cha biashara cha Tanzania au Kiingereza kulingana na lugha ya mteja.\nFuata mwongozo huu:\n1. Salamu ya Kwanza: Karibisha wateja kwa furaha. Kamwe usitumie \"Shikamoo\".\n2. Kutoa Order: Uliza kama wanataka Delivery au Pick-up. Chukua Jina, Eneo, na Namba ya simu.\n3. Njia za Malipo: Taja M-Pesa, Tigopesa, na Bank.\n4. Msaada wa Binadamu: Kama swali ni gumu sema \"Nitakuunganisha na mfanyakazi wetu sasa hivi.\"\nJibu kwa ufupi, ukitumia emoji zenye staha.', 0)`,
      [result.lastID]
    );

    // Seed default quick reply templates for admin
    await seedDefaultTemplates(db, result.lastID);
    console.log(`Seeded Super Admin user: ${adminEmail}`);
  }

  await initAllSessions();
  startAbandonedCartScheduler();
  startScheduler();
  app.listen(PORT, () => {
    console.log(`🚀 AgentNKO Enterprise Backend running on http://localhost:${PORT}`);
  });
}



// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token is invalid or expired' });
    req.user = user;
    next();
  });
}

// API Key Middleware (for external API access)
async function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'API key missing' });
  
  const user = await verifyApiKey(apiKey);
  if (!user) return res.status(403).json({ error: 'Invalid API key' });
  
  req.user = user;
  next();
}

async function requireAdmin(req, res, next) {
  const db = getDb();
  try {
    const user = await db.get('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ================= AUTH ROUTES =================

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = getDb();
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`,
      [name, email, hashedPassword]
    );
    
    await db.run(
      `INSERT INTO ai_configs (user_id, provider, model, system_prompt, enabled) 
       VALUES (?, 'gemini', 'gemini-2.0-flash', 'Wewe ni msaidizi mkuu wa huduma kwa wateja (AI Agent). Jibu wateja kwa adabu na urafiki ukitumia Kiswahili kizuri cha biashara cha Tanzania au Kiingereza kulingana na lugha ya mteja.\nFuata mwongozo huu:\n1. Salamu ya Kwanza: Karibisha wateja kwa furaha. Kamwe usitumie \"Shikamoo\".\n2. Kutoa Order: Uliza kama wanataka Delivery au Pick-up. Chukua Jina, Eneo, na Namba ya simu.\n3. Njia za Malipo: Taja M-Pesa, Tigopesa, na Bank.\n4. Msaada wa Binadamu: Kama swali ni gumu sema \"Nitakuunganisha na mfanyakazi wetu sasa hivi.\"\nJibu kwa ufupi, ukitumia emoji zenye staha.', 0)`,
      [result.lastID]
    );

    await seedDefaultTemplates(db, result.lastID);

    const token = jwt.sign({ id: result.lastID, email, name, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.lastID, name, email, plan: 'free', role: 'user', active_until: null } });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  const db = getDb();
  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(400).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: user.id, name: user.name, email: user.email, 
        plan: user.plan, role: user.role, active_until: user.active_until 
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const user = await db.get('SELECT id, name, email, plan, active_until, role, api_key FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate API Key
app.post('/api/me/api-key', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const apiKey = generateApiKey();
    await db.run('UPDATE users SET api_key = ? WHERE id = ?', [apiKey, req.user.id]);
    res.json({ api_key: apiKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= WHATSAPP SESSION ROUTES =================

app.get('/api/session/status', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const session = await db.get('SELECT * FROM whatsapp_sessions WHERE user_id = ?', [req.user.id]);
    if (!session) {
      return res.json({ status: 'disconnected', qr_code: null });
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/session/connect', authenticateToken, async (req, res) => {
  try {
    startWhatsappSession(req.user.id);
    res.json({ message: 'Initializing connection... QR code generation started.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/session/disconnect', authenticateToken, async (req, res) => {
  try {
    await stopWhatsappSession(req.user.id);
    res.json({ message: 'Disconnected successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= AI CONFIG ROUTES =================

app.get('/api/config/ai', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    let config = await db.get('SELECT * FROM ai_configs WHERE user_id = ?', [req.user.id]);
    if (!config) {
      await db.run(
        `INSERT INTO ai_configs (user_id, provider, model, enabled) VALUES (?, 'gemini', 'gemini-2.0-flash', 0)`,
        [req.user.id]
      );
      config = await db.get('SELECT * FROM ai_configs WHERE user_id = ?', [req.user.id]);
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/ai', authenticateToken, async (req, res) => {
  const { provider, model, api_key, system_prompt, support_prompt, temperature, enabled } = req.body;
  const db = getDb();
  const dbApiKey = (api_key === '' || api_key === undefined || api_key === null) ? null : api_key;
  try {
    await db.run(
      `INSERT INTO ai_configs (user_id, provider, model, api_key, system_prompt, support_prompt, temperature, enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET 
        provider = ?, model = ?, api_key = COALESCE(?, api_key), 
        system_prompt = ?, support_prompt = ?, temperature = ?, enabled = ?, 
        updated_at = CURRENT_TIMESTAMP`,
      [
        req.user.id, provider, model, dbApiKey, system_prompt, support_prompt, temperature, enabled,
        provider, model, dbApiKey, system_prompt, support_prompt, temperature, enabled
      ]
    );
    res.json({ message: 'AI configuration updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= WOOCOMMERCE ROUTES =================

app.get('/api/config/woocommerce', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    let config = await db.get('SELECT * FROM woocommerce_configs WHERE user_id = ?', [req.user.id]);
    if (!config) {
      config = { domain_name: '', consumer_key: '', consumer_secret: '', active: 0, sync_products: 0, create_orders: 0 };
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/woocommerce', authenticateToken, async (req, res) => {
  const { domain_name, consumer_key, consumer_secret, active, sync_products, create_orders } = req.body;
  const db = getDb();
  try {
    await db.run(
      `INSERT INTO woocommerce_configs (user_id, domain_name, consumer_key, consumer_secret, active, sync_products, create_orders)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
        domain_name = ?, consumer_key = ?, consumer_secret = ?,
        active = ?, sync_products = ?, create_orders = ?`,
      [
        req.user.id, domain_name, consumer_key, consumer_secret, active, sync_products, create_orders,
        domain_name, consumer_key, consumer_secret, active, sync_products, create_orders
      ]
    );
    res.json({ success: true, message: 'WooCommerce configuration saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/woocommerce/sync', authenticateToken, async (req, res) => {
  try {
    const count = await syncWooCommerceProducts(req.user.id);
    res.json({ success: true, count, message: `Successfully synced ${count} products.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= AUTOMATIONS ROUTES =================

app.get('/api/automations', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const automations = await db.all('SELECT * FROM automations WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(automations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/automations', authenticateToken, async (req, res) => {
  const { id, name, description, trigger_type, condition_type, condition_value, action_type, action_value, active } = req.body;
  const db = getDb();
  try {
    if (id) {
      await db.run(
        `UPDATE automations SET name=?, description=?, trigger_type=?, condition_type=?, condition_value=?, action_type=?, action_value=?, active=? WHERE id=? AND user_id=?`,
        [name, description, trigger_type, condition_type, condition_value, action_type, action_value, active, id, req.user.id]
      );
      res.json({ success: true, message: 'Automation rule updated.' });
    } else {
      await db.run(
        `INSERT INTO automations (user_id, name, description, trigger_type, condition_type, condition_value, action_type, action_value, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, name, description, trigger_type, condition_type, condition_value, action_type, action_value, active]
      );
      res.json({ success: true, message: 'Automation rule created.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/automations/:id', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    await db.run('DELETE FROM automations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Automation rule deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/automations/:id/toggle', authenticateToken, async (req, res) => {
  const { active } = req.body;
  const db = getDb();
  try {
    await db.run('UPDATE automations SET active = ? WHERE id = ? AND user_id = ?', [active, req.params.id, req.user.id]);
    res.json({ success: true, message: 'Automation status toggled.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= CRM ROUTES =================

app.get('/api/crm/contacts', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const contacts = await db.all('SELECT * FROM contacts WHERE user_id = ? ORDER BY lead_score DESC, name ASC', [req.user.id]);
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/crm/contacts', authenticateToken, async (req, res) => {
  const { phone_number, name, tags, notes } = req.body;
  if (!phone_number) return res.status(400).json({ error: 'Phone number is required' });

  const db = getDb();
  try {
    await db.run(
      `INSERT INTO contacts (user_id, phone_number, name, tags, notes)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, phone_number) DO UPDATE SET
        name = COALESCE(?, name), tags = COALESCE(?, tags), notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, phone_number, name, tags, notes, name, tags, notes]
    );
    const contact = await db.get('SELECT * FROM contacts WHERE user_id = ? AND phone_number = ?', [req.user.id, phone_number]);
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/crm/contacts/:id/settings', authenticateToken, async (req, res) => {
  const { ai_disabled, assignee, tags, notes } = req.body;
  const db = getDb();
  try {
    const contact = await db.get('SELECT * FROM contacts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    await db.run(
      `UPDATE contacts SET ai_disabled = ?, assignee = ?, tags = COALESCE(?, tags), notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
      [
        ai_disabled === undefined ? contact.ai_disabled : ai_disabled,
        assignee === undefined ? contact.assignee : assignee,
        tags, notes, req.params.id, req.user.id
      ]
    );
    const updatedContact = await db.get('SELECT * FROM contacts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json(updatedContact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/crm/messages/:contactId', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const messages = await db.all(
      `SELECT * FROM messages WHERE user_id = ? AND contact_id = ? ORDER BY timestamp ASC`,
      [req.user.id, req.params.contactId]
    );
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/crm/messages/send', authenticateToken, async (req, res) => {
  const { contact_id, text } = req.body;
  if (!contact_id || !text) return res.status(400).json({ error: 'Missing contact_id or text message' });

  const db = getDb();
  try {
    const contact = await db.get('SELECT * FROM contacts WHERE id = ? AND user_id = ?', [contact_id, req.user.id]);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const session = getSession(req.user.id);
    if (!session || session.status !== 'connected') {
      return res.status(400).json({ error: 'WhatsApp is not connected. Connect first.' });
    }

    const formattedJid = `${contact.phone_number}@s.whatsapp.net`;
    await session.sock.sendMessage(formattedJid, { text });
    const senderPhone = session.sock.user.id.split(':')[0];

    await db.run(
      `INSERT INTO messages (user_id, contact_id, sender_phone, recipient_phone, text, direction)
       VALUES (?, ?, ?, ?, ?, 'outgoing')`,
      [req.user.id, contact.id, senderPhone, contact.phone_number, text]
    );

    res.json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= CAMPAIGN & BROADCAST ROUTES =================

app.get('/api/campaigns', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const campaigns = await db.all('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/campaigns', authenticateToken, async (req, res) => {
  const { name, text, target_tags } = req.body;
  if (!name || !text) return res.status(400).json({ error: 'Name and text are required' });

  const db = getDb();
  try {
    const session = getSession(req.user.id);
    if (!session || session.status !== 'connected') {
      return res.status(400).json({ error: 'WhatsApp is not connected. Connect first before launching campaigns.' });
    }

    const result = await db.run(
      `INSERT INTO campaigns (user_id, name, text, target_tags, status) VALUES (?, ?, ?, ?, 'sending')`,
      [req.user.id, name, text, target_tags]
    );
    const campaignId = result.lastID;

    let query = 'SELECT * FROM contacts WHERE user_id = ? AND opt_out = 0';
    let params = [req.user.id];
    if (target_tags) {
      query += ' AND tags LIKE ?';
      params.push(`%${target_tags}%`);
    }

    const contacts = await db.all(query, params);

    if (contacts.length === 0) {
      await db.run('UPDATE campaigns SET status = "completed", completed_at = CURRENT_TIMESTAMP WHERE id = ?', [campaignId]);
      return res.json({ message: 'Campaign created but no contacts matched the tag filters.' });
    }

    sendBroadcast(req.user.id, contacts, text)
      .then(async () => {
        await db.run('UPDATE campaigns SET status = "completed", sent_count = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?', [contacts.length, campaignId]);
        await triggerWebhook(req.user.id, WEBHOOK_EVENTS.CAMPAIGN_COMPLETED, { name, sent_count: contacts.length });
      })
      .catch(async (err) => {
        console.error(`Campaign ${campaignId} failed:`, err);
        await db.run('UPDATE campaigns SET status = "failed" WHERE id = ?', [campaignId]);
      });

    res.json({ message: `Campaign initiated sending to ${contacts.length} contacts.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= PAYMENTS / SaaS BILLING ROUTES =================

app.post('/api/payments/subscribe', authenticateToken, async (req, res) => {
  const { phone_number, amount, provider } = req.body;
  if (!phone_number || !amount || !provider) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const paymentResponse = await initiatePayment(req.user.id, phone_number, amount, provider);
    res.json(paymentResponse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments/status/:reference', authenticateToken, async (req, res) => {
  try {
    const payment = await getPaymentStatus(req.params.reference);
    if (!payment) return res.status(404).json({ error: 'Transaction reference not found' });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= SUPER ADMIN ROUTES =================

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const db = getDb();
  try {
    const users = await db.all('SELECT id, name, email, plan, active_until, role, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users/:id/plan', authenticateToken, requireAdmin, async (req, res) => {
  const { plan, days } = req.body;
  if (!plan) return res.status(400).json({ error: 'Plan is required' });

  const db = getDb();
  try {
    let activeUntil = null;
    if (days && days > 0) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + parseInt(days));
      activeUntil = expirationDate.toISOString().slice(0, 19).replace('T', ' ');
    }
    await db.run('UPDATE users SET plan = ?, active_until = ? WHERE id = ?', [plan, activeUntil, req.params.id]);
    res.json({ success: true, message: 'User plan updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const db = getDb();
  try {
    try { await stopWhatsappSession(req.params.id); } catch (_) {}
    await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/payments', authenticateToken, requireAdmin, async (req, res) => {
  const db = getDb();
  try {
    const payments = await db.all(
      `SELECT p.*, u.email as user_email FROM payments p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC`
    );
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= CATALOG ROUTES =================

app.get('/api/catalog', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const products = await db.all('SELECT * FROM products WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/catalog', authenticateToken, async (req, res) => {
  const { id, name, price, description, status, image_url, stock } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'Name and price are required' });

  const db = getDb();
  try {
    if (id) {
      await db.run(
        `UPDATE products SET name=?, price=?, description=?, status=?, image_url=?, stock=? WHERE id=? AND user_id=?`,
        [name, price, description, status || 'available', image_url, stock ?? -1, id, req.user.id]
      );
      res.json({ success: true, message: 'Product updated successfully.' });
    } else {
      await db.run(
        `INSERT INTO products (user_id, name, price, description, status, image_url, stock) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, name, price, description, status || 'available', image_url, stock ?? -1]
      );
      res.json({ success: true, message: 'Product added successfully.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/catalog/:id', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    await db.run('DELETE FROM products WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= COUPONS ROUTES =================

app.get('/api/coupons', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const coupons = await db.all('SELECT * FROM coupons WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/coupons', authenticateToken, async (req, res) => {
  const { id, code, discount_type, value, active } = req.body;
  if (!code || value === undefined) return res.status(400).json({ error: 'Code and value are required' });

  const db = getDb();
  try {
    const uppercaseCode = code.trim().toUpperCase();
    if (id) {
      await db.run(
        `UPDATE coupons SET code=?, discount_type=?, value=?, active=? WHERE id=? AND user_id=?`,
        [uppercaseCode, discount_type || 'fixed', value, active === undefined ? 1 : active, id, req.user.id]
      );
      res.json({ success: true, message: 'Coupon updated successfully.' });
    } else {
      await db.run(
        `INSERT INTO coupons (user_id, code, discount_type, value, active) VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, uppercaseCode, discount_type || 'fixed', value, active === undefined ? 1 : active]
      );
      res.json({ success: true, message: 'Coupon created successfully.' });
    }
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/coupons/:id', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    await db.run('DELETE FROM coupons WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Coupon deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/carts', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const carts = await db.all(
      `SELECT c.*, co.name as contact_name, co.phone_number as contact_phone 
       FROM carts c JOIN contacts co ON c.contact_id = co.id 
       WHERE c.user_id = ? ORDER BY c.last_activity DESC`,
      [req.user.id]
    );
    res.json(carts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= ANALYTICS ROUTES (NEW) =================

app.get('/api/analytics/overview', authenticateToken, async (req, res) => {
  const { days = 30 } = req.query;
  try {
    const overview = await getAnalyticsOverview(req.user.id, parseInt(days));
    res.json(overview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/keywords', authenticateToken, async (req, res) => {
  const { days = 30, limit = 20 } = req.query;
  try {
    const keywords = await getTopKeywords(req.user.id, parseInt(days), parseInt(limit));
    res.json(keywords);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/response-times', authenticateToken, async (req, res) => {
  const { days = 30 } = req.query;
  try {
    const stats = await getResponseTimeStats(req.user.id, parseInt(days));
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/contact-growth', authenticateToken, async (req, res) => {
  try {
    const growth = await getContactGrowth(req.user.id);
    res.json(growth);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= LEAD SCORING ROUTES (NEW) =================

app.get('/api/lead-scores/top', authenticateToken, async (req, res) => {
  const { limit = 20 } = req.query;
  try {
    const leads = await getTopLeads(req.user.id, parseInt(limit));
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lead-scores/recalculate', authenticateToken, async (req, res) => {
  try {
    const results = await recalculateAllScores(req.user.id);
    res.json({ success: true, updated: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lead-scores/:contactId', authenticateToken, async (req, res) => {
  try {
    const result = await calculateLeadScore(req.user.id, parseInt(req.params.contactId));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lead-scores/history/:contactId', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const history = await db.all(
      'SELECT * FROM lead_score_history WHERE user_id = ? AND contact_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id, req.params.contactId]
    );
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= SCHEDULED MESSAGES ROUTES (NEW) =================

app.get('/api/scheduled-messages', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const msgs = await db.all(
      'SELECT * FROM scheduled_messages WHERE user_id = ? ORDER BY scheduled_at ASC',
      [req.user.id]
    );
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/scheduled-messages', authenticateToken, async (req, res) => {
  try {
    const id = await createScheduledMessage(req.user.id, req.body);
    const db = getDb();
    const msg = await db.get('SELECT * FROM scheduled_messages WHERE id = ?', [id]);
    res.json({ success: true, message: 'Scheduled message created.', data: msg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/scheduled-messages/:id', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    await db.run('DELETE FROM scheduled_messages WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Scheduled message deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/scheduled-messages/:id', authenticateToken, async (req, res) => {
  const { status } = req.body;
  const db = getDb();
  try {
    await db.run(
      'UPDATE scheduled_messages SET status = ? WHERE id = ? AND user_id = ?',
      [status, req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= CONTACT SEGMENTS ROUTES (NEW) =================

app.get('/api/segments', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const segments = await db.all(
      'SELECT * FROM contact_segments WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/segments', authenticateToken, async (req, res) => {
  const { id, name, description, filter_rules } = req.body;
  const db = getDb();
  try {
    const contacts = await applySegmentFilters(req.user.id, filter_rules || []);
    const count = contacts.length;
    const rulesJson = JSON.stringify(filter_rules || []);

    if (id) {
      await db.run(
        `UPDATE contact_segments SET name=?, description=?, filter_rules=?, contact_count=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`,
        [name, description, rulesJson, count, id, req.user.id]
      );
    } else {
      await db.run(
        `INSERT INTO contact_segments (user_id, name, description, filter_rules, contact_count) VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, name, description, rulesJson, count]
      );
    }
    res.json({ success: true, contact_count: count, message: 'Segment saved.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/segments/:id/contacts', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const segment = await db.get('SELECT * FROM contact_segments WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!segment) return res.status(404).json({ error: 'Segment not found' });

    const contacts = await applySegmentFilters(req.user.id, JSON.parse(segment.filter_rules));
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/segments/:id', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    await db.run('DELETE FROM contact_segments WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= QUICK REPLY TEMPLATES ROUTES (NEW) =================

app.get('/api/templates', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    let templates = await db.all(
      'SELECT * FROM quick_reply_templates WHERE user_id = ? ORDER BY category, name',
      [req.user.id]
    );
    if (templates.length === 0) {
      await seedDefaultTemplates(db, req.user.id);
      templates = await db.all(
        'SELECT * FROM quick_reply_templates WHERE user_id = ? ORDER BY category, name',
        [req.user.id]
      );
    }
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/templates', authenticateToken, async (req, res) => {
  const { id, name, shortcut, content, category } = req.body;
  if (!name || !shortcut || !content) {
    return res.status(400).json({ error: 'Name, shortcut, and content are required' });
  }

  const db = getDb();
  try {
    if (id) {
      await db.run(
        `UPDATE quick_reply_templates SET name=?, shortcut=?, content=?, category=? WHERE id=? AND user_id=?`,
        [name, shortcut, content, category || 'general', id, req.user.id]
      );
      res.json({ success: true, message: 'Template updated.' });
    } else {
      await db.run(
        `INSERT INTO quick_reply_templates (user_id, name, shortcut, content, category) VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, name, shortcut, content, category || 'general']
      );
      res.json({ success: true, message: 'Template created.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    await db.run('DELETE FROM quick_reply_templates WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= ORDERS ROUTES (NEW) =================

app.get('/api/orders', authenticateToken, async (req, res) => {
  const { status } = req.query;
  try {
    const orders = await getOrdersWithContacts(req.user.id, status || null);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await getOrderStats(req.user.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const order = await createOrder(req.user.id, req.body);
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id/status', authenticateToken, async (req, res) => {
  const { status, tracking_number } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });

  try {
    const order = await updateOrderStatus(req.user.id, parseInt(req.params.id), status, tracking_number);
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/orders/:id', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    await db.run('DELETE FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= TEAM AGENTS ROUTES (NEW) =================

app.get('/api/team', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const agents = await db.all(
      'SELECT * FROM team_agents WHERE owner_user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/team/invite', authenticateToken, async (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

  const db = getDb();
  try {
    const inviteToken = randomBytes(20).toString('hex');
    await db.run(
      `INSERT INTO team_agents (owner_user_id, name, email, role, invite_token) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, name, email, role || 'agent', inviteToken]
    );
    res.json({ success: true, invite_token: inviteToken, message: `Invite sent to ${email}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/team/:id', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    await db.run('DELETE FROM team_agents WHERE id = ? AND owner_user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/team/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  const db = getDb();
  try {
    await db.run('UPDATE team_agents SET status = ? WHERE id = ? AND owner_user_id = ?', [status, req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= WEBHOOK ROUTES (NEW) =================

app.get('/api/webhooks', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const webhooks = await db.all(
      'SELECT * FROM webhooks WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(webhooks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/webhooks', authenticateToken, async (req, res) => {
  const { id, name, url, events, secret, active } = req.body;
  if (!name || !url || !events) {
    return res.status(400).json({ error: 'Name, URL, and events are required' });
  }

  const db = getDb();
  try {
    if (id) {
      await db.run(
        `UPDATE webhooks SET name=?, url=?, events=?, secret=COALESCE(?,secret), active=? WHERE id=? AND user_id=?`,
        [name, url, Array.isArray(events) ? events.join(',') : events, secret, active ?? 1, id, req.user.id]
      );
      res.json({ success: true, message: 'Webhook updated.' });
    } else {
      await db.run(
        `INSERT INTO webhooks (user_id, name, url, events, secret, active) VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, name, url, Array.isArray(events) ? events.join(',') : events, secret || null, active ?? 1]
      );
      res.json({ success: true, message: 'Webhook created.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/webhooks/:id/test', authenticateToken, async (req, res) => {
  try {
    await testWebhook(parseInt(req.params.id), req.user.id);
    res.json({ success: true, message: 'Test payload sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/webhooks/:id', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    await db.run('DELETE FROM webhooks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= A/B TEST ROUTES (NEW) =================

app.get('/api/ab-tests', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const tests = await db.all(
      'SELECT * FROM ab_tests WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ab-tests', authenticateToken, async (req, res) => {
  const { name, variant_a, variant_b, target_tags, split_ratio, auto_select_after_hours } = req.body;
  if (!name || !variant_a || !variant_b) {
    return res.status(400).json({ error: 'Name, variant_a, and variant_b are required' });
  }

  const db = getDb();
  try {
    // Get contacts for targeting
    let contacts = [];
    if (target_tags) {
      contacts = await db.all(
        'SELECT * FROM contacts WHERE user_id = ? AND tags LIKE ? AND opt_out = 0',
        [req.user.id, `%${target_tags}%`]
      );
    } else {
      contacts = await db.all('SELECT * FROM contacts WHERE user_id = ? AND opt_out = 0', [req.user.id]);
    }

    if (contacts.length === 0) {
      return res.status(400).json({ error: 'No contacts found for targeting' });
    }

    const session = getSession(req.user.id);
    if (!session || session.status !== 'connected') {
      return res.status(400).json({ error: 'WhatsApp is not connected' });
    }

    const split = split_ratio || 50;
    const splitPoint = Math.floor(contacts.length * (split / 100));
    const groupA = contacts.slice(0, splitPoint);
    const groupB = contacts.slice(splitPoint);

    const result = await db.run(
      `INSERT INTO ab_tests (user_id, name, variant_a, variant_b, target_tags, split_ratio, auto_select_after_hours, sent_a, sent_b, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'running')`,
      [req.user.id, name, variant_a, variant_b, target_tags, split, auto_select_after_hours || 24, groupA.length, groupB.length]
    );

    const testId = result.lastID;

    // Send asynchronously
    (async () => {
      try {
        await sendBroadcast(req.user.id, groupA, variant_a);
        await sendBroadcast(req.user.id, groupB, variant_b);
        
        // Schedule winner selection
        const selectAfter = (auto_select_after_hours || 24) * 3600 * 1000;
        setTimeout(async () => {
          const test = await db.get('SELECT * FROM ab_tests WHERE id = ?', [testId]);
          if (test && test.status === 'running') {
            const winner = test.reply_a >= test.reply_b ? 'A' : 'B';
            await db.run(
              'UPDATE ab_tests SET winner=?, status="completed", completed_at=CURRENT_TIMESTAMP WHERE id=?',
              [winner, testId]
            );
          }
        }, selectAfter);
      } catch (e) {
        console.error('AB test send error:', e);
      }
    })();

    res.json({ success: true, test_id: testId, groups: { a: groupA.length, b: groupB.length } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ab-tests/:id', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    await db.run('DELETE FROM ab_tests WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= OPT-OUT / COMPLIANCE ROUTES (NEW) =================

app.get('/api/opt-outs', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const optOuts = await db.all(
      'SELECT * FROM opt_outs WHERE user_id = ? ORDER BY opted_out_at DESC',
      [req.user.id]
    );
    res.json(optOuts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/opt-outs', authenticateToken, async (req, res) => {
  const { phone_number, reason } = req.body;
  if (!phone_number) return res.status(400).json({ error: 'Phone number is required' });

  const db = getDb();
  try {
    await db.run(
      `INSERT OR REPLACE INTO opt_outs (user_id, phone_number, reason) VALUES (?, ?, ?)`,
      [req.user.id, phone_number, reason || 'manual']
    );
    // Also mark contact as opted out
    await db.run(
      'UPDATE contacts SET opt_out = 1, opt_out_at = CURRENT_TIMESTAMP WHERE user_id = ? AND phone_number = ?',
      [req.user.id, phone_number]
    );
    await triggerWebhook(req.user.id, WEBHOOK_EVENTS.CONTACT_OPT_OUT, { phone_number });
    res.json({ success: true, message: 'Contact added to opt-out list.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/opt-outs/:phone', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const phone = decodeURIComponent(req.params.phone);
    await db.run('DELETE FROM opt_outs WHERE user_id = ? AND phone_number = ?', [req.user.id, phone]);
    await db.run(
      'UPDATE contacts SET opt_out = 0, opt_out_at = NULL WHERE user_id = ? AND phone_number = ?',
      [req.user.id, phone]
    );
    res.json({ success: true, message: 'Contact removed from opt-out list.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= PUBLIC EXTERNAL API (with API Key auth) =================

app.get('/api/v1/contacts', authenticateApiKey, async (req, res) => {
  const db = getDb();
  try {
    const contacts = await db.all(
      'SELECT id, phone_number, name, tags, lead_score, last_seen FROM contacts WHERE user_id = ? AND opt_out = 0',
      [req.user.id]
    );
    res.json({ data: contacts, count: contacts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/messages/send', authenticateApiKey, async (req, res) => {
  const { phone_number, message } = req.body;
  if (!phone_number || !message) {
    return res.status(400).json({ error: 'phone_number and message are required' });
  }

  try {
    await sendWhatsAppMessage(req.user.id, phone_number, message);
    res.json({ success: true, message: 'Message sent via API' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= GATEWAY CONFIG ROUTES (NEW) =================

app.get('/api/config/whatsapp-gateway', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    let config = await db.get(
      'SELECT * FROM whatsapp_gateway_configs WHERE user_id = ?',
      [req.user.id]
    );
    if (!config) {
      await db.run(
        'INSERT INTO whatsapp_gateway_configs (user_id, gateway_type) VALUES (?, ?)',
        [req.user.id, 'baileys']
      );
      config = { user_id: req.user.id, gateway_type: 'baileys' };
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/whatsapp-gateway', authenticateToken, async (req, res) => {
  const { gateway_type, meta_access_token, meta_phone_number_id, meta_waba_id, meta_verify_token } = req.body;
  
  if (!gateway_type || !['baileys', 'meta_api'].includes(gateway_type)) {
    return res.status(400).json({ error: 'Invalid gateway_type' });
  }

  const db = getDb();
  try {
    await db.run(
      `INSERT INTO whatsapp_gateway_configs 
       (user_id, gateway_type, meta_access_token, meta_phone_number_id, meta_waba_id, meta_verify_token)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         gateway_type = excluded.gateway_type,
         meta_access_token = excluded.meta_access_token,
         meta_phone_number_id = excluded.meta_phone_number_id,
         meta_waba_id = excluded.meta_waba_id,
         meta_verify_token = excluded.meta_verify_token`,
      [req.user.id, gateway_type, meta_access_token || null, meta_phone_number_id || null, meta_waba_id || null, meta_verify_token || null]
    );
    res.json({ success: true, message: 'WhatsApp Gateway configuration updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= META CLOUD WEBHOOK ROUTES (NEW) =================

app.get('/api/webhook/whatsapp/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    const db = getDb();
    const config = await db.get(
      'SELECT meta_verify_token FROM whatsapp_gateway_configs WHERE user_id = ?',
      [userId]
    );

    if (config && token === config.meta_verify_token) {
      console.log(`Webhook verified successfully for user ${userId}`);
      return res.status(200).send(challenge);
    }
  }
  res.status(403).send('Verification failed');
});

app.post('/api/webhook/whatsapp/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    try {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      if (message) {
        const phone = message.from;
        let text = '';
        
        if (message.type === 'text') {
          text = message.text?.body;
        } else if (message.type === 'audio') {
          text = '[Customer sent a voice message]';
        }

        if (text) {
          console.log(`Meta Webhook message from ${phone} to ${userId}: "${text}"`);
          
          const db = getDb();
          let contact = await db.get(
            'SELECT * FROM contacts WHERE user_id = ? AND phone_number = ?',
            [userId, phone]
          );

          if (!contact) {
            const contactName = value.contacts?.[0]?.profile?.name || phone;
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

          // Opt-out handling
          const optOutKeywords = ['stop', 'unsubscribe', 'acha', 'niache'];
          if (optOutKeywords.includes(text.toLowerCase().trim())) {
            await db.run('UPDATE contacts SET opt_out = 1, opt_out_at = CURRENT_TIMESTAMP WHERE id = ?', [contact.id]);
            await db.run(
              `INSERT INTO opt_outs (user_id, phone_number, reason) VALUES (?, ?, 'webhook_keyword')
               ON CONFLICT(user_id, phone_number) DO NOTHING`,
              [userId, phone]
            );
            await sendWhatsAppMessage(userId, phone, 'Umeondolewa kwenye orodha ya kupokea ujumbe. Kama unataka kurudi, wasiliana nasi.');
            return res.sendStatus(200);
          }

          if (contact.opt_out === 1) {
            return res.sendStatus(200);
          }

          // 2. Log message to history
          await db.run(
            `INSERT INTO messages (user_id, contact_id, sender_phone, recipient_phone, text, direction)
             VALUES (?, ?, ?, ?, ?, 'incoming')`,
            [userId, contact.id, phone, value.metadata?.display_phone_number || 'meta', text]
          );

          // Evaluate Rules engine
          let ruleBypassedAI = false;
          try {
            const activeRules = await db.all('SELECT * FROM automations WHERE user_id = ? AND active = 1', [userId]);
            for (const rule of activeRules) {
              if (rule.trigger_type === 'message_received') {
                let matched = false;
                const msgLower = text.toLowerCase().trim();
                const valLower = (rule.condition_value || '').toLowerCase().trim();

                if (rule.condition_type === 'always') matched = true;
                else if (rule.condition_type === 'equals' && msgLower === valLower) matched = true;
                else if (rule.condition_type === 'contains' && msgLower.includes(valLower)) matched = true;
                else if (rule.condition_type === 'starts_with' && msgLower.startsWith(valLower)) matched = true;

                if (matched) {
                  if (rule.action_type === 'send_message') {
                    await sendWhatsAppMessage(userId, phone, rule.action_value);
                    await db.run(
                      `INSERT INTO messages (user_id, contact_id, sender_phone, recipient_phone, text, direction)
                       VALUES (?, ?, ?, ?, ?, 'outgoing')`,
                      [userId, contact.id, value.metadata?.display_phone_number || 'meta', phone, rule.action_value]
                    );
                    ruleBypassedAI = true;
                  } else if (rule.action_type === 'add_tag') {
                    let tagsArray = contact.tags ? contact.tags.split(',').map(t => t.trim()) : [];
                    if (!tagsArray.includes(rule.action_value)) {
                      tagsArray.push(rule.action_value);
                      await db.run('UPDATE contacts SET tags = ? WHERE id = ?', [tagsArray.join(', '), contact.id]);
                    }
                  } else if (rule.action_type === 'disable_ai') {
                    await db.run('UPDATE contacts SET ai_disabled = 1 WHERE id = ?', [contact.id]);
                  } else if (rule.action_type === 'enable_ai') {
                    await db.run('UPDATE contacts SET ai_disabled = 0 WHERE id = ?', [contact.id]);
                  }
                  await db.run('UPDATE automations SET runs_count = runs_count + 1 WHERE id = ?', [rule.id]);
                }
              }
            }
          } catch (rErr) {
            console.error('Rules error:', rErr);
          }

          // 3. AI response
          const aiConfig = await db.get('SELECT * FROM ai_configs WHERE user_id = ?', [userId]);
          if (aiConfig && aiConfig.enabled === 1 && contact.ai_disabled !== 1 && !ruleBypassedAI) {
            const history = await db.all(
              `SELECT text, direction FROM messages WHERE user_id = ? AND contact_id = ? ORDER BY timestamp DESC LIMIT 5`,
              [userId, contact.id]
            );
            const sortedHistory = history.reverse();
            const promptContext = sortedHistory.map(h => `${h.direction === 'incoming' ? 'Customer' : 'Assistant'}: ${h.text}`).join('\n') + `\nAssistant:`;

            const user = await db.get('SELECT plan, active_until FROM users WHERE id = ?', [userId]);
            const isPlanActive = !user.active_until || new Date(user.active_until) > new Date();

            if (isPlanActive) {
              const products = await db.all('SELECT name, price, description, status FROM products WHERE user_id = ?', [userId]);
              const coupons = await db.all('SELECT code, discount_type, value FROM coupons WHERE user_id = ? AND active = 1', [userId]);
              
              let dynamicContext = '\n\n';
              if (products.length > 0) {
                dynamicContext += 'ORODHA YA BIDHAA ZILIZOPO GHALANI NA BEI ZAKE:\n';
                products.forEach(p => {
                  dynamicContext += `- ${p.name}: Bei TZS ${p.price.toLocaleString()} (${p.description || ''}) - Hali: ${p.status === 'available' ? 'Ipo' : 'Imekwisha'}\n`;
                });
              }
              if (coupons.length > 0) {
                dynamicContext += '\nKUPONI ZA PUNGUZO ZILIZO HAI (COUPONS):\n';
                coupons.forEach(c => {
                  dynamicContext += `- Code: ${c.code} (${c.discount_type === 'percentage' ? c.value + '%' : c.value.toLocaleString() + ' TZS'} Off)\n`;
                });
              }

              let activePrompt = aiConfig.system_prompt + dynamicContext;
              const responseText = await askAI(promptContext, activePrompt, aiConfig);

              if (responseText) {
                let cleanedResponse = responseText;
                
                if (responseText.includes('[ROUTE: support]')) {
                  cleanedResponse = responseText.replace('[ROUTE: support]', '').trim();
                  await db.run("UPDATE contacts SET agent_mode = 'support' WHERE id = ?", [contact.id]);
                } else if (responseText.includes('[ROUTE: sales]')) {
                  cleanedResponse = responseText.replace('[ROUTE: sales]', '').trim();
                  await db.run("UPDATE contacts SET agent_mode = 'sales' WHERE id = ?", [contact.id]);
                }

                await sendWhatsAppMessage(userId, phone, cleanedResponse);

                await db.run(
                  `INSERT INTO messages (user_id, contact_id, sender_phone, recipient_phone, text, direction)
                   VALUES (?, ?, ?, ?, ?, 'outgoing')`,
                  [userId, contact.id, value.metadata?.display_phone_number || 'meta', phone, cleanedResponse]
                );
              }
            }
          }
        }
      }
      res.sendStatus(200);
    } catch (err) {
      console.error(err);
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(404);
  }
});

// Start Server execution
startServer().catch(err => {
  console.error('Fatal Server Start Error:', err);
});
