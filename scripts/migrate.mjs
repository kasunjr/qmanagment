
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const { Client } = pg;

const projectRoot = path.dirname(
  path.dirname(fileURLToPath(import.meta.url))
);

const migrationsDirectory = path.join(projectRoot, "migrations");

dotenv.config({
  path: [
    path.join(projectRoot, ".env.local"),
    path.join(projectRoot, ".env"),
  ],
});

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set before running migrations.");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

console.log("Starting database migration...");

try {
  console.log("Connecting to database...");
  await client.connect();

  console.log("Database connected successfully!");

  const result = await client.query("SELECT NOW()");
  console.log("Database test successful:", result.rows[0]);

  await client.query("BEGIN");

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const name of migrationFiles) {
    const { rowCount } = await client.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [name]
    );

    if (rowCount) {
      console.log(`Skipping already applied migration: ${name}`);
      continue;
    }

    const sql = await readFile(
      path.join(migrationsDirectory, name),
      "utf8"
    );

    console.log(`Applying ${name}...`);

    await client.query("BEGIN");

    try {
      await client.query(sql);

      await client.query(
        "INSERT INTO schema_migrations(name) VALUES ($1)",
        [name]
      );

      await client.query("COMMIT");

      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }
  }

  console.log("Database migration completed successfully!");
} catch (error) {
  console.error("Database migration failed:", {
    message: error.message,
    code: error.code,
    detail: error.detail,
  });

  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}