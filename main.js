let app_id = 'your-app-id';
let token = null;
let uid = String(Math.floor(Math.random() * 1000000000));

let client;
let channel;

// Getting the room name from the URL
let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room');

if(!roomId){
  window.location = 'lobby.html';
}

let localStream;    // for my video
let remoteStream;   // for friend's video
let peerConnection; // RTCPeerConnection object

const servers = {
  iceServers:[
      {
          urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
      }
  ]
}

const constraints = {
    video : {
      width: { min: 640, ideal: 1920, max: 1920 },
      height: { min: 400, ideal: 1080 , max: 1080},
      aspectRatio: 1.777777778,
      frameRate: { max: 60 },
    },
    audio : true
  };

let init = async () => {
  // Creating the Agora client
  client = await AgoraRTM.createInstance(app_id);
  await client.login({uid, token})

  // Creating the Agora channel
  channel = client.createChannel(roomId);
  await channel.join();

  // Listening for following events event
  channel.on('MemberJoined', handleuserJoined);
  channel.on('MemberLeft', handleuserLeft);
  client.on('MessageFromPeer', handleMessageFromPeer);

  // Accessing the camera and microphone
  localStream = await navigator.mediaDevices.getUserMedia(constraints);

  // Displaying my video stream on my video element
  document.getElementById('user1').srcObject = localStream;

}
let handleuserLeft = async (memberId) => {
  console.log('A user left the channel', memberId);
  document.getElementById('user2').style.display = 'none';
  document.getElementById('user1').classList.remove('smallFrame');

}
let handleMessageFromPeer = async (message, memberId) => {
  message = JSON.parse(message.text);

  if (message.type === 'offer') {
    createAnswer(memberId, message.offer);
  }
  else if (message.type === 'answer') {
    addAnswer(message.answer);
  }
  else if (message.type === 'candidate') {
    if(peerConnection) peerConnection.addIceCandidate(message.candidate);
  }

}
let handleuserJoined = async (memberId) => {
  console.log('A new user joined the channel', memberId);
  createOffer(memberId);
}


let createPeerConnection = async (memberId) => {

  // Creating the RTCPeerConnection object
  peerConnection = new RTCPeerConnection(servers);
  remoteStream = new MediaStream();

  // Display friend's video stream
  document.getElementById('user2').srcObject = remoteStream;
  document.getElementById('user2').style.display = 'block';

  document.getElementById('user1').classList.add('smallFrame');


  if(!localStream){
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('user1').srcObject = localStream;
  }

  // Adding the tracks to the RTCPeerConnection object
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // Adding incoming audio/video tracks from the remote peer to a remoteStream.
  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  }

  // Sending ICE candidates to the remote peer
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      client.sendMessageToPeer({ text: JSON.stringify({
        'type': 'candidate',
        'candidate': event.candidate,
      }) }, memberId);
    }
  }
}


let createOffer = async (memberId) => {
  await createPeerConnection(memberId);

  // Creating an offer
  let offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  // Sending the offer to the remote peer
  client.sendMessageToPeer({ text: JSON.stringify({
    'type': 'offer',
    'offer': offer,
  }) }, memberId);
}

let createAnswer = async (memberId, offer) => {
  await createPeerConnection(memberId);

  // Setting the remote description
  await peerConnection.setRemoteDescription(offer);

  // Creating an answer
  let answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  // Sending the answer to the remote peer
  client.sendMessageToPeer({ text: JSON.stringify({
    'type': 'answer',
    'answer': answer,
  }) }, memberId);
}

let addAnswer = async (answer) => {
  if(!peerConnection.currentRemoteDescription){
    await peerConnection.setRemoteDescription(answer);
  }
}

let leaveChannel = async () => {
  await channel.leave();
  await client.logout();
}

let toggleCamera = async () => {
  let videoTrack = localStream.getTracks().find(track => track.kind === 'video');

  if(videoTrack.enabled){
    videoTrack.enabled = false;
    document.getElementById('camera-btn').style.backgroundColor = 'firebrick';
  }
  else{
    videoTrack.enabled = true;
    document.getElementById('camera-btn').style.backgroundColor = 'rgba(54, 102, 207, 0.67)';
  }
}

let toggleMic = async () => {
  let micTrack = localStream.getTracks().find(track => track.kind === 'audio');

  if(micTrack.enabled){
    micTrack.enabled = false;
    document.getElementById('mic-btn').style.backgroundColor = 'firebrick';
  }
  else{
    micTrack.enabled = true;
    document.getElementById('mic-btn').style.backgroundColor = 'rgba(54, 102, 207, 0.67)';
  }
}

window.addEventListener('beforeunload', leaveChannel);

document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);

init();