import 'reflect-metadata';
import { SCHEMA_SQL } from './schema';
import { seedDatabase } from './seed';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const filePath = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'ax-parts.sqlite');
if (filePath !== ':memory:') mkdirSync(dirname(filePath), { recursive: true });

const db = new Database(filePath);
db.pragma('foreign_keys = ON');
db.exec(SCHEMA_SQL);
const imported = seedDatabase(db);
const materials = (db.prepare('SELECT COUNT(*) AS n FROM materials').get() as { n: number }).n;
const movements = (db.prepare('SELECT COUNT(*) AS n FROM stock_movements').get() as { n: number }).n;
db.close();

// eslint-disable-next-line no-console
console.log(
  `seed ${imported ? 'imported' : 'skipped (already seeded)'} at ${filePath}: materials=${materials}, movements=${movements}`,
);
