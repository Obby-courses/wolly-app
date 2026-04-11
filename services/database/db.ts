import * as SQLite from 'expo-sqlite';
import { createTables } from './schema';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDBConnection(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  
  dbInstance = await SQLite.openDatabaseAsync('filo.db');
  
  // Optional: Add PRAGMAs for performance
  await dbInstance.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  
  return dbInstance;
}

export async function initDatabase() {
  const db = await getDBConnection();
  await createTables(db);
}
