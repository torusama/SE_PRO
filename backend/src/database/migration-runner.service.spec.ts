import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Pool, PoolClient } from 'pg';
import {
  compatibleMigrationChecksums,
  migrationChecksum,
  migrationExecutionSql,
  MigrationRunnerService,
  normalizeMigrationSql,
} from './migration-runner.service';

interface TestDatabase {
  client: Pick<PoolClient, 'query' | 'release'>;
  pool: Pick<Pool, 'connect'>;
  queries: jest.Mock;
}

function config(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function database(
  applied: Array<{ migrationName: string; checksum: string }> = [],
  usersTable: string | null = 'users',
  extensionAvailable = true,
): TestDatabase {
  const queries = jest.fn((text: string, params?: unknown[]) => {
    if (text.includes("to_regclass('users')")) {
      return Promise.resolve({ rows: [{ usersTable }] });
    }
    if (
      text.includes('pg_available_extensions') &&
      params?.[0] === 'vector'
    ) {
      return Promise.resolve({
        rows: [{ isAvailable: extensionAvailable }],
      });
    }
    if (text.includes('SELECT migration_name')) {
      return Promise.resolve({ rows: applied });
    }
    return Promise.resolve({ rows: [] });
  });
  const client = {
    query: queries,
    release: jest.fn(),
  } as unknown as Pick<PoolClient, 'query' | 'release'>;
  const pool = {
    connect: jest.fn(() => Promise.resolve(client)),
  } as unknown as Pick<Pool, 'connect'>;
  return { client, pool, queries };
}

describe('MigrationRunnerService', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'se-pro-migrations-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('normalizes platform line endings before calculating checksums', () => {
    const windowsSql = '\uFEFFSELECT 1;\r\nSELECT 2;\r\n';
    const unixSql = 'SELECT 1;\nSELECT 2;\n';

    expect(normalizeMigrationSql(windowsSql)).toBe(unixSql);
    expect(migrationChecksum(normalizeMigrationSql(windowsSql))).toBe(
      migrationChecksum(unixSql),
    );
  });

  it('accepts a legacy checksum that differs only by the final newline', () => {
    const withoutFinalNewline = 'SELECT 1;';
    const withFinalNewline = `${withoutFinalNewline}\n`;

    expect(compatibleMigrationChecksums(withFinalNewline)).toContain(
      migrationChecksum(withoutFinalNewline),
    );
  });

  it('removes only a legacy outer transaction wrapper before execution', () => {
    const sql = [
      '-- migration header',
      'BEGIN;',
      'CREATE FUNCTION example() RETURNS void AS $$',
      'BEGIN',
      '  RETURN;',
      'END;',
      '$$ LANGUAGE plpgsql;',
      'COMMIT;',
      '',
    ].join('\n');

    const executionSql = migrationExecutionSql(sql);

    expect(executionSql).not.toContain('\nBEGIN;\nCREATE FUNCTION');
    expect(executionSql).not.toContain('$$ LANGUAGE plpgsql;\nCOMMIT;');
    expect(executionSql).toContain('CREATE FUNCTION example()');
    expect(executionSql).toContain('\nBEGIN\n  RETURN;\nEND;\n');
  });

  it('applies pending migrations in filename order and records each ledger row', async () => {
    await writeFile(join(directory, '002_second.sql'), 'SELECT 2;\r\n');
    await writeFile(join(directory, '001_first.sql'), 'SELECT 1;\r\n');
    const db = database();
    const runner = new MigrationRunnerService(
      config({
        databaseUrl: 'postgresql://test',
        'migrations.enabled': true,
        'migrations.directory': directory,
      }),
    );

    const result = await runner.run(db.pool as Pool);
    const executedSql = db.queries.mock.calls.map(([sql]) => sql as string);

    expect(result).toEqual({
      applied: ['001_first.sql', '002_second.sql'],
      skipped: [],
      deferred: [],
    });
    expect(executedSql.indexOf('SELECT 1;\n')).toBeLessThan(
      executedSql.indexOf('SELECT 2;\n'),
    );
    expect(
      executedSql.filter((sql) =>
        sql.includes('INSERT INTO schema_migrations'),
      ),
    ).toHaveLength(2);
    expect(executedSql.filter((sql) => sql === 'BEGIN')).toHaveLength(2);
    expect(executedSql.filter((sql) => sql === 'COMMIT')).toHaveLength(2);
    expect(db.client.release).toHaveBeenCalledTimes(1);
  });

  it('rejects a changed migration and releases the advisory lock', async () => {
    const sql = 'SELECT 1;\n';
    await writeFile(join(directory, '001_first.sql'), sql);
    const db = database([
      { migrationName: '001_first.sql', checksum: 'different-checksum' },
    ]);
    const runner = new MigrationRunnerService(
      config({
        databaseUrl: 'postgresql://test',
        'migrations.enabled': true,
        'migrations.directory': directory,
      }),
    );

    await expect(runner.run(db.pool as Pool)).rejects.toThrow(
      'Migration 001_first.sql was changed after it was applied',
    );
    expect(db.queries).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock(hashtext($1))',
      ['se_pro_schema_migrations'],
    );
    expect(db.queries).not.toHaveBeenCalledWith(sql);
    expect(db.client.release).toHaveBeenCalledTimes(1);
  });

  it('does not open a connection when automatic migrations are disabled', async () => {
    const db = database();
    const runner = new MigrationRunnerService(
      config({
        databaseUrl: 'postgresql://test',
        'migrations.enabled': false,
        'migrations.directory': directory,
      }),
    );

    await expect(runner.run(db.pool as Pool)).resolves.toEqual({
      applied: [],
      skipped: [],
      deferred: [],
    });
    expect(db.pool.connect).not.toHaveBeenCalled();
  });

  it('defers pgvector migrations and continues independent migrations when the extension is unavailable', async () => {
    const vectorSql = 'SELECT pgvector_migration;\n';
    const independentSql = 'SELECT independent_migration;\n';
    await writeFile(
      join(directory, '024_ai_knowledge_embeddings.sql'),
      vectorSql,
    );
    await writeFile(
      join(directory, '026_independent_migration.sql'),
      independentSql,
    );
    const db = database([], 'users', false);
    const runner = new MigrationRunnerService(
      config({
        databaseUrl: 'postgresql://test',
        'migrations.enabled': true,
        'migrations.directory': directory,
      }),
    );

    await expect(runner.run(db.pool as Pool)).resolves.toEqual({
      applied: ['026_independent_migration.sql'],
      skipped: [],
      deferred: ['024_ai_knowledge_embeddings.sql'],
    });
    expect(db.queries).not.toHaveBeenCalledWith(vectorSql);
    expect(db.queries).toHaveBeenCalledWith(independentSql);
  });

  it('applies a deferred pgvector migration once the extension becomes available', async () => {
    const vectorSql = 'SELECT pgvector_migration;\n';
    await writeFile(
      join(directory, '024_ai_knowledge_embeddings.sql'),
      vectorSql,
    );
    const db = database([], 'users', true);
    const runner = new MigrationRunnerService(
      config({
        databaseUrl: 'postgresql://test',
        'migrations.enabled': true,
        'migrations.directory': directory,
      }),
    );

    await expect(runner.run(db.pool as Pool)).resolves.toEqual({
      applied: ['024_ai_knowledge_embeddings.sql'],
      skipped: [],
      deferred: [],
    });
    expect(db.queries).toHaveBeenCalledWith(vectorSql);
  });

  it('defers only a recognized pgvector provisioning error from the migration itself', async () => {
    const vectorSql = 'SELECT pgvector_migration;\n';
    const independentSql = 'SELECT independent_migration;\n';
    await writeFile(
      join(directory, '024_ai_knowledge_embeddings.sql'),
      vectorSql,
    );
    await writeFile(
      join(directory, '026_independent_migration.sql'),
      independentSql,
    );
    const db = database([], 'users', true);
    const defaultQuery = db.queries.getMockImplementation();
    const pgvectorError = Object.assign(
      new Error('extension "vector" is not available'),
      { code: '0A000' },
    );
    db.queries.mockImplementation((text: string, params?: unknown[]) => {
      if (text === vectorSql) return Promise.reject(pgvectorError);
      return defaultQuery?.(text, params);
    });
    const runner = new MigrationRunnerService(
      config({
        databaseUrl: 'postgresql://test',
        'migrations.enabled': true,
        'migrations.directory': directory,
      }),
    );

    await expect(runner.run(db.pool as Pool)).resolves.toEqual({
      applied: ['026_independent_migration.sql'],
      skipped: [],
      deferred: ['024_ai_knowledge_embeddings.sql'],
    });
    expect(db.queries).toHaveBeenCalledWith('ROLLBACK');
    expect(db.queries).toHaveBeenCalledWith(independentSql);
  });

  it('does not hide unrelated errors in an optional migration', async () => {
    const vectorSql = 'SELECT broken_migration;\n';
    await writeFile(
      join(directory, '024_ai_knowledge_embeddings.sql'),
      vectorSql,
    );
    const db = database([], 'users', true);
    const defaultQuery = db.queries.getMockImplementation();
    db.queries.mockImplementation((text: string, params?: unknown[]) => {
      if (text === vectorSql) {
        return Promise.reject(
          Object.assign(new Error('syntax error near broken'), {
            code: '42601',
          }),
        );
      }
      return defaultQuery?.(text, params);
    });
    const runner = new MigrationRunnerService(
      config({
        databaseUrl: 'postgresql://test',
        'migrations.enabled': true,
        'migrations.directory': directory,
      }),
    );

    await expect(runner.run(db.pool as Pool)).rejects.toThrow(
      'Failed to apply migration 024_ai_knowledge_embeddings.sql',
    );
  });
});
