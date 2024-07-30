import { peerIdFromKeys} from '@libp2p/peer-id'
import { fromString, toString } from 'uint8arrays'

export const getPeerIdFromBase64urlEncoded =async  (base64UrlEncodedPeerIdFromSearchParams) => {
    const peerIdConcatinated = fromString(base64UrlEncodedPeerIdFromSearchParams, 'base64url')
    const privateKey  = peerIdConcatinated.slice(36)
    const publicKey = peerIdConcatinated.slice(0,36)
    return peerIdFromKeys(publicKey, privateKey)
}

export const getBase64UrlEncodedPeerId =  (peerId) => {
    const concatinated = new Uint8Array([...peerId.publicKey, ...peerId.privateKey])
    const base64UrlEncodedPeerId = toString(concatinated, 'base64url')
    return  base64UrlEncodedPeerId
}