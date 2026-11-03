#!/usr/bin/env node
import pg from 'pg';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const days = Number(process.env.EVENT_REPORT_DAYS ?? '7');
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const totals = await client.query(
    `SELECT name, count(*)::int AS events
     FROM public.product_events
     WHERE occurred_at >= now() - ($1::int || ' days')::interval
     GROUP BY name
     ORDER BY events DESC, name`,
    [Number.isFinite(days) ? days : 7],
  );
  const daily = await client.query(
    `SELECT to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
            count(*)::int AS events
     FROM public.product_events
     WHERE occurred_at >= now() - ($1::int || ' days')::interval
     GROUP BY day
     ORDER BY day`,
    [Number.isFinite(days) ? days : 7],
  );

  console.log(`events report: last ${days} days`);
  for (const row of totals.rows) {
    console.log(`${row.name}: ${row.events}`);
  }
  console.log('---');
  for (const row of daily.rows) {
    console.log(`${row.day}: ${row.events}`);
  }
} finally {
  await client.end();
}
