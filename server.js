const path = require('path')
const express = require('express')
const app = express()
const router = express.Router()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const signalServer = require('simple-signal-server')(io)

router.get('/*', (_, res) => {
  res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'))
})
app.use(express.static((path.join(__dirname, 'client', 'build'))))
app.use('/', router)

server.listen(process.env.PORT || 80)

const socketIDs = new Set()

signalServer.on('discover', (request) => {
  // Assign a client id
  const clientID = request.socket.id
  socketIDs.add(clientID)
  if (request.discoveryData.targetPeer) {
    // Client has a target to join
    request.discover(clientID, socketIDs.has(request.discoveryData.targetPeer))
  } else {
    request.discover(clientID, false)
  }
})

signalServer.on('disconnect', (socket) => {
  const clientID = socket.id
  io.emit('peer-disconnect', clientID)
  socketIDs.delete(clientID)
})

signalServer.on('request', (request) => {
  request.forward()
})

io.on('connection', socket => {
  socket.on('message', payload => {
    if (payload.target && payload.message.socketId) {
      io.to(payload.target).emit('welcome', payload.message)
    }
  })
})
