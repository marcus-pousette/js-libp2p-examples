/* eslint-disable no-console */

import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { mplex } from '@libp2p/mplex'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { createLibp2p } from 'libp2p'
import fs from 'fs'
import { getBase64UrlEncodedPeerId, getPeerIdFromBase64urlEncoded } from './utils.js'

let peerIdFromTempFile = undefined
if(fs.existsSync('./tmp/peerIdTempFile')){ 
  const base64Encoded = fs.readFileSync('./tmp/peerIdTempFile').toString()
  peerIdFromTempFile = await getPeerIdFromBase64urlEncoded(base64Encoded)
} 


const server = await createLibp2p({
  peerId: peerIdFromTempFile,
  addresses: {
    listen: ['/ip4/127.0.0.1/tcp/62236/ws']
  },
  transports: [
    webSockets({
      filter: filters.all
    })
  ],
  connectionEncryption: [noise()],
  streamMuxers: [yamux(), mplex()],
  services: {
    identify: identify(),
    relay: circuitRelayServer({

      reservations: {
        maxReservations: Infinity
      }
    })
  },
  connectionManager: {
    minConnections: 0
  }
})

if(!peerIdFromTempFile)
{
  // create folder if it does not exist
  if (!fs.existsSync('./tmp')) {
    fs.mkdirSync('./tmp');
  }

  fs.writeFileSync('./tmp/peerIdTempFile', getBase64UrlEncodedPeerId(server.peerId))
}
console.log('Relay listening on multiaddr(s): ', server.getMultiaddrs().map((ma) => ma.toString()))
