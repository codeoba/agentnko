import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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
    // Also create default AI config for admin
    await db.run(
      `INSERT INTO ai_configs (user_id, provider, model, system_prompt, enabled) 
       VALUES (?, 'gemini', 'gemini-2.0-flash', 'Wewe ni msaidizi mkuu wa huduma kwa wateja (AI Agent). Jibu wateja kwa adabu na urafiki ukitumia Kiswahili kizuri cha biashara cha Tanzania au Kiingereza kulingana na lugha ya mteja.
Fuata mwongozo huu:
1. Salamu ya Kwanza: Karibisha wateja kwa furaha. Kamwe usitumie \"Shikamoo\". Salamu ziwe kama \"Habari! Karibu sana\" na utaje chaguzi kama: 1. Kuuliza bei, 2. Kutoa order, 3. Mahali tulipo, 4. Kupanga miadi, 5. Njia za malipo, 6. Kuongea na mwanadamu.
2. Kutoa Order: Uliza kama wanataka Delivery au Pick-up. Chukua Jina, Eneo, na Namba ya simu. Kisha thibitisha order.
3. Njia za Malipo: Taja M-Pesa, Tigopesa, na Bank.
4. Msaada wa Binadamu: Kama swali ni gumu au mteja anataka mtu wa kweli, sema \"Nitakuunganisha na mfanyakazi wetu sasa hivi.\"
Jibu kwa ufupi, ukitumia emoji zenye staha.', 0)`,
      [result.lastID]
    );
    console.log(`Seeded Super Admin user: ${adminEmail}`);
  }

  // Restore previously active WhatsApp connections
  await initAllSessions();

  // Start Background Scheduler for Abandoned Cart Recovery
  startAbandonedCartScheduler();

  app.listen(PORT, () => {
    console.log(`AgentNKO Backend running on http://localhost:${PORT}`);
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
    
    // Automatically set up default AI config for this user
    await db.run(
      `INSERT INTO ai_configs (user_id, provider, model, system_prompt, enabled) 
       VALUES (?, 'gemini', 'gemini-2.0-flash', 'Wewe ni msaidizi mkuu wa huduma kwa wateja (AI Agent). Jibu wateja kwa adabu na urafiki ukitumia Kiswahili kizuri cha biashara cha Tanzania au Kiingereza kulingana na lugha ya mteja.
Fuata mwongozo huu:
1. Salamu ya Kwanza: Karibisha wateja kwa furaha. Kamwe usitumie \"Shikamoo\". Salamu ziwe kama \"Habari! Karibu sana\" na utaje chaguzi kama: 1. Kuuliza bei, 2. Kutoa order, 3. Mahali tulipo, 4. Kupanga miadi, 5. Njia za malipo, 6. Kuongea na mwanadamu.
2. Kutoa Order: Uliza kama wanataka Delivery au Pick-up. Chukua Jina, Eneo, na Namba ya simu. Kisha thibitisha order.
3. Njia za Malipo: Taja M-Pesa, Tigopesa, na Bank.
4. Msaada wa Binadamu: Kama swali ni gumu au mteja anataka mtu wa kweli, sema \"Nitakuunganisha na mfanyakazi wetu sasa hivi.\"
Jibu kwa ufupi, ukitumia emoji zenye staha.', 0)`,
      [result.lastID]
    );

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
        id: user.id, 
        name: user.name, 
        email: user.email, 
        plan: user.plan, 
        role: user.role,
        active_until: user.active_until 
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const db = getDb();
  try {
    const user = await db.get('SELECT id, name, email, plan, active_until, role FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
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
  try {
    await db.run(
      `INSERT INTO ai_configs (user_id, provider, model, api_key, system_prompt, support_prompt, temperature, enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET 
        provider = ?, 
        model = ?, 
        api_key = COALESCE(?, api_key), 
        system_prompt = ?, 
        support_prompt = ?, 
        temperature = ?, 
        enabled = ?, 
        updated_at = CURRENT_TIMESTAMP`,
      [
        req.user.id, provider, model, api_key, system_prompt, support_prompt, temperature, enabled,
        provider, model, api_key, system_prompt, support_prompt, temperature, enabled
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
        domain_name = ?,
        consumer_key = ?,
        consumer_secret = ?,
        active = ?,
        sync_products = ?,
        create_orders = ?`,
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
        `UPDATE automations SET
          name = ?,
          description = ?,
          trigger_type = ?,
          condition_type = ?,
          condition_value = ?,
          action_type = ?,
          action_value = ?,
          active = ?
         WHERE id = ? AND user_id = ?`,
        [name, description, trigger_type, condition_type, condition_value, action_type, action_value, active, id, req.user.id]
      );
      res.json({ success: true, message: 'Automation rule updated.' });
    } else {
      await db.run(
        `INSERT INTO automations (user_id, name, description, trigger_type, condition_type, condition_value, action_type, action_value, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    const contacts = await db.all('SELECT * FROM contacts WHERE user_id = ? ORDER BY name ASC', [req.user.id]);
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
        name = COALESCE(?, name),
        tags = COALESCE(?, tags),
        notes = COALESCE(?, notes),
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
  const { ai_disabled, assignee } = req.body;
  const db = getDb();
  try {
    const contact = await db.get('SELECT * FROM contacts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    await db.run(
      `UPDATE contacts SET 
        ai_disabled = ?, 
        assignee = ?, 
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND user_id = ?`,
      [
        ai_disabled === undefined ? contact.ai_disabled : ai_disabled,
        assignee === undefined ? contact.assignee : assignee,
        req.params.id,
        req.user.id
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
    
    // Send via Baileys socket
    await session.sock.sendMessage(formattedJid, { text });

    const senderPhone = session.sock.user.id.split(':')[0];

    // Log message to history
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
    // Check connection first
    const session = getSession(req.user.id);
    if (!session || session.status !== 'connected') {
      return res.status(400).json({ error: 'WhatsApp is not connected. Connect first before launching campaigns.' });
    }

    // Insert campaign
    const result = await db.run(
      `INSERT INTO campaigns (user_id, name, text, target_tags, status) VALUES (?, ?, ?, ?, 'sending')`,
      [req.user.id, name, text, target_tags]
    );
    const campaignId = result.lastID;

    // Fetch matching contacts in CRM
    let query = 'SELECT * FROM contacts WHERE user_id = ?';
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

    // Launch async broadcast sending
    sendBroadcast(req.user.id, contacts, text)
      .then(async () => {
        await db.run('UPDATE campaigns SET status = "completed", completed_at = CURRENT_TIMESTAMP WHERE id = ?', [campaignId]);
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

    await db.run(
      'UPDATE users SET plan = ?, active_until = ? WHERE id = ?',
      [plan, activeUntil, req.params.id]
    );

    res.json({ success: true, message: 'User plan updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const db = getDb();
  try {
    // Delete user session if active
    try {
      await stopWhatsappSession(req.params.id);
    } catch (_) {}

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
      `SELECT p.*, u.email as user_email FROM payments p 
       LEFT JOIN users u ON p.user_id = u.id 
       ORDER BY p.created_at DESC`
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
  const { id, name, price, description, status } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'Name and price are required' });

  const db = getDb();
  try {
    if (id) {
      // Update
      await db.run(
        `UPDATE products SET name = ?, price = ?, description = ?, status = ? WHERE id = ? AND user_id = ?`,
        [name, price, description, status || 'available', id, req.user.id]
      );
      res.json({ success: true, message: 'Product updated successfully.' });
    } else {
      // Create
      await db.run(
        `INSERT INTO products (user_id, name, price, description, status) VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, name, price, description, status || 'available']
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

// ================= COUPON ROUTES =================

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
        `UPDATE coupons SET code = ?, discount_type = ?, value = ?, active = ? WHERE id = ? AND user_id = ?`,
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
       FROM carts c 
       JOIN contacts co ON c.contact_id = co.id 
       WHERE c.user_id = ? 
       ORDER BY c.last_activity DESC`,
      [req.user.id]
    );
    res.json(carts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server execution
startServer().catch(err => {
  console.error('Fatal Server Start Error:', err);
});
