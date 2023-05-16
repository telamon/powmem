import { test } from 'tapzero'
import { schnorr } from '@noble/curves/secp256k1'
import {
  decodeASL,
  packGeo,
  roll,
  unpackGeo
} from './index.js'

test('Decode ASL', async t => {
  const secret = '9ec11fa81c53e7115b014a373a4b66172e4f476091a57b20be1103e935738f9c'
  const { age, sex, location } = decodeASL(schnorr.getPublicKey(secret))
  t.equal(age, 2)
  t.equal(sex, 1)
  t.equal(location, 'u67')
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
  t.equal(o, 'u12')
  t.equal(unpackGeo(packGeo('u6282sv', 30), 18), 'u628')
})
