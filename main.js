let app_id = 'your_app_id';
let token = null;
let uid = String(Math.floor(Math.random() * 1000000000));

let client;
let channel;

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


let init = async () => {
  // Creating the Agora client
  client = await AgoraRTM.createInstance(app_id);
  await client.login({uid, token})

  // Creating the Agora channel
  channel = client.createChannel('main');
  await channel.join();

  // Listening for following events event
  channel.on('MemberJoined', handleuserJoined);
  channel.on('MemberLeft', handleuserLeft);
  client.on('MessageFromPeer', handleMessageFromPeer);

  // Accessing the camera and microphone
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

  // Displaying my video stream on my video element
  document.getElementById('user1').srcObject = localStream;

}
let handleuserLeft = async (memberId) => {
  console.log('A user left the channel', memberId);
  document.getElementById('user2').style.display = 'none';
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
window.addEventListener('beforeunload', leaveChannel);

init();