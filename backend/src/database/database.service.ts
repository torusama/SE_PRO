import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { MigrationRunnerService } from './migration-runner.service';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  private migrationPromise?: Promise<void>;

  constructor(
    config: ConfigService,
    private readonly migrationRunner: MigrationRunnerService,
  ) {
    const connectionString = config.get<string>('databaseUrl');
    this.pool = new Pool({
      connectionString,
      ssl:
        config.get<string>('nodeEnv') === 'production'
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.waitUntilReady();
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    await this.waitUntilReady();
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    await this.waitUntilReady();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  private waitUntilReady(): Promise<void> {
    this.migrationPromise ??= this.migrationRunner
      .run(this.pool)
      .then(() => undefined);
    return this.migrationPromise;
  }
}
