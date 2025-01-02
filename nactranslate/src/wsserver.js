import {WebSocketServer} from 'ws'
import axios from 'axios'

const wss = new WebSocketServer({ port: 8000})

wss.on('connection', ws => {

    // WORK IN PROGRESS: NEED TO SEND THE DATA FOR THE LANGUAGE AND THE AUDIO BINARY DATA SEPARATELY BECAUSE JSON CONVERSION CORRUPTS THE AUDIO.

    console.log('Client connected')
    ws.on('message', async rawMessage => {
        try {
            const message = JSON.parse(rawMessage)
            const {lang_to, lang_from, data} = message
            console.log(`LANGUAGE SELECTIONS: TO: ${lang_to}, FROM: ${lang_from}`)
            const response = await axios.post('http://localhost:5000/process_audio', data, {headers: {'Content-Type': 'application/octet-stream'}})
            console.log("Flask response:", response.data.text)
            ws.send(response.data.text)
        } catch(error) {
            console.error("Error forwarding data from audio stream to speech-to-text server!!!!")
            console.error(error)
        }   
        ws.send('Message back from server completed.'); // just to see the message came through even if no data or errors are displayed...
    })
    
})

console.log('WebSocket server running on ws://localhost:8000')


    // console.log('Received:', message)
    // console.log('Buffer Length: ', message.length); // TESTED, working! 8192 bytes
    /* NOTE: default sample rate is 16 kHz: 128 frames × 2 bytes (16-bit PCM) = 256 bytes per buffer, which matches your observation. I've set BUFFER_SIZE to 4096 bytes per frame (ie: samples) instead of 256 bytes per buffer */