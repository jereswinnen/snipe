const url = process.env.APP_URL;
const secret = process.env.CRON_SECRET;
if (!url || !secret) {
  console.error("APP_URL and CRON_SECRET must be set");
  process.exit(1);
}

const res = await fetch(`${url}/api/cron/check`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});
const body = await res.text();
console.log(`HTTP ${res.status} ${body}`);
process.exit(res.ok ? 0 : 1);
