import test from 'node:test';
import assert from 'node:assert/strict';
import { artistScene, sceneMatchesTrack } from '../app/artist-scene.js';

test('artist folders identify artists without needing playback or external lookups', () => {
  const muse = artistScene(['Deezer', 'My library', 'Artists', 'Muse']);
  assert.deepEqual(muse, { artist: 'Muse', album: '', tone: 'cosmic' });
  assert.equal(artistScene(['Artists']), null);
  assert.equal(artistScene(['Deezer', 'Charts']), null);
  assert.equal(artistScene(['My artists', 'Portishead']).artist, 'Portishead');
  assert.deepEqual(artistScene(['Artists', 'Portishead']), artistScene(['Artists', 'Portishead']));
  assert.notEqual(artistScene(['Artists', 'Portishead']).tone, 'cosmic');
});

test('matching metadata recognizes an album page reopened without menu ancestry', () => {
  const info = { artist: 'Muse', album: 'Black Holes and Revelations' };
  const scene = artistScene(['Black Holes and Revelations'], info);
  assert.equal(scene.artist, 'Muse');
  assert.equal(scene.album, info.album);
  assert.equal(sceneMatchesTrack(scene, info), true);
  assert.equal(artistScene(['Charts'], info), null);
  assert.equal(artistScene(['Black Holes and Revelations'], {}), null);
});

test('artist art requires matching artist and album instead of borrowing a playing cover', () => {
  const info = { artist: 'Muse', album: 'Black Holes and Revelations' };
  assert.equal(sceneMatchesTrack(artistScene(['Artists', 'Muse']), info), true);
  assert.equal(sceneMatchesTrack(artistScene(['Artists', 'Portishead']), info), false);
  const otherAlbum = artistScene(['Artists', 'Muse', 'Albums', 'Origin of Symmetry'], info);
  assert.equal(otherAlbum.album, 'Origin of Symmetry');
  assert.equal(sceneMatchesTrack(otherAlbum, info), false);
  assert.equal(sceneMatchesTrack(null, info), false);
  assert.equal(sceneMatchesTrack(artistScene([' MUSE ']), { artist: 'muse' }), true);
});
