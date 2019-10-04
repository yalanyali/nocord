import SimpleSignalClient from 'simple-signal-client'
import socketIOClient from 'socket.io-client'

// const SOCKET_SERVER = window.location.origin.replace('3000', '80') // DEV
const SOCKET_SERVER = window.location.origin

const ICE_SERVERS = [
  { 'urls': 'stun:stun.schlund.de' },
  { 'urls': 'stun:stun.sipgate.net' },
  // { 'urls': 'stun:217.10.68.152' },
  // { 'urls': 'stun:stun.sipgate.net:10000' },
  // { 'urls': 'stun:217.10.68.152:10000' },
  { 'url': 'turn:numb.viagenie.ca', 'username': 'y.alanyali@gmail.com', 'credential': 'testserver', 'credentialType': 'password' },
  { 'urls': 'turn:192.155.84.88', 'username': 'easyRTC', 'credential': 'easyRTC@pass', 'credentialType': 'password' }
  // { 'urls': 'turn:192.155.84.88?transport=tcp', 'username': 'easyRTC', 'credential': 'easyRTC@pass', 'credentialType': 'password' },
  // {
  //   'urls': 'turn:192.155.86.24:443',
  //   'credential': 'easyRTC@pass',
  //   'username': 'easyRTC',
  //   'credentialType': 'password'
  // },
  // {
  //   'urls': 'turn:192.155.86.24:443?transport=tcp',
  //   'credential': 'easyRTC@pass',
  //   'credentialType': 'password',
  //   'username': 'easyRTC'
  // }
]

export default class PeerUtils {
  constructor (onNewPeer, onPeerDisconnect, onConnected, targetPeer = null) {
    this.socket = socketIOClient(SOCKET_SERVER)
    this.signalClient = new SimpleSignalClient(this.socket, { connectionTimeout: 5 * 1000 })
    this.hostPeer = null // Joiner keeps only the host peer

    // Discover checks if the peer with the given id exists
    this.signalClient.once('discover', async (peerExists) => {
      if (targetPeer) {
        // We were trying to check if target peer exists
        if (peerExists) {
          try {
            const { peer } = await this.signalClient.connect(targetPeer,
              { socketId: this.socket.id },
              {
                config: {
                  iceServers: ICE_SERVERS
                }
              }) // SDP
            console.log('Connected to the peer:', peer)
            this.hostPeer = peer
            onConnected(this.hostPeer)
          } catch (err) {
            console.log('Error connecting to the peer:', err)
          }
        } else {
          console.log('Peer is not online.')
        }
      } else {
        // No target peer, we're hosting
        // We have our own peer id at this point
        console.log('Hosted with id', this.signalClient.id)
        onConnected(this.signalClient.id)
      }
    })

    this.signalClient.on('request', async (request) => {
      // A peer requested to connect
      // Auto accept and trigger onNewPeer with Peer obj
      const req = await request.accept({}, {
        config: {
          iceServers: ICE_SERVERS
        }
      }) // SDP

      // Let the joining peer know the socket id
      this.socket.send({
        target: req.metadata.socketId,
        message: {
          socketId: this.socket.id
        }
      })
      const peerData = {
        peer: req.peer,
        socketId: req.metadata.socketId
      }
      onNewPeer(peerData)
    })

    this.socket.on('connect', () => {
      // Socket server connection ready
      // Initiate a discovery
      this.signalClient.discover({ targetPeer })
    })

    this.socket.on('peer-disconnect', (peerId) => {
      onPeerDisconnect(peerId)
    })

    this.socket.on('welcome', message => {
      // Hoster welcomes with its socket id
      this.hostPeer.socketId = message.socketId
    })
  }
}
