import * as SQLite from 'expo-sqlite';

export async function createTables(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      amount REAL NOT NULL,
      net_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      direction TEXT NOT NULL,
      payment_method TEXT,
      category_key TEXT NOT NULL,
      subcategory_key TEXT NOT NULL,
      domain_key TEXT,
      description TEXT,
      social_context TEXT,
      location_type TEXT,
      location_name TEXT,
      city TEXT,
      address TEXT,
      is_travel INTEGER NOT NULL DEFAULT 0,
      is_online INTEGER NOT NULL DEFAULT 0,
      split_people INTEGER,
      input_method TEXT NOT NULL,
      raw_input TEXT,
      synced_at TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      people_mentioned TEXT,
      subscription_id TEXT,
      holiday TEXT,
      tags TEXT
    );
  `);

  // Migrations on transactions
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN city TEXT;`); } catch (e) {}
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN address TEXT;`); } catch (e) {}
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN domain_key TEXT;`); } catch (e) {}
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN people_mentioned TEXT;`); } catch (e) {}
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN subscription_id TEXT;`); } catch (e) {}
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN holiday TEXT;`); } catch (e) {}
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN tags TEXT;`); } catch (e) {}

  // Migrate 'viaggi_lavoro' to 'lunga_distanza' + tag 'trasferta'
  try {
    await db.execAsync(`
      UPDATE transactions 
      SET category_key = 'lunga_distanza', 
          subcategory_key = 'lunga_distanza',
          tags = CASE WHEN tags IS NULL OR tags = '' THEN 'trasferta' ELSE tags || ',trasferta' END
      WHERE category_key = 'viaggi_lavoro';
    `);
  } catch (e) {}

  // Migrate legacy Italian taxonomy values to English
  try {
    await db.execAsync(`
      UPDATE transactions SET social_context = 'friends' WHERE social_context = 'amici';
      UPDATE transactions SET social_context = 'family' WHERE social_context = 'famiglia';
      UPDATE transactions SET social_context = 'colleagues' WHERE social_context = 'colleghi';
      UPDATE transactions SET social_context = 'couple' WHERE social_context = 'coppia';
      UPDATE transactions SET social_context = 'alone' WHERE social_context = 'solo';
      UPDATE transactions SET social_context = 'strangers' WHERE social_context = 'sconosciuti';

      UPDATE transactions SET location_type = 'physical_store' WHERE location_type = 'negozio_fisico';
      UPDATE transactions SET location_type = 'work' WHERE location_type = 'lavoro';
      UPDATE transactions SET location_type = 'restaurant' WHERE location_type = 'ristorante';
      UPDATE transactions SET location_type = 'home' WHERE location_type = 'casa';
      UPDATE transactions SET location_type = 'transport' WHERE location_type = 'trasporti';
      UPDATE transactions SET location_type = 'travel' WHERE location_type = 'viaggio';
      UPDATE transactions SET location_type = 'abroad' WHERE location_type = 'estero';
    `);
  } catch (e) {}

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS net_worth (
      id TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  // Seed the net_worth with initial data if empty
  const rs = await db.getAllAsync(`SELECT count(*) as c FROM net_worth`);
  if ((rs[0] as any).c === 0) {
    const defaultId = 'nw_initial';
    const initDate = '2026-01-01T00:00:00.000Z';
    await db.execAsync(`INSERT INTO net_worth (id, amount, updated_at) VALUES ('${defaultId}', 1000.0, '${initDate}')`);
  }

  // Legacy table — kept for data safety, no longer used by the app
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS recurring_payments (
      id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      direction TEXT NOT NULL,
      category_key TEXT NOT NULL,
      subcategory_key TEXT NOT NULL,
      description TEXT,
      frequency TEXT NOT NULL,
      start_date TEXT NOT NULL,
      next_due_date TEXT NOT NULL,
      payment_method TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      synced_at TEXT
    );
  `);

  // New subscriptions table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      direction TEXT NOT NULL DEFAULT 'out',
      category_key TEXT NOT NULL,
      frequency TEXT NOT NULL,
      recurrence_day INTEGER,
      start_date TEXT NOT NULL,
      end_date TEXT,
      auto_detected INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      synced_at TEXT
    );
  `);

  // Migrations on subscriptions (for future fields)
  try { await db.execAsync(`ALTER TABLE subscriptions ADD COLUMN end_date TEXT;`); } catch (e) {}
}

export async function dropTables(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`DROP TABLE IF EXISTS transactions;`);
  await db.execAsync(`DROP TABLE IF EXISTS recurring_payments;`);
  await db.execAsync(`DROP TABLE IF EXISTS subscriptions;`);
}
