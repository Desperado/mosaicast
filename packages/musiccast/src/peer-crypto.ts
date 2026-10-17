import { x25519 } from '@noble/curves/ed25519';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { sha256 } from '@noble/hashes/sha256';
import { hkdf } from '@noble/hashes/hkdf';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

export type PeerRandom = (length: number) => Uint8Array;
export interface PeerRecord { id: string; key: string; receiver: string; url: string }
export interface PeerPacket { id: string; epoch: string; counter: number; nonce: string; box: string }
const hex = (value: unknown, length: number): value is string => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length * 2}}$`).test(value);
export function peerRandomHex(random: PeerRandom, length = 32) { return bytesToHex(random(length)); }
export function peerCommit(publicKey: string, nonce: string) {
  if (!hex(publicKey, 32) || !hex(nonce, 32)) throw new Error('Invalid pairing');
  return bytesToHex(sha256(utf8ToBytes(`mosaicast-peer-commit-v1:${publicKey}:${nonce}`)));
}
export function peerKeyPair(random: PeerRandom) {
  const secret = random(32);
  return { secret, publicKey: bytesToHex(x25519.getPublicKey(secret)), nonce: peerRandomHex(random) };
}
export function peerSharedKey(secret: Uint8Array, otherPublic: string, transcript: string): string {
  if (!hex(otherPublic, 32)) throw new Error('Invalid pairing');
  const shared = x25519.getSharedSecret(secret, hexToBytes(otherPublic));
  try { return bytesToHex(hkdf(sha256, shared, sha256(utf8ToBytes(transcript)), 'mosaicast-peer-root-v1', 32)); }
  finally { shared.fill(0); }
}
export function peerSAS(key: string): string {
  if (!hex(key, 32)) throw new Error('Invalid pairing');
  const bytes = hkdf(sha256, hexToBytes(key), undefined, 'mosaicast-peer-compare-v1', 4);
  return String(new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0) % 1000000).padStart(6, '0');
}
export function peerTranscript(id: string, receiver: string, hostPublic: string, hostNonce: string, clientPublic: string, clientNonce: string) {
  return JSON.stringify(['mosaicast-peer-v1', id, receiver, hostPublic, hostNonce, clientPublic, clientNonce]);
}
function aad(direction: 'request' | 'response', packet: Pick<PeerPacket, 'id' | 'epoch' | 'counter'>) {
  return utf8ToBytes(JSON.stringify(['mosaicast-peer-v1', direction, packet.id, packet.epoch, packet.counter]));
}
export function sealPeer(key: string, meta: Pick<PeerPacket, 'id' | 'epoch' | 'counter'>, value: unknown, random: PeerRandom, direction: 'request' | 'response'): PeerPacket {
  if (!hex(key, 32)) throw new Error('Invalid peer');
  const nonce = random(24);
  const box = xchacha20poly1305(hexToBytes(key), nonce, aad(direction, meta)).encrypt(utf8ToBytes(JSON.stringify(value)));
  return { ...meta, nonce: bytesToHex(nonce), box: bytesToHex(box) };
}
export function openPeer(key: string, packet: PeerPacket, direction: 'request' | 'response'): unknown {
  if (!hex(key, 32) || !packet || !hex(packet.id, 16) || !hex(packet.epoch, 16) || !Number.isSafeInteger(packet.counter) || packet.counter < 1 || !hex(packet.nonce, 24) || typeof packet.box !== 'string' || packet.box.length > 524288 || !/^[a-f0-9]{32,}$/.test(packet.box) || packet.box.length % 2) throw new Error('Invalid peer packet');
  return JSON.parse(new TextDecoder().decode(xchacha20poly1305(hexToBytes(key), hexToBytes(packet.nonce), aad(direction, packet)).decrypt(hexToBytes(packet.box))));
}
