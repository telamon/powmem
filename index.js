/*! powmem - MIT License (c) 2023 Tony Ivanov */
import { getPublicKey as getPublicKey33, etc } from '@noble/secp256k1'
const { bytesToHex, hexToBytes } = etc
export const getPublicKey = (...a) => getPublicKey33(...a).slice(1)

/** @typedef {0|1} bit */
/** @typedef {string} hexstring */
/** @typedef {{age: number, sex: number, location: string}} ASL */

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
  // console.info('Searching for', nbits, binstr(prefix), 'mask', mask.toString(2))
  const nBytes = prefix.length
  const sk = new Uint8Array(32)
  for (let i = 0; i < maxTries; i++) {
    globalThis.crypto.getRandomValues(sk)
    const pk = getPublicKey(sk)
    let v = true
    for (let n = 0; v && n < nBytes; n++) {
      v = (n + 1 === nBytes)
        ? (pk[n] & mask) === (prefix[n] & mask)
        : v = pk[n] === prefix[n]
    }
    if (v) return bytesToHex(sk)
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
  const cpy = new Uint8Array(roundByte(4 + geobits)) // unshift alters buffers, using a copy.
  for (let i = 0; i < cpy.length; i++) cpy[i] = publicKey[i]
  const age = unshift(cpy) | unshift(cpy) << 1
  const sex = unshift(cpy) | unshift(cpy) << 1
  const location = unpackGeo(cpy, geobits)
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
  let tmp = [0]
  for (let n = 0; n < nBits; n++) {
    if (n && !(n % 5)) {
      const v = tmp[0] >> 3
      str += GHM.charAt(v)
      // console.log('>>> Decoding', GHM.charAt(v), v, binstr(v))
      tmp = [0]
    }
    unshift(tmp, unshift(cpy))
  }
  const v = tmp[0] >> 3
  str += GHM.charAt(v)
  // console.log('>>> Decoding', GHM.charAt(v), v, binstr(v))
  return str.replace(/0+$/, '')
}

/**
 * Bitpacks a geohash string containing quintets to arbitrary bit-precision
 *  'u120fw' <-- contains 30bits accurate to ~1.2 Kilometers
 *  References:
 *  Format specification:  https://en.m.wikipedia.org/wiki/Geohash
 *  Bitdepthchart: https://www.ibm.com/docs/en/streams/4.3.0?topic=334-geoh
      //         q1    q2    q3   18 19
      // HASH  01101 11111 11000 001|00 00010
      // LON   0 1 1  1 1  1 0 0  0 |0  0 0 0
      // LAT    1 0  1 1 1  1 0  0 1| 0  0 1
ashes
 * @param {string} str A geohash string.
 * @param {number?} [nBits] precision in bits; default 12
 * @param {Uint8Array|Buffer|Array} destination buffer
 * @returns {Uint8Array} buffer containing binary geohash
 */
export function packGeo (hash, nBits = SANE_DEFAULT, buf = undefined) {
  nBits = Math.min(hash.length * 5, nBits)
  if (nBits < 5) throw new Error('precision has to be at least 5')
  const nBytes = roundByte(nBits)
  if (!buf) buf = new Uint8Array(nBytes)
  let w = 0
  const tail = Math.ceil(nBits / 5) - 1
  for (let i = tail; i > -1; i--) {
    const v = GHU[hash[i]] // Quintet not byte
    const bits = [v << 3]
    let x = 5
    if (i === tail && nBits % 5) { // Align on first run
      x = (nBits % 5)
      for (let y = 0; y < 5 - x; y++) shift(bits)
    }
    // console.log('<<<Encoding', hash[i], v, binstr(v), 'x', x)
    for (let j = 0; j < x; j++) {
      shift(buf, shift(bits)) // push-back least significant bit
      if (++w >= nBits) break
    }
  }
  // console.log('Packed:', hash.slice(0, tail + 1), binstr(buf))
  return buf
}

/*
 * Rounds upwards to nearest byte
 * @param {number} number of bits
 * @returns {number} Amount of bytes
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

export function binstr (x, cap, bs = 5) {
  if (typeof x === 'number') x = [x]
  cap = cap || x.length * 8
  let str = ''
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < 8; j++) {
      if (i * 8 + j !== 0 && !((i * 8 + j) % bs)) str += ' '
      if (cap === i * 8 + j) str += '|'
      str += x[i] & (1 << j) ? '1' : '0'
    }
  }
  return str
}

/**
 * Calculates XOR-Distance between two buffers
 * @param {Uint8Array|Buffer|Array} a Buffer A
 * @param {Uint8Array|Buffer|Array} b Buffer B
 * @returns {number} Distance
 */
export function xorDistance (a, b) {
  // TODO: can be done without unshift(a) ^ unshift(b) and DataView
  // TODO: this function is full of glitches, needs regression testing.
  const out = new Uint8Array(4)
  const ac = Array.from(new Array(4)).map((_, i) => a[i] || 0)
  const bc = Array.from(new Array(4)).map((_, i) => b[i] || 0)
  for (let i = 0; i < 4 * 8; i++) shift(out, unshift(ac) ^ unshift(bc))
  const dv = new DataView(out.buffer)
  return dv.getUint32(0, true)
}

/**
 * Returns nearest flag of geohash.
 * The coordinates were given by GPT.
 * @param {string} geohash A hashed location
 * @param {number} [bits] Geohash bit precision
 * @returns {string} Emoji Flag
 */
export function flagOf (geohash, bits = SANE_DEFAULT) {
  const flags = initLUT()
  const src = packGeo(geohash, bits)
  const sorted = flags
    .map(f => [f[0], xorDistance(src, f[1])])
    .sort((a, b) => a[1] - b[1])
  return sorted[0][0]
}

let FLUT = null
function initLUT () {
  if (FLUT) return FLUT
  FLUT = POI.split('|').map(p => {
    const [flag, hash] = p.split(':')
    return [flag, packGeo(hash, 40)]
  })
  return FLUT
}
// 'fun' ISO-3166 alternative kindly provided by ChatGPT
// Size 4K
const POI = '🇦🇨:7wtfc36k7311|🇦🇩:sp91fdh1hs8k|🇦🇪:thnm324z28tz|🇦🇫:tw01hf2vt6g3|🇦🇬:deh11cc4re8k|🇦🇮:de5psufyen52|🇦🇱:srq64gwp77nk|🇦🇲:tp05by7g6jeg|🇦🇴:kqh8q8x7s13g|🇦🇶:d00000000000|🇦🇷:69y7pkxff4gc|🇦🇸:2jrnbd192kuc|🇦🇹:u2edk85115y4|🇦🇺:qgx0hnujcy27|🇦🇼:d6nppz6ssqnn|🇦🇽:u6wnm5nj5j7x|🇦🇿:tp5myu215xkz|🇧🇦:sru9f69s8vh7|🇧🇧:ddmej1cunchp|🇧🇩:wh0r3qs35cw7|🇧🇪:u151710b3yyw|🇧🇫:efnvs7yvk06x|🇧🇬:sx8dfsy|🇧🇭:theuq9k98ch6|🇧🇮:kxmkbcfq2bsf|🇧🇯:s19suwqm6119|🇧🇱:ddgr4pyhjupw|🇧🇲:dt9zy3rns6qt|🇧🇳:w8c9f9whj1jw|🇧🇴:6mpe3fmn9q87|🇧🇶:d6pmqkkjbffu|🇧🇷:6vjyjr7428nh|🇧🇸:dk2yqv3er7zb|🇧🇹:tuzkt0b9cdxk|🇧🇻:u4f7hb8nybjt|🇧🇼:ks18cxnzpcgt|🇧🇾:u9e9e98dm27k|🇧🇿:d50cgcqdqv95|🇨🇦:f244mkwzrmk9|🇨🇨:mjz6zc867uv2|🇨🇩:krr3p0u5nqqd|🇨🇫:s3jjwed8kn27|🇨🇬:krgq8nmru1sx|🇨🇭:u0m636zpbcpc|🇨🇮:eck4cu8exjy7|🇨🇰:2hppntbx22nn|🇨🇱:66jc8m77rmc3|🇨🇲:s28jvsx84r5q|🇨🇳:wx4g0bm6c408|🇨🇴:d2g6f3qmdzxh|🇨🇵:dezuwjygz2zm|🇨🇷:d1u0qxq7q7gp|🇨🇺:dhj7mxwqrp7d|🇨🇻:e6xjyz50ncp1|🇨🇼:d6nvnp7j03z7|🇨🇽:6w5u8fhdbscd|🇨🇾:swpzbdwfj5s1|🇨🇿:u2fkbecqcjgb|🇩🇪:u33dc0cppjs7|🇩🇯:sfng60dq5n6m|🇩🇰:u3butzxby979|🇩🇲:ddsreqpn63sh|🇩🇴:d7q686tr7797|🇩🇿:snd3hfudmhfh|🇪🇨:6r8jw6tkrxxd|🇪🇪:ud3t76cn2etg|🇪🇬:stq4yv3jkd44|🇪🇭:sf9yqg763t70|🇪🇷:sfew7gr6kj38|🇪🇸:ezjmgtwuzjwe|🇪🇹:sces1by96pw3|🇪🇺:u0wucrykkwgr|🇫🇮:ue423bvq08ck|🇫🇯:ruye5zqgznzm|🇫🇰:2hvbc3rtt2sk|🇫🇲:x3741zg9rbhv|🇫🇴:gg504enyx2uk|🇫🇷:u09tvw0f64r7|🇬🇦:s20k84m9yss1|🇬🇧:gcpvj0eh6eq9|🇬🇩:ddhkgmxpdrk1|🇬🇪:szrv76120d38|🇬🇫:dbdnrh4uxhh7|🇬🇬:gby0veyw3xz3|🇬🇭:ebzzgu07bt6h|🇬🇮:eykjw5jxkj6t|🇬🇱:gh9xytb6zygr|🇬🇲:edmh7x782f45|🇬🇳:ecc0e6e1kf4y|🇬🇵:dffhx0fyrpu2|🇬🇶:s0r33ssbe7mj|🇬🇷:swbb5ftzdvd2|🇬🇸:5nmf2e2sx54h|🇬🇹:9fz9u3qcs3eu|🇬🇺:x4quqz7w9z0j|🇬🇼:edj5nsccx11m|🇬🇾:d8y5ehb3fu4p|🇭🇰:wecpkthh2pd1|🇭🇲:rs390dkzeh03|🇭🇳:d4dwmwbsd4fq|🇭🇷:u24b9fhq99m7|🇭🇹:d7kecvwe3010|🇭🇺:u2mw1q8xkf61|🇮🇨:ethbvwk4db3x|🇮🇩:qqguwvtzpgcc|🇮🇪:gc7x9813h7tc|🇮🇱:sv9h9r1zf8mg|🇮🇲:gcsu892hjtff|🇮🇳:ttng692md2nf|🇮🇴:2m2qv1952vkh|🇮🇶:svzt98f7j53u|🇮🇷:tjy0mxq6jndq|🇮🇸:ge83tf0mkzed|🇮🇹:sr2yjyx33xus|🇯🇪:gbwrzx0n9j5e|🇯🇲:d71rh2cb4dng|🇯🇴:sv9tcfy9kwbu|🇯🇵:xn774c06kt10|🇰🇪:kzf0tuuburne|🇰🇬:txm4mm5102uu|🇰🇭:w64xmps09230|🇰🇮:80pxx3cvfz81|🇰🇲:mjcu3wjp1gd1|🇰🇳:de56em6bskhd|🇰🇵:wz4tmxdhbwmu|🇰🇷:wydveqv08x1t|🇰🇼:tj1yb2p1n0uj|🇰🇾:de7vbgu|🇰🇿:v2x94vsq7npx|🇱🇦:w78buqdzq685|🇱🇧:sy188541ujmp|🇱🇨:ddkxhkh|🇱🇮:u0qu36q1bgwt|🇱🇰:tc3ky120pk5q|🇱🇷:ec1k96jwksxn|🇱🇸:kdspd3xjfdd4|🇱🇹:u9c3zg7901e9|🇱🇺:u0u77kx7nhcp|🇱🇻:ud17xfee8jgw|🇱🇾:sksmb41m06rw|🇲🇦:evdsg7920f6v|🇲🇨:spv2bdmfdu8q|🇲🇩:u8kjtx42ddfd|🇲🇪:srtfbyuh0nxx|🇲🇫:s4fsxbyqrrg2|🇲🇬:mh9kde1h9njc|🇲🇭:xc2bx6nrzxgn|🇲🇰:srrkwyd7wjny|🇲🇱:egj5vndh9zck|🇲🇲:w5uhxt9p0gg3|🇲🇳:y23fe54cg7pv|🇲🇴:webwrc0hu9s7|🇲🇵:x4xtcsmp8uw3|🇲🇶:ddse737scj6m|🇲🇷:eg8px035uukh|🇲🇸:de5fbbsd8scd|🇲🇹:sq6hrn5z55e1|🇲🇺:mk2ujxsjzrq9|🇲🇻:t8s60xp99t0w|🇲🇼:kv8kse1s4gkh|🇲🇽:9g3w81t7j50q|🇲🇾:w28xbw2xbq5d|🇲🇿:ku9mb6pb7tmf|🇳🇦:k7vjku8q391t|🇳🇨:rsn9r5pzx34w|🇳🇪:s5jspvkuv7b6|🇳🇫:r8xrmfkbspt3|🇳🇬:s1w5tmm1vhu|🇳🇮:d473jn442k6s|🇳🇱:u173zmtys2gg|🇳🇴:u4y008wfgtve|🇳🇵:tv5cd31hr30b|🇳🇷:rxyth8z4rpj8|🇳🇺:rdydz1rcp6d8|🇳🇿:rbsr7dk08zd9|🇴🇲:t7cdjjj|🇵🇦:d1x2wd38yegj|🇵🇪:6q35wz50uwkx|🇵🇫:2svg2jt231p3|🇵🇬:rqbs5f6j0c2f|🇵🇭:wdq9709jey5e|🇵🇰:tt3kccxscyq6|🇵🇱:u3qcnhhs59zb|🇵🇲:fbr541922uru|🇵🇳:35e3rkzg7k31|🇵🇷:de0xssyxf5q9|🇵🇸:sv9jcb8p11f1|🇵🇹:eyckrcntwxuk|🇵🇼:wcrdy2pcrwck|🇵🇾:6ey6wh6t8c20|🇶🇦:ths2hxwyrm61|🇷🇪:mhprzu07euj6|🇷🇴:u81v25sq895r|🇷🇸:srywc9q8751q|🇷🇺:ucfv0n031d7w|🇷🇼:kxthzyc8bmf7|🇸🇦:th0pcu39mqrz|🇸🇧:rw390shcep0q|🇸🇨:mppmqspemem6|🇸🇩:sdz0hvv6hevj|🇸🇪:u6sce0t4hzhe|🇸🇬:w21zdqpk89ty|🇸🇭:5wmg3bkn7fg0|🏴‍☠️:1n7'
