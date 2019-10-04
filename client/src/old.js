import React from 'react'
import Peer from 'peerjs'

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
  constructor(props) {
    super(props)
    this.state = {
      roomId: Math.random().toString(36).substring(2, 15),
      connected: false,
      micActive: false,
      camActive: false,
      screenShareActive: false,
      snackOpen: false,
    }
    this.peer = null
    this.isPeerJoining = window.location.pathname.length > 1
    this.hostPeerId = window.location.pathname.replace('/', '')
    this.remotePeerList = []
    this.connections = []
    this.videoStream = null
    this.videoCalls = []
    this.audioStream = null
    this.audioCalls = []
  }

  componentDidMount() {
    this.initPeer()
      .then(() => {
        if (this.isPeerJoining) {
          // Joiner:
          // Connects to host
          // Waits for the host to call
          // Answers when called
          // Can then re-call the host with new streams for stream changes
          this.clientUtils.connect(this.hostPeerId)
          this.clientUtils.waitForCalls()
        } else {
          // Host:
          // Waits for connections
          // Calls joiners when a stream is on
          // Waits for new calls from joiners for stream changes
          this.hostUtils.waitForConnections()
          this.clientUtils.waitForCalls()
        }
      })
  }

  initPeer = () => {
    return new Promise((resolve, reject) => {
      this.peer = new Peer(this.state.roomId)
      this.peer.on('open', id => {
        resolve('Peer created')
      })
      console.log('Peer created:', this.peer.id, this.peer)
    })
  }

  clientUtils = {
    connect: (peerId) => {
      // Joining peer initiates the connection, the host accepts
      console.log('Trying to connect peer:', peerId)
      const connection = this.peer.connect(peerId)
      connection.on('open', () => {
        console.log('Connected to peer.')
        this.setState({
          connected: true
        })
      })
      connection.on('error', (err) => {
        console.log('Error while connecting:', err)
      })
      connection.on('close', () => {
        this.connections = this.connections.filter(conn => conn.peerId !== peerId)
        this.setState({
          connected: this.connections.length > 0
        })
      })
      this.connections.push(connection)
    },
    waitForCalls: () => {
      this.peer.on('call', this.clientUtils.handleIncomingCall)
    },
    handleIncomingCall: (call) => {
      if (this.isTrustedPeer(call.peer)) {
        console.log('Call received:', call)
        // Accept the call
        this.acceptCall(call)
      } else {
        console.log('A call was ignored from a non-trusted peer.')
      }
    },
    handleRemoteStream: (stream) => {
      if (this.getStreamType(stream) === 'video') {
        // Stream has video
        console.log('Incoming video stream:', stream)
        this.playVideoStream(stream)
      } else {
        // Audio only
        console.log('Incoming audio stream:', stream)
        this.playAudioStream(stream)
      }
    },
  }

  hostUtils = {
    waitForConnections: () => {
      this.peer.on('connection', this.hostUtils.handleIncomingConnection)
    },
    handleIncomingConnection: (conn) => {
      console.log('Connection received:', conn)
      this.hostUtils.bindConnection(conn)
      this.setState({
        connected: true
      })
      this.remotePeerList = [...this.remotePeerList, conn.peer]
      // Call if any stream active
      this.hostUtils.tryCalling(conn.peer)
    },
    bindConnection: (conn) => {
      conn.on('close', () => {
        // //this.hostUtils.startCall(conn.peer)
        this.removePeerFromlist(conn.peer)
      })
    },
    videoCall: (peerId) => {
      if (this.videoStream) {
        this.cleanUpVideoCalls()
        const videoCall = this.peer.call(peerId, this.videoStream,
          {
            // sdpTransform: (sdp) => { return this.changeCodec(sdp) }, // Doesn't seem to work
            metadata: { callType: 'video' }
          }
          )
        videoCall.on('error', err => {
          console.log('Error while videoCall:', err)
          if (err.message.includes('disconnected')) {
            this.removePeerFromlist(peerId)
            this.videoCalls = this.videoCalls.filter(call => call.peer !== peerId)
          }
        })
        videoCall.on('stream', stream => {
          if (this.isTrustedPeer(peerId)) {
            console.log('Caller also has a video stream:', stream)
            this.playVideoStream(stream)
          } else {
            console.log('A non-trusted caller\'s video stream was ignored.')
          }
        })
        this.videoCalls.push(videoCall)
      }
    },
    audioCall: (peerId) => {
      if (this.audioStream) {
        this.cleanUpAudioCalls()
        const audioCall = this.peer.call(peerId, this.audioStream, { metadata: { callType: 'audio' } })
        audioCall.on('error', err => {
          console.log('Error while audioCall:', err)
          if (err.message.includes('disconnected')) {
            this.removePeerFromlist(peerId)
            this.audioCalls = this.audioCalls.filter(call => call.peer !== peerId)
          }
        })
        audioCall.on('stream', stream => {
          if (this.isTrustedPeer(peerId)) {
            // Answer stream can only be audio
            console.log('Caller also has an audio stream:', stream)
            this.playAudioStream(stream)
          } else {
            console.log('A non-trusted caller\'s audio stream was ignored.')
          }
        })
        this.audioCalls.push(audioCall)
      }
    },
    tryCalling: (peerId) => {
      this.hostUtils.videoCall(peerId)
      this.hostUtils.audioCall(peerId)
    }
  }

  acceptCall = (call) => {
    if (call.metadata.callType === 'video') {
      if (this.videoStream) {
        call.answer(this.videoStream)
      } else {
        call.answer()
      }
    } else if (call.metadata.callType === 'audio') {
      if (this.audioStream) {
        call.answer(this.audioStream)
      } else {
        call.answer()
      }
    }
    call.on('stream', this.clientUtils.handleRemoteStream)
  }

  getStreamType = (stream) => {
    console.log('Checking stream type:', stream)
    return stream.getTracks().find(s => s.kind === 'video') ? 'video' : 'audio'
  }

  playVideoStream = (srcObject) => {
    this.refs.screen.srcObject = null
    this.refs.screen.muted = true
    this.refs.screen.controls = true
    this.refs.screen.srcObject = srcObject
  }

  playAudioStream = (srcObject) => {
    this.refs.speaker.srcObject = null
    this.refs.speaker.srcObject = srcObject
  }

  toggleMic = async () => {
    if (this.audioStream === null) {
      // New audio stream
      this.audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
      this.setState({ micActive: true })
      console.log('Created audio stream:', this.audioStream)
      if (this.state.connected) {
        if (this.isPeerJoining) {
          // Client calls the host
          this.hostUtils.audioCall(this.hostPeerId)
        } else {
          // Host audio calls every client
          this.remotePeerList.forEach(peer => {
            this.hostUtils.audioCall(peer)
          })
        }
      }
    } else {
      // Audio stream exists
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
      try {
        this.videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      } catch (error) {
        console.log(error)
        return
      }
      this.setState({ camActive: true })
      console.log('Created video stream (Webcam):', this.videoStream)
      if (this.state.connected) {
        if (this.isPeerJoining) {
          // Client calls the host
          this.hostUtils.videoCall(this.hostPeerId)
        } else {
          // Host calls every client
          this.remotePeerList.forEach(peer => {
            this.hostUtils.videoCall(peer)
          })
        }
      }
    } else {
      // Video stream exists
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
      this.videoStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      // Screen sharing with audio, close audio stream
      if (this.videoStream.getAudioTracks().length > 0 && this.state.micActive) {
        await this.toggleMic()
      }
      this.setState({ screenShareActive: true })
      console.log('Created video stream (Screen):', this.videoStream)
      // Call every connection again
      if (this.state.connected) {
        if (this.isPeerJoining) {
          // Client calls the host
          this.hostUtils.videoCall(this.hostPeerId)
        } else {
          // Host calls every client
          this.remotePeerList.forEach(peer => {
            this.hostUtils.videoCall(peer)
          })
        }
      }
    } else {
      // Video stream exists
      this.videoStream.getTracks().forEach(track => track.stop())
      this.videoStream = null
      this.setState({ screenShareActive: false })
      console.log('Removed video stream (Screen).')
    }
  }

  changeCodec = (sdp) => {
    const newSdp = sdp.replace(/(?:m=video \d+ (?:(?:\w+)?(?:\/)?)+ (.*)\n)/gi, (m, p1) => {
      return m.replace(p1,'98 100 96 97 99 101 102 122 127 121 125 107 108 109 124 120 123 119 114 115 116')
    })
    console.log(newSdp)
    return 'anan'
  }

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

  copyUrl = () => {
    const textEl = this.refs.urlText.children[0]
    const prettyUrl = textEl.value
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
    return window.location.hostname + '/' + this.state.roomId
  }

  isTrustedPeer = (peerId) => {
    if (this.isPeerJoining) {
      return peerId === this.hostPeerId
    } else {
      return this.remotePeerList.length > 0 && this.remotePeerList[0] === peerId
    }
  }

  removePeerFromlist = (peerId) => {
    const remotePeerList = this.remotePeerList.filter(p => p !== peerId)
    this.setState({
      connected: remotePeerList.length > 0
    })
    this.remotePeerList = remotePeerList
  }

  cleanUpVideoCalls = () => {
    if (this.videoCalls.length > 0) {
      this.videoCalls.forEach(call => {
        if (!this.remotePeerList.includes(call.peer)) {
          call.close()
          this.videoCalls = this.videoCalls.filter(c => c.peer !== call.peer)
        }
      })
    }
  }

  cleanUpAudioCalls = () => {
    if (this.audioCalls.length > 0) {
      this.audioCalls.forEach(call => {
        if (!this.remotePeerList.includes(call.peer)) {
          call.close()
          this.audioCalls = this.audioCalls.filter(c => c.peer !== call.peer)
        }
      })
    }
  }

  isMobileDevice = !!(/Android|webOS|iPhone|iPad|iPod|BB10|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent || ''))

  render() {
    return (
      <div className='App'>
        <div className='main-container'>

          <Typography variant="h3">
            Screen Share
          </Typography>

          {
            !this.isPeerJoining ?
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
