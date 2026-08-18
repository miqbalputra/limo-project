import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const splitDatabaseValues = [
  process.env.DB_HOST,
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
];
const hasSplitDatabaseSettings = splitDatabaseValues.some((value) => value !== undefined && value !== "");

if (hasSplitDatabaseSettings) {
  if (splitDatabaseValues.some((value) => !value)) {
    throw new Error("When using split database settings, set DB_HOST, DB_NAME, DB_USER, and DB_PASS.");
  }

  const host = process.env.DB_HOST!.trim();
  const database = process.env.DB_NAME!.trim();
  const port = (process.env.DB_PORT || "3306").trim();

  if (!/^[a-zA-Z0-9._-]+$/.test(host)) {
    throw new Error("DB_HOST must be a hostname without protocol or port.");
  }
  if (!database) {
    throw new Error("DB_NAME cannot be blank.");
  }
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("DB_PORT must be an integer between 1 and 65535.");
  }

  process.env.DATABASE_URL = `mysql://${encodeURIComponent(process.env.DB_USER!)}:${encodeURIComponent(process.env.DB_PASS!)}@${host}:${port}/${encodeURIComponent(database)}`;
}

if (process.env.DATABASE_URL?.startsWith("mariadb://")) {
  process.env.DATABASE_URL = `mysql://${process.env.DATABASE_URL.slice("mariadb://".length)}`;
}
