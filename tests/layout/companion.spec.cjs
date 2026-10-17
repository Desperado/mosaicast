const { test, expect } = require('@playwright/test');
const { en, uk } = require('../../packages/i18n/dist/index.js');

for (const language of ['en', 'uk']) for (const [width, height] of [[320, 568], [430, 932], [932, 430]]) {
  test(`companion pairing ${language} ${width}x${height} remains reachable and demo sends no real requests`, async ({ page }, testInfo) => {
    const t = language === 'en' ? en : uk;
    await page.setViewportSize({width, height});
    await page.addInitScript(language => localStorage.setItem('mosaicast.preferences.v1', JSON.stringify({version: 1, language, appearance: 'dark', demoStarted: true, mode: 'demo', address: ''})), language);
    const external = [];
    await page.route('**/*', route => {
      if (new URL(route.request().url()).hostname !== '127.0.0.1') { external.push(true); return route.abort(); }
      return route.continue();
    });
    await page.goto('/');
    await page.getByRole('button', {name: t.settings, exact: true}).click();
    await page.getByRole('button', {name: t.connection, exact: true}).click();
    await page.getByRole('button', {name: t.companion, exact: true}).click();
    const address = page.getByRole('textbox', {name: t.ipAddress, exact: true});
    await expect(address).toBeVisible();
    await address.fill('8.8.8.8');
    const pair = page.getByRole('button', {name: t.hostPhone, exact: true});
    await pair.scrollIntoViewIfNeeded(); await expect(pair).toBeDisabled();
    await expect(pair).toBeInViewport({ratio: 1});
    await address.fill('192.168.1.20'); await expect(pair).toBeEnabled(); await pair.click();
    await expect(page.getByRole('alert')).toContainText(t.peerNativeRequired);
    const overflow = await page.locator('#root').evaluate(root => root.scrollWidth > innerWidth + 1);
    expect(overflow).toBe(false); expect(external).toEqual([]);
    if (width === 430 && language === 'uk') await page.screenshot({path: testInfo.outputPath('companion.png')});
  });
}
