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
  if (isMining) { // -- STOP KEYGEN
    console.log('KEYGEN: STOP')
    isMining = false
  } else { // -- START KEYGEN
    console.log('KEYGEN: START')
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
    const keysTested = 0
    const rollLoop = () => setTimeout(() => {
      if (!secret && isMining) secret = roll(age, sex, location, bits, 5000)
      else isMining = false
    }, 20)
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
  const GPS = Geohash.decode(ASL.location)
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
