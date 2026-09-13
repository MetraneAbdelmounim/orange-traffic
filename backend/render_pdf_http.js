const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto('http://127.0.0.1:8899/rapport-test.pdf');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'pdf-page1.png' });
  console.log('done');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
