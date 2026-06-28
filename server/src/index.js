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
  sendBroadcast 
} from './services/whatsappManager.js';
import { askAI } from './services/aiService.js';
import { initiatePayment, getPaymentStatus } from './services/paymentService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'agentnko-super-secret-key-12345';

app.use(cors());
app.use(express.json());

// Initialize Database and Start App
async function startServer() {
  await initDb();
  
  // Restore previously active WhatsApp connections
  await initAllSessions();

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
      `INSERT INTO ai_configs (user_id, provider, model, enabled) VALUES (?, 'gemini', 'gemini-1.5-flash', 0)`,
      [result.lastID]
    );

    const token = jwt.sign({ id: result.lastID, email, name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.lastID, name, email, plan: 'free', active_until: null } });
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

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        plan: user.plan, 
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
    const user = await db.get('SELECT id, name, email, plan, active_until FROM users WHERE id = ?', [req.user.id]);
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
        `INSERT INTO ai_configs (user_id, provider, model, enabled) VALUES (?, 'gemini', 'gemini-1.5-flash', 0)`,
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
  const { provider, model, api_key, system_prompt, temperature, enabled } = req.body;
  const db = getDb();
  try {
    await db.run(
      `INSERT INTO ai_configs (user_id, provider, model, api_key, system_prompt, temperature, enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET 
        provider = ?, 
        model = ?, 
        api_key = COALESCE(?, api_key), 
        system_prompt = ?, 
        temperature = ?, 
        enabled = ?, 
        updated_at = CURRENT_TIMESTAMP`,
      [
        req.user.id, provider, model, api_key, system_prompt, temperature, enabled,
        provider, model, api_key, system_prompt, temperature, enabled
      ]
    );
    res.json({ message: 'AI configuration updated successfully.' });
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

// Start Server execution
startServer().catch(err => {
  console.error('Fatal Server Start Error:', err);
});
