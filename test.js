import { test } from 'tapzero'
import { getPublicKey } from '@noble/curves'
import {
  decodeASL,
  packGeo,
  roll,
  unpackGeo
} from './index.js'

test('Decode ASL', async t => {
  const secret = roll(2, 1, 'u6282sv')
  const { age, sex, location } = decodeASL(getPublicKey(secret))
  t.equal(age, 2)
  t.equal(sex, 1)
  t.equal(location, 'u628')
})

test('Geohash bitpacking', async t => {
  const geohash = 'u120fw'
  const n = packGeo(geohash)
  t.ok(n instanceof Uint8Array)
  const o = unpackGeo(n)
  t.equal(o, 'u12')
  t.equal(unpackGeo(packGeo('u6282sv', 24), 17), 'u628')
})
