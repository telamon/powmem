import { test } from 'tapzero'
import { schnorr } from '@noble/curves/secp256k1'
import {
  decodeASL,
  packGeo,
  roll,
  unpackGeo,
  flagOf
} from './index.js'
import Geohash from 'latlon-geohash'
import { readFileSync, writeFileSync } from 'node:fs'

test('Decode ASL', async t => {
  const secret = '9ec11fa81c53e7115b014a373a4b66172e4f476091a57b20be1103e935738f9c'
  const { age, sex, location } = decodeASL(schnorr.getPublicKey(secret))
  t.equal(age, 2)
  t.equal(sex, 1)
  t.equal(location, 'cdw')
})

test.skip('Encode ASL', async t => {
  const secret = roll(2, 1, 'u6282sv')
  t.ok(secret)
  const { age, sex, location } = decodeASL(schnorr.getPublicKey(secret))
  t.equal(age, 2)
  t.equal(sex, 1)
  t.equal(location, 'u62')
})

test('Geohash bitpacking', async t => {
  const geohash = 'u120fw'
  const n = packGeo(geohash, 14)
  t.ok(n instanceof Uint8Array)
  const o = unpackGeo(n, 14)
  t.equal(o, 'u14')
  t.equal(unpackGeo(packGeo('u6282sv', 30), 20), 'u628')
})

test('Regression coord<->hash', async t => {
  const ghash = 'gcnenk' // taken from geohash.co
  const coord = [51.17706299, -1.82922363] // taken from OSM
  const x = Geohash.decode(ghash, 6)
  t.equal(coord[0].toFixed(2), x.lat.toFixed(2), 'Geohash.decode().lat')
  t.equal(coord[1].toFixed(2), x.lon.toFixed(2), 'Geohash.decode().lon')

  const h = Geohash.encode(...coord, 6)
  t.equal(h, ghash, 'Geohash.encode()')

  const n = packGeo(h, 6 * 5)
  const d = unpackGeo(n, 6 * 5)
  t.equal(d, h, 'unpackGeo(h, 30)')

  const p = Geohash.decode(d)
  t.equal(coord[0].toFixed(2), p.lat.toFixed(2), 'Same Latitude')
  t.equal(coord[1].toFixed(2), p.lon.toFixed(2), 'Same Longitude')

  const n2 = packGeo(h, 6 * 3)
  const d2 = unpackGeo(n2, 6 * 3)
  t.equal(d2, 'gcnn', 'unpackGeo(h, 18)')
})

// Ignore this test. One-shot csv->json cleanup thing.
test.skip('ChatGPT provided flag->location LUT', async t => {
  const data = readFileSync('flags.csv').toString()
  const lines = data.split('\n').map(line => {
    const [flag, lon, lat] = line.split(',') // Flipped for some reason?
    if (!flag || !lat || !lon) return undefined
    const hash = Geohash.encode(parseFloat(lat), parseFloat(lon))
    return [flag, hash] // packGeo(hash, 40)]
  })
  const table = lines.filter(x => x)
    .map(fh => fh.join(':')).join('|')
  writeFileSync('flags.db', table) // 4KB Addressbook
})

test('Picks closest flag using XOR distance', async t => {
  const flag = flagOf('u6282sv')
  t.equal(flag, '🇸🇪')
})
