import { FrameCompanion, findFrameCompanions, pairFrame, savedCompanion, companionFeatures, companionStatus, companionInfo, companionTuner } from './companion.js';
import { MusicCast, transport, entries, soundControls, sources, sourceName, deviceCapabilities, privateIPv4 } from './protocol.js';
import { demoTransport } from './demo.js';
import { LyricsLoader, artworkUrl, trackKey } from './metadata.js';
import { artistScene, sceneMatchesTrack, isArtistFolder } from './artist-scene.js';

const $ = id => document.getElementById(id);
const themes = {
  'gallery-night': 'Gallery Night', 'record-store-after-hours': 'Record Store After Hours',
  'midnight-precision': 'Midnight Precision',
  'warm-gallery': 'Warm Gallery', 'listening-room-noir': 'Listening Room Noir',
  'record-store': 'Record Store', 'quiet-precision': 'Quiet Precision',
  light: 'Classic Light', dark: 'Classic Dark'
};

const themeStyles = { 'gallery-night': 'warm-gallery', 'record-store-after-hours': 'record-store', 'midnight-precision': 'quiet-precision' };

function setTheme(theme, save = false) {
  if (!Object.prototype.hasOwnProperty.call(themes, theme)) return;
  const scroll = $('main-content').scrollTop;
  document.documentElement.dataset.theme = theme;
  const style = themeStyles[theme] || theme;
  document.documentElement.dataset.style = style;
  document.documentElement.dataset.designed = String(theme !== 'light' && theme !== 'dark');
  document.documentElement.dataset.navigation = ['listening-room-noir', 'record-store'].includes(style) ? 'top' : 'side';
  $('theme-current').textContent = themes[theme];
  for (const id of Object.keys(themes)) $(`theme-${id}`).setAttribute('aria-pressed', String(theme === id));
  $('main-content').scrollTop = scroll;
  if (save) { try { localStorage.setItem('frame-music-theme', theme); } catch { /* Theme still works without storage. */ } }
}

let savedTheme;
try { savedTheme = localStorage.getItem('frame-music-theme'); } catch { /* Use the dark default when storage is unavailable. */ }
setTheme(Object.prototype.hasOwnProperty.call(themes, savedTheme) ? savedTheme : 'gallery-night');
for (const theme of Object.keys(themes)) $(`theme-${theme}`).onclick = () => setTheme(theme, true);

function setSurface(surface, save = false) {
  if (!['glass', 'solid'].includes(surface)) return;
  document.documentElement.dataset.surface = surface;
  for (const value of ['glass', 'solid']) $(`surface-${value}`).setAttribute('aria-pressed', String(surface === value));
  if (save) { try { localStorage.setItem('frame-music-surface', surface); } catch { /* Appearance still works without storage. */ } }
}
let savedSurface;
try { savedSurface = localStorage.getItem('frame-music-surface'); } catch { /* Use glass when storage is unavailable. */ }
setSurface(savedSurface === 'solid' ? 'solid' : 'glass');
for (const surface of ['glass', 'solid']) $(`surface-${surface}`).onclick = () => setSurface(surface, true);

let stopCompanionWatch, viewEpoch = 0, operationView = 0;
let client, list, features, isDemo = true, busy = false, prepared = false, dialogMode, searchEntry, priorFocus, browsingInput = 'deezer', sourceView = false, currentStatus;
let trackView = false, metadataKey = '', metadataVersion = 0, artKey = '', artRevision = 0;
let trackOrigin = 'menu';
let sceneTrack = {}, sceneArtwork = '', sceneVersion = 0, browseScene = null;
const viewMemory = new Map(), menuParents = [];
const zoneMemory = new Map();
let playerOrigin = 'content', lastArrow = 0, lastArrowTime = 0, heldArrow;
const lyricsLoader = new LyricsLoader();
const icons = { Flow: '≈', Charts: '↗', Recommendations: '✧', Mixes: '♫', Genres: '◈', 'My library': '▤', Search: '⌕' };

const companionRecoveryMessage = 'Coordinator changed or an action needs checking. After a phone disconnect, wait one minute, then choose Refresh.';

function message(text, error = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
}

async function action(work) {
  if (busy) return;
  busy = true; operationView = viewEpoch;
  $('menu').setAttribute('aria-busy', 'true');
  message('');
  try { await work(); message(''); }
  catch (error) {
    message(error.message, true);
    if (!$('overlay').hidden) $('dialog-error').textContent = error.message;
  } finally { busy = false; $('menu').setAttribute('aria-busy', 'false'); }
}

function renderArtistScene(path) {
  const scene = path ? artistScene(path, sceneTrack) : trackView ? artistScene([sceneTrack.artist], sceneTrack) : sourceView ? null : browseScene;
  const main = $('main-content'), cover = $('artist-cover');
  main.dataset.artist = scene?.artist || '';
  main.dataset.artistTone = scene?.tone || '';
  $('artist-atmosphere').hidden = !scene;
  const url = sceneMatchesTrack(scene, sceneTrack) ? sceneArtwork : '';
  // A late/failed cover must never repaint a different artist.
  if ((cover.getAttribute('src') || '') === url) return;
  const version = ++sceneVersion;
  cover.hidden = true;
  cover.onload = () => { if (version === sceneVersion) cover.hidden = false; };
  cover.onerror = () => { if (version === sceneVersion) cover.hidden = true; };
  if (url) cover.setAttribute('src', url); else cover.removeAttribute('src');
}

function artistPath(data) {
  return Number(data?.menu_layer) > 0 ? [...menuParents.filter(parent => Number(parent.layer) < Number(data.menu_layer)).map(parent => parent.name), data.menu_name] : [];
}

function renderMenu(data, focusIndex) {
  if (busy && operationView !== viewEpoch && data !== list) return;
  rememberView();
  const sameMenu = list?.input === data.input && list?.menu_layer === data.menu_layer && list?.menu_name === data.menu_name;
  const path = artistPath(data);
  browseScene = artistScene(path, sceneTrack) || (sameMenu && Number(data.menu_layer) > 0 ? browseScene : null);
  list = data; sourceView = false; trackView = false; $('track-panel').hidden = true;
  $('home').classList.toggle('selected', true); $('now-playing').classList.toggle('selected', false);
  $('menu').hidden = false; $('sources-panel').hidden = true;
  $('browse-panel').hidden = false; $('main-content').dataset.view = 'browse';
  renderArtistScene();
  $('browse-sources').classList.toggle('selected', false);
  $('browse-label').textContent = sourceName(browsingInput);
  $('service-label').textContent = sourceName(browsingInput).toUpperCase();
  $('menu').setAttribute('aria-label', `${sourceName(browsingInput)} menu`);
  $('menu-title').textContent = data.menu_name || sourceName(browsingInput);
  $('breadcrumb').textContent = Number(data.menu_layer) > 0 ? `${sourceName(browsingInput).toUpperCase()} / YOUR MUSIC` : '';
  $('back').hidden = !(Number(data.menu_layer) > 0);
  const start = Number(data.index || 0), count = Number(data.max_line || 0);
  $('page-prev').hidden = start < 8;
  $('page-next').hidden = start + 8 >= count;
  $('menu-count').textContent = count ? `${start + 1}–${Math.min(start + (data.list_info?.length || 0), count)} of ${count}` : currentStatus?.power === 'standby' ? 'Power on Yamaha, then Refresh to browse music.' : 'No items here yet';
  const menu = $('menu');
  menu.textContent = '';
  for (const item of entries(data)) {
    const button = document.createElement('button');
    button.className = 'menu-card';
    button.dataset.index = item.index;
    button.dataset.focusKey = JSON.stringify([item.index, item.text, item.attribute]);
    button.dataset.title = item.text;
    button.dataset.action = item.search ? 'OK searches' : item.browse ? (item.play ? 'OK opens · Play key to listen' : 'OK opens collection') : item.play ? 'OK plays on Yamaha' : 'Unavailable';
    button.disabled = !(item.browse || item.play || item.search);
    const icon = document.createElement('span');
    icon.className = 'card-icon'; icon.textContent = icons[item.text] || (item.browse ? '▤' : '♫'); icon.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span'); copy.className = 'card-copy';
    const title = document.createElement('strong'); title.textContent = item.text;
    copy.append(title);
    button.setAttribute('aria-label', `${item.text} · ${button.dataset.action}`);
    const arrow = document.createElement('span'); arrow.className = 'card-arrow'; arrow.textContent = item.search ? '⌕' : item.browse ? '›' : '▷'; arrow.setAttribute('aria-hidden', 'true');
    button.append(icon, copy, arrow);
    button.addEventListener('click', () => item.search ? openDialog('search', item) : action(() => activate(item, item.browse ? 'select' : 'play')));
    menu.append(button);
  }
  updatePreview(menu.querySelector('button:not(:disabled)'));
  if (focusIndex !== undefined && $('overlay').hidden) restoreView(focusIndex);
}

function renderPowerState(power) {
  const state = power === 'on' || power === 'standby' ? power : 'unknown';
  const description = state === 'on' ? 'Yamaha is on' : state === 'standby' ? 'Yamaha is in standby' : 'Yamaha power status unavailable';
  $('power-state').dataset.power = state;
  $('power-state').setAttribute('title', description);
  $('power-description').textContent = description;
}

function renderPlayer(info, status) {
  currentStatus = status;
  $('device-description').textContent = isDemo ? '' : `${client.host} · ${status.power === 'on' ? 'Connected' : status.power === 'standby' ? 'Standby' : 'Power status unavailable'}`;
  const canPower = features.zone?.find(zone => zone.id === 'main')?.func_list?.includes('power');
  $('power-on').disabled = !canPower || status.power === 'on';
  $('power-off').disabled = !canPower || status.power === 'standby';
  renderPowerState(status.power);
  const source = sourceName(status.input);
  const supported = sources(features).some(item => item.id === status.input && item.type === 'netusb') && status.power !== 'standby';
  for (const id of ['previous', 'toggle-play', 'next']) $(id).disabled = !supported;
  $('play-source').textContent = isDemo ? 'EXAMPLE MUSIC' : `NOW PLAYING · ${source.toUpperCase()}`;
  $('track-title').textContent = info.error ? 'Playback information unavailable' : info.track || (info.playback === 'play' ? `Listening via ${source}` : 'Choose something to listen to');
  $('track-artist').textContent = info.error || info.artist || info.album || 'Your Yamaha listening room';
  $('play-state').textContent = status.power === 'standby' ? 'Standby' : info.playback === 'play' ? 'Playing' : info.playback === 'pause' ? 'Paused' : 'Ready to listen';
  $('toggle-play').textContent = info.playback === 'play' ? 'Ⅱ' : '▶';
  $('toggle-play').setAttribute('aria-label', info.playback === 'play' ? 'Pause Yamaha playback' : 'Play Yamaha playback');
  preloadTrack(info, status);
  renderTuner(client?.companion ? client.controller.state?.snapshot : undefined);
}

let tunerSignature = '';
function renderTuner(snapshot) {
  const tuner = companionTuner(snapshot);
  $('tuner-panel').hidden = !tuner;
  if (!tuner) return;
  $('tuner-status').textContent = tuner.description;
  $('track-title').textContent = tuner.title; $('detail-title').textContent = tuner.title;
  $('track-artist').textContent = tuner.description;
  const signature = JSON.stringify(tuner.controls);
  if (signature === tunerSignature) return;
  tunerSignature = signature;
  const focused = document.activeElement, focusKey = $('tuner-controls').contains(focused) ? focused.dataset.focusKey : undefined;
  $('tuner-controls').textContent = '';
  for (const control of tuner.controls) {
    const button = document.createElement('button'); button.className = 'quiet';
    button.textContent = control.label; button.dataset.focusKey = `tuner:${control.id}`; button.disabled = !!control.disabled;
    button.onclick = () => action(() => client.command(control.command));
    $('tuner-controls').append(button);
  }
  if (focusKey && trackView && $('overlay').hidden) {
    const buttons = [...$('tuner-controls').querySelectorAll('button:not(:disabled)')];
    focusControl(buttons.find(button => button.dataset.focusKey === focusKey) || buttons[0] || $('sources'));
  }
}

function clockTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function renderLyrics(result) {
  if ($('lyrics').textContent !== (result.text || '')) $('lyrics').textContent = result.text || '';
  $('lyrics').hidden = result.state !== 'found';
  $('lyrics-controls').hidden = result.state !== 'found';
  $('lyrics-source').textContent = result.state === 'found' || result.state === 'instrumental' ? isDemo ? 'Original example lyrics' : 'From LRCLIB' : '';
  $('lyrics-status').textContent = ({ loading: 'Finding lyrics…', missing: 'No matching lyrics found.', unavailable: 'Lyrics are unavailable right now. Playback controls still work.', instrumental: 'Instrumental · no lyrics', empty: 'Choose a song to see lyrics.' })[result.state] || '';
}

function preloadTrack(info, status) {
  const hasTrack = status.power !== 'standby' && !info.error && typeof info.track === 'string' && Boolean(info.track.trim());
  sceneTrack = hasTrack ? info : {};
  // A reopened Yamaha menu may arrive before its playback metadata. Resolve it
  // on the next poll without replacing an already identified browsing artist.
  if (!browseScene) browseScene = artistScene(artistPath(list), sceneTrack);
  $('detail-title').textContent = $('track-title').textContent;
  $('detail-artist').textContent = hasTrack ? info.artist || 'Artist not provided' : '—';
  $('detail-album').textContent = hasTrack ? info.album || 'Album not provided' : '—';
  $('detail-time').textContent = hasTrack ? `${$('play-state').textContent} · ${clockTime(info.play_time)} / ${info.total_time > 0 ? clockTime(info.total_time) : '—'}` : $('play-state').textContent;
  const key = hasTrack ? JSON.stringify([isDemo ? 'demo' : client.host, status.input, trackKey(info)]) : '';
  if (key !== metadataKey) {
    metadataKey = key; ++metadataVersion;
    lyricsLoader.cancel(); $('lyrics').scrollTop = 0;
    renderLyrics({ state: key ? 'loading' : 'empty' });
  } else if (!key) renderLyrics({ state: 'empty' });
  if (key) {
    const version = metadataVersion;
    const pending = isDemo ? Promise.resolve({ state: 'found', text: 'Let the morning take its time\nLeave the busy world behind\nA little room, a little light\nA slower song to make things right' }) : lyricsLoader.load(info);
    pending.then(result => { if (version === metadataVersion && key === metadataKey) renderLyrics(result); });
  }
  const nextArtKey = key ? JSON.stringify([key, info.albumart_url || '', info.albumart_id]) : '';
  if (nextArtKey !== artKey) {
    artKey = nextArtKey;
    const url = key && !isDemo ? artworkUrl(client.host, info, Boolean(globalThis.tizen?.application), ++artRevision) : '';
    $('cover-status').textContent = url ? 'Loading album cover…' : isDemo && key ? 'Illustrated example cover' : 'Album cover not provided.';
    for (const id of ['player-cover', 'detail-cover']) {
      const image = $(id); image.hidden = true;
      if (id === 'detail-cover') image.setAttribute('alt', `Album cover for ${info.album || info.track || 'current song'}`);
      image.onload = () => { if (artKey === nextArtKey) { image.hidden = false; $('cover-status').textContent = ''; } };
      image.onerror = () => { if (artKey === nextArtKey) { image.hidden = true; $('cover-status').textContent = 'Album cover unavailable.'; } };
      if (url) image.setAttribute('src', url); else image.removeAttribute('src');
    }
  }
  sceneArtwork = $('player-cover').getAttribute('src') || '';
  renderArtistScene();
}

function renderTrack() {
  rememberView();
  if (!trackView) trackOrigin = sourceView ? 'sources' : 'menu';
  trackView = true; sourceView = false;
  $('home').classList.toggle('selected', false); $('now-playing').classList.toggle('selected', true);
  $('menu').hidden = true; $('sources-panel').hidden = true; $('track-panel').hidden = false;
  $('browse-panel').hidden = true; $('main-content').dataset.view = 'track';
  renderArtistScene();
  $('browse-sources').classList.toggle('selected', false);
  $('service-label').textContent = 'NOW PLAYING'; $('breadcrumb').textContent = '';
  $('menu-title').textContent = 'Now playing';
  $('back').hidden = false; $('page-prev').hidden = true; $('page-next').hidden = true;
  $('menu-count').textContent = '';
  playerOrigin = 'content';
  ($('toggle-play').disabled ? $('sources') : $('toggle-play')).focus();
}

async function playerState(candidate = client, capabilities = features, status) {
  try { status ||= await candidate.request('main/getStatus'); }
  catch (error) { if (candidate === client) renderPowerState(); throw error; }
  const source = sources(capabilities).find(item => item.id === status.input);
  let info = {};
  if (source?.type === 'netusb' && status.power !== 'standby') {
    try { info = await candidate.request('netusb/getPlayInfo'); }
    catch (error) { info = { error: error.message }; }
  }
  // The network player can retain metadata from the source used before CD/radio/AUX.
  if (!info.error && info.input !== status.input) info = {};
  return { status, info };
}

async function refreshPlayer() {
  const state = await playerState();
  renderPlayer(state.info, state.status); renderSound(state.status);
}

function renderSources(focus = false) {
  const restoreFocus = focus || contentRoot().contains(document.activeElement);
  rememberView();
  sourceView = true; trackView = false; $('track-panel').hidden = true;
  renderArtistScene();
  $('home').classList.toggle('selected', false); $('now-playing').classList.toggle('selected', false);
  $('menu').hidden = true; $('sources-panel').hidden = false;
  $('browse-panel').hidden = true; $('main-content').dataset.view = 'sources';
  $('browse-sources').classList.toggle('selected', true);
  $('service-label').textContent = 'MUSICCAST'; $('breadcrumb').textContent = '';
  $('menu-title').textContent = 'All sources';
  $('back').hidden = !list; $('page-prev').hidden = true; $('page-next').hidden = true;
  const available = sources(features);
  $('menu-count').textContent = `${available.length} inputs · ${currentStatus?.power === 'standby' ? 'Standby' : 'Current input: ' + sourceName(currentStatus?.input)}`;
  const container = $('source-list'); container.textContent = '';
  for (const source of available) {
    const card = document.createElement('article'); card.className = 'source-card';
    const title = document.createElement('h2'); title.textContent = source.name;
    const controls = document.createElement('div'); controls.className = 'source-actions';
    if (source.browse) {
      const browse = document.createElement('button'); browse.className = 'quiet'; browse.textContent = 'Browse';
      browse.dataset.focusKey = `browse:${source.id}`;
      browse.setAttribute('aria-label', `Browse ${source.name}`);
      browse.onclick = () => action(async () => {
        const data = await client.list(0, source.id);
        rememberView(); browsingInput = source.id; prepared = false; menuParents.length = 0; renderMenu(data, 0);
      });
      controls.append(browse);
    }
    const select = document.createElement('button'); select.className = 'quiet';
    select.dataset.focusKey = `select:${source.id}`;
    select.textContent = currentStatus?.input === source.id ? 'Current input' : 'Switch input';
    select.disabled = currentStatus?.input === source.id;
    select.setAttribute('aria-label', `Switch Yamaha input to ${source.name}`);
    select.onclick = () => action(async () => {
      prepared = false;
      const status = await client.selectInput(source.id);
      const state = await playerState(client, features, status);
      renderPlayer(state.info, state.status); renderSound(state.status); renderSources(true);
    });
    controls.append(select); card.append(title, controls); container.append(card);
  }
  const capabilities = $('capability-list'); capabilities.textContent = '';
  for (const label of deviceCapabilities(features)) { const item = document.createElement('li'); item.textContent = label; capabilities.append(item); }
  if (restoreFocus && $('overlay').hidden) restoreView();
}

function renderSound(status) {
  const sound = soundControls(features, status);
  $('volume-level').textContent = sound.label;
  $('volume-down').disabled = !sound.down;
  $('volume-up').disabled = !sound.up;
  $('mute').disabled = !sound.canMute;
  $('mute').textContent = sound.muted ? 'Unmute' : 'Mute';
  $('mute').setAttribute('aria-label', sound.muted ? 'Unmute Yamaha' : 'Mute Yamaha');
  $('mute').setAttribute('aria-pressed', String(sound.muted));
}

function sound(command) {
  return action(async () => {
    const focused = document.activeElement;
    renderSound(await client.sound(command, features));
    // A button can become disabled at the volume limit. Keep remote focus usable.
    if (focused.disabled) { if ($('mute').disabled) $('toggle-play').focus(); else $('mute').focus(); }
  });
}

async function ensurePrepared(item) {
  const zone = features.zone?.find(z => z.id === 'main');
  if (!prepared && zone?.func_list?.includes('prepare_input_change')) await client.request('main/prepareInputChange', { input: browsingInput });
  prepared = true;
  // Input preparation can reset the Yamaha's shared menu. Never use a stale index.
  const fresh = await client.list(Number(list.index || 0), browsingInput);
  const match = fresh.input === browsingInput && fresh.menu_layer === list.menu_layer && fresh.menu_name === list.menu_name && entries(fresh).find(v => v.index === item.index && v.text === item.text && v.attribute === item.attribute);
  if (!match) { menuParents.length = 0; renderMenu(fresh, 0); throw new Error('The Yamaha menu changed. Choose your item again.'); }
  return match;
}

async function activate(item, type) {
  if (type === 'select') renderArtistScene([...menuParents.map(parent => parent.name), list.menu_name, item.text]);
  try {
    item = await ensurePrepared(item);
    rememberView();
    const parent = { layer: list.menu_layer, name: list.menu_name, index: Number(list.index || 0), selected: { index: item.index, text: item.text, attribute: item.attribute }, count: Number(list.max_line || 0) };
    await client.control(type, item.index);
    if (type === 'select') {
      menuParents.push(parent); if (menuParents.length > 32) menuParents.shift();
      renderMenu(await client.list(0, browsingInput), 0);
    }
    else await refreshPlayer();
  } finally { renderArtistScene(); }
}

async function currentMenu() {
  const fresh = await client.list(Number(list.index || 0), browsingInput);
  if (fresh.input !== browsingInput || fresh.menu_layer !== list.menu_layer || fresh.menu_name !== list.menu_name || JSON.stringify(fresh.list_info) !== JSON.stringify(list.list_info)) {
    menuParents.length = 0; renderMenu(fresh, 0);
    throw new Error('The Yamaha menu changed. Choose your item again.');
  }
  return fresh;
}

async function pageMenu(direction) {
  const fresh = await currentMenu();
  const start = Number(fresh.index || 0) + direction * 8;
  if (start < 0 || start >= Number(fresh.max_line || 0)) return;
  const page = await client.list(start, browsingInput);
  if (page.input !== fresh.input || page.menu_layer !== fresh.menu_layer || page.menu_name !== fresh.menu_name) {
    menuParents.length = 0; renderMenu(page, 0);
    throw new Error('The Yamaha menu changed. Choose your item again.');
  }
  renderMenu(page, start);
}

function artistParent() { return [...menuParents].reverse().find(parent => isArtistFolder(parent.name) && parent.selected); }

async function adjacentArtist(direction, selected) {
  const parent = artistParent();
  if (!isArtistFolder(list.menu_name) && !parent) return;
  selected ||= parent?.selected;
  if (!selected) return;
  const target = selected.index + direction;
  // At either end, keep the current artist and its track page in place.
  if (target < 0 || target >= (isArtistFolder(list.menu_name) ? Number(list.max_line) : parent.count)) return;
  await currentMenu();
  while (!isArtistFolder(list.menu_name)) {
    const saved = menuParents[menuParents.length - 1];
    if (!saved) return;
    await client.control('return');
    const data = await client.list(saved.index, browsingInput);
    menuParents.pop();
    if (data.input !== browsingInput || data.menu_layer !== saved.layer || data.menu_name !== saved.name) {
      menuParents.length = 0; renderMenu(data, 0);
      throw new Error('The Yamaha menu changed. Choose your artist again.');
    }
    renderMenu(data, null);
    await currentMenu();
  }
  // Check the artist we came from before selecting a neighbouring shared index.
  const originPage = await client.list(Math.floor(selected.index / 8) * 8, browsingInput);
  const origin = entries(originPage).find(item => item.index === selected.index && item.text === selected.text && item.attribute === selected.attribute);
  if (originPage.input !== browsingInput || originPage.menu_layer !== list.menu_layer || originPage.menu_name !== list.menu_name || !origin) {
    menuParents.length = 0; renderMenu(originPage, 0);
    throw new Error('The artist list changed. Choose your artist again.');
  }
  const page = Math.floor(target / 8) === Math.floor(selected.index / 8) ? originPage : await client.list(Math.floor(target / 8) * 8, browsingInput);
  if (page.input !== originPage.input || page.menu_layer !== originPage.menu_layer || page.menu_name !== originPage.menu_name) {
    menuParents.length = 0; renderMenu(page, 0);
    throw new Error('The artist list changed. Choose your artist again.');
  }
  renderMenu(page, target);
  const artist = entries(page).find(item => item.index === target && item.browse);
  if (artist) await activate(artist, 'select');
}

async function back() {
  if (!$('overlay').hidden) { closeDialog(); return; }
  if (trackView) { ++viewEpoch; if (trackOrigin === 'sources' || !list) renderSources(true); else renderMenu(list, null); return; }
  if (sourceView && list) { ++viewEpoch; renderMenu(list, null); return; }
  if (busy) return;
  if (Number(list?.menu_layer) > 0) await action(async () => {
    await currentMenu();
    await client.control('return');
    let parent = await client.list(0, browsingInput);
    const saved = menuParents.pop();
    if (saved && saved.layer === parent.menu_layer && saved.name === parent.menu_name) {
      if (saved.index) parent = await client.list(saved.index, browsingInput);
      renderMenu(parent, null);
    } else { menuParents.length = 0; renderMenu(parent, 0); }
  });
  else if (globalThis.tizen?.application) openDialog('exit');
  else message('You’re at the home menu.');
}

let companionSearch, pendingPair, pairingAttempt = 0;
function stopCompanionSearch() {
  companionSearch?.abort(); companionSearch = undefined;
  $('find-companions').textContent = 'Search again';
}
async function searchCompanions() {
  stopCompanionSearch();
  const controller = new AbortController(); companionSearch = controller;
  $('companion-results').textContent = '';
  $('companion-discovery-status').textContent = 'Finding your iPhone…';
  $('find-companions').textContent = 'Cancel search';
  try {
    const devices = await findFrameCompanions(controller.signal, device => {
      if (controller.signal.aborted) return;
      const button = document.createElement('button'); button.type = 'button'; button.textContent = device.url;
      button.onclick = () => { stopCompanionSearch(); $('dialog-input').value = device.url; $('submit-dialog').focus(); };
      $('companion-results').append(button);
    });
    if (!controller.signal.aborted) {
      if (devices.length === 1 && $('dialog-input').value === 'http://') $('dialog-input').value = devices[0].url;
      $('companion-discovery-status').textContent = devices.length ? 'Choose your phone, then compare the code on both screens.' : 'No phone found. Open Connect phone + TV on your iPhone, check Wi-Fi, or enter its address.';
    }
  } catch {
    if (!controller.signal.aborted) $('companion-discovery-status').textContent = 'Local discovery unavailable. Enter the phone address, or check network permissions and search again.';
  } finally { if (companionSearch === controller) stopCompanionSearch(); }
}

function openDialog(mode, item) {
  stopCompanionSearch(); pendingPair = undefined; ++pairingAttempt;
  dialogMode = mode; searchEntry = item; priorFocus = document.activeElement;
  $('overlay').hidden = false;
  $('dialog-form').hidden = !['connect', 'companion', 'search'].includes(mode);
  $('help-sections').hidden = mode !== 'help';
  $('surface-options').hidden = mode !== 'theme';
  heldArrow = undefined;
  $('exit-actions').hidden = mode !== 'exit';
  $('theme-options').hidden = mode !== 'theme';
  $('overlay').classList.toggle('theme-overlay', mode === 'theme');
  $('overlay').classList.toggle('help-overlay', mode === 'help');
  $('overlay').classList.toggle('companion-overlay', mode === 'companion');
  $('dialog-error').textContent = '';
  $('dialog-title').textContent = mode === 'search' ? 'Find your music' : 'Connect your Yamaha';
  $('dialog-description').textContent = mode === 'search' ? 'Search through your Yamaha’s existing music menu.' : 'Enter the Yamaha’s address on your home network. Set up streaming accounts through the MusicCast phone app.';
  $('input-label').textContent = mode === 'search' ? 'Artist, album or track' : 'Local IP address';
  $('dialog-input').value = mode === 'search' ? '' : savedHost();
  $('dialog-input').placeholder = mode === 'search' ? 'What would you like to hear?' : '192.168.1.20';
  $('dialog-input').inputMode = mode === 'search' ? 'text' : 'decimal';
  $('submit-dialog').textContent = mode === 'search' ? 'Search' : 'Connect';
  $('companion-fields').hidden = mode !== 'companion';
  $('pair-companion').hidden = mode !== 'connect';
  $('takeover-menu').hidden = !client?.companion || mode !== 'connect';
  if (mode === 'companion') {
    $('dialog-title').textContent = 'Connect phone + TV';
    $('dialog-description').textContent = 'Open Connect phone + TV on your iPhone and connect Yamaha. Choose the phone below. Compare and approve the six digits on both screens. No computer needed.';
    $('input-label').textContent = 'Phone address';
    $('dialog-input').value = 'http://'; $('dialog-input').placeholder = 'http://192.168.1.10:8095'; $('dialog-input').inputMode = 'url';
    $('submit-dialog').textContent = 'Pair'; $('pairing-code').textContent = '';
    void searchCompanions();
  }
  $('use-demo').hidden = mode !== 'connect';
  if (mode === 'exit') {
    $('dialog-title').textContent = 'Leave Frame Music?';
    $('dialog-description').textContent = 'Your Yamaha will keep its current playback. You can reopen Frame Music any time.';
  }
  if (mode === 'theme') {
    $('dialog-title').textContent = 'Appearance';
    $('dialog-description').textContent = 'Glass layers song titles over the artwork. Choose a surface and a theme.';
  }
  if (mode === 'help') {
    $('dialog-title').textContent = 'Help';
    $('dialog-description').textContent = 'Remote controls, playback and your connection.';
  }
  (mode === 'help' ? $('close-dialog') : mode === 'theme' ? $(`theme-${document.documentElement.dataset.theme}`) : mode === 'exit' ? $('cancel-exit') : $('dialog-input')).focus();
}

function closeDialog() {
  stopCompanionSearch(); pendingPair = undefined; ++pairingAttempt;
  client?.setActive?.(true);
  $('overlay').hidden = true;
  if (visibleControls().includes(priorFocus)) priorFocus.focus();
  else if (trackView) $('sources').focus();
  else ((sourceView ? $('source-list') : $('menu')).querySelector('button:not(:disabled)') || $('sources')).focus();
}

function savedMode() {
  try { return localStorage.getItem('mosaicast-mode'); } catch { return; }
}
function saveMode(mode) {
  try { localStorage.setItem('mosaicast-mode', mode); } catch { /* The current selection still works for this session. */ }
}

function savedHost() {
  let host;
  try { host = localStorage.getItem('yamaha-host'); } catch { /* Use the optional install preset. */ }
  return privateIPv4(host) ? host : bundledYamahaHost;
}

async function connect(host, demo = false, pairing) {
  const candidate = pairing ? new FrameCompanion(pairing) : new MusicCast(demo ? '10.0.0.1' : host, demo ? demoTransport() : transport);
  try {
  const device = await candidate.request('system/getDeviceInfo');
  const capabilities = await candidate.request('system/getFeatures');
  const available = sources(capabilities);
  if (!available.length) throw new Error('This Yamaha does not advertise any inputs on its main zone.');
  const status = await candidate.request('main/getStatus');
  const state = await playerState(candidate, capabilities, status);
  const initial = available.find(item => item.id === 'deezer' && item.browse);
  let menu, menuError;
  if (initial) { try { menu = await candidate.list(0, initial.id); } catch (error) { menuError = error.message; } }
  if (status.power === 'standby' && menu && !Number(menu.max_line)) menu = undefined;
  $('source-error').textContent = menuError ? `Deezer menu unavailable: ${menuError}` : '';
  stopCompanionWatch?.();
  client?.close?.();
  client = candidate; features = capabilities; isDemo = demo; prepared = false;
  if (!demo) saveMode(pairing ? 'companion' : 'direct');
  if (!demo && !pairing) { try { localStorage.setItem('yamaha-host', host); } catch { /* Connection still works without storage. */ } }
  $('device-name').textContent = demo ? 'Preview mode' : device.model_name || 'Yamaha';
  $('connection-badge').textContent = demo ? '' : 'YAMAHA CONNECTED';
  $('connection-badge').hidden = demo;
  $('demo-hint').textContent = demo ? 'Preview · example music' : 'MusicCast · local connection';
  browsingInput = initial?.id || available.find(item => item.browse)?.id; list = undefined;
  viewMemory.clear(); zoneMemory.clear(); menuParents.length = 0;
  renderPlayer(state.info, state.status); renderSound(status);
  if (menu) renderMenu(menu); else renderSources();
  if (pairing) stopCompanionWatch = candidate.watch(observed => {
    if (candidate !== client) return;
    if (observed.snapshot) {
      features = companionFeatures(observed.snapshot);
      renderPlayer(companionInfo(observed.snapshot), companionStatus(observed.snapshot)); renderSound(companionStatus(observed.snapshot));
    }
    const state = candidate.controller.state;
    const blocked = observed.stale || observed.needsRefresh;
    $('connection-badge').textContent = blocked ? 'REFRESH CONNECTION' : state?.activity ? 'YAMAHA BUSY' : 'COMPANION CONNECTED';
    if (blocked) {
      for (const button of $('tuner-controls').querySelectorAll('button')) button.disabled = true;
      tunerSignature = ''; // Re-enable only from a fresh observation after explicit recovery.
      for (const id of ['power-on', 'power-off', 'previous', 'toggle-play', 'next', 'volume-up', 'volume-down', 'mute']) $(id).disabled = true;
      message(companionRecoveryMessage, true);
    } else if ($('message').textContent === companionRecoveryMessage) message('');
  });
  closeDialog();
  (menu ? $('menu') : $('source-list')).querySelector('button:not(:disabled)')?.focus();
  } catch (error) { if (candidate !== client) candidate.close?.(); throw error; }
}

$('find-companions').onclick = () => { if (companionSearch) stopCompanionSearch(); else void searchCompanions(); };
$('pair-companion').onclick = () => openDialog('companion');
$('takeover-menu').onclick = () => action(async () => {
  if (!browsingInput) throw new Error('Choose a music source first.');
  const page = await client.list(0, browsingInput, true);
  closeDialog(); menuParents.length = 0; renderMenu(page, 0);
});
$('settings').onclick = () => openDialog('connect');
$('open-themes').onclick = () => openDialog('theme');
$('help').onclick = () => openDialog('help');
for (const topic of ['remote', 'playback', 'connection', 'artwork']) $(`help-${topic}`).onclick = () => {
  for (const value of ['remote', 'playback', 'connection', 'artwork']) {
    $(`help-section-${value}`).hidden = value !== topic;
    $(`help-${value}`).setAttribute('aria-pressed', String(value === topic));
  }
};
$('close-dialog').onclick = closeDialog;
$('cancel-exit').onclick = closeDialog;
$('confirm-exit').onclick = () => globalThis.tizen?.application?.getCurrentApplication().exit();
$('use-demo').onclick = () => action(async () => { await connect('', true); saveMode('demo'); });
$('dialog-form').onsubmit = event => {
  event.preventDefault();
  const value = $('dialog-input').value.trim();
  action(async () => {
    if (dialogMode === 'search') {
      if (!value) throw new Error('Enter something to search for.');
      const item = await ensurePrepared(searchEntry);
      rememberView();
      const parent = { layer: list.menu_layer, name: list.menu_name, index: Number(list.index || 0), selected: { index: item.index, text: item.text, attribute: item.attribute }, count: Number(list.max_line || 0) };
      await client.search(item.index, value);
      const results = await client.list(0, browsingInput);
      menuParents.push(parent); if (menuParents.length > 32) menuParents.shift();
      closeDialog(); renderMenu(results, 0);
    } else if (dialogMode === 'companion') {
      stopCompanionSearch();
      if (!pendingPair || pendingPair.url !== value) {
        // Stop standalone writes before granting the phone ownership.
        client?.setActive?.(false);
        if (client?.pending) throw new Error('Wait for the current Yamaha operation to finish.');
        const attempt = ++pairingAttempt;
        const pending = await pairFrame(value);
        if (attempt !== pairingAttempt || $('overlay').hidden) return;
        pendingPair = { ...pending, url: value };
        $('pairing-code').textContent = pending.comparison;
        $('dialog-description').textContent = 'Approve this same six-digit code on your iPhone, then choose The codes match here. If they differ, close and pair again.';
        $('submit-dialog').textContent = 'The codes match';
        return;
      }
      const attempt = pairingAttempt;
      const pairing = await pendingPair.confirm();
      if (attempt !== pairingAttempt || $('overlay').hidden) return;
      await connect(pairing.receiver, false, pairing);
    } else await connect(value);
  });
};
$('back').onclick = back;
$('home').onclick = () => action(async () => {
  if (!browsingInput) { renderSources(true); return; }
  // Lists are shared with the MusicCast app, so always observe the current layer.
  let data = await client.list(0, browsingInput);
  for (let i = 0; Number(data.menu_layer) > 0 && i < 32; i++) { await client.control('return'); data = await client.list(0, browsingInput); }
  menuParents.length = 0; renderMenu(data, null);
});
for (const id of ['now-playing', 'open-track']) $(id).onclick = () => {
  ++viewEpoch; renderTrack();
  if (!busy && !client.companion) void action(() => refreshPlayer());
};
$('lyrics-up').onclick = () => { $('lyrics').scrollTop -= $('lyrics').clientHeight * .8; };
$('lyrics-down').onclick = () => { $('lyrics').scrollTop += $('lyrics').clientHeight * .8; };
$('sources').onclick = () => { ++viewEpoch; renderSources(true); };
$('browse-sources').onclick = $('sources').onclick;
$('refresh').onclick = () => action(async () => {
  if (client?.companion) await client.reconcile();
  if (trackView) { await refreshPlayer(); return; }
  if (sourceView) { features = await client.request('system/getFeatures'); await refreshPlayer(); renderSources(); return; }
  renderMenu(await client.list(Number(list.index || 0), browsingInput), null); });
$('page-prev').onclick = () => action(() => pageMenu(-1));
$('page-next').onclick = () => action(() => pageMenu(1));

function playback(command) {
  return action(async () => {
    const status = await client.request('main/getStatus');
    if (status.power === 'standby' || !sources(features).some(item => item.id === status.input && item.type === 'netusb')) {
      const state = await playerState(client, features, status); renderPlayer(state.info, state.status); renderSound(status);
      throw new Error('Use MusicCast or the Yamaha remote for this source’s playback controls.');
    }
    await client.request('netusb/setPlayback', { playback: command }); await refreshPlayer();
  });
}
function power(target) {
  return action(async () => {
    prepared = false;
    const status = await client.power(target);
    const state = await playerState(client, features, status);
    renderPlayer(state.info, state.status); renderSound(status);
    if (sourceView) renderSources();
    ($(target === 'on' ? 'power-off' : 'power-on').disabled ? $('sources') : $(target === 'on' ? 'power-off' : 'power-on')).focus();
  });
}
$('power-on').onclick = () => power('on');
$('power-off').onclick = () => power('standby');
$('previous').onclick = () => playback('previous');
$('toggle-play').onclick = () => playback('play_pause');
$('next').onclick = () => playback('next');
$('volume-down').onclick = () => sound('down');
$('volume-up').onclick = () => sound('up');
$('mute').onclick = () => sound('mute');

function visibleControls() {
  const scope = $('overlay').hidden ? document : $('overlay');
  return [...scope.querySelectorAll('button:not(:disabled),input')].filter(el => el.getClientRects().length);
}

function viewKey() {
  return trackView ? 'track' : sourceView || !list ? 'sources' : JSON.stringify([browsingInput, list.menu_layer, list.menu_name, list.index, list.list_info]);
}

function contentRoot() { return $(trackView ? 'track-panel' : sourceView ? 'source-list' : 'menu'); }

function rememberView() {
  const key = viewKey(), saved = viewMemory.get(key) || {};
  const focused = document.activeElement;
  if (contentRoot().contains(focused)) saved.focusKey = focused.dataset.focusKey || focused.id;
  saved.scroll = $('main-content').scrollTop || 0;
  viewMemory.delete(key); viewMemory.set(key, saved);
  if (viewMemory.size > 40) viewMemory.delete(viewMemory.keys().next().value);
}

function focusControl(control, scroll = true) {
  if (!control) return;
  control.focus({ preventScroll: true });
  if (scroll) control.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function restoreView(index = null) {
  const controls = visibleControls().filter(el => contentRoot().contains(el));
  const saved = { ...viewMemory.get(viewKey()) };
  const target = (index === null ? controls.find(el => (el.dataset.focusKey || el.id) === saved?.focusKey) : controls.find(el => String(el.dataset.index) === String(index))) || controls[0] || $('sources');
  focusControl(target, false);
  $('main-content').scrollTop = index === null ? saved?.scroll || 0 : 0;
  // Keep a fallback visible when items disappeared or became disabled.
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  rememberView();
}

function zoneFor(control) {
  if (!$('overlay').hidden) return 'dialog';
  if (contentRoot().contains(control)) return 'content';
  for (const id of ['navigation', 'appearance', 'power-controls', 'toolbar', 'player']) if ($(id).contains(control)) return id;
  if (control === $('back')) return 'back';
}

function updatePreview(control) {
  $('preview-title').textContent = control?.dataset.title || 'No items available';
  $('preview-icon').textContent = icons[control?.dataset.title] || '♫';
}

document.addEventListener('focusin', event => {
  const zone = zoneFor(event.target);
  if (zone === 'content') { rememberView(); if (!sourceView && !trackView) updatePreview(event.target); }
  if (zone && zone !== 'dialog') zoneMemory.set(zone, event.target);
});

function focusZone(zone, last = false) {
  if (zone === 'content') {
    if (visibleControls().some(el => contentRoot().contains(el))) restoreView();
    else focusZone('toolbar');
    return;
  }
  const controls = visibleControls().filter(el => zoneFor(el) === zone);
  const saved = zoneMemory.get(zone);
  focusControl(controls.includes(saved) ? saved : zone === 'player' && controls.includes($('toggle-play')) ? $('toggle-play') : controls[last ? controls.length - 1 : 0]);
}

function moveFocus(dx, dy) {
  const controls = visibleControls(), current = document.activeElement;
  if (!controls.includes(current)) { if ($('overlay').hidden) restoreView(); else focusControl(controls[0]); return; }
  const zone = zoneFor(current);
  const topNavigation = document.documentElement.dataset.navigation === 'top';
  const members = controls.filter(el => zoneFor(el) === zone);
  if (zone !== 'content' && zone !== 'dialog') {
    // Lists and button bars have a fixed order, independent of nearby controls.
    const step = zone === 'navigation' && !topNavigation ? dy : dx;
    const next = members[members.indexOf(current) + step];
    if (step && next) { focusControl(next); return; }
  } else {
    const box = current.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    const candidates = members.filter(el => el !== current).map(el => {
      const b = el.getBoundingClientRect(), vx = b.x + b.width / 2 - x, vy = b.y + b.height / 2 - y;
      const sameRow = b.top < box.bottom - 2 && b.bottom > box.top + 2;
      return { el, along: vx * dx + vy * dy, across: Math.abs(vx * dy - vy * dx), sameRow };
    }).filter(v => v.along > 5 && (dx ? v.sameRow : !v.sameRow)).sort((a, b) => (a.along + a.across * 3) - (b.along + b.across * 3));
    if (candidates[0]) { focusControl(candidates[0].el); return; }
  }
  if (zone === 'dialog') return;
  if (zone === 'navigation') {
    if (topNavigation) { if (dy > 0) focusZone('content'); return; }
    if (dx > 0) focusZone('content');
    else if (dy > 0) { playerOrigin = 'navigation'; focusZone('player'); }
    else if (dy < 0) focusZone('appearance');
    return;
  }
  if (zone === 'player') { if (dy < 0) focusZone(playerOrigin); return; }
  if (dx < 0) { if (!topNavigation) focusZone('navigation'); return; }
  if (!dy) return;
  const order = [...(topNavigation ? ['navigation'] : []), 'appearance', 'back', 'power-controls', 'toolbar', 'content'];
  const available = order.filter(name => controls.some(el => zoneFor(el) === name));
  const next = available[available.indexOf(zone) + dy];
  if (next) focusZone(next, dy < 0);
  else if (dy > 0) { playerOrigin = zone; rememberView(); focusZone('player'); }
}

document.addEventListener('keydown', event => {
  const code = event.keyCode;
  if (document.visibilityState !== 'visible') { heldArrow = undefined; return; }
  if (![37, 38, 39, 40].includes(code)) heldArrow = undefined;
  const trackCommand = { 427: 'next', 428: 'previous' }[code];
  if (trackCommand) {
    if (document.visibilityState !== 'visible') return;
    // Keep the channel rocker in the app; a held key skips only one song.
    event.preventDefault();
    if (!event.repeat) playback(trackCommand);
    return;
  }
  const volumeCommand = { 447: 'up', 448: 'down', 449: 'mute' }[code];
  if (volumeCommand) {
    if (document.visibilityState !== 'visible') return;
    // Consume these keys even during dialogs or pending work, so they do not
    // change TV-speaker volume or accumulate delayed Yamaha commands.
    event.preventDefault();
    if (volumeCommand !== 'mute' || !event.repeat) sound(volumeCommand);
    return;
  }
  if (event.key === 'Escape' || code === 10009) { event.preventDefault(); if (!event.repeat) back(); return; }
  if (!$('overlay').hidden && event.key === 'Tab') {
    const controls = visibleControls(), current = controls.indexOf(document.activeElement);
    const next = current < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    event.preventDefault(); controls[next]?.focus(); return;
  }
  if (!$('overlay').hidden && !visibleControls().includes(document.activeElement)) {
    event.preventDefault(); (dialogMode === 'help' ? $('close-dialog') : dialogMode === 'theme' ? $(`theme-${document.documentElement.dataset.theme}`) : dialogMode === 'exit' ? $('cancel-exit') : $('dialog-input')).focus(); return;
  }
  if ([37, 38, 39, 40].includes(code)) {
    if (document.activeElement.tagName === 'INPUT' && (code === 37 || code === 39)) return;
    event.preventDefault();
    const now = event.timeStamp || Date.now();
    if (!event.repeat) {
      heldArrow = undefined;
      const horizontal = code === 37 || code === 39;
      if (!busy && $('overlay').hidden && !sourceView && !trackView && list && zoneFor(document.activeElement) === 'content' && (horizontal || isArtistFolder(list.menu_name) || artistParent())) {
        heldArrow = { code, start: now, view: viewKey(), horizontal, selected: isArtistFolder(list.menu_name) ? entries(list).find(item => String(item.index) === String(document.activeElement.dataset.index)) : undefined };
      }
    } else if (heldArrow?.code === code) {
      if (heldArrow.fired) return;
      if (viewKey() !== heldArrow.view || !$('overlay').hidden) { heldArrow = undefined; return; }
      if (now - heldArrow.start >= 550) {
        heldArrow.fired = true;
        const direction = code === 37 || code === 38 ? -1 : 1;
        const { horizontal, selected } = heldArrow;
        action(() => horizontal ? pageMenu(direction) : adjacentArtist(direction, selected));
      }
      return;
    }
    if (event.repeat && code === lastArrow && now - lastArrowTime < 110) return;
    lastArrow = code; lastArrowTime = now;
    moveFocus(code === 37 ? -1 : code === 39 ? 1 : 0, code === 38 ? -1 : code === 40 ? 1 : 0); return;
  }
  if (code === 13 && document.activeElement.tagName === 'BUTTON') { event.preventDefault(); if (!event.repeat) document.activeElement.click(); return; }
  if (!$('overlay').hidden) return;
  if (code === 415) {
    event.preventDefault();
    const item = !sourceView && !trackView && entries(list || {}).find(v => String(v.index) === document.activeElement.dataset.index);
    if (item?.play) action(() => activate(item, 'play')); else playback('play');
  } else if (code === 10252 || (event.key === ' ' && !['INPUT', 'BUTTON'].includes(document.activeElement.tagName))) { event.preventDefault(); playback('play_pause'); }
  else if ({ 19: 'pause', 413: 'stop', 10232: 'previous', 10233: 'next' }[code]) { event.preventDefault(); playback({ 19: 'pause', 413: 'stop', 10232: 'previous', 10233: 'next' }[code]); }
});

document.addEventListener('keyup', event => { if (heldArrow?.code === event.keyCode) heldArrow = undefined; });
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') stopCompanionSearch(); heldArrow = undefined; client?.setActive?.(document.visibilityState === 'visible'); });

if (globalThis.tizen?.tvinputdevice) {
  try { tizen.tvinputdevice.registerKeyBatch(['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaTrackPrevious', 'MediaTrackNext']); }
  catch { message('Use the onscreen buttons for playback controls.'); }
  for (const key of ['ChannelUp', 'ChannelDown']) {
    try { tizen.tvinputdevice.registerKey(key); }
    catch { $('remote-track-hint').textContent = 'Tracks · use onscreen previous / next'; }
  }
  for (const key of ['VolumeUp', 'VolumeDown', 'VolumeMute']) {
    try { tizen.tvinputdevice.registerKey(key); }
    catch { $('remote-volume-hint').textContent = 'Yamaha volume · use onscreen controls'; }
  }
}

setInterval(() => {
  if (client && !client.companion && !busy && !client.pending && document.visibilityState === 'visible' && $('overlay').hidden) {
    const current = client;
    playerState(current).then(({info, status}) => {
      if (client === current) { renderPlayer(info, status); renderSound(status); }
    }).catch(error => { if (client === current && !busy) message(error.message, true); });
  }
}, 10000);

const initialMode = savedMode();
const initialPairing = initialMode === 'companion' ? savedCompanion() : undefined;
const initialHost = initialMode === 'demo' ? '' : initialMode === 'companion' ? initialPairing?.receiver : savedHost();
await action(async () => {
  if (!initialHost) { await connect('', true); return; }
  try { await connect(initialHost, false, initialPairing); }
  catch (error) {
    // Keep controls usable and retain the saved address for Retry or correction.
    await connect('', true);
    throw error;
  }
});
if ((initialHost || initialMode === 'companion') && isDemo) {
  const error = $('message').textContent;
  openDialog('connect');
  $('dialog-error').textContent = initialMode === 'companion' ? 'Phone + TV connection unavailable. Check Wi-Fi and pairing. Standalone mode requires an explicit connection.' : `Could not reconnect to Yamaha. ${error}`;
}
