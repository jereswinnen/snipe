import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  APP_PASSWORD: required("APP_PASSWORD"),
  APP_SECRET: required("APP_SECRET"),
  CRON_SECRET: required("CRON_SECRET"),
  BRRR_WEBHOOK_SECRET: required("BRRR_WEBHOOK_SECRET"),
  APP_URL: optional("APP_URL", "http://localhost:3000"),
  ALLYOURGAMES_SHIPPING: Number(optional("ALLYOURGAMES_SHIPPING", "5.95")),
} as const;
