import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const out = '/private/tmp/claude-501/shots';
for (const w of [360, 390, 412]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 780 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:5173/profile/demo');
  await p.getByRole('button', { name: /Kabir/ }).first().click();
  await p.goto('http://127.0.0.1:5173/discover');
  await p.waitForLoadState('networkidle');
  const nav = await p.locator('nav.bottom-nav a').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [e.innerText.trim(), Math.round(r.width), Math.round(r.height), r.bottom <= innerHeight]; }));
  console.log(w, 'tabs', JSON.stringify(nav));
  // last card fully above tabs
  const last = await p.evaluate(() => { const m = document.querySelector('main.scroll'); m.scrollTop = m.scrollHeight; const c = [...document.querySelectorAll('.story-card')].pop().getBoundingClientRect(); const n = document.querySelector('nav.bottom-nav').getBoundingClientRect(); return { cardBottom: Math.round(c.bottom), navTop: Math.round(n.top) }; });
  console.log(w, 'last card', JSON.stringify(last), last.cardBottom <= last.navTop ? 'OK' : 'OVERLAP');
  await p.screenshot({ path: `${out}/W${w}-discover-bottom.png` });
  // keyboard emulation: shrink viewport and focus search
  await p.evaluate(() => (document.querySelector('main.scroll').scrollTop = 0));
  await p.setViewportSize({ width: w, height: 420 });
  await p.getByLabel('Search stories').click();
  await p.getByLabel('Search stories').fill('a');
  const kb = await p.evaluate(() => { const i = document.querySelector('#disc-search').getBoundingClientRect(); const m = document.querySelector('main.scroll').getBoundingClientRect(); return { inputVisible: i.top >= 0 && i.bottom <= innerHeight, resultsHeight: Math.round(m.height), navHidden: getComputedStyle(document.querySelector('nav.bottom-nav')).display === 'none' }; });
  console.log(w, 'keyboard', JSON.stringify(kb));
  await p.screenshot({ path: `${out}/W${w}-keyboard.png` });
  await ctx.close();
}
await b.close();
