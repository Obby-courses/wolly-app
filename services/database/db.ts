import * as SQLite from 'expo-sqlite';
import { createTables } from './schema';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDBConnection(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  
  const db = await SQLite.openDatabaseAsync('wolly.db');
  dbInstance = db;
  
  // Optional: Add PRAGMAs for performance
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  
  // Ensure tables and migrations are run
  await createTables(db);
  
  return db;
}

export async function initDatabase() {
  await getDBConnection();
}
