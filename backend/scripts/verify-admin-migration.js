const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config();

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
  const source = new URL(process.env.DATABASE_URL);
  const databaseName = `se_cnpm_migration_test_${Date.now()}`;
  const adminUrl = new URL(source);
  adminUrl.pathname = "/postgres";
  const testUrl = new URL(source);
  testUrl.pathname = `/${databaseName}`;
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    const test = new Client({ connectionString: testUrl.toString() });
    await test.connect();
    try {
      await test.query(
        fs.readFileSync(path.join(__dirname, "../database/DBase.sql"), "utf8"),
      );
      for (const filename of [
        "001_consolidated_schema.sql",
        "002_add_service_order_history.sql",
        "012_reminder_notify_emails.sql",
        "013_admin_audit_entity_key.sql",
      ]) {
        await test.query(
          fs.readFileSync(
            path.join(__dirname, "../database/migrations", filename),
            "utf8",
          ),
        );
      }
      const result = await test.query(`
        SELECT
          (SELECT COUNT(*)::int FROM information_schema.tables
           WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,
          (SELECT COUNT(*)::int FROM information_schema.views
           WHERE table_schema='public') AS views,
          (SELECT COUNT(*)::int FROM information_schema.routines
           WHERE routine_schema='public') AS functions,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='audit_logs'
              AND column_name='entity_key'
          ) AS entity_key
      `);
      const counts = result.rows[0];
      if (
        counts.tables < 36 ||
        counts.views < 8 ||
        counts.functions < 10 ||
        !counts.entity_key
      ) {
        throw new Error(`Unexpected disposable schema: ${JSON.stringify(counts)}`);
      }
      console.log(JSON.stringify(counts));
    } finally {
      await test.end();
    }
  } finally {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname=$1 AND pid<>pg_backend_pid()`,
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
