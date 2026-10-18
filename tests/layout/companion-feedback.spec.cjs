const { test, expect } = require('@playwright/test');
const { en, uk } = require('../../packages/i18n/dist/index.js');
const { companionHarness } = require('./helpers/companion-harness.cjs');
let script;
test.beforeAll(async () => { script = await companionHarness(); });

async function open(page, platform = 'ios') {
  await page.route('**/feedback-test', route => route.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
  await page.goto('/feedback-test');
  await page.evaluate(platform => { window.testPlatform = platform; }, platform);
  await page.addScriptTag({content:script});
}

test('a deep link clears a previous camera failure', async ({page}) => {
  await open(page);
  await page.getByRole('button', {name:en.scanTVQR, exact:true}).click();
  await page.evaluate(() => window.cameraFails());
  await expect(page.getByText(en.cameraUnavailable, {exact:true})).toBeVisible();
  await page.evaluate(() => window.openPairing());
  await page.evaluate(() => window.finishConnection(true));
  await page.evaluate(() => window.finishPairing());
  await expect(page.getByText(en.cameraUnavailable, {exact:true})).toHaveCount(0);
  await expect(page.getByText(en.phoneTVConnected, {exact:true})).toBeVisible();
});

test('manual hosting discards an expired completed QR attempt', async ({page}) => {
  await page.clock.install();
  await open(page);
  await page.getByRole('button', {name:en.scanTVQR, exact:true}).click();
  await page.evaluate(() => window.scanValid());
  await page.evaluate(() => window.finishConnection(true));
  await page.clock.fastForward(301000);
  await expect(page.getByText(en.qrInvalid, {exact:true})).toBeVisible();
  await page.getByRole('button', {name:en.pairingHelp, exact:true}).click();
  await page.getByRole('button', {name:en.hostPhone, exact:true}).click();
  await expect(page.getByText(en.qrInvalid, {exact:true})).toHaveCount(0);
  await page.evaluate(() => window.finishConnection(true));
  await page.evaluate(() => window.finishPairing());
  await expect(page.getByText(en.phoneTVConnected, {exact:true})).toBeVisible();
});

test('a retained failed invitation can be cancelled before manual hosting', async ({page}) => {
  await page.clock.install();
  await open(page);
  await page.getByRole('button', {name:en.scanTVQR, exact:true}).click();
  await page.evaluate(() => window.scanValid());
  await page.evaluate(() => window.finishConnection(false));
  await page.clock.fastForward(301000);
  await page.getByRole('button', {name:en.cancelPairing, exact:true}).click();
  await page.getByRole('button', {name:en.pairingHelp, exact:true}).click();
  await page.getByRole('button', {name:en.hostPhone, exact:true}).click();
  expect(await page.evaluate(() => window.connectCalls)).toBe(2);
});

for (const platform of ['android', 'web']) test(`${platform} can close an unavailable scanner and use Help`, async ({page}) => {
  await open(page, platform);
  await page.getByRole('button', {name:en.scanTVQR, exact:true}).click();
  await expect(page.getByText(en.qrNativeRequired, {exact:true})).toBeVisible();
  await page.getByRole('button', {name:en.close, exact:true}).click();
  await page.getByRole('button', {name:en.pairingHelp, exact:true}).click();
  await expect(page.getByRole('button', {name:en.hostPhone, exact:true})).toBeVisible();
});

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
    await page.evaluate(() => window.finishConnection(false, 'address'));
    await expect(page.getByText(t.pairingAddressFailed,{exact:true})).toBeInViewport({ratio:1});
    await expect(page.getByText(`${t.pairingAddressDiagnostic}: WIFI_NO_IPV4`,{exact:true})).toBeInViewport({ratio:1});
    await scan.click(); await page.evaluate(() => window.scanValid());
    await page.evaluate(() => window.finishConnection(true));
    await expect(page.getByText(t.phoneTVWaiting,{exact:true})).toBeInViewport({ratio:1});
    await page.evaluate(() => window.finishPairing());
    await expect(page.getByText(t.phoneTVConnected,{exact:true})).toBeInViewport({ratio:1});
  });
}
