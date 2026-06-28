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

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      plan TEXT DEFAULT 'free',
      active_until DATETIME,
      role TEXT DEFAULT 'user',
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
      system_prompt TEXT DEFAULT 'Wewe ni msaidizi mkuu wa huduma kwa wateja (AI Agent). Jibu wateja kwa adabu na urafiki ukitumia Kiswahili kizuri cha biashara cha Tanzania au Kiingereza kulingana na lugha ya mteja.
Fuata mwongozo huu:
1. Salamu ya Kwanza: Karibisha wateja kwa furaha. Kamwe usitumie "Shikamoo". Salamu ziwe kama "Habari! Karibu sana" na utaje chaguzi kama: 1. Kuuliza bei, 2. Kutoa order, 3. Mahali tulipo, 4. Kupanga miadi, 5. Njia za malipo, 6. Kuongea na mwanadamu.
2. Kutoa Order: Uliza kama wanataka Delivery au Pick-up. Chukua Jina, Eneo, na Namba ya simu. Kisha thibitisha order.
3. Njia za Malipo: Taja M-Pesa, Tigopesa, na Bank.
4. Msaada wa Binadamu: Kama swali ni gumu au mteja anataka mtu wa kweli, sema "Nitakuunganisha na mfanyakazi wetu sasa hivi."
Jibu kwa ufupi, ukitumia emoji zenye staha.',
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
      direction TEXT NOT NULL, -- 'incoming' or 'outgoing'
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
      status TEXT DEFAULT 'pending', -- 'pending', 'sending', 'completed', 'failed'
      scheduled_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      phone_number TEXT NOT NULL,
      amount REAL NOT NULL,
      provider TEXT NOT NULL, -- 'mpesa' or 'tigopesa'
      reference TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failed'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'available', -- 'available', 'out_of_stock'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT DEFAULT 'fixed', -- 'fixed', 'percentage'
      value REAL NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  console.log('SQLite Database initialized successfully.');

  // Migration: Add role column to users if it doesn't exist
  const columns = await db.all("PRAGMA table_info(users)");
  const hasRole = columns.some(c => c.name === 'role');
  if (!hasRole) {
    await db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
    console.log("Migration: Added role column to users table.");
  }

  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}
