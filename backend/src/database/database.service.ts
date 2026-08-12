import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow, types } from 'pg';
import { MigrationRunnerService } from './migration-runner.service';

// FIX BUG: mặc định pg parse cột kiểu DATE (OID 1082) thành JS Date object
// theo GIỜ LOCAL của server (`new Date(year, month-1, day)`), không phải UTC.
// Khi Express serialize response bằng JSON.stringify -> Date.toISOString(),
// giờ local nửa đêm sẽ bị quy đổi sang UTC và LÙI 1 NGÀY nếu server chạy ở
// timezone lệch dương so với UTC (VD: Asia/Ho_Chi_Minh, UTC+7).
// => Mỗi lần load lại rồi lưu, ngày sinh (và các cột DATE khác) bị trừ dần 1
// ngày. Khắc phục bằng cách giữ nguyên giá trị dạng chuỗi "YYYY-MM-DD" trả về
// từ Postgres, không cho pg parse thành Date object.
types.setTypeParser(1082, (value: string) => value);

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  private migrationPromise?: Promise<void>;

  constructor(
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly migrationRunner?: MigrationRunnerService,
  ) {
    const connectionString =
      config?.get<string>('databaseUrl') ||
      config?.get<string>('DATABASE_URL') ||
      process.env.DATABASE_URL;
    this.pool = new Pool({
      connectionString,
      ssl:
        (config?.get<string>('nodeEnv') || process.env.NODE_ENV) === 'production'
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
    if (!this.migrationRunner) return Promise.resolve();
    this.migrationPromise ??= this.migrationRunner
      .run(this.pool)
      .then(() => undefined);
    return this.migrationPromise;
  }
}
