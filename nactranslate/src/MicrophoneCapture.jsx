import React, { useState, useRef } from 'react';

const MicrophoneCapture = () => {
  const [status, setStatus] = useState('');
  const [socket, setSocket] = useState(null); // Added state for WebSocket, may not be necessary
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const workletNodeRef = useRef(null)

  const handleMicAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStatus('Microphone connected');

      // Initialize AudioContext
      audioContextRef.current = new window.AudioContext({sampleRate: 16000})
      mediaStreamRef.current = stream;


      // Add a DynamicsCompressorNode to normalize audio
      const compressor = audioContextRef.current.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, audioContextRef.current.currentTime); // Adjust threshold
      compressor.knee.setValueAtTime(40, audioContextRef.current.currentTime);      // Smoother transition
      compressor.ratio.setValueAtTime(12, audioContextRef.current.currentTime);     // Compression ratio
      compressor.attack.setValueAtTime(0.003, audioContextRef.current.currentTime); // Attack time
      compressor.release.setValueAtTime(0.25, audioContextRef.current.currentTime); // Release time
      
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Establish pcm-processor, the AudioWorklet that will convert the audio stream to compatible format
      await audioContextRef.current.audioWorklet.addModule('/pcmProcessor.js')
      // Create audio worklet node
      workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'pcm-processor')

      // Initialize WebSocket
      const ws = new WebSocket('ws://localhost:8000');
      ws.onopen = () => console.log('WebSocket connection established');
      ws.onerror = err => console.error('WebSocket error:', err);
      ws.onclose = () => console.log('WebSocket connection closed');
      setSocket(ws)

      // Send PCM data to WebSocket
      workletNodeRef.current.port.onmessage = event => {
        if (ws !== null && ws.readyState === WebSocket.OPEN){
          ws.send(event.data)
        }
      }

      // Connect the audio source to the worklet
      // source.connect(workletNodeRef.current)
      // Connect source -> compressor -> worklet
      source.connect(compressor)
      compressor.connect(workletNodeRef.current)

    } catch (error) {
      setStatus('Failed to connect microphone');
      console.error(error);
    }
  };

  const handleStopMic = () => {
    if (workletNodeRef.current) {
      workletNodeRef.current.port.close()
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach( track => track.stop() )
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (socket !== null) {
      socket.close(); // Close WebSocket connection
      setSocket(null);
    }
    setStatus("Microphone disconnected")
  }

  return (
    <div>
      <button onClick={handleMicAccess}>Connect Microphone</button>
      <button onClick={handleStopMic}>Disconnect Microphone</button>
      <p>{status}</p>
    </div>
  );
};

export default MicrophoneCapture;
