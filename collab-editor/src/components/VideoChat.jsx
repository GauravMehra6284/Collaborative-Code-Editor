import React, { useEffect, useRef } from 'react';
import Peer from 'simple-peer';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

export default function VideoChat({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);

  useEffect(() => {
    let localStream;

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localStream = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        } else {
          console.error("Local video element not mounted yet!");
        }

        socket.emit('ready', { roomId });

        socket.on('startCall', (signal) => {
          const peer = new Peer({ initiator: false, trickle: false, stream });
          peer.on('signal', data => socket.emit('signal', { roomId, signal: data }));
          peer.on('stream', remoteStream => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            } else {
              console.error("Remote video element not mounted yet!");
            }
          });
          peer.signal(signal);
          peerRef.current = peer;
        });

        socket.on('readyForCall', () => {
          const peer = new Peer({ initiator: true, trickle: false, stream });
          peer.on('signal', data => socket.emit('signal', { roomId, signal: data }));
          peer.on('stream', remoteStream => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            } else {
              console.error("Remote video element not mounted yet!");
            }
          });
          peerRef.current = peer;
        });

        socket.on('signal', (signal) => {
          if (peerRef.current) {
            peerRef.current.signal(signal);
          }
        });
      })
      .catch(err => console.error("Error accessing webcam:", err));

    return () => {
      if (socket) {
        socket.off('startCall');
        socket.off('readyForCall');
        socket.off('signal');
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId]);

  return (
    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', margin: '1rem 0' }}>
      <video ref={localVideoRef} autoPlay muted width={200} style={{ border: '2px solid green', background: '#000' }} />
      <video ref={remoteVideoRef} autoPlay width={200} style={{ border: '2px solid red', background: '#000' }} />
    </div>
  );
}
