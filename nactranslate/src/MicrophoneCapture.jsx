import React, { useState, useRef } from 'react'

const MicrophoneCapture = () => {
  const [status, setStatus] = useState('')
  const [socket, setSocket] = useState(null) // Added state for WebSocket, may not be necessary
  const audioContextRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const workletNodeRef = useRef(null)
  const [subtitles, setSubtitles] = useState("TESTING")
  const [langselections, setLangselections] = useState({from: "en", to: "fr"}) // default english to french
  
  const handleLanguageChange = e => {
    const { name, value } = e.target
    console.log(`${name} changed to ${value}`)
    if (name === "spokenLanguage") {
      setLangselections( prev => {
        let output = prev
        output.from = value
        return {...output}
      })
    }
    else if (name === "transcribedLanguage") {
      setLangselections( prev => {
        let output = prev
        output.to = value
        return {...output}
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
      compressor.knee.setValueAtTime(40, audioContextRef.current.currentTime)   // Smoother transition
      compressor.ratio.setValueAtTime(12, audioContextRef.current.currentTime)  // Compression ratio
      compressor.attack.setValueAtTime(0.003, audioContextRef.current.currentTime)  // Attack time
      compressor.release.setValueAtTime(0.25, audioContextRef.current.currentTime)  // Release time
      
      const source = audioContextRef.current.createMediaStreamSource(stream)

      // Establish pcm-processor, the AudioWorklet that will convert the audio stream to compatible format
      await audioContextRef.current.audioWorklet.addModule('/pcmProcessor.js')
      // Create audio worklet node
      workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'pcm-processor')

      // Initialize WebSocket
      const ws = new WebSocket('ws://localhost:8000')
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
          // socket expect string, so data must be passed serialized, and then de-serialized on the other end...


    // WORK IN PROGRESS: NEED TO SEND THE DATA FOR THE LANGUAGE AND THE AUDIO BINARY DATA SEPARATELY BECAUSE JSON CONVERSION CORRUPTS THE AUDIO.

          ws.send(JSON.stringify({data: event.data, lang_to: langselections.to, lang_from: langselections.from }))
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
