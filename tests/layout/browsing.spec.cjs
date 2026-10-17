const { test, expect } = require('@playwright/test');
const { en, uk } = require('../../packages/i18n/dist/index.js');

async function preferences(page, language, mode = 'demo') {
  await page.addInitScript(({ language, mode }) => localStorage.setItem('mosaicast.preferences.v1', JSON.stringify({
    version: 1, language, appearance: 'light', demoStarted: true, mode, address: mode === 'device' ? '192.168.1.50' : '',
  })), { language, mode });
}
async function noClipping(page) {
  expect(await page.locator('#root').evaluate(root => [...root.querySelectorAll('input, [role="button"], [dir="auto"]')].filter(node => {
    const r = node.getBoundingClientRect();
    return r.width && r.height && r.top < innerHeight && r.bottom > 0 && (r.left < -1 || r.right > innerWidth + 1);
  }).map(node => node.textContent))).toEqual([]);
}

for (const language of ['en', 'uk']) for (const width of [320, 430]) {
  test(`demo browsing ${language} ${width}px navigates, pages, searches and plays without hardware`, async ({ page }, testInfo) => {
    const t = language === 'en' ? en : uk;
    await page.setViewportSize({ width, height: width === 320 ? 568 : 932 });
    await preferences(page, language);
    const deviceRequests = [];
    await page.route('http://127.0.0.1:8092/**', route => { deviceRequests.push(route.request().url()); return route.abort(); });
    await page.goto('/');
    await page.getByRole('button', { name: t.browseSource, exact: true }).click();
    await page.getByRole('button', { name: `${t.openFolder}: Low tide hours`, exact: true }).click();
    await expect(page.getByText('1–8 / 11', { exact: false })).toBeVisible();
    await noClipping(page);
    await page.getByTestId('collection-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
    for (const name of [t.back, t.parentMenu, t.nextPage]) await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: t.nextPage, exact: true }).click();
    await expect(page.getByText('9–11 / 11', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: t.nextPage, exact: true })).toBeDisabled();
    await page.getByRole('button', { name: `${t.play}: Last light`, exact: true }).click();
    await expect(page.getByText(t.demoBrowseAccepted, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: t.parentMenu, exact: true }).click();
    await page.getByRole('button', { name: `${t.search}: ${t.searchCatalog}`, exact: true }).click();
    const query = page.getByRole('textbox', { name: t.searchQuery, exact: true });
    await expect(page.getByRole('button', { name: t.search, exact: true })).toBeDisabled();
    await query.fill('light');
    await noClipping(page);
    await page.getByRole('button', { name: t.search, exact: true }).click();
    await expect(page.getByText('1–3 / 3', { exact: false })).toBeVisible();
    if (width === 430 && language === 'uk') await page.screenshot({ path: testInfo.outputPath('source-browsing.png') });
    await page.getByRole('button', { name: t.parentMenu, exact: true }).click();
    await page.getByRole('button', { name: `${t.search}: ${t.searchCatalog}`, exact: true }).click();
    await query.fill('no matching fictional song');
    await page.getByRole('button', { name: t.search, exact: true }).click();
    await expect(page.getByText(t.browseEmpty, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: t.back, exact: true }).click();
    await expect(page.getByText('Last light', { exact: true })).toBeVisible();
    expect(deviceRequests).toEqual([]);
  });
}

for (const error of ['browseChanged', 'uncertainError']) {
  test(`device browser recovers from ${error} without repeating an action`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await preferences(page, 'en', 'device');
    const snapshot = {
      model: 'Example Yamaha', features: { controls: ['power'], connectivity: [], sources: [{ id: 'server', name: 'PC / NAS', networkPlayer: true }] },
      status: { power: 'on', input: 'server' }, trackUnavailable: true,
    };
    const menu = { input: 'server', token: '1', layer: 0, title: 'Example menu', index: 0, total: 1, items: [{ index: 0, text: 'Example album', selectable: true, playable: true, searchable: false }] };
    const requests = [];
    await page.route('http://127.0.0.1:8092/**', route => {
      const request = route.request();
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const action = new URL(request.url()).pathname;
      requests.push(action);
      return route.fulfill({ status: action === '/browse-action' ? 503 : 200, headers,
        json: action === '/browse-action' ? { code: error } : action === '/browse' ? menu : snapshot });
    });
    await page.goto('/');
    await page.getByRole('button', { name: en.browseSource, exact: true }).click();
    await page.getByRole('button', { name: `${en.play}: Example album`, exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(en[error]);
    if (error === 'uncertainError') {
      await expect(page.getByRole('button', { name: en.refreshMenu, exact: true })).toBeDisabled();
      await page.getByRole('button', { name: en.refresh, exact: true }).click();
    }
    if (error !== 'uncertainError') await page.getByRole('button', { name: en.close, exact: true }).click();
    await page.getByRole('button', { name: en.refreshMenu, exact: true }).click();
    await expect(page.getByRole('button', { name: `${en.openFolder}: Example album`, exact: true })).toBeEnabled();
    await noClipping(page);
    expect(requests.filter(action => action === '/browse-action')).toHaveLength(1);
    expect(requests).not.toContain('/command');
  });
}

test('refreshing a source menu preserves its rows, title and footer until replacement arrives', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await preferences(page, 'en', 'device');
  const snapshot = { model: 'Example Yamaha', features: { controls: ['power'], connectivity: [], sources: [{ id: 'server', name: 'PC / NAS', networkPlayer: true }] }, status: { power: 'on', input: 'server' }, trackUnavailable: true };
  const menu = { input: 'server', token: '1', layer: 1, title: 'Example album', index: 0, total: 11, items: Array.from({ length: 8 }, (_, index) => ({ index, text: `Song ${index + 1}`, selectable: false, playable: true, searchable: false })) };
  let reads = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('http://127.0.0.1:8092/**', async route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const browsing = route.request().url().endsWith('/browse');
    if (browsing && ++reads > 1) await gate;
    return route.fulfill({ status: 200, headers, json: browsing ? { ...menu, token: String(reads) } : snapshot });
  });
  await page.goto('/');
  await page.getByRole('button', { name: en.browseSource, exact: true }).click();
  const row = page.getByRole('button', { name: `${en.play}: Song 1`, exact: true });
  await expect(row).toBeEnabled();
  const position = await row.boundingBox();
  await page.getByRole('button', { name: en.refreshMenu, exact: true }).click();
  await expect(row).toBeDisabled();
  await expect(page.getByText('Example album', { exact: true })).toBeVisible();
  await expect(page.getByText('1–8 / 11', { exact: false })).toBeVisible();
  expect(await row.boundingBox()).toEqual(position);
  expect(await row.evaluate(node => getComputedStyle(node).opacity)).toBe('1');
  release();
  await expect(row).toBeEnabled();
});
