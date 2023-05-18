import { decodeASL, flagOf, roll } from './index.js'
import Geohash from 'latlon-geohash'
import { nip19 } from 'nostr-tools'
import { schnorr } from '@noble/curves/secp256k1'
import { bytesToHex } from '@noble/hashes/utils'
let elForm
let isMining = false
let secret = null
let player = null

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
    const burn = !!fd.get('pow')
    const bits = burn ? parseInt(fd.get('bits')) : 5
    const mute = !!fd.get('music')
    const location = Geohash.encode(lat, lon, 6)
    console.log('Generating', age, sex, location, mute)
    secret = null
    const start = performance.now()
    let keysTested = 0
    const testCount = 1000
    if (!mute) await initSound()
    setMiningState(true)
    const rollLoop = () => setTimeout(() => {
      if (!secret && isMining) {
        secret = roll(age, sex, location, bits, testCount)
        keysTested += testCount
        const hashRate = keysTested / (performance.now() - start)
        document.getElementById('hashrate').innerText = `Hashrate: ${(hashRate * 1000).toFixed(2)} keys/s`
      }

      // Auto-restart/stop
      if (!secret && isMining) rollLoop()
      else {
        if (secret) {
          document.getElementById('secret').innerText = 'SECRET KEY:\n' + secret + '\n---\n' + nip19.nsecEncode(secret)
          document.getElementById('inp-pk').value = bytesToHex(schnorr.getPublicKey(secret))
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

/**
 * Decodes public Key pasted in input and
 * updates the preview/visualization
 * @type {(event: Event) => void}
 */
function decodePublicKey (event) {
  if (event) event.preventDefault()
  const portraits = ['👩', '👨', '🌈', '🤖']
  const ageSpans = ['16+', '24+', '32+', '42+']

  const { value } = document.getElementById('inp-pk')
  if (!value.length) return
  const isHex = /^[a-fA-F0-9]+$/

  let ASL = null
  if (!isHex.test(value)) {
    const { type, data } = nip19.decode(value)
    if (type !== 'npub') throw new Error(`Invalid type: ${type}`)
    ASL = decodeASL(data)
  } else {
    ASL = decodeASL(value)
  }
  // Todo, verify ASL geolocations Lat and lon
  const { lat, lon } = Geohash.decode(ASL.location)

  // TODO: example line
  console.log('ASL', ASL)
  // document.getElementById('outPortrait').innerText = 'bob'
  document.getElementById('outPortrait').innerText = portraits[ASL.sex]
  document.getElementById('outAge').innerText = ageSpans[ASL.age]

  document.getElementById('outLocation').href = `https://www.openstreetmap.org/search?query=${lat},${lon}`
  document.getElementById('outLocation').innerText = `Geohash: ${ASL.location}, Lat: ${lat}, Lon: ${lon}`
  document.getElementById('outFlag').innerText = flagOf(ASL.location)
}

/**
 * Attaches listeners to elements when document
 * has finished loading.
 */
function boot () {
  console.log('initializing...')
  elForm = document.getElementById('constraints')
  elForm.onsubmit = generate
  document.getElementById('btn-geo')
    .addEventListener('click', fetchLocation)

  document.getElementById('btn-nip07')
    .addEventListener('click', nip07reveal)

  const pkInput = document.getElementById('inp-pk')
  pkInput.addEventListener('change', decodePublicKey)
  pkInput.addEventListener('keyup', decodePublicKey)

  document.getElementById('music-switch')
    .addEventListener('change', ev => {
      if (!player) return
      if (!ev.target.value) player.resume()
      else player.pause()
    })
}
document.addEventListener('DOMContentLoaded', boot)

/**
 * Initialize sound-system
 */
async function initSound () {
  if (!player) {
    const res = await fetch('dubmood_-_finland_sux.xm')
    const ab = await res.arrayBuffer()
    await ModPlayer.wasmLoaded()
    player = new ModPlayer(24000, 4096 << 1)
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
      for(var j = 1; j <= ninsts; ++j) {
        xmd.instruments.push({
          latestTrigger: Module._xm_get_latest_trigger_of_instrument(moduleContext, j),
        });
      }

      xmd.channels = [];
      for(var j = 1; j <= nchans; ++j) {
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
