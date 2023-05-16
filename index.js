import { schnorr } from '@noble/curves/secp256k1'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

/**
 * @typedef {0|1} bit
 * @typedef {string} hexstring
 * @typedef {{age: number, sex: number, location: string}} ASL
 */

const GHM = '0123456789bcdefghjkmnpqrstuvwxyz' // (geohash-specific) Base32 map
const GHU = GHM.split('').reduce((h, l, i) => { h[l] = i; return h }, {})

export const SANE_DEFAULT = 15 // Somewhat sane

/**
 * Rolls keypairs until a matching public-key is found
 * @param {0|1|2|3} age values: 0: 16+, 1: 24+; 2: 32+; 3: 40+
 * @param {0|1|2|3} sex values: 0: Female, 1: Male, 2: Nonbinary, 3: Bot
 * @param {string} location a geohash
 * @param {number} [geobits] geohash bit-size; default: 15
 * @param {number} [maxTries] maximum number of rolls before giving up.
 * @returns {Uint8Array?} secret key if found within maxTries, null otherwise
 */
export function roll (age, sex, location, geobits = SANE_DEFAULT, maxTries = 500000) {
  const nbits = geobits + 4
  const buf = new Uint8Array(roundByte(nbits))
  const prefix = packGeo(location, geobits, buf)
  shift(prefix, sex & 0b10)
  shift(prefix, sex & 1)
  shift(prefix, age & 0b10)
  shift(prefix, age & 1)
  const mask = nbits % 8
    ? (1 << (nbits % 8)) - 1
    : 0xff
  console.info('Searching for', nbits, binstr(prefix), 'mask', mask.toString(2))
  // const max = 500000 // ~10second on my laptop
  const nBytes = prefix.length
  for (let i = 0; i < maxTries; i++) {
    const sk = schnorr.utils.randomPrivateKey()
    const pk = schnorr.getPublicKey(sk)
    let v = true
    for (let n = 0; v && n < nBytes; n++) {
      v = (n + 1 === nBytes)
        ? (pk[n] & mask) === (prefix[n] & mask)
        : v = pk[n] === prefix[n]
    }
    if (v) {
      console.log('PFX', binstr(prefix))
      console.log('KEY', binstr(pk))
      console.log('key found', bytesToHex(sk))
      return bytesToHex(sk)
    }
  }
}

/**
 * Holistically decodes ASL from a public key
 * @param {Uint8Array|hexstring} publicKey
 * @param {number} geobits geohash bit-size; default: 15
 * @returns {ASL}
 */
export function decodeASL (publicKey, geobits = SANE_DEFAULT) {
  if (typeof publicKey === 'string') publicKey = hexToBytes(publicKey)
  const age = unshift(publicKey) | unshift(publicKey) << 1
  const sex = unshift(publicKey) | unshift(publicKey) << 1
  const location = unpackGeo(publicKey, geobits)
  return { age, sex, location }
}

/**
 * Unpacks bitarray back into base32 string
 * @param {Uint8Array|Buffer|array} buf a byte array
 * @param {number} nBits number of bits to unpack
 * @returns {string} A geohash
 */
export function unpackGeo (buf, nBits = SANE_DEFAULT) {
  const nBytes = roundByte(nBits)
  if (buf.length < nBytes) throw new Error('BufferUnderflow, dst buffer too small')
  const cpy = []
  for (let i = 0; i < nBytes; i++) cpy[i] = buf[i]
  let str = ''
  let tmp = 0
  for (let n = 0; n < nBits; n++) {
    const bit = unshift(cpy)
    tmp = tmp | bit << (4 - (n % 5))
    if (n && !(n % 5)) {
      str += GHM.charAt(tmp)
      tmp = 0
    }
  }
  str += GHM.charAt(tmp)
  return str
}

/**
 * Bitpacks a geohash string containing quintets to arbitrary bit-precision
 *  'u120fw' <-- contains 30bits accurate to ~1.2 Kilometers
 *  References:
 *  Format specification:  https://en.m.wikipedia.org/wiki/Geohash
 *  Bitdepthchart: https://www.ibm.com/docs/en/streams/4.3.0?topic=334-geoh
ashes
 * @param {string} str A geohash string.
 * @param {number?} [nBits] precision in bits; default 12
 * @param {Uint8Array|Buffer|Array} destination buffer
 * @returns {Uint8Array} buffer containing binary geohash
 */
export function packGeo (str, nBits = SANE_DEFAULT, buf = undefined) {
  if (!nBits) nBits = Math.min(str.length * 5, 12)
  if (nBits < 5) throw new Error('precision has to be at least 5')
  const nBytes = roundByte(nBits)
  if (!buf) buf = new Uint8Array(nBytes)
  const val = str
    .split('')
    .reverse()
    .reduce((sum, c, b) => sum + (GHU[c] * (32 ** b)), 0)
  const bits = val.toString(2).slice(0, nBits).split('').reverse() // lsb
  for (const bit of bits) { // buf.writeUInt32BE(bits)
    shift(buf, bit === '0' ? 0 : 1) // msb
  }
  return buf
}

/*
 * Round bits upwards to closet byte
 * @type {(b: number) => number}
 */
export function roundByte (b) { return (b >> 3) + (b % 8 ? 1 : 0) }

/**
 * Treats buffer as a series of latched 8bit shift-registers
 * shifts all bits 1 step from low to high.
 * @param {bit} x The value to shift in
 * @param {Uint8Array|Buffer|array} inp The input buffer
 * @return {number} the previous last bit
 */
export function shift (x, inp = 0) {
  let c = inp ? 1 : 0
  for (let i = 0; i < x.length; i++) {
    const nc = (x[i] >> 7) & 1
    x[i] = (x[i] << 1) | c
    c = nc
  }
  return c
}

/**
 * Opposite of shift, shifts all bits 1 step towards low.
 * @param {bit} x The value to shift out
 * @param {Uint8Array|Buffer|array} inp The input buffer
 * @return {number} the previous first bit
 */
export function unshift (x, inp = 0) {
  let i = x.length
  let c = (inp ? 1 : 0) << 7
  while (i--) {
    const nc = (x[i] & 1) << 7
    x[i] = c | x[i] >> 1
    c = nc
  }
  return c ? 1 : 0
}

function binstr (x, cap, bs = true) {
  cap = cap || x.length * 8
  let str = ''
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < 8; j++) {
      if (cap === i * 8 + j) str += '|'
      str += x[i] & (1 << j) ? '1' : '0'
    }
    if (bs) str += ' '
  }
  return str
}
