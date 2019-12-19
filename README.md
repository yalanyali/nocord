
<a href="https://nocord.yigit.host">
<img src="https://i.imgur.com/RCBw6Br.jpg"></img>
</a>
<p align="center">
  <h3 align="center">Nocord</h3>

  <p align="center">
    An easy to use video chat (and screen sharing) app.
    <br />
    <a href="https://nocord.yigit.host">Try it!</a>
    ·
    <a href="https://github.com/yalanyali/nocord/issues">Report Bug</a>
    ·
    <a href="https://github.com/yalanyali/nocord/issues">Request Feature</a>
    <br />
  </p>
</p>


## About The Project

We were using Discord for an easy screen sharing solution while pair programming along with voice chat. We still use it for voice chat (when the servers don't act up) but boy the screen sharing got worse and worse. Of course you have the option to just pay for a better support (you're limited to 720p on free option) which makes sense since Discord essentially makes audio/video streams to go through an SFU and get re-encoded. In our case a simple P2P connection would do just fine, so I made this working prototype to just open up and share the link to connect and share your screen/camera and audio.

* It is a weekend project, use it with caution
* Apart from the signalling it is fully P2P (which means your bandwidth may not be enough for multiple clients)
* Both voice and video sharing are very basic
* It should be easy enough to extend the capabilities thanks to modern browsers' media support


### Built With

Frontend
* [Reactjs](https://reactjs.org/)
* [WebRTC](https://webrtc.org/)
* [Socket.io](https://socket.io/)

Server
* [Express](https://expressjs.com/)
* [simple-signal](https://github.com/t-mullen/simple-signal)

### Installation

Signalling server is a Nodejs project
```sh
yarn install
```
Frontend is a Reactjs app
```sh
cd client
yarn install && yarn build
```
Express serves ./client/build by default
```sh
yarn start
```
