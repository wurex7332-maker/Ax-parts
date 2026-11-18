import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SCHEMA_SQL } from './schema';
import { seedDatabase } from './seed';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: Database.Database;
  readonly filePath: string;

  constructor() {
    this.filePath =
      process.env.DATABASE_PATH === ':memory:'
        ? ':memory:'
        : process.env.DATABASE_PATH || join(process.cwd(), 'data', 'ax-parts.sqlite');
    if (this.filePath !== ':memory:') mkdirSync(dirname(this.filePath), { recursive: true });

    this.db = new Database(this.filePath);
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA_SQL);
    if (process.env.SKIP_SEED !== '1') seedDatabase(this.db);
  }

  onModuleDestroy() {
    this.db.close();
  }
}

@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
