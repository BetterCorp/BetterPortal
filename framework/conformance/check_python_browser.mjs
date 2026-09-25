import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [origin] = process.argv.slice(2);
const token = readFileSync(0, 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ extraHTTPHeaders: { Authorization: 'Bearer ' + token } });
  const fragment = page.waitForResponse(response => response.url().endsWith('/hello') && !response.url().startsWith(origin));
  await page.goto(origin + '/hello');
  await page.locator('#bp-main').getByText('Hello', { exact: true }).waitFor({ timeout: 20_000 });
  const response = await fragment;
  if (response.status() !== 200 || !(response.headers()['content-type'] ?? '').includes('text/html')) throw new Error('Bootstrap did not load a Python HTML fragment');
  console.log('Real Bootstrap shell loaded and rendered the authenticated Python service');
} finally { await browser.close(); }
