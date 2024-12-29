const BUFFER_SIZE = 96000 // 3 seconds is probably too short
// const BUFFER_SIZE = 96000*3 // 9 seconds

class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super()
        this.buffer = []
    }

    process(inputs) {
      const input = inputs[0]; // Get audio input
      if (input && input[0]) {
        const float32Array = input[0]; // Get channel 0 for mono
        const int16Array = new Int16Array(float32Array.length);
  
        // Convert Float32 to Int16 for VOSK compatibility
        for (let i = 0; i < float32Array.length; i++) {
          int16Array[i] = Math.max(-1, Math.min(1, float32Array[i])) * 0x7fff; // Scale to 16-bit PCM
        }

        // append to buffer
        this.buffer.push(...int16Array)

        if (this.buffer.length >= BUFFER_SIZE) {
            // Post the Int16Array back to the main thread
            this.port.postMessage(new Int16Array(this.buffer.slice(0, BUFFER_SIZE))) // TESTING AudioWorklet stream PCM 16-bit wav conversion
            this.buffer = this.buffer.slice(BUFFER_SIZE)
        }
      }
      return true; // Keep the processor alive
    }
  }
  
  registerProcessor('pcm-processor', PCMProcessor);
  