import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../database.sqlite');

let db;

export async function initDb() {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON');

  // ===================== CORE TABLES =====================
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      plan TEXT DEFAULT 'free',
      active_until DATETIME,
      role TEXT DEFAULT 'user',
      api_key TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      user_id INTEGER PRIMARY KEY,
      phone_number TEXT,
      status TEXT DEFAULT 'disconnected',
      qr_code TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_configs (
      user_id INTEGER PRIMARY KEY,
      provider TEXT DEFAULT 'gemini',
      model TEXT DEFAULT 'gemini-2.0-flash',
      api_key TEXT,
      system_prompt TEXT DEFAULT 'Wewe ni msaidizi mkuu wa huduma kwa wateja (AI Agent). Jibu wateja kwa adabu na urafiki ukitumia Kiswahili kizuri cha biashara cha Tanzania au Kiingereza kulingana na lugha ya mteja.',
      support_prompt TEXT DEFAULT 'Wewe ni msaidizi wa kiufundi na malalamiko ya wateja (Technical Support Agent). Jibu wateja kwa adabu na utatue matatizo yao ya kiufundi au ucheleweshaji wa delivery.',
      temperature REAL DEFAULT 0.7,
      enabled INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      phone_number TEXT NOT NULL,
      name TEXT,
      tags TEXT,
      notes TEXT,
      agent_mode TEXT DEFAULT 'sales',
      ai_disabled INTEGER DEFAULT 0,
      assignee TEXT DEFAULT 'unassigned',
      lead_score INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      last_seen DATETIME,
      location TEXT,
      opt_out INTEGER DEFAULT 0,
      opt_out_at DATETIME,
      ai_context TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, phone_number),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      contact_id INTEGER,
      sender_phone TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      text TEXT,
      direction TEXT NOT NULL,
      ai_tokens_used INTEGER DEFAULT 0,
      response_time_ms INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      text TEXT NOT NULL,
      target_tags TEXT,
      status TEXT DEFAULT 'pending',
      scheduled_at DATETIME,
      completed_at DATETIME,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      phone_number TEXT NOT NULL,
      amount REAL NOT NULL,
      provider TEXT NOT NULL,
      reference TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      image_url TEXT,
      stock INTEGER DEFAULT -1,
      status TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT DEFAULT 'fixed',
      value REAL NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      contact_id INTEGER NOT NULL UNIQUE,
      cart_data TEXT,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      reminder_sent INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS woocommerce_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      domain_name TEXT NOT NULL,
      consumer_key TEXT NOT NULL,
      consumer_secret TEXT NOT NULL,
      active INTEGER DEFAULT 0,
      sync_products INTEGER DEFAULT 0,
      create_orders INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      trigger_type TEXT NOT NULL,
      condition_type TEXT NOT NULL,
      condition_value TEXT,
      action_type TEXT NOT NULL,
      action_value TEXT,
      active INTEGER DEFAULT 1,
      runs_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // ===================== NEW ENTERPRISE TABLES =====================
  await db.exec(`

    -- TIER 1: Lead Scoring History
    CREATE TABLE IF NOT EXISTS lead_score_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      contact_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );

    -- TIER 1: Scheduled Messages
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      target_type TEXT DEFAULT 'all',
      target_value TEXT,
      schedule_type TEXT DEFAULT 'once',
      scheduled_at DATETIME NOT NULL,
      cron_expression TEXT,
      timezone TEXT DEFAULT 'Africa/Dar_es_Salaam',
      status TEXT DEFAULT 'pending',
      sent_at DATETIME,
      sent_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- TIER 1: Contact Segments / Smart Lists
    CREATE TABLE IF NOT EXISTS contact_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      filter_rules TEXT NOT NULL,
      contact_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- TIER 1: Quick Reply Templates
    CREATE TABLE IF NOT EXISTS quick_reply_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      shortcut TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      usage_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- TIER 2: Order Management
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      contact_id INTEGER,
      order_number TEXT NOT NULL UNIQUE,
      items TEXT NOT NULL,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      delivery_type TEXT DEFAULT 'delivery',
      delivery_address TEXT,
      tracking_number TEXT,
      notes TEXT,
      notified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
    );

    -- TIER 2: Team Agents
    CREATE TABLE IF NOT EXISTS team_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT DEFAULT 'agent',
      status TEXT DEFAULT 'offline',
      invite_token TEXT UNIQUE,
      joined_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- TIER 3: Webhooks
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      secret TEXT,
      active INTEGER DEFAULT 1,
      last_triggered DATETIME,
      success_count INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- TIER 3: A/B Tests
    CREATE TABLE IF NOT EXISTS ab_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      variant_a TEXT NOT NULL,
      variant_b TEXT NOT NULL,
      target_tags TEXT,
      split_ratio INTEGER DEFAULT 50,
      status TEXT DEFAULT 'running',
      winner TEXT,
      sent_a INTEGER DEFAULT 0,
      sent_b INTEGER DEFAULT 0,
      reply_a INTEGER DEFAULT 0,
      reply_b INTEGER DEFAULT 0,
      auto_select_winner INTEGER DEFAULT 1,
      auto_select_after_hours INTEGER DEFAULT 24,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- TIER 3: Opt-Out / Compliance
    CREATE TABLE IF NOT EXISTS opt_outs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      phone_number TEXT NOT NULL,
      reason TEXT,
      opted_out_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, phone_number),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Analytics: Daily Message Stats
    CREATE TABLE IF NOT EXISTS analytics_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      incoming_count INTEGER DEFAULT 0,
      outgoing_count INTEGER DEFAULT 0,
      ai_responses INTEGER DEFAULT 0,
      manual_responses INTEGER DEFAULT 0,
      new_contacts INTEGER DEFAULT 0,
      avg_response_time_ms INTEGER DEFAULT 0,
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Gateway configs: Switchable WhatsApp options (Baileys vs Meta API)
    CREATE TABLE IF NOT EXISTS whatsapp_gateway_configs (
      user_id INTEGER PRIMARY KEY,
      gateway_type TEXT DEFAULT 'baileys',
      meta_access_token TEXT,
      meta_phone_number_id TEXT,
      meta_waba_id TEXT,
      meta_verify_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  console.log('SQLite Database initialized successfully with all enterprise tables.');

  // ===================== MIGRATIONS =====================
  await runMigrations();

  return db;
}

async function runMigrations() {
  // Users migrations
  const userCols = await db.all("PRAGMA table_info(users)");
  const userColNames = userCols.map(c => c.name);
  if (!userColNames.includes('role')) {
    await db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
    console.log("Migration: Added role to users.");
  }
  if (!userColNames.includes('api_key')) {
    await db.exec("ALTER TABLE users ADD COLUMN api_key TEXT");
    await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key)");
    console.log("Migration: Added api_key to users.");
  }

  // AI Configs migrations
  const aiCols = await db.all("PRAGMA table_info(ai_configs)");
  const aiColNames = aiCols.map(c => c.name);
  if (!aiColNames.includes('support_prompt')) {
    await db.exec("ALTER TABLE ai_configs ADD COLUMN support_prompt TEXT DEFAULT 'Wewe ni msaidizi wa kiufundi na malalamiko ya wateja.'");
    console.log("Migration: Added support_prompt to ai_configs.");
  }

  // Contacts migrations
  const contactCols = await db.all("PRAGMA table_info(contacts)");
  const contactColNames = contactCols.map(c => c.name);
  const contactMigrations = [
    ['agent_mode', "ALTER TABLE contacts ADD COLUMN agent_mode TEXT DEFAULT 'sales'"],
    ['ai_disabled', "ALTER TABLE contacts ADD COLUMN ai_disabled INTEGER DEFAULT 0"],
    ['assignee', "ALTER TABLE contacts ADD COLUMN assignee TEXT DEFAULT 'unassigned'"],
    ['lead_score', "ALTER TABLE contacts ADD COLUMN lead_score INTEGER DEFAULT 0"],
    ['message_count', "ALTER TABLE contacts ADD COLUMN message_count INTEGER DEFAULT 0"],
    ['last_seen', "ALTER TABLE contacts ADD COLUMN last_seen DATETIME"],
    ['location', "ALTER TABLE contacts ADD COLUMN location TEXT"],
    ['opt_out', "ALTER TABLE contacts ADD COLUMN opt_out INTEGER DEFAULT 0"],
    ['opt_out_at', "ALTER TABLE contacts ADD COLUMN opt_out_at DATETIME"],
    ['ai_context', "ALTER TABLE contacts ADD COLUMN ai_context TEXT"],
  ];
  for (const [col, sql] of contactMigrations) {
    if (!contactColNames.includes(col)) {
      await db.exec(sql);
      console.log(`Migration: Added ${col} to contacts.`);
    }
  }

  // Messages migrations
  const msgCols = await db.all("PRAGMA table_info(messages)");
  const msgColNames = msgCols.map(c => c.name);
  if (!msgColNames.includes('ai_tokens_used')) {
    await db.exec("ALTER TABLE messages ADD COLUMN ai_tokens_used INTEGER DEFAULT 0");
    console.log("Migration: Added ai_tokens_used to messages.");
  }
  if (!msgColNames.includes('response_time_ms')) {
    await db.exec("ALTER TABLE messages ADD COLUMN response_time_ms INTEGER DEFAULT 0");
    console.log("Migration: Added response_time_ms to messages.");
  }

  // Campaigns migrations
  const campCols = await db.all("PRAGMA table_info(campaigns)");
  const campColNames = campCols.map(c => c.name);
  if (!campColNames.includes('sent_count')) {
    await db.exec("ALTER TABLE campaigns ADD COLUMN sent_count INTEGER DEFAULT 0");
    console.log("Migration: Added sent_count to campaigns.");
  }
  if (!campColNames.includes('failed_count')) {
    await db.exec("ALTER TABLE campaigns ADD COLUMN failed_count INTEGER DEFAULT 0");
    console.log("Migration: Added failed_count to campaigns.");
  }

  // Products migrations
  const prodCols = await db.all("PRAGMA table_info(products)");
  const prodColNames = prodCols.map(c => c.name);
  if (!prodColNames.includes('image_url')) {
    await db.exec("ALTER TABLE products ADD COLUMN image_url TEXT");
    console.log("Migration: Added image_url to products.");
  }
  if (!prodColNames.includes('stock')) {
    await db.exec("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT -1");
    console.log("Migration: Added stock to products.");
  }

  console.log('All migrations completed successfully.');
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}
