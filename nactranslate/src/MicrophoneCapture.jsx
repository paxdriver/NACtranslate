import React, { useState, useRef } from 'react';
// import WebSocket from 'ws';

const MicrophoneCapture = () => {
  const [status, setStatus] = useState('');
  const [socket, setSocket] = useState(null); // Add state for WebSocket
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioProcessorRef = useRef(null);

  const handleMicAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStatus('Microphone connected');

      // Initialize WebSocket
      const ws = new WebSocket('ws://localhost:8000');
      setSocket(ws);
      ws.onopen = () => console.log('WebSocket connection established');
      ws.onerror = (err) => console.error('WebSocket error:', err);
      ws.onclose = () => console.log('WebSocket connection closed');

      // Initialize AudioContext
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      mediaStreamRef.current = stream;

      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Create ScriptProcessorNode for capturing audio data
      audioProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      source.connect(audioProcessorRef.current);
      audioProcessorRef.current.connect(audioContextRef.current.destination);

      // Process audio data
      audioProcessorRef.current.onaudioprocess = (event) => {
        const audioData = event.inputBuffer.getChannelData(0); // Get channel 0
        const int16Array = new Int16Array(audioData.length);

        // Convert Float32 to Int16
        for (let i = 0; i < audioData.length; i++) {
          int16Array[i] = Math.min(1, audioData[i]) * 0x7FFF; // Scale and clamp
        }

        // Send data to backend
        sendAudioData(int16Array);
      };

      const sendAudioData = (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data.buffer); // Send raw audio data to backend
        }
      };
    } catch (error) {
      setStatus('Failed to connect microphone');
      console.error(error);
    }
  };

  const handleStopMic = () => {
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (socket) {
      socket.close(); // Close WebSocket connection
      setSocket(null);
    }
    setStatus('Microphone disconnected');
  };

  return (
    <div>
      <button onClick={handleMicAccess}>Connect Microphone</button>
      <button onClick={handleStopMic}>Disconnect Microphone</button>
      <p>{status}</p>
    </div>
  );
};

export default MicrophoneCapture;
