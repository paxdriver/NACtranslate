import { useState, useRef, useCallback, useEffect } from 'react'
import './index.css'

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
            document.body.classList.add('recording-active')
            setIsRecording(true)
            workletNodeRef.current.port.postMessage({ command: 'START_RECORDING' })
        }
    }, [isRecording, isProcessing])

    const stopRecording = useCallback(() => {
        if (workletNodeRef.current && isRecording) {
            console.log('Stopping recording...')
            document.body.classList.remove('recording-active')
            setIsRecording(false)
            setIsProcessing(true)
            workletNodeRef.current.port.postMessage({ command: 'STOP_RECORDING' })
        }
    }, [isRecording])

    // Keyboard event handlers
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.code === 'Space' && status === 'Microphone connected') {
                event.preventDefault() // prevent page scroll from holding spacebar
                if (!event.repeat) startRecording()
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
    <div className="app-container">

        {/* Top Banner - Language & Connection */}
        <div className="control-banner">
            <div className="app-logo"></div>
            
            <div className="banner-content">
                <div className="banner-top-row">
                    <h1 className="app-title">NAC Translate: Privacy-Focused Translation</h1>
                    
                    <div className="connection-controls">
                        <div className={`mic-status ${status === 'Microphone connected' ? 'mic-connected' : 'mic-disconnected'}`}>
                            Status: {status}
                        </div>
                        
                        <button 
                            className={`btn ${status === 'Microphone connected' ? 'btn-connect' : 'btn-connect'}`}
                            onClick={status === 'Microphone connected' ? handleStopMic : handleMicAccess}
                        >
                            {status === 'Microphone connected' ? 'Disconnect' : 'Connect Mic'}
                        </button>

                        <button className="btn btn-disconnect" onClick={handleStopMic} title="Emergency Stop">
                            🛑
                        </button>
                    </div>
                </div>

                <div className="language-section">
                    <div className="language-group">
                        <label>Spoken Language:</label>
                        <select 
                            name="spokenLanguage"
                            value={langselections.from}
                            onChange={handleLanguageChange}
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
                    </div>
                    <div className="language-group">
                        <label>Translate To:</label>
                        <select 
                            name="transcribedLanguage"
                            value={langselections.to} 
                            onChange={handleLanguageChange}
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
                    </div>
                </div>
            </div>
        </div>

        {/* Main Translation Area */}
        <div className="translation-area">
            <div className="translation-header">
                Live Translation
            </div>
            
            <div className="translation-content">
                {isRecording && (
                    <div className="recording-indicator">
                        🔴 Recording... Release to translate
                    </div>
                )}
                
                {isProcessing && (
                    <div className="processing-indicator">
                        ⚡ Processing translation...
                    </div>
                )}
                
                {!isRecording && !isProcessing && subtitles === "" && (
                    <div className="recording-prompt">
                        {status === 'Microphone connected' 
                            ? "Hold spacebar or the button below to start recording"
                            : "Connect microphone to begin"
                        }
                    </div>
                )}
                
                <div className="translation-messages">
                    {subtitles.split('\n\n').filter(msg => msg.trim()).map((message, index) => (
                        <div key={index} className="translation-message">
                            <div className="translation-text">{message.replace(/^-\s*/, '')}</div>
                            <div className="translation-timestamp">{new Date().toLocaleTimeString()}</div>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Push to Talk - Bottom of Translation Area */}
            {status === 'Microphone connected' && (
                <div className="ptt-container">
                    <button
                        className={`ptt-button ${isProcessing ? 'ptt-processing' : isRecording ? 'ptt-recording' : 'ptt-idle'}`}
                        onMouseDown={ e => {
                            e.preventDefault()
                            startRecording()
                        }}
                        onMouseUp={ e=> {
                            e.preventDefault()
                            stopRecording()
                        }}
                        onMouseLeave={() => {
                            // Handles the case where user clicks and holds the button to record, but then moves the mouse cursor off the button while still holding down the mouse button. Without this, they'd be stuck recording until they moved back to the button and released. It's a UX safety feature.
                            if (isRecording) stopRecording()
                        }}
                        disabled={isProcessing}
                    >
                        {isProcessing ? '...' : isRecording ? 'Recording' : 'Hold'}
                    </button>
                    <div className="ptt-instructions">
                        Hold button or spacebar to record
                    </div>
                </div>
            )}
        </div>
    </div>
)
}

export default MicrophoneCapture