import React from 'react'
import PeerUtils from './PeerUtils'

// import Peer from 'simple-peer' // DEV

import './App.css'
import Snackbar from '@material-ui/core/Snackbar'
import Typography from '@material-ui/core/Typography'
import Paper from '@material-ui/core/Paper'
import InputBase from '@material-ui/core/InputBase'
import Divider from '@material-ui/core/Divider'

import ShareIcon from '@material-ui/icons/Share'
import ErrorIcon from '@material-ui/icons/Error'
import DoneIcon from '@material-ui/icons/Done'
import IconButton from '@material-ui/core/IconButton'
import MicIcon from '@material-ui/icons/Mic'
import MicOffIcon from '@material-ui/icons/MicOff'
import ScreenShareIcon from '@material-ui/icons/ScreenShare'
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare'
import VideocamIcon from '@material-ui/icons/Videocam'
import VideocamOffIcon from '@material-ui/icons/VideocamOff'
import FullScreenIcon from '@material-ui/icons/Fullscreen'

class App extends React.Component {
  constructor() {
    super()
    this.state = {
      roomId: '',
      connected: false,
      micActive: false,
      camActive: false,
      screenShareActive: false,
      snackOpen: false,
    }
    this.targetId = window.location.pathname.replace('/', '')
    this.sessionType = this.targetId !== '' ? 'joiner' : 'hoster'
    this.videoStream = null
    this.audioStream = null
    this.init(this.sessionType)
  }

  init = (type) => {
    if (type === 'hoster') {
      this.peerList = [] // [{ peerId: '', socketId: '' }, ...]
      return new PeerUtils(
        this.handleNewPeer,
        this.handleDisconnectedPeerAsHoster,
        this.handleConnectedAsHoster,
        this.targetId
        )
    } else if (type === 'joiner') {
      this.hostPeer = null
      new PeerUtils(
        () => {},
        this.handleDisconnectedPeerAsJoiner,
        this.handleConnectedAsJoiner,
        this.targetId
        )
    }
  }

  handleConnectedAsHoster = (ownPeerId) => {
    this.setState({
      roomId: ownPeerId
    })
  }

  handleConnectedAsJoiner = (hostPeer) => {
    hostPeer.on('stream', stream => {
      console.log('Host shares a stream:', stream)
      this.playStream(stream)
    })
    // console.log(hostPeer)
    this.hostPeer = hostPeer
    this.setState({
      connected: true
    })
  }

  handleNewPeer = async (peerData) => {
    /** @type {Peer} */
    const peer = peerData.peer
    peer.socketId = peerData.socketId
    console.log('A peer connected:', peer)
    peer.on('stream', this.handlePeerStreamAsHoster(peer))
    this.sendStreamsToNewPeer(peer)
    this.peerList.push(peer)
    this.setState({ connected: true })
  }

  handlePeerStreamAsHoster = (peer) => (stream) => {
    if (this.isTrustedPeer(peer)) {
      this.playStream(stream)
    } else {
      console.log('A non-trusted peer started a stream.')
    }
  }

  handleDisconnectedPeerAsHoster = (socketId) => {
    const prevPeerCount = this.peerList.length
    this.peerList = this.peerList.filter(peer => peer.socketId !== socketId)
    if (this.peerList.length < prevPeerCount) {
      console.log('A peer disconnected.')
      this.setState({
        connected: this.peerList.length > 0
      })
    }
  }

  handleDisconnectedPeerAsJoiner = (socketId) => {
    if (this.hostPeer.socketId === socketId) {
      console.log('The host was disconnected from the server.')
      this.setState({ connected: false })
    }
  }

  sendStreamsToNewPeer = (peer) => {
    if (this.videoStream) {
      peer.addStream(this.videoStream)
    }
    if (this.audioStream) peer.addStream(this.audioStream)
  }

  updateStreamOnPeers = (newStream, type, removeOnly) => {
    let oldStream
    if (type === 'video') {
      oldStream = this.videoStream
    } else {
      oldStream = this.audioStream
    }
    if (this.sessionType === 'hoster') {
      // Hoster updates streams on every peer connection
      this.peerList.forEach((/** @type {Peer} */peer) => {
        if (oldStream) peer.removeStream(oldStream)
        if (!removeOnly) peer.addStream(newStream)
      })
    } else if (this.sessionType === 'joiner') {
      // Joiner only updates the hoster's
      if (oldStream) this.hostPeer.removeStream(oldStream)
      if (!removeOnly) this.hostPeer.addStream(newStream)
    }
  }
  
  isTrustedPeer = (peer) => {
    if (this.sessionType === 'hoster') {
      // Hoster trusts the first joiner
      if (this.peerList.length > 0)
        return this.peerList[0]._id === peer._id
    } else if (this.sessionType === 'joiner') {
      if (this.hostPeer)
        return this.hostPeer._id === peer._id
    }
  }

  toggleMic = async () => {
    if (this.audioStream === null) {
      // New audio stream
      let newAudioStream
      try {
        newAudioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
      } catch (err) {
        console.log('Problem while getUserMedia:', err)
        return
      }
      this.setState({ micActive: true })
      console.log('Created audio stream:', newAudioStream)
      if (this.state.connected) {
        this.updateStreamOnPeers(newAudioStream, 'audio')
      }
      this.audioStream = newAudioStream
    } else {
      // Audio stream exists
      this.updateStreamOnPeers(null, 'audio', true)
      this.audioStream.getTracks().forEach(track => track.stop())
      this.audioStream = null
      this.setState({ micActive: false })
      console.log('Removed audio stream.')
    }
  }

  toggleCam = async () => {
    // Close screen share stream first
    if (this.state.screenShareActive) { this.toggleScreenShare() }

    if (this.videoStream === null) {
      // New video stream
      let newVideoStream
      try {
        newVideoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      } catch (err) {
        console.log('Problem while getUserMedia:', err)
        return
      }
      this.setState({ camActive: true })
      console.log('Created video stream (Webcam):', newVideoStream)
      // Call every connection again
      if (this.state.connected) {
        this.updateStreamOnPeers(newVideoStream, 'video')
      }
      this.videoStream = newVideoStream
    } else {
      // Video stream exists
      this.updateStreamOnPeers(null, 'video', true)
      this.videoStream.getTracks().forEach(track => track.stop())
      this.videoStream = null
      this.setState({ camActive: false })
      console.log('Removed video stream (Webcam).')
    }
  }

  toggleScreenShare = async () => {
    // Close camera stream first
    if (this.state.camActive) { this.toggleCam() }

    if (this.videoStream === null) {
      // New video stream
      let newVideoStream
      try {
        newVideoStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      } catch (err) {
        console.log('Problem while getDisplayMedia:', err)
        return
      }
      // Screen sharing with audio, close audio stream
      // if (this.videoStream.getAudioTracks().length > 0 && this.state.micActive) {
      //   await this.toggleMic()
      // }
      this.setState({ screenShareActive: true })
      console.log('Created video stream (Screen):', newVideoStream)
      // Call every connection again
      if (this.state.connected) {
        this.updateStreamOnPeers(newVideoStream, 'video')
      }
      this.videoStream = newVideoStream
    } else {
      // Video stream exists
      this.updateStreamOnPeers(null, 'video', true)
      this.videoStream.getTracks().forEach(track => track.stop())
      this.videoStream = null
      this.setState({ screenShareActive: false })
      console.log('Removed video stream (Screen).')
    }
  }

  streamHasVideo = (stream) => {
    return stream.getVideoTracks().length > 0
  }

  playStream = (stream) => {
    if (this.streamHasVideo(stream)) {
      this.refs.screen.srcObject = null
      this.refs.screen.muted = true
      this.refs.screen.srcObject = stream
      this.refs.screen.load()
    } else {
      this.refs.speaker.srcObject = null
      this.refs.speaker.srcObject = stream
    }
  }

  toggleFullScreen = () => {
    if (!document.mozFullScreen && !document.webkitFullScreen) {
      if (this.refs.screen.mozRequestFullScreen) {
        this.refs.screen.mozRequestFullScreen()
      } else {
        this.refs.screen.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT)
      }
    } else {
      if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen()
      } else {
        document.webkitCancelFullScreen()
      }
    }
  }

  getShareUrl = () => {
    if (this.state.roomId) {
      return window.location.hostname + '/' + this.state.roomId
      // return window.location.hostname + ':3000/' + this.state.roomId // DEV
    } else {
      return 'Creating your shareable link...'
    }
  }

  copyUrl = () => {
    const textEl = this.refs.urlText.children[0]
    const prettyUrl = textEl.value
    // textEl.value = 'http://' + prettyUrl // DEV
    textEl.value = 'https://' + prettyUrl
    textEl.select()
    document.execCommand('copy')
    textEl.value = prettyUrl
    window.getSelection().removeAllRanges()
    this.setState({ snackOpen: true }, () => {
      setTimeout(() => {
        this.setState({ snackOpen: false })
      }, 1500)
    })
  }

  isMobileDevice = !!(/Android|webOS|iPhone|iPad|iPod|BB10|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent || ''))

  renderButtons = () => {
    const buttons = {
      mic: (
        <div id='micButton' onClick={this.toggleMic}>
          {
            this.state.micActive ?
              <IconButton>
                <MicOffIcon />
              </IconButton>
              :
              <IconButton>
                <MicIcon />
              </IconButton>
          }
        </div>
      ),
      screenShare: (
        <div id='screenShareButton' onClick={this.toggleScreenShare}>
          {
            this.state.screenShareActive ?
              <IconButton>
                <StopScreenShareIcon />
              </IconButton>
              :
              <IconButton>
                <ScreenShareIcon />
              </IconButton>
          }
        </div>
      ),
      camToggle: (
        <div id='camToggleButton' onClick={this.toggleCam}>
          {
            this.state.camActive ?
              <IconButton>
                <VideocamOffIcon />
              </IconButton>
              :
              <IconButton>
                <VideocamIcon />
              </IconButton>
          }
        </div>
      ),
      fullScreen: (
        <div id='fullScreenToggleButton' onClick={() => { this.toggleFullScreen() }}>
          <IconButton>
            <FullScreenIcon />
          </IconButton>
        </div>
      )
    }
    return (
      <div className='button-container'>
        {
          !!navigator.mediaDevices.getUserMedia ?
            buttons.mic : ''
        }
        {
          !this.isMobileDevice ?
            buttons.screenShare : ''
        }
        {
          !!navigator.mediaDevices.getUserMedia ?
            buttons.camToggle : ''
        }
        {
          buttons.fullScreen
        }
      </div>
    )
  }

  render() {
    return (
      <div className='App'>
        <div className='main-container'>

          <Typography variant="h3">
            Screen Share
          </Typography>

          {
            this.sessionType === 'hoster' ?
              <Paper className='url-container' onClick={this.copyUrl}>
                <IconButton
                  style={{ fontSize: 15, color: 'gray' }}
                  disabled
                >
                  Your URL:
                </IconButton>
                <InputBase
                  ref='urlText'
                  style={{ flex: 1 }}
                  value={this.getShareUrl()}
                  readOnly
                />
                <Divider style={{ height: 28, margin: 4 }} orientation='vertical'></Divider>
                <IconButton style={{ padding: 10 }}>
                  <ShareIcon></ShareIcon>
                </IconButton>
              </Paper>
              :
              !this.state.connected ?
                <Typography variant="h6" style={{ marginTop: 20, fontSize: 16 }}>
                  Connecting...
                </Typography>
                :
                ''
          }

          <div className='status-container'>
            {
              this.state.connected ?
                <DoneIcon></DoneIcon>
                :
                <ErrorIcon></ErrorIcon>
            }
            <Typography variant="h6" style={{ marginLeft: 5 }}>
              {
                this.state.connected ?
                  'Connected'
                  :
                  'Not Connected'
              }
            </Typography>
          </div>

          <div className='screen-container'>
            <video id='screen' ref='screen' onCanPlay={(e) => { e.target.play() }}></video>
            <audio id='speaker' ref='speaker' onCanPlay={(e) => { e.target.play() }}></audio>
          </div>

          {this.renderButtons()}

        </div>
        <Snackbar
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center'
          }}
          open={this.state.snackOpen}
          message={<span>Copied to clipboard!</span>}
        />
      </div>
    )
  }
}

export default App
