import { chromium } from 'playwright';

const url = process.argv[2] || 'https://cero-club.web.app/app/?v=2026052726';
const errors = [];
const logs = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text());
  logs.push(msg.type() + ': ' + msg.text());
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => errors.push('GOTO: ' + e.message));
await page.waitForTimeout(3000);

const rootChildren = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? -1);
const fallbackVisible = await page.evaluate(() => document.getElementById('cero-boot-fallback')?.classList.contains('show'));
const title = await page.title();

console.log(JSON.stringify({ url, title, rootChildren, fallbackVisible, errors, logs: logs.slice(-20) }, null, 2));
await browser.close();
