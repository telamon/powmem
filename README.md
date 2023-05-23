# POP-0101: PoWMEM

> Alternative Profile scheme for minimalists

Live demo: [https://telamon.github.io/powmem/demo.html](https://telamon.github.io/powmem/demo.html)

We think the demo is kinda cool cause if you'd build it using traditional Web 2.0 tech you would not be able to
provide a form and a realtime world-map with `0` server-costs.

## Install

```
$ npm i powmem
```

## API

### Generate Identity `roll(A, S, L)`

Use this to provide an alternative to user registrations.

> Requires peer dependency `@noble/curves`


Callsignature:

```js
roll(
  age: number, // 0: 16+, 1: 24+, 2: 32+, 3: 48+
  sex: number: // 0: Female, 1: Male, 2: Non-binary, 3: Robot
  location: string, // A geohash
  geobits: number, // target precision, default: 15 (bits)
  maxTries: number, // Give up and return undefined, default: 50 000 attempts.
) Uint8Array? // returns mined Secret
```

Example:

```
import { roll } from 'powmem'

const secret = roll(2, 1, 'h4x')
console.log('Your secret key is', secret)
```

Imagine a nation where every citizen born takes a crayon
and draws their own legal passport.



### Decode Identity `decodeASL(key)`

Decodes the burnt in information:

Callsignature:

```js
decodeASL(
  key: Uint8Array|hexstring
) ASL : {
  age: number, // 0..3
  sex: number, // 0..3
  location: string // 3-5 characters of geohash.
}
```

Example:

```javascript
import { decodeASL, flagOf } from 'powmem'
import Geohash from 'latlon-geohash'

const key = '0149170fe78b061ce6c7295fff2daa303f710ba17efd8fafd8343292b4295e84'

const { age, sex, location } = decodeASL(key)

const humanYears = [16, 24, 32, 48][age]

console.log('Age:', humanYears)
console.log('Sex:', sex)
console.log('Country:', flagOf(location))
console.log('Coordinates:', Geohash.decode(location, 3))
```
Produces:
```javascript
Produces:
Age: 24
Sex: 0
Country: 🇲🇫
Coordinates: { lat: -75.2, lon: 10.5 }
```


# JSDOC output

## Functions

<dl>
<dt><a href="#roll">roll(age, sex, location, [geobits], [maxTries])</a> ⇒ <code>Uint8Array</code></dt>
<dd><p>Rolls keypairs until a matching public-key is found</p>
</dd>
<dt><a href="#decodeASL">decodeASL(publicKey, geobits)</a> ⇒ <code><a href="#ASL">ASL</a></code></dt>
<dd><p>Holistically decodes ASL from a public key</p>
</dd>
<dt><a href="#unpackGeo">unpackGeo(buf, nBits)</a> ⇒ <code>string</code></dt>
<dd><p>Unpacks bitarray back into base32 string</p>
</dd>
<dt><a href="#packGeo">packGeo(str, [nBits], destination)</a> ⇒ <code>Uint8Array</code></dt>
<dd><p>Bitpacks a geohash string containing quintets to arbitrary bit-precision
 &#39;u120fw&#39; &lt;-- contains 30bits accurate to ~1.2 Kilometers
 References:
 Format specification:  <a href="https://en.m.wikipedia.org/wiki/Geohash">https://en.m.wikipedia.org/wiki/Geohash</a>
 Bitdepthchart: <a href="https://www.ibm.com/docs/en/streams/4.3.0?topic=334-geoh">https://www.ibm.com/docs/en/streams/4.3.0?topic=334-geohashes</a>
</p>
</dd>
<dt><a href="#shift">shift(x, inp)</a> ⇒ <code>number</code></dt>
<dd><p>Treats buffer as a series of latched 8bit shift-registers
shifts all bits 1 step from low to high.</p>
</dd>
<dt><a href="#unshift">unshift(x, inp)</a> ⇒ <code>number</code></dt>
<dd><p>Opposite of shift, shifts all bits 1 step towards low.</p>
</dd>
<dt><a href="#xorDistance">xorDistance(a, b)</a> ⇒ <code>number</code></dt>
<dd><p>Calculates XOR-Distance between two buffers</p>
</dd>
<dt><a href="#flagOf">flagOf(geohash, [bits])</a> ⇒ <code>string</code></dt>
<dd><p>Returns nearest flag of geohash.
The coordinates were given by GPT.</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#bit">bit</a> : <code>0</code> | <code>1</code></dt>
<dd></dd>
<dt><a href="#hexstring">hexstring</a> : <code>string</code></dt>
<dd></dd>
<dt><a href="#ASL">ASL</a> : <code>Object</code></dt>
<dd></dd>
</dl>

<a name="roll"></a>

## roll(age, sex, location, [geobits], [maxTries]) ⇒ <code>Uint8Array</code>
Rolls keypairs until a matching public-key is found

**Kind**: global function  
**Returns**: <code>Uint8Array</code> - secret key if found within maxTries, null otherwise  

| Param | Type | Description |
| --- | --- | --- |
| age | <code>0</code> \| <code>1</code> \| <code>2</code> \| <code>3</code> | values: 0: 16+, 1: 24+; 2: 32+; 3: 40+ |
| sex | <code>0</code> \| <code>1</code> \| <code>2</code> \| <code>3</code> | values: 0: Female, 1: Male, 2: Nonbinary, 3: Bot |
| location | <code>string</code> | a geohash |
| [geobits] | <code>number</code> | geohash bit-size; default: 15 |
| [maxTries] | <code>number</code> | maximum number of rolls before giving up. |

<a name="decodeASL"></a>

## decodeASL(publicKey, geobits) ⇒ [<code>ASL</code>](#ASL)
Holistically decodes ASL from a public key

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| publicKey | <code>Uint8Array</code> \| [<code>hexstring</code>](#hexstring) |  |
| geobits | <code>number</code> | geohash bit-size; default: 15 |

<a name="unpackGeo"></a>

## unpackGeo(buf, nBits) ⇒ <code>string</code>
Unpacks bitarray back into base32 string

**Kind**: global function  
**Returns**: <code>string</code> - A geohash  

| Param | Type | Description |
| --- | --- | --- |
| buf | <code>Uint8Array</code> \| <code>Buffer</code> \| <code>array</code> | a byte array |
| nBits | <code>number</code> | number of bits to unpack |

<a name="packGeo"></a>

## packGeo(str, [nBits], destination) ⇒ <code>Uint8Array</code>
Bitpacks a geohash string containing quintets to arbitrary bit-precision
 'u120fw' <-- contains 30bits accurate to ~1.2 Kilometers
 References:
 Format specification:  https://en.m.wikipedia.org/wiki/Geohash
 Bitdepthchart: https://www.ibm.com/docs/en/streams/4.3.0?topic=334-geohashes
```
        q1    q2    q3   18 19
HASH  01101 11111 11000 001|00 00010
LON   0 1 1  1 1  1 0 0  0 |0  0 0 0
LAT    1 0  1 1 1  1 0  0 1| 0  0 1
```

**Kind**: global function  
**Returns**: <code>Uint8Array</code> - buffer containing binary geohash  

| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | A geohash string. |
| [nBits] | <code>number</code> | precision in bits; default 12 |
| destination | <code>Uint8Array</code> \| <code>Buffer</code> \| <code>Array</code> | buffer |

<a name="shift"></a>

## shift(x, inp) ⇒ <code>number</code>
Treats buffer as a series of latched 8bit shift-registers
shifts all bits 1 step from low to high.

**Kind**: global function  
**Returns**: <code>number</code> - the previous last bit  

| Param | Type | Description |
| --- | --- | --- |
| x | [<code>bit</code>](#bit) | The value to shift in |
| inp | <code>Uint8Array</code> \| <code>Buffer</code> \| <code>array</code> | The input buffer |

<a name="unshift"></a>

## unshift(x, inp) ⇒ <code>number</code>
Opposite of shift, shifts all bits 1 step towards low.

**Kind**: global function  
**Returns**: <code>number</code> - the previous first bit  

| Param | Type | Description |
| --- | --- | --- |
| x | [<code>bit</code>](#bit) | The value to shift out |
| inp | <code>Uint8Array</code> \| <code>Buffer</code> \| <code>array</code> | The input buffer |

<a name="xorDistance"></a>

## xorDistance(a, b) ⇒ <code>number</code>
Calculates XOR-Distance between two buffers

**Kind**: global function  
**Returns**: <code>number</code> - Distance  

| Param | Type | Description |
| --- | --- | --- |
| a | <code>Uint8Array</code> \| <code>Buffer</code> \| <code>Array</code> | Buffer A |
| b | <code>Uint8Array</code> \| <code>Buffer</code> \| <code>Array</code> | Buffer B |

<a name="flagOf"></a>

## flagOf(geohash, [bits]) ⇒ <code>string</code>
Returns nearest flag of geohash.
The coordinates were given by GPT.

**Kind**: global function  
**Returns**: <code>string</code> - Emoji Flag  

| Param | Type | Description |
| --- | --- | --- |
| geohash | <code>string</code> | A hashed location |
| [bits] | <code>number</code> | Geohash bit precision |

<a name="bit"></a>

## bit : <code>0</code> \| <code>1</code>
**Kind**: global typedef  
<a name="hexstring"></a>

## hexstring : <code>string</code>
**Kind**: global typedef  
<a name="ASL"></a>

## ASL : <code>Object</code>
**Kind**: global typedef

# License

AGPLv3 - or mit or whatever, implement your own, it was kinda fun :-)


