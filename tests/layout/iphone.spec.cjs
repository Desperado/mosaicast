const { test, expect } = require('@playwright/test');
const { en, uk } = require('../../packages/i18n/dist/index.js');

// Logical viewport sizes, not a claim of native validation on these devices.
const viewports = [[320, 568], [360, 780], [375, 667], [375, 812], [390, 844], [393, 852],
  [402, 874], [414, 736], [414, 896], [420, 912], [428, 926], [430, 932], [440, 956], [932, 430]];

async function noHorizontalClipping(page) {
  const clipped = await page.locator('#root').evaluate(root => [...root.querySelectorAll('[dir="auto"], input, [role="button"]')]
    .filter(node => {
      const rect = node.getBoundingClientRect();
      return node.getClientRects().length && rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight &&
        (rect.left < -1 || rect.right > innerWidth + 1);
    }).map(node => node.getAttribute('aria-label') || node.textContent));
  expect(clipped).toEqual([]);
}

async function screenFits(page) {
  const overflow = await page.getByTestId('screen-frame').evaluateAll(frames => frames.flatMap(frame => {
    if (!frame.checkVisibility()) return [];
    return [...frame.querySelectorAll('[role="button"], input, [dir="auto"]')].filter(node => {
      if (!node.checkVisibility() || node.closest('[data-testid="collection-scroll"]')) return false;
      const r = node.getBoundingClientRect();
      return r.width && r.height && (r.top < -1 || r.bottom > innerHeight + 1);
    }).map(node => node.getAttribute('aria-label') || node.textContent);
  }));
  expect(overflow).toEqual([]);
}

for (const [width, height] of viewports) for (const language of ['en', 'uk']) for (const appearance of ['light', 'dark']) {
  test(`${width}x${height} ${language} ${appearance}`, async ({ page }, testInfo) => {
    const t = language === 'en' ? en : uk;
    await page.setViewportSize({ width, height });
    await page.addInitScript(({ language, appearance }) => localStorage.setItem('mosaicast.preferences.v1', JSON.stringify({
      version: 1, language, appearance, demoStarted: true, mode: 'demo', address: '',
    })), { language, appearance });
    await page.goto('/');
    await expect(page.getByRole('button', { name: t.play, exact: true })).toBeVisible();
    await noHorizontalClipping(page);
    await screenFits(page);
    const volumePosition = await page.getByRole('button', { name: `${t.volume} +`, exact: true }).boundingBox();
    await page.getByRole('button', { name: `${t.volume} +`, exact: true }).click();
    await expect(page.getByRole('button', { name: `${t.volume} +`, exact: true })).toBeEnabled();
    expect(await page.getByRole('button', { name: `${t.volume} +`, exact: true }).boundingBox()).toEqual(volumePosition);
    await expect(page.getByText(t.demoNotice, { exact: true })).toHaveCount(0);
    await expect(page.getByText(t.confirmed, { exact: true })).toHaveCount(0);
    await expect(page.getByText(t.accepted, { exact: true })).toHaveCount(0);
    // Normal portrait phone sizes must show playback and volume without scrolling.
    {
      await expect(page.getByRole('button', { name: t.play, exact: true })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: `${t.volume} +`, exact: true })).toBeInViewport({ ratio: 1 });
    }
    if (width === 430 && language === 'uk') await page.screenshot({ path: testInfo.outputPath('listen.png') });
    await page.getByRole('button', { name: t.sources, exact: true }).click();
    await expect(page.getByText(t.chooseSource, { exact: true })).toBeVisible();
    await noHorizontalClipping(page);
    await screenFits(page);
    await page.getByRole('button', { name: t.close, exact: true }).last().click();
    await expect(page.getByText(t.chooseSource, { exact: true })).toBeHidden();
    await page.getByRole('button', { name: t.rooms, exact: true }).click();
    await expect(page.getByText(t.roomsTitle, { exact: true })).toBeVisible();
    await noHorizontalClipping(page);
    await screenFits(page);
    await page.getByRole('button', { name: t.settings, exact: true }).click();
    await expect(page.getByText(t.appearance, { exact: true })).toBeVisible();
    await noHorizontalClipping(page);
    await screenFits(page);
    await page.getByRole('button', { name: t.connection, exact: true }).click();
    const input = page.getByRole('textbox', { name: t.ipAddress, exact: true });
    await expect(input).toBeVisible();
    await input.fill('192,168,188,194');
    await expect(input).toHaveValue('192.168.188.194');
    await input.fill('192.168.1');
    await page.getByRole('button', { name: t.connectByIP, exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(t.invalidIP);
    await input.fill('192.168.1.40');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await noHorizontalClipping(page);
    await screenFits(page);
    if (width === 430 && language === 'uk') await page.screenshot({ path: testInfo.outputPath('connection.png') });
  });
}

for (const [width, height] of [[320, 568], [932, 430]]) for (const language of ['en', 'uk']) {
  test(`welcome ${width}x${height} ${language} fits without scrolling`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(language => localStorage.setItem('mosaicast.preferences.v1', JSON.stringify({
      version: 1, language, appearance: 'light', demoStarted: false, mode: 'demo', address: '',
    })), language);
    await page.goto('/');
    const t = language === 'en' ? en : uk;
    await expect(page.getByRole('button', { name: t.tryDemo, exact: true })).toBeVisible();
    await screenFits(page);
    await noHorizontalClipping(page);
    const description = await page.getByText(t.welcomeBody, { exact: true }).boundingBox();
    const demo = await page.getByRole('button', { name: t.tryDemo, exact: true }).boundingBox();
    expect(description.y + description.height).toBeLessThanOrEqual(demo.y);
  });
}

test('large text and long metadata stay reachable on the smallest portrait viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem('mosaicast.preferences.v1', JSON.stringify({
    version: 1, language: 'uk', appearance: 'dark', demoStarted: true, mode: 'demo', address: '',
  })));
  await page.goto('/');
  await expect(page.getByRole('button', { name: uk.play, exact: true })).toBeVisible();
  await page.getByText('A slower kind of Sunday', { exact: true }).evaluate(node => { node.textContent = 'Дуже довга назва композиції для перевірки перенесення тексту'; });
  // Browser text stress test only; this does not emulate native Dynamic Type.
  await page.locator('[dir="auto"]').evaluateAll(nodes => nodes.forEach(node => {
    const style = getComputedStyle(node);
    node.style.fontSize = `${parseFloat(style.fontSize) * 2}px`;
    node.style.lineHeight = `${parseFloat(style.lineHeight) * 2}px`;
  }));
  await noHorizontalClipping(page);
  const volume = page.getByRole('button', { name: `${uk.volume} +`, exact: true });
  await volume.scrollIntoViewIfNeeded();
  await expect(volume).toBeInViewport({ ratio: 1 });
  await noHorizontalClipping(page);
  await volume.click();
});

for (const width of [375, 430]) for (const power of ['on', 'standby']) {
  test(`device UI ${width}px ${power} keeps controls reachable`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 375 ? 667 : 932 });
    await page.addInitScript(() => localStorage.setItem('mosaicast.preferences.v1', JSON.stringify({
      version: 1, language: 'uk', appearance: 'light', demoStarted: true, mode: 'device', address: '192.168.188.194',
    })));
    const snapshot = {
      model: 'CD-NT670D',
      features: {
        controls: ['power', 'volume', 'mute'], connectivity: ['Ethernet', 'Wi-Fi', 'AirPlay'],
        volumeRange: { min: 0, max: 63, step: 1 },
        sources: [{ id: 'deezer', name: 'Deezer', networkPlayer: true }],
      },
      status: { power, input: 'deezer', volume: 15, maxVolume: 63, mute: false },
      track: power === 'on' ? { title: 'Довга назва композиції для перевірки перенесення', artist: 'Angine de Poitrine', album: 'Vol.II', playback: 'pause' } : undefined,
      trackUnavailable: false,
    };
    const writes = [];
    await page.route('http://127.0.0.1:8092/**', route => {
      const request = route.request();
      if (request.method() !== 'OPTIONS' && !request.url().endsWith('/read')) writes.push(request.url());
      return route.fulfill({ status: 200, headers: {
        'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type',
      }, json: snapshot });
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: uk.refresh, exact: true })).toBeEnabled();
    await noHorizontalClipping(page);
    const volume = page.getByRole('button', { name: `${uk.volume} +`, exact: true });
    await screenFits(page);
    await expect(volume).toBeInViewport({ ratio: 1 });
    await noHorizontalClipping(page);
    if (width === 430 && power === 'on') {
      await page.getByRole('button', { name: uk.rooms, exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('device-listen.png') });
    }
    await page.getByRole('button', { name: uk.sources, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Deezer', exact: true })).toBeVisible();
    await noHorizontalClipping(page);
    expect(writes).toEqual([]);
  });
}
