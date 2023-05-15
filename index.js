/** @typedef {0|1} bit */
const GHM = '0123456789bcdefghjkmnpqrstuvwxyz' // (geohash-specific) Base32 map
const GHU = GHM.split('').reduce((h, l, i) => { h[l] = i; return h }, {})

const SANE_DEFAULT = 16

/**
 * Rolls keypairs until a matching public-key is found
 * @param {0|1|2|3} age values: 0: 16+, 1: 24+; 2: 32+; 3: 40+
 * @param {0|1|2|3} sex values: 0: Female, 1: Male, 2: Nonbinary, 3: Bot
 * @param {string} location a geohash
 * @returns {Uint8Array} secret key.
 */
export function roll (age, sex, location) {

}

/**
 * Holistically decodes ASL from a public key
 */
export function decodeASL (publicKey) {

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
  return str.replace(/0+$/, '') // Truncate trailing zero-fields
}

/**
 * Bitpacks a geohash string containing quintets to arbitrary bit-precision
 *  'u120fw' <-- contains 6*5 bits accurate to ~1.2 Kilometers
 *
 *  References:
 *  Format specification:  https://en.m.wikipedia.org/wiki/Geohash
 *  Bitdepthchart: https://www.ibm.com/docs/en/streams/4.3.0?topic=334-geoh
ashes
 * @param {string} str A geohash string.
 * @param {number?} [nBits] precision in bits; default 12
 * @returns {Uint8Array} buffer containing binary geohash
 */
export function packGeo (str, nBits = SANE_DEFAULT) {
  if (!nBits) nBits = Math.min(str.length * 5, 12)
  if (nBits < 5) throw new Error('precision has to be at least 5')
  const nBytes = roundByte(nBits)
  const buf = new Uint8Array(nBytes)
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
