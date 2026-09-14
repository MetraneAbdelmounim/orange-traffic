const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto('http://127.0.0.1:8898/regression-report.pdf', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: __dirname + '/regression-page1.png' });
  await page.keyboard.press('End');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: __dirname + '/regression-page2.png' });
  console.log('done');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
