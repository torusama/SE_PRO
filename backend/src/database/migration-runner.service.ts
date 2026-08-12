import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Dirent, promises as fs } from 'fs';
import { resolve } from 'path';
import { Pool, PoolClient, QueryResultRow } from 'pg';

const MIGRATION_FILE_PATTERN = /^\d{3}_[a-z0-9][a-z0-9_-]*\.sql$/i;
const MIGRATION_LOCK_NAME = 'se_pro_schema_migrations';
const OPTIONAL_EXTENSION_MIGRATIONS: Readonly<Record<string, string>> = {
  '024_ai_knowledge_embeddings.sql': 'vector',
  '025_switch_rag_to_nvidia_bge_m3.sql': 'vector',
};
const OPTIONAL_EXTENSION_ERROR_CODES = new Set(['0A000', '42501', '58P01']);

interface AppliedMigrationRow extends QueryResultRow {
  migrationName: string;
  checksum: string;
}

interface CoreSchemaRow extends QueryResultRow {
  usersTable: string | null;
}

interface ExtensionAvailabilityRow extends QueryResultRow {
  isAvailable: boolean;
}

export interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

export interface MigrationRunSummary {
  applied: string[];
  skipped: string[];
  deferred: string[];
}

export function normalizeMigrationSql(source: string): string {
  return source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

export function migrationChecksum(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

export function compatibleMigrationChecksums(sql: string): string[] {
  const alternateEofSql = sql.endsWith('\n') ? sql.slice(0, -1) : `${sql}\n`;
  return [
    ...new Set([migrationChecksum(sql), migrationChecksum(alternateEofSql)]),
  ];
}

export function migrationExecutionSql(sql: string): string {
  const lines = sql.split('\n');
  const firstStatement = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed !== '' && !trimmed.startsWith('--');
  });
  let lastStatement = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const trimmed = lines[index].trim();
    if (trimmed !== '' && !trimmed.startsWith('--')) {
      lastStatement = index;
      break;
    }
  }

  const hasOuterBegin =
    firstStatement >= 0 &&
    /^BEGIN(?:\s+TRANSACTION)?\s*;$/i.test(lines[firstStatement].trim());
  const hasOuterCommit =
    lastStatement >= 0 && /^COMMIT\s*;$/i.test(lines[lastStatement].trim());

  if (hasOuterBegin !== hasOuterCommit) {
    throw new Error('Migration has an incomplete outer transaction wrapper');
  }
  if (!hasOuterBegin) return sql;

  lines.splice(lastStatement, 1);
  lines.splice(firstStatement, 1);
  return lines.join('\n');
}

@Injectable()
export class MigrationRunnerService {
  private readonly logger = new Logger(MigrationRunnerService.name);

  constructor(@Optional() private readonly config?: ConfigService) {}

  async run(pool: Pool): Promise<MigrationRunSummary> {
    if (!this.isEnabled()) {
      this.logger.warn(
        'Automatic database migrations are disabled by DB_MIGRATIONS_ENABLED',
      );
      return { applied: [], skipped: [], deferred: [] };
    }

    const dbUrl =
      this.config?.get<string>('databaseUrl') ||
      this.config?.get<string>('DATABASE_URL') ||
      process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error(
        'DATABASE_URL is required when automatic database migrations are enabled',
      );
    }

    const migrations = await this.loadMigrations();
    const client = await pool.connect();
    let lockAcquired = false;

    try {
      await client.query('SELECT pg_advisory_lock(hashtext($1))', [
        MIGRATION_LOCK_NAME,
      ]);
      lockAcquired = true;

      await this.ensureLedger(client);
      await this.ensureCoreSchema(client);

      const appliedRows = await client.query<AppliedMigrationRow>(
        `SELECT migration_name AS "migrationName", checksum
         FROM schema_migrations`,
      );
      const appliedByName = new Map(
        appliedRows.rows.map((row) => [row.migrationName, row.checksum]),
      );
      const summary: MigrationRunSummary = {
        applied: [],
        skipped: [],
        deferred: [],
      };

      for (const migration of migrations) {
        const appliedChecksum = appliedByName.get(migration.name);
        if (appliedChecksum) {
          const compatibleChecksums = compatibleMigrationChecksums(
            migration.sql,
          );
          if (!compatibleChecksums.includes(appliedChecksum)) {
            throw new Error(
              `Migration ${migration.name} was changed after it was applied. ` +
                `Expected checksum ${appliedChecksum}, received ${migration.checksum}.`,
            );
          }
          if (appliedChecksum !== migration.checksum) {
            await client.query(
              `UPDATE schema_migrations
               SET checksum = $1
               WHERE migration_name = $2 AND checksum = $3`,
              [migration.checksum, migration.name, appliedChecksum],
            );
          }
          summary.skipped.push(migration.name);
          continue;
        }

        const optionalExtension =
          OPTIONAL_EXTENSION_MIGRATIONS[migration.name];
        if (
          optionalExtension &&
          !(await this.isExtensionAvailable(client, optionalExtension))
        ) {
          this.logger.warn(
            `Deferring optional migration ${migration.name}: PostgreSQL extension ` +
              `"${optionalExtension}" is not available; the application will use its fallback path`,
          );
          summary.deferred.push(migration.name);
          continue;
        }

        try {
          await this.applyMigration(client, migration);
          summary.applied.push(migration.name);
        } catch (error) {
          if (
            optionalExtension &&
            this.isOptionalExtensionUnavailableError(
              error,
              optionalExtension,
            )
          ) {
            this.logger.warn(
              `Deferring optional migration ${migration.name}: PostgreSQL could not enable ` +
                `extension "${optionalExtension}"; the application will use its fallback path`,
            );
            summary.deferred.push(migration.name);
            continue;
          }
          throw error;
        }
      }

      if (summary.applied.length === 0 && summary.deferred.length === 0) {
        this.logger.log('Database schema is up to date');
      } else if (summary.applied.length > 0) {
        this.logger.log(
          `Applied ${summary.applied.length} migration(s): ${summary.applied.join(', ')}`,
        );
      }

      return summary;
    } finally {
      if (lockAcquired) {
        try {
          await client.query('SELECT pg_advisory_unlock(hashtext($1))', [
            MIGRATION_LOCK_NAME,
          ]);
        } catch (error) {
          this.logger.error(
            'Failed to release the database migration lock',
            error,
          );
        }
      }
      client.release();
    }
  }

  private isEnabled(): boolean {
    const flag = this.config?.get<boolean>('migrations.enabled');
    if (flag !== undefined) return flag;
    return process.env.DB_MIGRATIONS_ENABLED !== 'false';
  }

  private migrationsDirectory(): string {
    const configured = this.config?.get<string>('migrations.directory');
    return configured
      ? resolve(configured)
      : resolve(__dirname, '../../database/migrations');
  }

  private async loadMigrations(): Promise<MigrationFile[]> {
    const directory = this.migrationsDirectory();
    let entries: Dirent<string>[];
    try {
      entries = await fs.readdir(directory, {
        encoding: 'utf8',
        withFileTypes: true,
      });
    } catch (error) {
      throw new Error(`Cannot read migrations directory ${directory}`, {
        cause: error,
      });
    }

    const invalidSqlFiles = entries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.toLowerCase().endsWith('.sql') &&
          !MIGRATION_FILE_PATTERN.test(entry.name),
      )
      .map((entry) => entry.name);
    if (invalidSqlFiles.length > 0) {
      throw new Error(
        `Invalid migration filename(s): ${invalidSqlFiles.join(', ')}. ` +
          'Expected NNN_descriptive_name.sql.',
      );
    }

    const names = entries
      .filter(
        (entry) => entry.isFile() && MIGRATION_FILE_PATTERN.test(entry.name),
      )
      .map((entry) => entry.name)
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

    if (names.length === 0) {
      throw new Error(`No migration files found in ${directory}`);
    }

    return Promise.all(
      names.map(async (name) => {
        const sql = normalizeMigrationSql(
          await fs.readFile(resolve(directory, name), 'utf8'),
        );
        return { name, sql, checksum: migrationChecksum(sql) };
      }),
    );
  }

  private async ensureLedger(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name    VARCHAR(255) PRIMARY KEY,
        checksum          CHAR(64) NOT NULL,
        applied_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        execution_time_ms INTEGER NOT NULL CHECK (execution_time_ms >= 0)
      )
    `);
  }

  private async ensureCoreSchema(client: PoolClient): Promise<void> {
    const result = await client.query<CoreSchemaRow>(
      `SELECT to_regclass('users')::text AS "usersTable"`,
    );
    if (!result.rows[0]?.usersTable) {
      throw new Error(
        'The base database schema is missing. Apply database/DBase.sql once ' +
          'before running versioned migrations.',
      );
    }
  }

  private async isExtensionAvailable(
    client: PoolClient,
    extensionName: string,
  ): Promise<boolean> {
    const result = await client.query<ExtensionAvailabilityRow>(
      `SELECT (
         EXISTS (
           SELECT 1 FROM pg_extension WHERE extname = $1
         ) OR EXISTS (
           SELECT 1 FROM pg_available_extensions WHERE name = $1
         )
       ) AS "isAvailable"`,
      [extensionName],
    );
    return result.rows[0]?.isAvailable === true;
  }

  private isOptionalExtensionUnavailableError(
    error: unknown,
    extensionName: string,
  ): boolean {
    const normalizedExtension = extensionName.toLowerCase();
    let current: unknown = error;
    const visited = new Set<unknown>();

    while (
      current &&
      typeof current === 'object' &&
      !visited.has(current)
    ) {
      visited.add(current);
      const candidate = current as {
        code?: unknown;
        message?: unknown;
        detail?: unknown;
        hint?: unknown;
        cause?: unknown;
      };
      const code = typeof candidate.code === 'string' ? candidate.code : '';
      const description = [
        candidate.message,
        candidate.detail,
        candidate.hint,
      ]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase();

      if (
        OPTIONAL_EXTENSION_ERROR_CODES.has(code) &&
        description.includes(normalizedExtension)
      ) {
        return true;
      }
      current = candidate.cause;
    }

    return false;
  }

  private async applyMigration(
    client: PoolClient,
    migration: MigrationFile,
  ): Promise<void> {
    const startedAt = Date.now();
    this.logger.log(`Applying migration ${migration.name}`);

    await client.query('BEGIN');
    try {
      await client.query(migrationExecutionSql(migration.sql));
      await client.query(
        `INSERT INTO schema_migrations (
           migration_name, checksum, execution_time_ms
         ) VALUES ($1, $2, $3)`,
        [migration.name, migration.checksum, Date.now() - startedAt],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to apply migration ${migration.name}`, {
        cause: error,
      });
    }
  }
}
