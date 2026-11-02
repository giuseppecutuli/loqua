#!/usr/bin/env node
import pg from 'pg';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const strict = process.argv.includes('--strict');
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const byLevel = await client.query(
    `SELECT cefr_level,
            count(*)::int AS items,
            count(*) FILTER (WHERE tags_json ? 'assessment')::int AS assessment
     FROM items
     WHERE review_status = 'approved'
     GROUP BY cefr_level
     ORDER BY cefr_level`,
  );
  const bySkill = await client.query(
    `SELECT s.domain, count(*)::int AS items,
            count(*) FILTER (WHERE i.tags_json ? 'assessment')::int AS assessment
     FROM items i
     JOIN skills s ON s.id = i.skill_id
     WHERE i.review_status = 'approved'
     GROUP BY s.domain
     ORDER BY s.domain`,
  );
  const byType = await client.query(
    `SELECT type, count(*)::int AS n
     FROM items WHERE review_status = 'approved'
     GROUP BY type ORDER BY n DESC`,
  );
  const total = await client.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE tags_json ? 'assessment')::int AS assessment
     FROM items WHERE review_status = 'approved'`,
  );
  const underDepth = await client.query(
    `SELECT s.domain, c.id, count(i.id)::int AS n
     FROM concepts c
     JOIN skills s ON s.id = c.skill_id
     LEFT JOIN item_concepts ic ON ic.concept_id = c.id
     LEFT JOIN items i ON i.id = ic.item_id AND i.review_status = 'approved'
       AND NOT (i.tags_json ? 'assessment')
     WHERE s.domain IN ('grammar','vocabulary','reading','pragmatics')
     GROUP BY s.domain, c.id
     HAVING count(i.id) < 5
     ORDER BY s.domain, c.id`,
  );
  const missing = await client.query(
    `SELECT s.domain, c.cefr_level, count(*)::int AS concepts
     FROM concepts c
     JOIN skills s ON s.id = c.skill_id
     LEFT JOIN item_concepts ic ON ic.concept_id = c.id
     WHERE ic.concept_id IS NULL
     GROUP BY s.domain, c.cefr_level
     ORDER BY c.cefr_level, s.domain`,
  );

  console.log('CONTENT COVERAGE');
  console.log('total', total.rows[0]);
  console.log('by level', byLevel.rows);
  console.log('by skill', bySkill.rows);
  console.log('by type', byType.rows);
  console.log('concepts without items', missing.rows);
  console.log('text concepts under 5 practice items', underDepth.rows);

  const failures = [];
  const row = total.rows[0];
  if (!row || row.total < 347) failures.push('total approved items < 347');
  if (!row || row.assessment < 200) failures.push('assessment items < 200');
  const byLevelMap = new Map(byLevel.rows.map((entry) => [entry.cefr_level, entry]));
  for (const level of ['A1', 'A2']) {
    if ((byLevelMap.get(level)?.assessment ?? 0) < 25) failures.push(`${level} assessment < 25`);
  }
  for (const level of ['B1', 'B2', 'C1']) {
    if ((byLevelMap.get(level)?.assessment ?? 0) < 50) failures.push(`${level} assessment < 50`);
  }
  for (const domain of ['grammar', 'vocabulary', 'reading', 'pragmatics']) {
    const skill = bySkill.rows.find((entry) => entry.domain === domain);
    if (!skill || skill.items < 40) failures.push(`${domain} items < 40`);
  }
  if (missing.rows.some((entry) => !['listening', 'speaking', 'writing'].includes(entry.domain))) {
    failures.push('a text skill concept still has no item');
  }
  if (underDepth.rows.length > 0) {
    failures.push('a text concept has fewer than 5 practice items');
  }

  if (failures.length > 0) {
    console.log('gaps', failures);
    if (strict) process.exitCode = 1;
  } else {
    console.log('coverage gates: pass');
  }
} finally {
  await client.end();
}
