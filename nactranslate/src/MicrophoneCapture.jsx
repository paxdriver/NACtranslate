import React, { useState, useRef, useCallback, useEffect } from 'react'

const MicrophoneCapture = () => {
    const [status, setStatus] = useState('')
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const audioContextRef = useRef(null)
    const mediaStreamRef = useRef(null)
    const workletNodeRef = useRef(null)
    const socketRef = useRef(null)
    const [subtitles, setSubtitles] = useState("")
    const [langselections, setLangselections] = useState({from: "en", to: "fr"})

    const handleLanguageChange = e => {
        const { name, value } = e.target
        console.log(`${name} changed to ${value}`)
        if (name === "spokenLanguage" || name === "transcribedLanguage") {
            setLangselections(prev => {
                const updatedConfig = (name === "spokenLanguage") ? 
                    { ...prev, from: value } : { ...prev, to: value}
                
                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify(updatedConfig))
                }
                return updatedConfig
            })
        }
    }

    const startRecording = useCallback(() => {
        if (workletNodeRef.current && !isRecording && !isProcessing) {
            console.log('Starting recording...')
            setIsRecording(true)
            workletNodeRef.current.port.postMessage({ command: 'START_RECORDING' })
        }
    }, [isRecording, isProcessing])

    const stopRecording = useCallback(() => {
        if (workletNodeRef.current && isRecording) {
            console.log('Stopping recording...')
            setIsRecording(false)
            setIsProcessing(true)
            workletNodeRef.current.port.postMessage({ command: 'STOP_RECORDING' })
        }
    }, [isRecording])

    // Keyboard event handlers
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.code === 'Space' && !event.repeat && status === 'Microphone connected') {
                event.preventDefault()
                startRecording()
            }
        }

        const handleKeyUp = (event) => {
            if (event.code === 'Space' && status === 'Microphone connected') {
                event.preventDefault()
                stopRecording()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [startRecording, stopRecording, status])

    const handleMicAccess = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            setStatus('Microphone connected')

            audioContextRef.current = new window.AudioContext({sampleRate: 16000})
            mediaStreamRef.current = stream

            const compressor = audioContextRef.current.createDynamicsCompressor()
            compressor.threshold.setValueAtTime(-50, audioContextRef.current.currentTime)
            compressor.knee.setValueAtTime(40, audioContextRef.current.currentTime)
            compressor.ratio.setValueAtTime(12, audioContextRef.current.currentTime)
            compressor.attack.setValueAtTime(0.003, audioContextRef.current.currentTime)
            compressor.release.setValueAtTime(0.25, audioContextRef.current.currentTime)
            
            const source = audioContextRef.current.createMediaStreamSource(stream)

            await audioContextRef.current.audioWorklet.addModule('/pcmProcessor.js')
            workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'pcm-processor')

            const ws = new WebSocket('ws://localhost:8000/websocket/')
            socketRef.current = ws
            
            ws.onopen = () => { 
                console.log('WebSocket connection established')
                ws.send(JSON.stringify(langselections))
            }
            ws.onerror = err => console.error('WebSocket error:', err)
            ws.onclose = () => console.log('WebSocket connection closed')
            ws.onmessage = event => {
                const wsResponse = event.data
                setIsProcessing(false) // Translation received, no longer processing
                setSubtitles(prev => {
                    const output = (wsResponse !== '') ? `- ${wsResponse}\n\n${prev}` : prev
                    return output
                })
            }

            // Handle audio data from worklet
            workletNodeRef.current.port.onmessage = event => {
                const { type, data } = event.data
                if (type === 'AUDIO_DATA' && ws.readyState === WebSocket.OPEN) {
                    console.log(`Sending audio chunk of ${data.length} samples`)
                    ws.send(data)
                }
            }

            source.connect(compressor)
            compressor.connect(workletNodeRef.current)

        } catch (error) {
            setStatus('Failed to connect microphone')
            console.error(error)
        }
    }

    const handleStopMic = () => {
        if (isRecording) {
            stopRecording()
        }
        
        if (workletNodeRef.current) {
            workletNodeRef.current.port.close()
            workletNodeRef.current.disconnect()
            workletNodeRef.current = null
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop())
            mediaStreamRef.current = null
        }
        if (audioContextRef.current) {
            audioContextRef.current.close()
            audioContextRef.current = null
        }
        if (socketRef.current) {
            socketRef.current.close()
            socketRef.current = null
        }
        setStatus("Microphone disconnected")
        setIsRecording(false)
        setIsProcessing(false)
    }

    return (
        <div>
            {/* Language Selection */}
            <div style={{textAlign: 'center', margin: '0.25rem', padding: '0.25rem', backgroundColor: 'rgba(180,180,180,0.25)', border: '3px dashed black'}}>
                <div><strong>
                    <label>Language Spoken:
                        <select 
                            disabled={status === 'Microphone connected'} 
                            name="spokenLanguage"
                            onChange={handleLanguageChange} 
                            style={{margin: '0 3rem'}}
                        >
                            <option value='en'>English</option>
                            <option value='fr'>French</option>
                            <option value='ru'>Russian</option>
                            <option value='uk'>Ukrainian</option>
                            <option value='de'>German</option>
                            <option value='es'>Spanish</option>
                            <option value='ar'>Arabic</option>
                            <option value='ca'>Catalan</option>
                            <option value='pt'>Portuguese</option>
                            <option value='tl'>Tagalog (Philippines)</option>
                        </select>
                    </label>

                    <label>Language Transcribed:
                        <select 
                            name="transcribedLanguage" 
                            onChange={handleLanguageChange} 
                            style={{margin: '0 3rem'}}
                        >
                            <option value='fr'>French</option>
                            <option value='en'>English</option>
                            <option value='es'>Spanish</option>
                            <option value='ru'>Russian</option>
                            <option value='de'>German</option>
                            <option value='uk'>Ukrainian</option>
                            <option value='ar'>Arabic</option>
                            <option value='ca'>Catalan</option>
                            <option value='pt'>Portuguese</option>
                            <option value='tl'>Tagalog (Philippines)</option>
                        </select>
                    </label>
                </strong></div>
            </div>

            {/* Microphone Connectivity */}
            <div style={{border: '3px dotted black', padding: '1rem', margin: '1rem', backgroundColor: 'rgba(200, 50,50,0.25)'}}>
                <button onClick={handleMicAccess} style={{border:'2px solid red'}}>
                    Connect Microphone
                </button>
                &nbsp;&nbsp;
                <button onClick={handleStopMic} style={{border:'2px solid red'}}>
                    Disconnect Microphone
                </button>
                <strong><p>{status}</p></strong>
            </div>

            {/* Push-to-Talk Recording Button - This should always show when mic is connected */}
            {status === 'Microphone connected' && (
                <div style={{textAlign: 'center', margin: '1rem', padding: '1rem', border: '3px solid blue', backgroundColor: 'rgba(50, 50, 200, 0.25)'}}>
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault()
                            startRecording()
                        }}
                        onMouseUp={(e) => {
                            e.preventDefault()
                            stopRecording()
                        }}
                        onMouseLeave={() => {
                            if (isRecording) {
                                stopRecording()
                            }
                        }}
                        disabled={isProcessing}
                        style={{
                            padding: '20px 40px',
                            fontSize: '18px',
                            border: '3px solid',
                            borderColor: isRecording ? 'red' : 'blue',
                            backgroundColor: isRecording ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 0, 255, 0.3)',
                            color: 'black',
                            borderRadius: '10px',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            userSelect: 'none'
                        }}
                    >
                        {isProcessing ? 'Processing...' : 
                         isRecording ? 'Recording... (Release to translate)' : 
                         'Hold to Record'}
                    </button>
                    <p><strong>Hold the button above or press and hold SPACEBAR to record</strong></p>
                    {isProcessing && <p style={{color: 'orange'}}>⏳ Translating your speech...</p>}
                </div>
            )}

            {/* Always show button area for debugging, even if mic not connected */}
            {status !== 'Microphone connected' && status !== '' && (
                <div style={{textAlign: 'center', margin: '1rem', padding: '1rem', border: '3px dashed gray', backgroundColor: 'rgba(128, 128, 128, 0.25)'}}>
                    <p>Connect microphone to enable recording</p>
                </div>
            )}

            {/* Subtitles Display */}
            <pre 
                id="subtitlesText" 
                style={{
                    whiteSpace: 'pre-wrap', 
                    wordWrap: 'break-word', 
                    border: '5px inset black', 
                    height: '50vh', 
                    width: '80vw', 
                    fontSize: '1rem', 
                    textAlign: 'left', 
                    overflowY: 'scroll',
                    padding: '10px'
                }}
            >
                {subtitles}
            </pre>
        </div>
    )
}

export default MicrophoneCapture