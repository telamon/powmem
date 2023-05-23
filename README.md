
> We think this tech-demo is cool cause
> if you estimate the servercosts of 
> If you'd even begin to try and estimate the cost
> Of having a form + map-view using web2.0, you'd very quickly
> find yourself banging your head against a wall
> wishing you'd have asked to be paid at least the double.

# POP-0101: PoWMEM

> Alternative Profile scheme for minimalists

Live demo: [https://telamon.github.io/powmem/demo.html](https://telamon.github.io/powmem/demo.html)


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
### `flagOf(geohash)`

### `xorDistance(a, b)`
Returns the XOR-distance between two packed/binary geohashes








