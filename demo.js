import { decodeASL, roll } from './index.js'
import Geohash from 'latlon-geohash'
import {nip19} from 'nostr-tools'

let elForm
function generate (event) {
  event.preventDefault()
  const fd = new FormData(event.target)
  const age = parseInt(fd.get('age'))
  const sex = parseInt(fd.get('sex'))
  const lat = parseFloat(fd.get('lat'))
  const lon = parseFloat(fd.get('lon'))
  const bits = parseInt(fd.get('bits'))
  const location = Geohash.encode(lat, lon, 6)
  console.log('Generating', age, sex, location)
  const secret = roll(age, sex, location, bits, 5000)
  console.log('Secret rolled', secret)
}

async function nip07reveal (event) {
  event.preventDefault()
  if (typeof window.nostr?.getPublicKey !== 'function') {
    return window.alert('You don\'t have passport installed, lookup nos2x / nos2x-fox')
  }
  const pk = await window.nostr.getPublicKey()
  document.getElementById('inp-pk').value = pk
}

async function fetchLocation (event) {
  event.preventDefault()
  const res = await new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('Browser does not support geolocation APIs'))
    else navigator.geolocation.getCurrentPosition(resolve, reject)
  })
  document.getElementById('lat').value = res.coords.latitude
  document.getElementById('lon').value = res.coords.longitude
}

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
