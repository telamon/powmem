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

let FLAGS = null
function buildFlagLUT () {
  if (FLAGS) return FLAGS
  const data = JSON.parse(FLJSON) // TODO: THEY're WRONG! Lon lat is swapped!!!!!!
  FLAGS = {}
  for (const f in data) {
    FLAGS[f] = packGeo(data[f], 40)
  }
  return FLAGS
}

export function xorDistance (a, b) {
  /* // TODO: dosen't work :'(
  let d = 0
  const n = Math.min(a.length, b.length, 4)
  for (let i = 0; i < n; i++) {
    d |= (a[i] ^ b[i]) << (i * 8)
  }
  */
  // TODO: try inefficient way of shift(out, unshift(a) ^ unshift(b))
  const out = new Uint8Array(4)
  const ac = Array.from(new Array(4)).map((_, i) => a[i] || 0)
  const bc = Array.from(new Array(4)).map((_, i) => b[i] || 0)
  console.log('A', binstr(ac))
  console.log('B', binstr(bc))
  for (let i = 0; i < 4 * 8; i++) shift(out, unshift(ac) ^ unshift(bc))
  console.log('X', binstr(out), out)
  const dv = new DataView(out.buffer)
  return dv.getUint32(0, true)
}

export function flagOf (hash, bits = SANE_DEFAULT) {
  const flags = buildFlagLUT()
  const src = packGeo(hash, bits)
  const sorted = Object.keys(flags)
    .map(f => [f, xorDistance(src, flags[f])])
    .sort((a, b) => a[1] - b[1])
  console.log(sorted)
  debugger
  return sorted.slice(0, 3)
}
// 'fun' ISO-3166 alternative kindly provided by ChatGPT
const FLJSON = '{"🇦🇨":"7v6q74tdc4k0","🇦🇩":"sbq0xm01hs4d","🇦🇪":"u98dm48yjj6y","🇦🇫":"uu01hq1xq6g4","🇦🇬":"hmh0knr3ckne","🇦🇮":"hkucnweyfbb4","🇦🇱":"sgt68rwbv7se","🇦🇲":"ubh2pycqt8yr","🇦🇴":"eg0j9jf7n0mq","🇦🇶":"h00000000000","🇦🇷":"5jx7uefqe2gn","🇦🇸":"58jb5200j850","🇦🇹":"t4fm1hb0k3x3","🇦🇺":"grypbzgxzzcr","🇦🇼":"h78cuytt4g8b","🇦🇽":"t7dc33s8u8vv","🇦🇿":"ubuexw10uvjy","🇧🇦":"sgphx66s4xh7","🇧🇧":"hm3mk0rx8phb","🇧🇩":"uxbzvzfpupyr","🇧🇪":"t0u0v0hn3zev","🇧🇫":"kr8xn7xxj09v","🇧🇬":"sunkete","🇧🇭":"u8fx9jjhnph7","🇧🇮":"evmd5nxf1p4q","🇧🇯":"s0qt5v9dt0kj","🇧🇱":"hkgfscx92xbv","🇧🇲":"hsqzx5vc479s","🇧🇳":"upgpzpyxbpuz","🇧🇴":"5eukmr3b6f47","🇧🇶":"h7bete18pqex","🇧🇷":"5xkz2fv21j89","🇧🇸":"hd1z9wmmv7zp","🇧🇹":"uxge605hrmfe","🇧🇻":"t2e7hn4cep2t","🇧🇼":"es2h7vszunzs","🇧🇾":"thyhyhnm34cd","🇧🇿":"h2hnzptm9wq2","🇨🇦":"j4833edzvejj","🇨🇨":"g9z7gnn6cx74","🇨🇩":"egv5u153sg9m","🇨🇫":"s5k9wkwj1b17","🇨🇬":"efzf4c3gp1nu","🇨🇭":"t13637gbppup","🇨🇮":"kpj27w4my9x7","🇨🇰":"580bh8pbj00b","🇨🇱":"572nndv7vdr4","🇨🇲":"s449rtfh8fug","🇨🇳":"uzurupcrgrbp","🇨🇴":"h4g6e5tdwzy8","🇨🇵":"hmzxd9xrz5gd","🇨🇷":"h1p19vt7t6zb","🇨🇺":"h927mvwgcbvk","🇨🇻":"k7f9xyu18pu1","🇨🇼":"h78xsbv8h5z7","🇨🇽":"5ubw4r0k5s7m","🇨🇾":"svbypmdr23n1","🇨🇿":"t4ed5krf78zp","🇩🇪":"t4mk707cu9n7","🇩🇯":"sr8qt0dfbb9e","🇩🇰":"t4px6zypehvj","🇩🇲":"hm4fygbb95n9","🇩🇴":"h7t6476fv6q7","🇩🇿":"sbd5hr5m38e9","🇪🇨":"5fn9w76ecvyk","🇪🇪":"tk3sv67b1mqr","🇪🇬":"stt3ewm9jk82","🇪🇭":"sq6z9qv63sv0","🇪🇷":"sqfucrv718mh","🇪🇸":"kzkdztwxg9wk","🇪🇹":"snys2pehtcw4","🇪🇺":"t1dw7gxe1ugg","🇫🇮":"tks43p7f0h7e","🇫🇯":"gxgruzvrzzgx","🇫🇰":"585050j8n048","🇫🇲":"upvrbzzpvpbx","🇫🇴":"mqu08mszf55e","🇫🇷":"t06tru0q93c7","🇬🇦":"s40d433jxt40","🇬🇧":"mpuxk0f89mth","🇬🇩":"hm0dgeybwgj1","🇬🇪":"szvwv6240k3h","🇬🇫":"hndcc88xf906","🇬🇬":"mpe17mxu3vz5","🇬🇭":"kpgyzw06pst8","🇬🇮":"kz19w3kvj8ts","🇬🇱":"m86vxsp7gygg","🇬🇲":"km38cuvh1q82","🇬🇳":"knr0f6f1jq8z","🇬🇵":"hqe9f0ezccp4","🇬🇶":"s1c4mt4nf7m9","🇬🇷":"su5nbr6ywww4","🇬🇸":"6c3q1kjtf2s8","🇬🇹":"h250p0j0n0n8","🇬🇺":"urcxczvzfzux","🇬🇼":"km23ss7py0kd","🇬🇾":"hje2y854xw8b","🇭🇰":"urzzvxuxczyp","🇭🇲":"gxcpurczyxbp","🇭🇳":"h2dv3u5sd2eg","🇭🇷":"t48n6r0f6jm7","🇭🇹":"h7jkrxwkm020","🇭🇺":"t53u2f4vjq91","🇮🇨":"kthp7v12dn3u","🇮🇩":"gzgxfxyzurzp","🇮🇪":"mnvuqh25h7qp","🇮🇱":"swq86fkyxj3q","🇮🇲":"mpnw4hj92sxq","🇮🇳":"utsqthjdw58r","🇮🇴":"58jb50n2j8j8","🇮🇶":"sxzsqhe7k2mx","🇮🇷":"u9x13vt72bdf","🇮🇸":"mkn5qq0ejyyk","🇮🇹":"sfjz2zf4mvpt","🇯🇪":"mpdgzuhb68uk","🇯🇲":"h6kgh47n8m8r","🇯🇴":"swqsrrejju5x","🇯🇵":"uzcrupurcxup","🇰🇪":"eyx16x5p5gsm","🇰🇬":"uvm33du0h55w","🇰🇭":"urbzvzypfpcp","🇰🇮":"h00bn0p8pbn0","🇰🇲":"g8rw3v2bkqw1","🇰🇳":"hku6fdtp4e0m","🇰🇵":"uzuxvzyxgzcx","🇰🇷":"uzfxyzgpfzux","🇰🇼":"u8ky55b1s159","🇰🇾":"hkvwprp","🇰🇿":"v5fhsxnfccbu","🇱🇦":"urypgzfzvrfr","🇱🇧":"sy2h42s1p9mb","🇱🇨":"hm1vhe0","🇱🇮":"t19w3790prwt","🇱🇰":"unmee0j1bdbf","🇱🇷":"knkd672v1tfc","🇱🇸":"em4bw5y8xkd2","🇱🇹":"thr5zqvhh0yh","🇱🇺":"t156vef7s87b","🇱🇻":"tk27yqfkn8zu","🇱🇾":"se4dp22dh7cu","🇲🇦":"kwwsg6q40q9x","🇲🇨":"scr45m3qdw4f","🇲🇩":"tj19qus4dkem","🇲🇪":"sgqq5z580cfv","🇲🇫":"s2etfpegcfz5","🇲🇬":"g86ddkk86c2p","🇲🇭":"upvpfrbzzzzz","🇲🇰":"sgvedyd7w9sz","🇲🇱":"krk3rbd86yrd","🇲🇲":"urzxfxyzurzp","🇲🇳":"vpcrfrupzrux","🇲🇴":"urzzcpuxgpyr","🇲🇵":"urfxzxczyxfp","🇲🇶":"hm4kv4vs78te","🇲🇷":"kqncy033px19","🇲🇸":"hkuq5p4k4s7m","🇲🇹":"sf99cbbyu2y1","🇲🇺":"gd1x2vn9zgtj","🇲🇻":"uj460vuhqshu","🇲🇼":"ewne4kks8rj9","🇲🇽":"h2jb40n2h2hb","🇲🇾":"upfzzzczzzbr","🇲🇿":"ew6dp7bnctmr","🇳🇦":"e7r9jw4f3hks","🇳🇨":"gxbpvruzypuz","🇳🇪":"s3ktbxjx76p6","🇳🇫":"gpfzvrcpfzyp","🇳🇬":"s1w3qem1r95","🇳🇮":"h2c5kb821d9t","🇳🇱":"t0v5zeqz44gq","🇳🇴":"t3e00jdqgtrk","🇳🇵":"uwunw4k9c4hn","🇳🇷":"gzzxupgrczup","🇳🇺":"grgrgpvpurfp","🇳🇿":"gpfzvrcpfzyp","🇴🇲":"u6rm29k","🇵🇦":"h1y5dk3jekz8","🇵🇪":"5f33wyu15v1u","🇵🇫":"5852j8n010h0","🇵🇬":"gzgxbrcxupvr","🇵🇭":"urcpvpfxyzbr","🇵🇰":"usmd7pys7z96","🇵🇱":"t5tps90sbjzp","🇵🇲":"jpc2s0q41xcx","🇵🇳":"52n0j852j810","🇵🇷":"hkhvnteux3th","🇵🇸":"swq8rn4bk0x0","🇵🇹":"ky7ecpstwvpe","🇵🇼":"upvrgpbpvzgx","🇵🇾":"5mx7d89snnj1","🇶🇦":"u9450vwzcdt0","🇷🇪":"g9bgzw06yx26","🇷🇴":"th2wj3nf4hug","🇷🇸":"sgxu7jthc2kg","🇷🇺":"tnxwhb04kkcu","🇷🇼":"evq9gy7h5dx6","🇸🇦":"u80brw3jmgcy","🇸🇧":"gzcpuxbpyzuz","🇸🇨":"gcuettbmmmm7","🇸🇩":"smg10xr70mr8","🇸🇪":"t74ny1630zhm","🇸🇬":"upbzyzbxfpyz","🇸🇭":"6v3qmp1bcqg0"}'
