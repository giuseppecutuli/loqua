#!/usr/bin/env node
/**
 * Browser speaking E2E for the Expo web build.
 *
 * Prerequisites:
 *   pnpm supabase:start
 *   pnpm supabase:local:reset
 *   pnpm api:dev
 *   pnpm web
 *   ASSEMBLYAI_API_KEY and DEEPSEEK_API_KEY in .env
 *
 * This script drives onboarding -> placement -> recording -> evaluation in
 * Chromium with a fake microphone. It needs Windows SAPI to synthesize the
 * fake speech input. It is intentionally not part of `verify --level=core`.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { chromium } from '@playwright/test';

const appUrl = process.env.SMOKE_WEB_URL ?? 'http://127.0.0.1:8081';
const audioPath = path.join(os.tmpdir(), 'loqua-fake-mic.wav');
const shotPath = path.join(os.tmpdir(), 'loqua-speaking-web.png');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeAudio() {
  if (process.platform !== 'win32') {
    throw new Error('speaking-web smoke currently needs Windows SAPI for fake audio');
  }
  const text =
    'Recently I decided to change my daily routine. I used to study late at night, but I was always tired. ' +
    'I decided to study for twenty minutes every morning before work. At first it was difficult, but now I ' +
    'feel more energetic and I remember more words. I am happy with this decision because I can practise every day.';
  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    `$s.SetOutputToWaveFile('${audioPath.replaceAll("'", "''")}')`,
    `$s.Speak("${text}")`,
    '$s.Dispose()',
  ].join('; ');
  const result = spawnSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'could not synthesize fake audio');
}

async function waitFor(check, timeoutMs = 240000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('timed out waiting for the next placement state');
}

makeAudio();
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${audioPath}`,
  ],
});
const context = await browser.newContext({ permissions: ['microphone'] });
const page = await context.newPage();

try {
  await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByText('Lavoro', { exact: true }).click();
  await page.getByRole('button', { name: 'Continua' }).click();
  await page.getByRole('button', { name: 'Continua' }).click();
  await page.getByRole('button', { name: 'Continua' }).click();
  await page.getByPlaceholder('Aggiungi un interesse').fill('technology');
  await page.getByRole('button', { name: 'Aggiungi' }).click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: 'Inizia' }).click();
  await page.waitForURL('**/placement', { timeout: 60000 });

  let recordings = 0;
  for (let step = 0; step < 600; step += 1) {
    const text = await page.locator('body').innerText();
    if (text.includes('Il tuo livello')) break;

    if (text.includes('Una risposta parlata')) {
      const aiConsent = page.getByRole('button', { name: 'Attiva consenso AI' });
      if (await aiConsent.count()) {
        await aiConsent.click();
        continue;
      }
      const voiceConsent = page.getByRole('button', { name: 'Attiva consenso voce' });
      if (await voiceConsent.count()) {
        await voiceConsent.click();
        continue;
      }
      const record = page.getByRole('button', { name: 'Registra' });
      if ((await record.count()) && (await record.isEnabled())) {
        recordings += 1;
        await record.click();
        await page.waitForTimeout(22000);
        await page.getByRole('button', { name: 'Ferma' }).click();
        continue;
      }
      const submit = page.getByRole('button', { name: 'Valuta la risposta' });
      if ((await submit.count()) && (await submit.isEnabled())) {
        await submit.click();
        await page.waitForTimeout(2000);
        continue;
      }
      await page.waitForTimeout(1000);
      continue;
    }

    if (text.includes('Un testo breve') || text.includes('Salta la scrittura')) {
      const skip = page.getByRole('button', { name: 'Salta la scrittura' });
      if ((await skip.count()) && (await skip.isEnabled())) {
        await skip.click();
        continue;
      }
      await page.waitForTimeout(500);
      continue;
    }

    const next = page.getByRole('button', { name: 'Continua' });
    if ((await next.count()) && (await next.isEnabled())) {
      await next.click();
      continue;
    }
    const option = page.locator('[data-testid^="placement-option-"]').first();
    if ((await option.count()) && (await option.isEnabled())) {
      await option.click();
      continue;
    }
    await page.waitForTimeout(500);
  }

  await waitFor(async () => (await page.locator('body').innerText()).includes('Il tuo livello'));
  const finalText = await page.locator('body').innerText();
  assert(finalText.includes('Parlato:'), 'speaking result was not shown');
  assert(recordings >= 2, 'expected two recording rounds');
  await mkdir(path.dirname(shotPath), { recursive: true });
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log('PASS Expo web microphone -> AssemblyAI -> DeepSeek speaking placement');
  console.log({ recordings, screenshot: shotPath });
} finally {
  await browser.close();
  await rm(audioPath, { force: true }).catch(() => undefined);
}
