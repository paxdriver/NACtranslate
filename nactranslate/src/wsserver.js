import {WebSocketServer} from 'ws'
import axios from 'axios'

const wss = new WebSocketServer({ port: 8000})

wss.on('connection', ws => {
    console.log('Client connected')

    // WORK IN PROGRESS: NEED TO SEND THE DATA FOR THE LANGUAGE AND THE AUDIO BINARY DATA SEPARATELY BECAUSE JSON CONVERSION CORRUPTS THE AUDIO.

    let languageConfig = null // store language settings for the session, that is the language spoken and the language being translated as the desired output

    // Dev NOTE: WebSocket automatically provides the isBinary data boolean value. it is false when the message comes through serialized, and true when the audio data stream is provided as a message.
    ws.on('message', async (message, isBinary) => {
        console.log(`isBinary: ${isBinary}`)
        try {

            if (isBinary) {
                // handle binary audio data
                if (!languageConfig) {
                    console.error("No metadata received!")
                }
                // send flask server audio data to be transcribed
                const response = await axios.post('http://localhost:5000/process_audio', message, {headers: {'Content-Type': 'application/octet-stream'}})
                console.log("Flask response:", response.data.text)
                ws.send(response.data.text) // send back the flask translation response as text
            }
            else {
                const parsedMessage = JSON.parse(message) // the message is config, not binary audio stream data
                /* received config object looks like this:
                    {
                        spokenLanguage: 'en',
                        transcribedLanguage: 'fr'
                    }
                */
                languageConfig = parsedMessage // store current metadata settings for translation languages
                console.log("---- languageConfig is now: -----")
                console.log(languageConfig)
                console.log("------------------------")
                console.log("Language configuration received: ", parsedMessage)
            }

            // const message = JSON.parse(rawMessage)
            // const {lang_to, lang_from, data} = message
            // console.log(`LANGUAGE SELECTIONS: TO: ${lang_to}, FROM: ${lang_from}`)
            
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