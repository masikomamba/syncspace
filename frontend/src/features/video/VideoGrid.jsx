import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { io } from 'socket.io-client';

// Connect to the signaling server
const socketHost = window.location.hostname === 'localhost' ? 'http://localhost:8080' : '/';
const socket = io(socketHost);

const VideoGrid = ({ roomId = 'sandbox-1' }) => {
  const localVideoRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const peersRef = useRef({}); // Store RTCPeerConnections
  const localStreamRef = useRef(null);

  useEffect(() => {
    // 1. Get Local Media
    const initLocalVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Join Room & Setup Signaling
        socket.emit('join-room', roomId);
        
        // Notify others I'm here
        socket.emit('ready-for-call', roomId);

        socket.on('user-joined', (userId) => {
          // A new user joined, I should create an offer
          createPeerConnection(userId, true);
        });

        socket.on('webrtc-offer', async ({ caller, sdp }) => {
          // Received an offer, create peer connection and answer
          const pc = createPeerConnection(caller, false);
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc-answer', { target: caller, caller: socket.id, sdp: answer });
        });

        socket.on('webrtc-answer', async ({ caller, sdp }) => {
          // Received answer to my offer
          const pc = peersRef.current[caller];
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          }
        });

        socket.on('webrtc-ice-candidate', ({ candidate, sender }) => {
          const pc = peersRef.current[sender];
          if (pc && candidate) {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
          }
        });

      } catch (err) {
        console.error('Error accessing media devices:', err);
      }
    };

    initLocalVideo();

    return () => {
      socket.off('user-joined');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      
      // Cleanup streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(pc => pc.close());
    };
  }, [roomId]);

  const createPeerConnection = (userId, isInitiator) => {
    // Basic STUN server configuration for NAT traversal
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peersRef.current[userId] = pc;

    // Add local tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', {
          target: userId,
          candidate: event.candidate
        });
      }
    };

    // Receive remote tracks
    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [userId]: event.streams[0]
      }));
    };

    if (isInitiator) {
      // Create Offer
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('webrtc-offer', {
            target: userId,
            caller: socket.id,
            sdp: pc.localDescription
          });
        });
    }

    // Handle cleanup on disconnect
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          delete newStreams[userId];
          return newStreams;
        });
        pc.close();
        delete peersRef.current[userId];
      }
    };

    return pc;
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks()[0].enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks()[0].enabled = isVideoOff;
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
        {/* Local Video Container */}
        <div style={{ position: 'relative', width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
            You (Local)
          </div>
        </div>

        {/* Remote Videos Container */}
        {Object.keys(remoteStreams).map((userId) => (
          <div key={userId} style={{ position: 'relative', width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
            <RemoteVideo stream={remoteStreams[userId]} userId={userId} />
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex-center" style={{ gap: '16px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)' }}>
        <button 
          onClick={toggleMute} 
          className="icon-btn" 
          style={{ background: isMuted ? 'var(--accent-red)' : 'rgba(255,255,255,0.1)', color: 'white' }}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button 
          onClick={toggleVideo} 
          className="icon-btn" 
          style={{ background: isVideoOff ? 'var(--accent-red)' : 'rgba(255,255,255,0.1)', color: 'white' }}
        >
          {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>
      </div>

    </div>
  );
};

// Helper component to bind the MediaStream to a video element
const RemoteVideo = ({ stream, userId }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
        Remote User
      </div>
    </>
  );
};

export default VideoGrid;
