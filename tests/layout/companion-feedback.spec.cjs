const { test, expect } = require('@playwright/test');
const { en, uk } = require('../../packages/i18n/dist/index.js');
const { companionHarness } = require('./helpers/companion-harness.cjs');
let script;
test.beforeAll(async () => { script = await companionHarness(); });

for (const language of ['en', 'uk']) for (const [width,height] of [[320,568],[932,430]]) {
  test(`QR feedback ${language} ${width}x${height} replaces old success and stays visible`, async ({page}) => {
    const t = language === 'en' ? en : uk;
    await page.setViewportSize({width,height});
    await page.route('**/feedback-test', route => route.fulfill({contentType:'text/html',body:`<style>html,body,#root{height:100%;margin:0}#root{display:flex}</style><div id="root"></div>`}));
    await page.goto('/feedback-test');
    await page.evaluate(language => { window.testLanguage = language; }, language);
    await page.addScriptTag({content:script});
    const scan = page.getByRole('button',{name:t.scanTVQR,exact:true});
    await scan.click();
    await page.evaluate(() => window.testScan('invalid'));
    await expect(page.getByText(t.phoneTVConnected,{exact:true})).toHaveCount(0);
    await expect(page.getByText(t.qrInvalid,{exact:true})).toBeInViewport({ratio:1});
    await page.getByRole('button',{name:t.pairingHelp,exact:true}).click();
    await page.getByRole('button',{name:t.hostPhone,exact:true}).click();
    await expect(page.getByText(t.qrInvalid,{exact:true})).toHaveCount(0);
    await expect(page.getByText(t.qrPreparing,{exact:true})).toBeInViewport({ratio:1});
    await page.evaluate(() => window.finishConnection(false));
    await scan.click();
    await page.getByTestId('collection-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
    await page.evaluate(() => { window.scanValid(); window.scanValid(); });
    await expect(page.getByText(t.qrPreparing,{exact:true})).toBeInViewport({ratio:1});
    expect(await page.evaluate(() => window.connectCalls)).toBe(2);
    await expect(page.getByText(t.qrWaiting,{exact:true})).toHaveCount(0);
    await page.evaluate(() => window.finishConnection(false));
    await expect(page.getByText(t.pairingReceiverFailed,{exact:true})).toBeInViewport({ratio:1});
    await expect(page.getByText('192.168.1.20',{exact:true})).toBeInViewport({ratio:1});
    await scan.click(); await page.evaluate(() => window.scanValid());
    await page.evaluate(() => window.finishConnection(true));
    await expect(page.getByText(t.phoneTVWaiting,{exact:true})).toBeInViewport({ratio:1});
    await page.evaluate(() => window.finishPairing());
    await expect(page.getByText(t.phoneTVConnected,{exact:true})).toBeInViewport({ratio:1});
  });
}
