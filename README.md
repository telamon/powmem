<style>
    
    #bitviz { text-align: center; }
    #bitviz .au code { color: #e8ff48; background-color: #c8b200; box-shadow: 0 0 8px goldenrod; text-shadow: 1px -2px 2px #9ff522; }
    #bitviz .ag code { color: #d2f8fc; background-color: #5A6166; box-shadow: 0 0 5px #a3d4ff87; }
    #bitviz .cu code { color: orange; background-color: #775009; }

    </style>

# Open PoWMeM Implementation
  <section>
      <h2 id="bitviz">
        <span class="au"><code>1</code> <code>0</code></span>
        <span class="ag"><code>0</code> <code>1</code></span>
        <span class="cu">
          <code style="opacity: 1;">1</code>
          <code style="opacity: 0.8;">0</code>
          <code style="opacity: 0.6;">1</code>
          <code style="opacity: 0.4;">1</code>
          <code style="opacity: 0.2;">0</code>
        </span>
      </h2>
    </section>
    
### Make PoW slightly sustainable
```
This is a key generator based on a spec that encodes ASL into the first 19-bits of your public key.
It uses the same mechanics as Proof of Work but burns data instead of burning zeros.
```
### Decentralized Taxonomy
```
Sort the hashspace holistically by redistributing data across popular metrics.
Let clients attract other clients with similar interests and form natural clusters.
```
### Localize relays (nostr)
```
POP-0101 strives to create incentive that benefit local actors.
Let relays appealing more to some audiences and less to others emerge.
Importing culture is vital for sustained network growth.✌️
```


# Install
```
$ npm i powmem latlon-geohash
```

### What you get
### powmem:
```
 Provides decodeASL(key) and roll(a, s, l) functions
```

### latlon-geohash:
```
Transcoder between Latitude + Longitude pair and Geohash
```

# Decode
## Pass any 32byte public(npub) key or 64char hexstring to the decode-function
```
import { decodeASL, flagOf } from 'powmem'
import Geohash from 'latlon-geohash'

const key = '0149170fe78b061ce6c7295fff2daa303f710ba17efd8fafd8343292b4295e84'

const { age, sex, location } = decodeASL(key)

console.log('Age:', age)
console.log('Sex:', sex)
console.log('Country:', flagOf(location))
console.log('Coordinates:', Geohash.decode(location, 3))
```
### Produces:

```
Produces:
Age: 1
Sex: 0
Country: 🇲🇫
Coordinates: { lat: -75.2, lon: 10.5 }
```


TODO: write a proper README.md

```javascript
var s = "JavaScript syntax highlighting";
alert(s);
```



>Goto: https://telamon.github.io/powmem/demo.html




Peace!
