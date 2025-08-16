class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super()
        this.buffer = []
        this.isRecording = false
        
        // Set up message handler
        this.port.onmessage = (event) => {
            const { command } = event.data
            
            if (command === 'START_RECORDING') {
                this.isRecording = true
                this.buffer = [] // Clear any existing buffer
                console.log('PCM Processor: Started recording')
            } else if (command === 'STOP_RECORDING') {
                this.isRecording = false
                if (this.buffer.length > 0) {
                    // Send the complete recording
                    this.port.postMessage({
                        type: 'AUDIO_DATA',
                        data: new Int16Array(this.buffer)
                    })
                    console.log(`PCM Processor: Sent ${this.buffer.length} samples`)
                    this.buffer = [] // Clear buffer after sending
                } else {
                    console.log('PCM Processor: No audio data to send')
                }
            }
        }
    }

    process(inputs) {
        const input = inputs[0]
        if (input && input[0] && this.isRecording) {
            const float32Array = input[0]
            const int16Array = new Int16Array(float32Array.length)

            // Convert Float32 to Int16 for VOSK compatibility
            for (let i = 0; i < float32Array.length; i++) {
                int16Array[i] = Math.max(-1, Math.min(1, float32Array[i])) * 0x7fff
            }

            // Accumulate to buffer while recording
            this.buffer.push(...int16Array)
        }
        return true
    }
}

registerProcessor('pcm-processor', PCMProcessor)