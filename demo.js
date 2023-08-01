import { decodeASL, flagOf, roll } from './index.js'
import Geohash from 'latlon-geohash'
import { nip19, SimplePool, getEventHash, signEvent } from 'nostr-tools'
import { schnorr } from '@noble/curves/secp256k1'
import { bytesToHex } from '@noble/hashes/utils'
import { SVG } from '@svgdotjs/svg.js'
// import L from 'leaflet' A complete waste of time.

let elForm
let isMining = false
let secret = null
let player = null
let pool = null
const relays = [
  'wss://relay.f7z.io',
  'wss://relay.nostr.info',
  'wss://nostr-pub.wellorder.net',
  'wss://relay.current.fyi',
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol'
]
const TAGS = ['reroll', 'reboot']

/**
 * Connects to nostr network
 */
function initPool () {
  if (pool) return pool
  console.info('Connecting to relays', relays)
  pool = new SimplePool()

  const filters = [
    { kinds: [1], '#t': TAGS }
  ]
  const sub = pool.sub(relays, filters)

  sub.on('event', event => {
    const { pubkey, tags } = event
    const hashtag = tags.find(t => t[0] === 't' && ~TAGS.indexOf(t[1]))
    if (hashtag) {
      // console.info('Adding pin', hashtag, pubkey, event)
      addMapPin('event', pubkey, event)
    }
  })
  return pool
}

/**
 * Updates the 'result' section after/while
 * key-generation
 * @type {(isMining: boolean, secret: string) => void}
 */
function setMiningState (state) {
  const elBtn = document.getElementById('btn-generate')
  isMining = state
  if (state) {
    elBtn.classList.add('active')
    elBtn.innerText = 'Stop'
    // if (player) player.pause()
  } else {
    elBtn.classList.remove('active')
    elBtn.innerText = 'Generate'
    // if (player) player.resume()
  }
}

async function generate (event) {
  event.preventDefault()
  if (isMining) { // -- STOP KEYGEN
    console.log('KEYGEN: STOP')
    setMiningState(false)
  } else { // -- START KEYGEN
    console.log('KEYGEN: START')
    const fd = new FormData(event.target)
    const age = parseInt(fd.get('age'))
    const sex = parseInt(fd.get('sex'))
    const lat = parseFloat(fd.get('lat'))
    const lon = parseFloat(fd.get('lon'))
    const burn = !fd.get('pow')
    const bits = burn ? parseInt(fd.get('bits')) : 8
    const mute = !!fd.get('music')
    const location = Geohash.encode(lat, lon, 6)
    console.log('Generating', age, sex, location, mute)
    secret = null
    const start = performance.now()
    let keysTested = 0
    const testCount = burn ? 1000 : 100
    if (!mute) await initSound(burn ? 24000 : 48000)
    setMiningState(true)
    const rollLoop = () => setTimeout(() => {
      if (!secret && isMining) {
        secret = roll(age, sex, location, bits, testCount)
        keysTested += testCount
        const hashRate = keysTested / (performance.now() - start)
        document.getElementById('hashrate').innerText = `Hashrate ${(hashRate * 1000).toFixed(2)} keys/s`
      }

      // Auto-restart/stop
      if (!secret && isMining) rollLoop()
      else {
        if (secret) {
          document.getElementById('hashrate').innerText = 'SECRET KEY FOUND'
          document.getElementById('secret').innerText = '\n' + nip19.nsecEncode(secret) + '\n'
          document.getElementById('inp-pk').value = bytesToHex(schnorr.getPublicKey(secret))
          document.getElementById('voluntary-ad').style.display = 'block'
          decodePublicKey()
        }
        setMiningState(false)
      }
    }, burn ? 10 : 500)
    rollLoop()
    // console.log('Secret rolled', secret)
  }
}

/**
 * Attempts to get user's pubkey via window.nostr
 * and sets the result to pubkey-input.
 * @type {(event: Event) => Promise<void>}
 */
async function nip07reveal (event) {
  event.preventDefault()
  if (typeof window.nostr?.getPublicKey !== 'function') {
    return window.alert('You don\'t have passport installed, lookup nos2x / nos2x-fox')
  }
  const pk = await window.nostr.getPublicKey()
  document.getElementById('inp-pk').value = pk
  decodePublicKey()
}

/**
 * Fetches location from devices
 * @type {(event: Event) => Promise<void>}
 */
async function fetchLocation (event) {
  event.preventDefault()
  const res = await new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('Browser does not support geolocation APIs'))
    else navigator.geolocation.getCurrentPosition(resolve, reject)
  })
  // Added toFixed(5) to prevent form-validators from triggering on mobile
  document.getElementById('lat').value = res.coords.latitude.toFixed(5)
  document.getElementById('lon').value = res.coords.longitude.toFixed(5)
}

const ageSpans = ['16+', '24+', '32+', '48+']
/**
 * Decodes public Key pasted in input and
 * updates the preview/visualization
 * @type {(event: Event) => void}
 */
function decodePublicKey (event) {
  if (event) event.preventDefault()

  let { value } = document.getElementById('inp-pk')
  if (!value.length) return

  if (!/^[a-fA-F0-9]+$/.test(value)) value = nip19.decode(value).data
  const ASL = decodeASL(value)

  const { lat, lon } = Geohash.decode(ASL.location)
  document.getElementById('outPortrait').innerText = emoOf(ASL.sex, ASL.age)
  document.getElementById('outAge').innerText = ageSpans[ASL.age]
  document.getElementById('outLocation').href = `https://www.openstreetmap.org/search?query=${lat},${lon}`
  document.getElementById('outLocation').innerText = `Geohash: ${ASL.location}, Lat: ${lat}, Lon: ${lon}`
  document.getElementById('outFlag').innerText = flagOf(ASL.location)
  document.getElementById('text-share').value = mkPOPaganda(value)
  addMapPin('player', value)
}

const [svgMap, setSvgMap] = unpromise()
setTimeout(() => addMapPin('player', 'a68de0b819e5bbc15bbe727275826e9e29a9aa44d084f8e3a9736f856ef8edef'), 500)
async function addMapPin (thing, key, nevent) {
  const { age, sex, location } = decodeASL(key)
  const { lat, lon } = Geohash.decode(location)
  // L.marker([lat, lon], { }).addTo(lMap)
  const { x, y } = projectRobin(lat, lon)
  const elBox = document.getElementById('map-box')
  const elMap = document.getElementById('map')
  const r = elMap.getBoundingClientRect()
  const elPin = document.createElement('pow-pin')
  elPin.innerText = emoOf(sex, age)
  const scale = 0.1875279169222285 * 1.969
  const rx = r.width * (x * scale * 0.5 + 0.5)
  const ry = r.height * (y * -scale + 0.5)
  // console.info('pin', flag, x, y, 'px', rx, ry)
  // console.info('box', r.width, r.height, 'scales', r.width / rx, r.height / ry)
  elPin.style.left = rx + 'px'
  elPin.style.top = ry + 'px'
  elBox.appendChild(elPin) // .insertBefore(elPin, elMap)

  // ------------------------------------------
  // New map
  /** @type {SVGSVGElement} */
  const svg = await svgMap
  const marker = SVG().size(200, 200)
  const ox = (x * scale * 0.5 + 0.5) * svg.width()
  const oy = (y * -scale + 0.5) * svg.height()
  console.log('M2', ox, oy)
  marker.circle(75)
    .fill('#f06')
    .move(ox, oy)
  svg.add(marker)
}

async function initMap () {
  const res = await fetch('./world.svg')
  const text = await res.text()
  const container = document.getElementById('world')
  container.innerHTML = text
  const elMap = container.querySelector('svg')
  elMap.style.width = '100%'
  const svg = SVG(elMap)
  setSvgMap(svg)
  window.map = svg
  console.log('SVG ELEMENT', svg)
  const marker = SVG(`<g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1">
    <path
       style="opacity:0.682785;fill:#000000;stroke:#4b4b4b;stroke-width:6.15307;stroke-dasharray:24.6123, 24.6123;stroke-dashoffset:19.6898;fill-opacity:1"
       id="path846"
       sodipodi:type="arc"
       sodipodi:cx="105.74687"
       sodipodi:cy="135.0751"
       sodipodi:rx="52.873436"
       sodipodi:ry="52.873436"
       sodipodi:start="6.263306"
       sodipodi:end="6.2628173"
       sodipodi:arc-type="slice"
       d="m 158.60986,134.02409 a 52.873436,52.873436 0 0 1 -51.80551,53.91387 52.873436,52.873436 0 0 1 -53.920209,-51.79892 52.873436,52.873436 0 0 1 51.792339,-53.926536 52.873436,52.873436 0 0 1 53.93286,51.785746 l -52.86247,1.07685 z" />
  </g>`)
  marker.move(30, 30)
  svg.add(marker)
  /*
  const el = document.getElementById('leafmap')
  console.log('Leaflet', el, L)
  const map = L.map(el).fitWorld()
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map)
  map._controlContainer.querySelector('.leaflet-control-attribution').innerHTML = '🏴‍☠️ undefined' // merge conflict resolved
  lMap = map
  // L.marker([56.6681, 12.8831], { }).addTo(map)
  */
}

/** @type {() => [Promise, (value: any) => void, (error: Error) => void]} */
function unpromise () {
  let set, abort
  return [
    new Promise((resolve, reject) => { set = resolve; abort = reject }),
    set,
    abort
  ]
}

function emoOf (sex, age = 1) {
  return [
    ['👧', '👦', '🧒', '🔋'],
    ['👩', '👨', '🧑', '🤖'],
    ['👵', '👴', '🧓', '📟'],
    ['💃', '🕺', '🌈', '💾']
  ][age][sex]
}

function mkPOPaganda (pk) {
  let ft = 'Banner'
  let emo = 'Lizard Emoji'
  let at = 'lvl24'
  if (pk) {
    if (!/^[a-fA-F0-9]+$/.test(pk)) pk = nip19.decode(pk).data
    const { age, sex, location } = decodeASL(pk)
    ft = flagOf(location)
    emo = emoOf(sex, age)
    at = ageSpans[age]
  }
  return `I decoded my public key and I turned out like this:\n\n${ft} ${emo} ${at}.\n
Should I #reroll ?
https://telamon.github.io/powmem/demo.html`
}

async function shareDecode (ev) {
  if (ev) ev.preventDefault()
  const NIP07 = 'nip07'
  const LOCAL = 'local'
  const mode = secret
    ? LOCAL
    : window.nostr ? NIP07 : undefined

  if (!mode) return window.alert('Generate a key first')

  let pk = null
  if (mode === LOCAL) pk = bytesToHex(schnorr.getPublicKey(secret))
  else if (mode === NIP07) pk = await window.nostr.getPublicKey()

  if (!pk) return window.alert('Generate a key or press accept in your NIP-07 extension')

  // const profile = await nip05.queryProfile('telamon@xorcery.co')
  // console.log(profile)
  console.info('Post using key', pk)
  const tarea = document.getElementById('text-share')
  tarea.disabled = true
  document.getElementById('btn-share').disabled = true
  const asl = decodeASL(pk)
  const gTag = ['g', asl.location]
  const tTags = [
    ['t', 'reroll'],
    ['t', 'powmem'],
    ['t', 'decentralize']
  ]
  const event = {
    kind: 1,
    pubkey: pk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [...tTags, gTag],
    content: tarea.value
  }
  event.id = getEventHash(event)
  // event.sig = getSignature(event, sk) // TODO: nostr-tools yet released.
  event.sig = mode === LOCAL
    ? signEvent(event, secret)
    : (await window.nostr.signEvent(event))
  initPool()
  console.info('Posting event', nip19.noteEncode(event.id), event)
  const pubs = pool.publish(relays, event)
  pubs.on('ok', ev => console.info('Relay "OK": Post Accepted', ev))
}

/**
 * Attaches listeners to elements when document
 * has finished loading.
 */
async function boot () {
  console.log('initializing...')
  elForm = document.getElementById('constraints')
  elForm.onsubmit = generate
  document.getElementById('btn-geo')
    .addEventListener('click', fetchLocation)

  document.getElementById('btn-nip07')
    .addEventListener('click', nip07reveal)

  document.getElementById('btn-share')
    .addEventListener('click', shareDecode)

  const pkInput = document.getElementById('inp-pk')
  pkInput.addEventListener('change', decodePublicKey)
  pkInput.addEventListener('keyup', decodePublicKey)

  document.getElementById('music-switch')
    .addEventListener('change', ev => {
      if (!player) return
      if (!ev.target.value) player.resume()
      else player.pause()
    })

  document.getElementById('text-share').value = mkPOPaganda()
  await initMap()
  initPool()
}
document.addEventListener('DOMContentLoaded', boot)

/**
 * Initialize sound-system
 */
async function initSound (sampleRate) {
  if (!player) {
    const res = await fetch('dubmood_-_finland_sux.xm')
    const ab = await res.arrayBuffer()
    await ModPlayer.wasmLoaded()
    player = new ModPlayer(sampleRate, 4096 << 1)
    await player.loadModule(new Uint8Array(ab))
    player.setupSources()
  }
  player.resume()
}

// Ported https://github.com/Artefact2/libxm.js/blob/master/frontend/frontend.js
// TODO: PR a pack.json for reuse
const XM = window.Module // Glob-loaded
class ModPlayer {
  XM_BUFFER_LENGTH = 256
  MAX_XMDATA = 256
  playing = false
  needsResync = true
  t0 = 0 /* Sync point in audio ctx */
  s0 = 0 /* Sync point in xm ctx */
  amp = 1.0
  clip = false
  xmActions = []

  constructor (RATE = 48000, AUDIO_BUFFER_LENGTH = 4096) {
    this.RATE = RATE
    this.AUDIO_BUFFER_LENGTH = AUDIO_BUFFER_LENGTH
    this.audioContext = new window.AudioContext()
    this.buffers = [
      this.audioContext.createBuffer(2, AUDIO_BUFFER_LENGTH, RATE),
      this.audioContext.createBuffer(2, AUDIO_BUFFER_LENGTH, RATE)
    ]
    this.LATENCY_COMP = RATE * (this.audioContext.outputLatency | this.audioContext.baseLatency | 0.25) -
      RATE / 60
    this.cFloatArray = XM._malloc(2 * this.XM_BUFFER_LENGTH * 4)
    this.moduleContextPtr = XM._malloc(4)
    this.moduleContext = null
    this.cSamplesPtr = XM._malloc(8)
  }

  /** Private method **/
  runXCTX (action) {
    this.xmActions.push(action)
    if (this.xmActions.length > 1) return // Wasm task already running.
    while (this.xmActions.length) (this.xmActions.shift())() // Run que sequentially
  }

  /** Loads an XM module from Uint8Array
   * @param {Uint8Array} buffer
   */
  async loadModule (buffer) {
    await new Promise((resolve, reject) => {
      this.runXCTX(() => {
        if (this.moduleContext) {
          XM._xm_free_context(this.moduleContext)
          this.moduleContext = null
        }
        const moduleStringBuffer = XM._malloc(buffer.length)
        XM.writeArrayToMemory(buffer, moduleStringBuffer)
        const ret = XM._xm_create_context(
          this.moduleContextPtr,
          moduleStringBuffer,
          this.RATE
        )
        XM._free(moduleStringBuffer)

        if (ret !== 0) {
          this.moduleContext = null
          reject(new Error(`libxm.js: return code ${ret}`))
        } else {
          this.moduleContext = XM.getValue(this.moduleContextPtr, '*')
          resolve()
        }
      })
    })
    // Reset amp & clip
    this.amp = 1.0
    this.clip = false
    this.needsResync = true
    if (!this.moduleContext) throw new Error(`Loading failed, moduleCtx: ${this.moduleContext}`)
  }

  fillBuffer (buffer) {
    const l = buffer.getChannelData(0)
    const r = buffer.getChannelData(1)
    for (let off = 0; off < this.AUDIO_BUFFER_LENGTH; off += this.XM_BUFFER_LENGTH) {
      XM._xm_generate_samples(this.moduleContext, this.cFloatArray, this.XM_BUFFER_LENGTH)
      for (let j = 0; j < this.XM_BUFFER_LENGTH; ++j) {
        l[off + j] = XM.getValue(this.cFloatArray + 8 * j, 'float') * this.amp
        r[off + j] = XM.getValue(this.cFloatArray + 8 * j + 4, 'float') * this.amp
        if (!this.clip && (l[j] < -1.0 || l[j] > 1.0 || r[j] < -1.0 || r[j] > 1.0)) {
          this.clip = true
        }
      }
      /* TODO: Unported, used to get tune&playback stats
      const xmd = {};

      XM._xm_get_position(moduleContext, null, null, null, cSamplesPtr);
      xmd.sampleCount = Module.getValue(cSamplesPtr, 'i64');

      xmd.instruments = [];
      for(const j = 1; j <= ninsts; ++j) {
        xmd.instruments.push({
          latestTrigger: Module._xm_get_latest_trigger_of_instrument(moduleContext, j),
        });
      }

      xmd.channels = [];
      for(const j = 1; j <= nchans; ++j) {
        xmd.channels.push({
          active: Module._xm_is_channel_active(moduleContext, j),
          latestTrigger: Module._xm_get_latest_trigger_of_channel(moduleContext, j),
          volume: Module._xm_get_volume_of_channel(moduleContext, j),
          panning: Module._xm_get_panning_of_channel(moduleContext, j),
          frequency: Module._xm_get_frequency_of_channel(moduleContext, j),
          instrument: Module._xm_get_instrument_of_channel(moduleContext, j),
        });
      }

      xmdata.push(xmd)
      if(xmd.length >= MAX_XMDATA) xmdata.shift()
      */
    }
  }

  setupSources () {
    const makeSourceGenerator = (index, start) => {
      return () => {
        const s = this.audioContext.createBufferSource()
        s.onended = makeSourceGenerator(index, start + 2 * this.AUDIO_BUFFER_LENGTH)
        s.buffer = this.buffers[index]
        s.connect(this.audioContext.destination)

        if (this.moduleContext) {
          this.runXCTX(() => {
            if (this.needsResync) {
              this.t0 = start
              XM._xm_get_position(this.moduleContext, null, null, null, this.cSamplesPtr)
              this.s0 = XM.getValue(this.cSamplesPtr, 'i64')
              this.needsResync = false
            }
            this.fillBuffer(s.buffer)
          })
        } else {
          const l = s.buffer.getChannelData(0)
          const r = s.buffer.getChannelData(1)
          for (let i = 0; i < this.AUDIO_BUFFER_LENGTH; ++i) {
            l[i] = r[i] = 0.0
          }
        }
        s.start(start / this.RATE)
      }
    }

    const t = this.RATE * this.audioContext.currentTime + this.AUDIO_BUFFER_LENGTH
    this.runXCTX(() => {
      XM._xm_get_position(this.moduleContext, null, null, null, this.cSamplesPtr)
      this.s0 = XM.getValue(this.cSamplesPtr, 'i64')
    });
    (makeSourceGenerator(0, t))();
    (makeSourceGenerator(1, t + this.AUDIO_BUFFER_LENGTH))()
  }

  pause () {
    this.audioContext.suspend()
    this.playing = false
  }

  resume () {
    this.audioContext.resume()
    this.playing = true
  }

  /**
   * Lowers volume one ste
   * @param {number} step Amount
   */
  volDown (step = 1.25892541179) {
    this.amp /= step
    this.clip = false
  }

  /**
   * Raises volume one ste
   * @param {number} step Amount
   */
  volUp (step = 1.25892541179) {
    this.amp *= step
  }

  /**
   * Gets the embedded Ascii-title of tne
   */
  getTitle () {
    return XM.AsciiToString(XM._xm_get_module_name(this.moduleContext))
  }

  /**
   * Wait for WASM-blob to become available.
   */
  static async wasmLoaded () {
    /** Can't figure out the emscripten bootstrap. they forgot to export a promise? O_o */
  }
}

// Borrowed from: https://github.com/oesmith/PJ_robin.js/blob/master/pj_robin.js
function projectRobin (lat, lng, remap = false) {
  // note: following terms based upon 5 deg. intervals in degrees.
  const X = [
    [1, -5.67239e-12, -7.15511e-05, 3.11028e-06],
    [0.9986, -0.000482241, -2.4897e-05, -1.33094e-06],
    [0.9954, -0.000831031, -4.4861e-05, -9.86588e-07],
    [0.99, -0.00135363, -5.96598e-05, 3.67749e-06],
    [0.9822, -0.00167442, -4.4975e-06, -5.72394e-06],
    [0.973, -0.00214869, -9.03565e-05, 1.88767e-08],
    [0.96, -0.00305084, -9.00732e-05, 1.64869e-06],
    [0.9427, -0.00382792, -6.53428e-05, -2.61493e-06],
    [0.9216, -0.00467747, -0.000104566, 4.8122e-06],
    [0.8962, -0.00536222, -3.23834e-05, -5.43445e-06],
    [0.8679, -0.00609364, -0.0001139, 3.32521e-06],
    [0.835, -0.00698325, -6.40219e-05, 9.34582e-07],
    [0.7986, -0.00755337, -5.00038e-05, 9.35532e-07],
    [0.7597, -0.00798325, -3.59716e-05, -2.27604e-06],
    [0.7186, -0.00851366, -7.0112e-05, -8.63072e-06],
    [0.6732, -0.00986209, -0.000199572, 1.91978e-05],
    [0.6213, -0.010418, 8.83948e-05, 6.24031e-06],
    [0.5722, -0.00906601, 0.000181999, 6.24033e-06],
    [0.5322, 0.0, 0.0, 0.0]
  ]
  const Y = [
    [0, 0.0124, 3.72529e-10, 1.15484e-09],
    [0.062, 0.0124001, 1.76951e-08, -5.92321e-09],
    [0.124, 0.0123998, -7.09668e-08, 2.25753e-08],
    [0.186, 0.0124008, 2.66917e-07, -8.44523e-08],
    [0.248, 0.0123971, -9.99682e-07, 3.15569e-07],
    [0.31, 0.0124108, 3.73349e-06, -1.1779e-06],
    [0.372, 0.0123598, -1.3935e-05, 4.39588e-06],
    [0.434, 0.0125501, 5.20034e-05, -1.00051e-05],
    [0.4968, 0.0123198, -9.80735e-05, 9.22397e-06],
    [0.5571, 0.0120308, 4.02857e-05, -5.2901e-06],
    [0.6176, 0.0120369, -3.90662e-05, 7.36117e-07],
    [0.6769, 0.0117015, -2.80246e-05, -8.54283e-07],
    [0.7346, 0.0113572, -4.08389e-05, -5.18524e-07],
    [0.7903, 0.0109099, -4.86169e-05, -1.0718e-06],
    [0.8435, 0.0103433, -6.46934e-05, 5.36384e-09],
    [0.8936, 0.00969679, -6.46129e-05, -8.54894e-06],
    [0.9394, 0.00840949, -0.000192847, -4.21023e-06],
    [0.9761, 0.00616525, -0.000256001, -4.21021e-06],
    [1.0, 0.0, 0.0, 0]
  ]
  const NODES = 18
  const V = (C, z) => C[0] + z * (C[1] + z * (C[2] + z * C[3]))
  const FXC = 0.8487
  const FYC = 1.3523
  const D2R = Math.PI / 180.0
  const R2D = 180.0 / Math.PI
  const C1 = 11.459155902616464
  const RC1 = 0.0872664625997164
  const SCALE = 0.1875279169222285

  const phi = lat * D2R
  const lam = lng * D2R

  let dphi = Math.abs(phi)
  let i = Math.floor(dphi * C1)
  if (i >= NODES) i = NODES - 1
  dphi = R2D * (dphi - RC1 * i)
  const x = V(X[i], dphi) * FXC * lam
  let y = V(Y[i], dphi) * FYC

  if (phi < 0) y = -y

  if (remap) return { x: x * SCALE + 0.5, y: y * -SCALE + 0.5 }
  else return { x, y }
}
