from vosk import Model, KaldiRecognizer
from flask import Flask, request
import wave
import io  # Required for handling in-memory streams
import os # Required for robustly handling relative paths
import json # Required for the parsing of the API responses

app = Flask(__name__)

# Get the absolute path to the Vosk model
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
model_path = os.path.join(parent_dir, "vosk-models/vosk-model-small-en-us-0.15")

# Load the Vosk model
model = Model(model_path)

@app.route("/process_audio", methods=["POST"])
def process_audio():
    file = request.files['file']

    # Convert FileStorage to a byte stream
    audio_stream = io.BytesIO(file.read())

    # Open the byte stream as a WAV file
    with wave.open(audio_stream, "rb") as audio:
        recognizer = KaldiRecognizer(model, audio.getframerate())
        transcription = ""

        while True:
            data = audio.readframes(4000)
            if len(data) == 0:
                break
            if recognizer.AcceptWaveform(data):
                result = json.loads(recognizer.Result())
                transcription += result.get("text", "")

    return {"text": transcription}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)


###############################
# INSTRUCTIONS AND USEFUL COMMANDS
###############################

#   - AUDIO INPUT REQUIREMENTS: WAV FILE, 16KHZ, MONO, PCM 16-BIT
#   - To test this endpoing, /process_audio needs to be sent a file with a POST request

#   curl -X POST -F "file=@vosk-en-test-b.wav" http://localhost:5000/process_audio
#   ffprobe vosk-en-test-fixed.wav (to get the details of an audio file if you're having trouble getting it working, check the audio input requirements match the file you're trying to test)

#   - Example output from my script and test recording: {"text":"this is a test of the python waskerecordingand it's supposed to convert the speech to text"}

# HOW TO GET MORE LANGUAGE MODELS
    # wget https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip
    # (find more models at https://alphacephei.com/vosk/models)
    # unzip vosk-model-en-us-0.22.zip
    
# HOW THIS SCRIPT IS EXPECTING TO FIND THOSE MODELS
    # This script is run in a python-scripts folder. It will look for models by their unzipped folder names, but not in the same directory as this script. The models are stored in the parent directory's "vosk-models" folder. For the sake of including this script in the same git repo as it will be used, it will not be in the correct place and the models are not included with this repo, they need to be gathered separately and the script must be amended to include the matching model name for the language and size of model you're wanting to use. This will later be done by the app with the user selection, but for now it is manually entered at the top of the script.