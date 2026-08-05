/**
 * The sealed envelope the server is allowed to hold.
 *
 * The whole design rests on one property: the server stores a blob it cannot
 * read, and neither can the operator. Everything here exists to make that
 * property true and hard to break by accident.
 *
 * XChaCha20-Poly1305 from @noble/ciphers. Deliberately pure JavaScript — a
 * native crypto module would need a `.web.ts` split, and this runs identically
 * on native and web. Authenticated encryption, so a tampered blob fails to open
 * rather than decrypting to garbage.
 *
 * `open` returns null rather than throwing. A wrong recovery phrase is a normal
 * thing for a person to do, not an exceptional one, and a screen should be able
 * to say so without a try/catch around every call.
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes, utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';

export const KEY_BYTES = 32;
export const NONCE_BYTES = 24;

export type Sealed = { ciphertext: Uint8Array; nonce: Uint8Array };

export function generateKey(): Uint8Array {
  return randomBytes(KEY_BYTES);
}

/**
 * Seals a payload. A fresh nonce every time — reusing one with the same key
 * is the classic way to destroy a stream cipher's security, so it is generated
 * here rather than accepted from the caller.
 */
export function seal(key: Uint8Array, plaintext: string): Sealed {
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(utf8ToBytes(plaintext));
  return { ciphertext, nonce };
}

/** Opens a sealed payload, or null if the key is wrong or the blob was touched. */
export function open(key: Uint8Array, sealed: Sealed): string | null {
  try {
    if (!(key instanceof Uint8Array) || key.length !== KEY_BYTES) return null;
    if (!sealed?.nonce || sealed.nonce.length !== NONCE_BYTES) return null;
    return bytesToUtf8(xchacha20poly1305(key, sealed.nonce).decrypt(sealed.ciphertext));
  } catch {
    return null;
  }
}

// --- The recovery phrase ---------------------------------------------------

/**
 * The key as words. This is the only copy that leaves the keychain, and it is
 * also how a second device joins — recovery and pairing are the same act.
 *
 * Base32 (RFC 4648 alphabet minus the ambiguous letters) in groups of four,
 * plus a checksum group, so a typo is caught before it becomes "your data is
 * gone". Digits 0/1 and letters I/O/L/U are excluded: they are what people
 * actually mistype when copying by hand.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const GROUP = 4;

/**
 * ceil(256 / log2(30)) = 53. Not 52 — that was the first version, and it fits
 * only 55.8% of possible keys, so nearly half of all recovery phrases would
 * have been rejected on the device they were meant to rescue. The self-check
 * that round-trips many random keys is there to keep this honest.
 */
const BODY_CHARS = 53;
const CHECK_CHARS = 3;
const PHRASE_CHARS = BODY_CHARS + CHECK_CHARS;

/**
 * Three characters of a hash over the key — 27,000 possibilities, so a
 * mistyped phrase slips through about once in 27,000 rather than once in 900.
 * The extra character is free; a wrongly accepted phrase is not, because it
 * hands back a *different valid key* and the person reads that as lost data.
 *
 * The first attempt here was hand-rolled: `sum = (sum * 31 + b) % 30`. The
 * multiplier is congruent to 1 modulo 30, so it collapsed into a plain sum of
 * bytes and became blind to position. Half of all single-character typos got
 * through, each one silently yielding a *different valid-looking key* — the
 * worst possible failure, because it reads as "my data is gone" rather than
 * "you typed it wrong". A hash is the right tool; inventing one was not.
 */
function checksumChars(bytes: Uint8Array): string {
  const h = sha256(bytes);
  let n = (h[0] << 16) | (h[1] << 8) | h[2];
  let out = '';
  for (let i = 0; i < CHECK_CHARS; i++) {
    out = ALPHABET[n % ALPHABET.length] + out;
    n = Math.floor(n / ALPHABET.length);
  }
  return out;
}

export function toRecoveryPhrase(key: Uint8Array): string {
  if (!(key instanceof Uint8Array) || key.length !== KEY_BYTES) {
    throw new Error('A recovery phrase needs a full-length key.');
  }
  let out = '';
  // Base-N over the whole key, so every bit is carried.
  let n = 0n;
  for (const b of key) n = (n << 8n) | BigInt(b);
  const base = BigInt(ALPHABET.length);
  while (n > 0n) {
    out = ALPHABET[Number(n % base)] + out;
    n /= base;
  }
  out = out.padStart(BODY_CHARS, ALPHABET[0]);
  out += checksumChars(key);

  return (out.match(new RegExp(`.{1,${GROUP}}`, 'g')) ?? []).join(' ');
}

export function fromRecoveryPhrase(phrase: unknown): Uint8Array | null {
  if (typeof phrase !== 'string') return null;
  // People paste with line breaks, dashes and mixed case. None of that is an
  // error worth refusing over.
  const cleaned = phrase.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== PHRASE_CHARS) return null;

  const body = cleaned.slice(0, BODY_CHARS);
  const given = cleaned.slice(BODY_CHARS);

  let n = 0n;
  const base = BigInt(ALPHABET.length);
  for (const ch of body) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) return null;
    n = n * base + BigInt(i);
  }

  const key = new Uint8Array(KEY_BYTES);
  for (let i = KEY_BYTES - 1; i >= 0; i--) {
    key[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  // Anything left over means the phrase encodes a number too large for 32
  // bytes — a corrupted phrase, not a key.
  if (n !== 0n) return null;
  if (checksumChars(key) !== given) return null;

  return key;
}

// ---------------------------------------------------------------------------

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  const key = generateKey();
  assert(key.length === KEY_BYTES, 'a key is 32 bytes');
  assert(!generateKey().every((b, i) => b === key[i]), 'two keys differ');

  // --- sealing -------------------------------------------------------------

  const payload = JSON.stringify({ weight_kg: 82, log: ['2026-08-01', '2026-08-02'] });
  const sealed = seal(key, payload);
  assert(open(key, sealed) === payload, 'a sealed payload opens again');
  assert(sealed.nonce.length === NONCE_BYTES, 'the nonce is the right size');

  // The property the whole design rests on: the blob is not the payload.
  const asText = bytesToUtf8Safe(sealed.ciphertext);
  assert(!asText.includes('weight_kg'), 'the ciphertext does not contain the field names');
  assert(!asText.includes('2026-08-01'), 'nor the values');

  // A fresh nonce every time, or the cipher is broken.
  const nonces = new Set<string>();
  for (let i = 0; i < 200; i++) nonces.add(seal(key, payload).nonce.join(','));
  assert(nonces.size === 200, 'every seal uses a new nonce');

  // --- opening: every way it can fail --------------------------------------

  assert(open(generateKey(), sealed) === null, 'a wrong key returns null, it does not throw');

  const tampered = { ...sealed, ciphertext: Uint8Array.from(sealed.ciphertext) };
  tampered.ciphertext[3] ^= 0x01;
  assert(open(key, tampered) === null, 'a single flipped bit is detected');

  const shortNonce = { ...sealed, nonce: sealed.nonce.slice(0, 8) };
  assert(open(key, shortNonce) === null, 'a truncated nonce is refused');
  assert(open(key.slice(0, 8), sealed) === null, 'a short key is refused');
  assert(open(key, { ciphertext: new Uint8Array(0), nonce: sealed.nonce }) === null, 'an empty blob is refused');
  assert(open(key, null as any) === null, 'a missing envelope does not throw');

  // Empty and large payloads both survive.
  assert(open(key, seal(key, '')) === '', 'an empty payload round-trips');
  const big = JSON.stringify({ log: Array.from({ length: 5000 }, (_, i) => `2026-01-${i}`) });
  assert(open(key, seal(key, big)) === big, 'a large payload round-trips');
  assert(open(key, seal(key, 'Grüße, 🥔')) === 'Grüße, 🥔', 'non-ASCII survives');

  // --- the recovery phrase -------------------------------------------------

  const phrase = toRecoveryPhrase(key);
  const back = fromRecoveryPhrase(phrase);
  assert(back !== null, 'a phrase converts back');
  assert(back!.every((b, i) => b === key[i]), 'and to exactly the same key');
  assert(open(back!, sealed) === payload, 'the recovered key opens the blob');

  // Every key must survive the trip, not merely most of them. The first
  // version of this encoding fitted 55.8% of the key space and silently
  // rejected the rest — on the device the phrase existed to rescue.
  for (let i = 0; i < 400; i++) {
    const k = generateKey();
    const round = fromRecoveryPhrase(toRecoveryPhrase(k));
    assert(round !== null && round.every((b, j) => b === k[j]), 'every random key round-trips');
  }

  // How people actually type it.
  assert(fromRecoveryPhrase(phrase.toLowerCase())!.every((b, i) => b === key[i]), 'case does not matter');
  assert(fromRecoveryPhrase(phrase.replace(/ /g, '-'))!.every((b, i) => b === key[i]), 'dashes are tolerated');
  assert(fromRecoveryPhrase(`  ${phrase}\n`)!.every((b, i) => b === key[i]), 'stray whitespace is tolerated');

  // The checksum earns its place: a mistyped character must not silently
  // produce a different key, because that reads as "my data is gone".
  const chars = phrase.replace(/ /g, '');
  let caught = 0;
  for (let i = 0; i < chars.length - 1; i++) {
    const wrong = ALPHABET[(ALPHABET.indexOf(chars[i]) + 1) % ALPHABET.length];
    const typo = chars.slice(0, i) + wrong + chars.slice(i + 1);
    if (fromRecoveryPhrase(typo) === null) caught++;
  }
  assert(caught === chars.length - 1, `single-character typos are caught (${caught}/${chars.length - 1})`);

  // Across many phrases, not just one: a weak checksum passes a single sample
  // and fails in aggregate, which is exactly how the first version slipped by.
  let slipped = 0, tried = 0;
  for (let t = 0; t < 40; t++) {
    const k = generateKey();
    const cs = toRecoveryPhrase(k).replace(/ /g, '');
    for (let i = 0; i < cs.length; i++) {
      const wrong = ALPHABET[(ALPHABET.indexOf(cs[i]) + 1 + t) % ALPHABET.length];
      if (wrong === cs[i]) continue;
      tried++;
      if (fromRecoveryPhrase(cs.slice(0, i) + wrong + cs.slice(i + 1)) !== null) slipped++;
    }
  }
  const rate = slipped / tried;
  assert(rate < 0.001, `typos slip through far below 1 in 1000 (${slipped}/${tried} = ${(rate * 100).toFixed(3)}%)`);

  assert(fromRecoveryPhrase('') === null, 'an empty phrase is not a key');
  assert(fromRecoveryPhrase(null) === null, 'null is not a phrase');
  assert(fromRecoveryPhrase(phrase.slice(0, 20)) === null, 'a truncated phrase is refused');
  assert(fromRecoveryPhrase(phrase + 'AAAA') === null, 'an overlong phrase is refused');

  // A key of all zeroes and one of all 0xff both survive the encoding, which
  // is where a padding bug would show up.
  for (const fill of [0x00, 0xff]) {
    const edge = new Uint8Array(KEY_BYTES).fill(fill);
    const round = fromRecoveryPhrase(toRecoveryPhrase(edge));
    assert(round !== null && round.every((b) => b === fill), `a key of all 0x${fill.toString(16)} round-trips`);
  }

  return 'crypto.ts: all checks passed';
}

/** Bytes as text for inspection only — never for decoding. */
function bytesToUtf8Safe(b: Uint8Array): string {
  return Array.from(b, (x) => String.fromCharCode(x)).join('');
}
