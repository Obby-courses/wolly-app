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
      is_deleted INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migration: Add city, address and domain_key if they don't exist
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN city TEXT;`); } catch (e) {}
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN address TEXT;`); } catch (e) {}
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN domain_key TEXT;`); } catch (e) {}


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
}

export async function dropTables(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`DROP TABLE IF EXISTS transactions;`);
  await db.execAsync(`DROP TABLE IF EXISTS recurring_payments;`);
}
