import { decodeASL, roll } from './index.js'
import Geohash from 'latlon-geohash'
import {nip19} from 'nostr-tools'

let elForm
let isMining = false
let secret = null

/**
 * Updates the 'result' section after/while
 * key-generation
 * @type {(isMining: boolean, secret: string) => void}
 */
function updateMiningState (isMining, secret) {
  
}

function generate (event) {
  event.preventDefault()
  const elBtn = document.getElementById('btn-generate')
  if (isMining) { // -- STOP KEYGEN
    console.log('KEYGEN: STOP')
    isMining = false
    elBtn.classList.remove('active')
    elBtn.innerText = 'Generate'
  } else { // -- START KEYGEN
    console.log('KEYGEN: START')
    elBtn.classList.add('active')
    elBtn.innerText = 'Stop'
    const fd = new FormData(event.target)
    const age = parseInt(fd.get('age'))
    const sex = parseInt(fd.get('sex'))
    const lat = parseFloat(fd.get('lat'))
    const lon = parseFloat(fd.get('lon'))
    const bits = parseInt(fd.get('bits'))
    const location = Geohash.encode(lat, lon, 6)
    console.log('Generating', age, sex, location)
    isMining = true
    secret = null
    const start = performance.now()
    let keysTested = 0
    const testCount = 1000
    const rollLoop = () => setTimeout(() => {
      if (!secret && isMining) {
        secret = roll(age, sex, location, bits, testCount)
        keysTested += testCount
        const hashRate = keysTested / (performance.now() - start)
        document.getElementById('hashrate').innerText = `Hashrate: ${(hashRate * 1000).toFixed(2)} keys/s`
      }

      // Auto-restart/stop
      if (!secret && isMining) rollLoop()
      else isMining = false
    }, 10)
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
  document.getElementById('lat').value = res.coords.latitude
  document.getElementById('lon').value = res.coords.longitude
}

/**
 * Decodes public Key pasted in input and
 * updates the preview/visualization
 * @type {(event: Event) => void}
 */
function decodePublicKey (event) {
  const portraits = ["👩","👨","🏳️‍🌈","🤖"]
  const ageSpans = ["16+","24+","32+","42+"]

  const { value } = event.target
  const isHex = new RegExp(/^[a-fA-F0-9]+$/);

  let ASL = null
  if(!isHex.test(value)) {
    let {type, data} = nip19.decode(value)
    ASL =  decodeASL(data)
  }
  else {
    ASL =  decodeASL(value)
  }
  //Todo, verify ASL geolocations Lat and lon
  const {lat, lon} = Geohash.decode(ASL.location)
  
  // TODO: example line
  console.log('ASL', ASL)
  // document.getElementById('outPortrait').innerText = 'bob'
  document.getElementById('outPortrait').innerText = portraits[ASL.sex]
  document.getElementById('outAge').innerText = ageSpans[ASL.age]
  
  document.getElementById('outLocation').innerText = 'Sweden ish '
  document.getElementById('outFlag').innerText = ASL.location
  document.getElementById('geoLink').href = `https://www.openstreetmap.org/search?query=${lat},${lon}`
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
}
document.addEventListener('DOMContentLoaded', boot)
