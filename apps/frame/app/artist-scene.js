const sceneText = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

export const isArtistFolder = name => ['artists', 'artist', 'my artists', 'favourite artists', 'favorite artists'].includes(sceneText(name));

// Yamaha lists contain names, not artist IDs or artist photographs. Use explicit
// artist folders or matching playback metadata; never borrow an unrelated cover.
export function artistScene(path, info = {}) {
  const names = path.filter(value => typeof value === 'string' && value.trim());
  const normalized = names.map(sceneText);
  const artistFolder = names.findIndex(isArtistFolder);
  const playingArtist = sceneText(info.artist), playingAlbum = sceneText(info.album);
  let artist = artistFolder >= 0 ? names[artistFolder + 1] : '';
  if (!artist && normalized.includes('muse')) artist = 'Muse';
  if (!artist && playingArtist && normalized.some(name => name === playingArtist || (playingAlbum && name === playingAlbum))) artist = info.artist;
  if (!artist) return null;
  const key = sceneText(artist);
  const artistIndex = normalized.indexOf(key), leaf = names[names.length - 1];
  const collection = ['albums', 'top tracks', 'tracks', 'songs', 'discography', 'singles', 'eps'];
  const album = key === playingArtist && playingAlbum && normalized.includes(playingAlbum) ? info.album :
    artistIndex >= 0 && artistIndex < names.length - 1 && !collection.includes(sceneText(leaf)) ? leaf : '';
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return { artist, album, tone: key === 'muse' ? 'cosmic' : ['violet', 'ocean', 'ember', 'forest', 'rose'][hash % 5] };
}

export function sceneMatchesTrack(scene, info) {
  return Boolean(scene && sceneText(scene.artist) === sceneText(info.artist) &&
    (!scene.album || sceneText(scene.album) === sceneText(info.album)));
}
