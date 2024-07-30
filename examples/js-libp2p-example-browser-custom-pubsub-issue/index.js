import { DirectSub } from '@peerbit/pubsub'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'

import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { dcutr } from '@libp2p/dcutr'
import { identify } from '@libp2p/identify'
import { webRTC } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { multiaddr } from '@multiformats/multiaddr'
import { createLibp2p } from 'libp2p'
import { fromString, toString } from 'uint8arrays'
import { peerIdFromBytes ,peerIdFromKeys} from '@libp2p/peer-id'
import {  ready }  from '@peerbit/crypto'
import { getBase64UrlEncodedPeerId, getPeerIdFromBase64urlEncoded } from './utils'
await ready;

const DOM = {
  peerId: () => document.getElementById('peer-id'),

  dialMultiaddrInput: () => document.getElementById('dial-multiaddr-input'),
  dialMultiaddrButton: () => document.getElementById('dial-multiaddr-button'),

  subscribeTopicInput: () => document.getElementById('subscribe-topic-input'),
  subscribeTopicButton: () => document.getElementById('subscribe-topic-button'),

  sendTopicMessageInput: () => document.getElementById('send-topic-message-input'),
  sendTopicMessageButton: () => document.getElementById('send-topic-message-button'),

  output: () => document.getElementById('output'),

  listeningAddressesList: () => document.getElementById('listening-addresses'),
  peerConnectionsList: () => document.getElementById('peer-connections'),
  topicPeerList: () => document.getElementById('topic-peers')
}

const appendOutput = (line) => {
  DOM.output().innerText += `${line}\n`
}

const replaceOutput = (line) => {
  DOM.output().innerText = line
}

const clean = (line) => line.replaceAll('\n', '')


const base64UrlEncodedPeerIdFromSearchParams = new URLSearchParams(window.location.search).get('peerId')
let peerId = undefined; 
if (base64UrlEncodedPeerIdFromSearchParams) {
  peerId = await getPeerIdFromBase64urlEncoded(base64UrlEncodedPeerIdFromSearchParams)
  appendOutput(`Using peerId from URL: ${peerId}`)
}
const libp2p = await createLibp2p({
  peerId,
  addresses: {
    listen: [
      // create listeners for incoming WebRTC connection attempts on on all
      // available Circuit Relay connections
      '/webrtc'
    ]
  },
  transports: [
    // the WebSocket transport lets us dial a local relay
    webSockets({
      // this allows non-secure WebSocket connections for purposes of the demo
      filter: filters.all
    }),
    // support dialing/listening on WebRTC addresses
    webRTC(),
    // support dialing/listening on Circuit Relay addresses
    circuitRelayTransport({
      // make a reservation on any discovered relays - this will let other
      // peers use the relay to contact us
      discoverRelays: 1
    })
  ],
  // a connection encrypter is necessary to dial the relay
  connectionEncryption: [noise()],
  // a stream muxer is necessary to dial the relay
  streamMuxers: [yamux()],
  connectionGater: {
    denyDialMultiaddr: () => {
      // by default we refuse to dial local addresses from browsers since they
      // are usually sent by remote peers broadcasting undialable multiaddrs and
      // cause errors to appear in the console but in this example we are
      // explicitly connecting to a local node so allow all addresses
      return false
    }
  },
  services: {
    identify: identify(),
    pubsub:gossipsub(), /* (c) => new DirectSub(c), */
    dcutr: dcutr()
  },
  connectionManager: {
    minConnections: 0
  }
})

if(!peerId)
{
  // update the query param to include the peer id
  // so that browser-refresh yields the same peer id
  const url = new URL(window.location)
  url.searchParams.set('peerId', getBase64UrlEncodedPeerId(libp2p.peerId))
  window.history.replaceState({}, '', url.toString())

}

DOM.peerId().innerText = libp2p.peerId.toString()

function updatePeerList () {
  // Update connections list
  const peerList = libp2p.getPeers()
    .map(peerId => {
      const el = document.createElement('li')
      el.textContent = peerId.toString()

      const addrList = document.createElement('ul')

      for (const conn of libp2p.getConnections(peerId)) {
        const addr = document.createElement('li')
        addr.textContent = conn.remoteAddr.toString()

        addrList.appendChild(addr)
      }

      el.appendChild(addrList)

      return el
    })
  DOM.peerConnectionsList().replaceChildren(...peerList)
}

// update peer connections
libp2p.addEventListener('connection:open', () => {
  updatePeerList()
})
libp2p.addEventListener('connection:close', () => {
  updatePeerList()
})

// update listening addresses
libp2p.addEventListener('self:peer:update', () => {
  const multiaddrs = libp2p.getMultiaddrs()
    .map((ma) => {
      const el = document.createElement('li')
      el.textContent = ma.toString()
      return el
    })
  DOM.listeningAddressesList().replaceChildren(...multiaddrs)
})

// dial remote peer
if(new URLSearchParams(window.location.search).get('dial')) {

  const all = new URLSearchParams(window.location.search).getAll('dial')
  for (const dial of all) {
    console.log("DIAL?", dial)
    const ma = multiaddr(dial)
    appendOutput(`Dialing '${ma}'`)
    await libp2p.dial(ma)
    appendOutput(`Connected to '${ma}'`)
  }
}

DOM.dialMultiaddrButton().onclick = async () => {
  const ma = multiaddr(DOM.dialMultiaddrInput().value)
  appendOutput(`Dialing '${ma}'`)
  await libp2p.dial(ma)
  appendOutput(`Connected to '${ma}'`)

  // update query param to include the multiaddr
  const url = new URL(window.location)

  // add address to existing query params
  const arr = url.searchParams.getAll('dial')

  if (arr.includes(ma.toString()))
    return

  arr.push(ma.toString())
  const searchParams = new URLSearchParams(url.searchParams)
  searchParams.delete('dial')
  for(const addr of arr) {
    searchParams.append('dial', addr)
  }

  url.search = searchParams.toString()

  window.history.replaceState({}, '', url.toString())

}


DOM.sendTopicMessageButton().disabled = true
DOM.subscribeTopicButton().disabled = true
const topic = "topic";
DOM.subscribeTopicInput().value = topic
DOM.subscribeTopicInput().disabled = true


// subscribe to pubsub topic
/* DOM.subscribeTopicButton().onclick = async () => {
  const topic = DOM.subscribeTopicInput().value
  appendOutput(`Subscribing to '${clean(topic)}'`)

  libp2p.services.pubsub.subscribe(topic)

  DOM.sendTopicMessageInput().disabled = undefined
  DOM.sendTopicMessageButton().disabled = undefined
} */

  /* await libp2p.services.pubsub.subscribe(topic) */
  await libp2p.services.pubsub.subscribe(topic)

// send message to topic


// push data frequencylu
setInterval(() => {
  if(libp2p.services.pubsub.topics.size === 0) {
    return
  }
  const topic = DOM.subscribeTopicInput().value
  const message = DOM.sendTopicMessageInput().value
   libp2p.services.pubsub.publish(topic, fromString(message)) 
 /*  libp2p.services.pubsub.publish(fromString(message),{topics: [topic]} ) */
}, 100)


// update topic peers
setInterval(async () => {
  const topic = DOM.subscribeTopicInput().value
  const peerList = (await libp2p.services.pubsub.getSubscribers(topic))?.map(peerId => {
      const el = document.createElement('li')
      el.textContent = peerId.toString()
      return el
    }) || [];
  DOM.topicPeerList().replaceChildren(...peerList)
}, 500)

let messagesReceived = 0;
 libp2p.services.pubsub.addEventListener('message', event => {
  const topic = event.detail.topic
  const message = toString(event.detail.data)
  replaceOutput(String(messagesReceived++) + `: Received message on topic '${clean(topic)}': '${clean(message)}'\n`)
}) 
 /*  libp2p.services.pubsub.addEventListener('data', event => {
    console.log(event)
    const topic = event.detail.data.topics[0]
    const message = toString(event.detail.data.data)
    replaceOutput(String(messagesReceived++) + `: Received message on topic '${clean(topic)}': '${clean(message)}'\n`)
  }) */