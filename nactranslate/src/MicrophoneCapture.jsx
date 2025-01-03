import React, { useState, useRef } from 'react'

const MicrophoneCapture = () => {
  const [status, setStatus] = useState('')
  const [socket, setSocket] = useState(null) // Added state for WebSocket, may not be necessary
  const audioContextRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const workletNodeRef = useRef(null)
  const socketRef = useRef(null)  // Used to store the socket so it can be used by language selection handler to update metadata
  const [subtitles, setSubtitles] = useState("TESTING")
  const [langselections, setLangselections] = useState({from: "en", to: "fr"}) // default english to french
  // NOTE: langselections isn't being used, it's just storing WebSocket metadata settings right now in case an app component crashes and forces a re-render
  
  const handleLanguageChange = e => {
    const { name, value } = e.target
    console.log(`${name} changed to ${value}`)
    if (name === "spokenLanguage" || name === "transcribedLanguage") {
      setLangselections( prev => {
        // Depending on which of the selection options are changed, this will update the state key pertaining to that selection box
        const updatedConfig = (name === "spokenLanguage") ? { ...prev, from: value } : { ...prev, to: value}  
        
        // send the updated config to the WebSocket
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify(updatedConfig))
        }
      })
    }
    else {
      console.error("An error has occurred with the language handler function in the MicrophoneCapture component! This should never happen, there's a logical error that needs to be resolved!!!")
    }
  }


  const handleMicAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setStatus('Microphone connected')

      // Initialize AudioContext
      audioContextRef.current = new window.AudioContext({sampleRate: 16000})
      mediaStreamRef.current = stream

      // Add a DynamicsCompressorNode to normalize audio
      const compressor = audioContextRef.current.createDynamicsCompressor()
      compressor.threshold.setValueAtTime(-50, audioContextRef.current.currentTime) // Adjust threshold
      compressor.knee.setValueAtTime(40, audioContextRef.current.currentTime)       // Smoother transition
      compressor.ratio.setValueAtTime(12, audioContextRef.current.currentTime)      // Compression ratio
      compressor.attack.setValueAtTime(0.003, audioContextRef.current.currentTime)  // Attack time
      compressor.release.setValueAtTime(0.25, audioContextRef.current.currentTime)  // Release time
      
      const source = audioContextRef.current.createMediaStreamSource(stream)

      // Establish pcm-processor, the AudioWorklet that will convert the audio stream to compatible format
      await audioContextRef.current.audioWorklet.addModule('/pcmProcessor.js')
      // Create audio worklet node
      workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'pcm-processor')

      // Initialize WebSocket
      const ws = new WebSocket('ws://localhost:8000')
      socketRef.current = ws      // for language selection handler access
      ws.onopen = () => console.log('WebSocket connection established')
      ws.onerror = err => console.error('WebSocket error:', err)
      ws.onclose = () => console.log('WebSocket connection closed')
      ws.onmessage = event => {
        const wsResponse = event.data
        setSubtitles(prev => {
          const output = (wsResponse !== '') ? `${wsResponse}\n${prev}` : prev
          return output
        }) // response back from worklet containing translated subtitles to update the displayed text.
      }
      setSocket(ws)

      // Send PCM data to WebSocket
      workletNodeRef.current.port.onmessage = event => {
        if (ws !== null && ws.readyState === WebSocket.OPEN){
          ws.send(event.data) // audio stream binary data
        }
      }

      // Connect the audio source to the worklet
      // Connect source -> compressor -> worklet
      source.connect(compressor)
      compressor.connect(workletNodeRef.current)

    } catch (error) {
      setStatus('Failed to connect microphone')
      console.error(error)
    }
  }

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
      socket.close()     // Close WebSocket connection
      setSocket(null)
    }
    setStatus("Microphone disconnected")
  }

  return (
    <div>
      {/* Language Selection Input / Output */}
      <div style={{textAlign: 'center', margin: '1rem', padding: '2rem', backgroundColor: 'rgba(180,180,180,0.25)', border: '3px dashed black'}} >
        <div>
          <label>Language Spoken:
          <select name="spokenLanguage" onChange={handleLanguageChange} style={{margin: '0 3rem'}}>
            <option value='en'>English</option>
            <option value='fr'>French</option>
          </select>
          </label>
          <label>Language Transcribed:
          <select name="transcribedLanguage" onChange={handleLanguageChange} style={{margin: '0 3rem'}}>
            <option value='fr'>French</option>
            <option value='en'>English</option>
          </select>
          </label>
        </div>

      </div>

      {/* Microphone Connectivity */}
      <div style={{border: '3px dotted black', padding: '1rem', margin: '1rem', backgroundColor: 'rgba(200, 50,50,0.25)'}}>
        <button onClick={handleMicAccess} style={{border:'2px solid red'}}>Connect Microphone</button>
        &nbsp;
        &nbsp;
        <button onClick={handleStopMic} style={{border:'2px solid red'}}>Disconnect Microphone</button>
        <strong><p>{status}</p></strong>
      </div>
      {/* Text area for the translated output to appear. */}
      <p id="subtitlesText" style={{border: '5px inset black', height: '300px', width: '80vw', fontSize: '2rem'}}>{subtitles}</p>
    </div>
  )
}

export default MicrophoneCapture;
