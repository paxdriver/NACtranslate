from vosk import Model, KaldiRecognizer
from flask import Flask, request
import wave  # Required for testing with a file instead of a stream
import io  # Required for handling in-memory streams
import os # Required for robustly handling relative paths
import json # Required for the parsing of the API responses

# NOTE: this buffer_size MUST match the BUFFER_SIZE in pcmProcessor.js. keep fine-tuning things but make sure that the values are updated in both places every time or nothing will work and no errors will be helpful.
BUFFER_SIZE = 48000 * 5
# BUFFER_SIZE = 4096 # 256ms
# BUFFER_SIZE = 48000
# BUFFER_SIZE = 96000 # 96000 = 6 seconds

app = Flask(__name__)

# Get the absolute path to the Vosk model
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
model_path = os.path.join(parent_dir, "vosk-models/vosk-model-small-en-us-0.15")

# Load the Vosk model
model = Model(model_path)

############ DEBUGGING #######################

# def save_chunk_as_wav(data, file_path, sample_rate=16000, channels=1):
#     with wave.open(file_path, 'wb') as wav_file:
#         wav_file.setnchannels(channels)
#         wav_file.setsampwidth(2)
#         wav_file.setframerate(sample_rate)
#         wav_file.writeframes(data)
#     print(f"Saved wav file: {file_path}")

# def chunk_saver(output_dir):
#     """
#     Generator-based function to save audio chunks with incrementing file names.

#     :param output_dir: Directory to save audio chunks.
#     """
#     counter = 0
#     while True:
#         chunk = yield  # Receive the chunk from the caller
#         if chunk:
#             file_name = f"chunk_{counter:04d}.wav"
#             file_path = os.path.join(output_dir, file_name)
#             # with open(file_path, "wb") as f:
#             #     f.write(chunk)
#             # print(f"Saved chunk {counter} as {file_path}")
#             save_chunk_as_wav(chunk, file_path)
#             counter += 1

# output_dir = "debug_audio_chunks"
# os.makedirs(output_dir, exist_ok=True)
# chunk_saver_gen = chunk_saver(output_dir)
# next(chunk_saver_gen)  # Prime the generator

############ DEBUGGING #######################

@app.route("/process_audio", methods=["POST"])
def process_audio():
    # file = request.files['file']

    ########################################### DEV NOTE: ##############################
    # Convert FileStorage to a byte stream
    audio_stream = io.BytesIO(request.data) # Read raw PCM data from message contents in request from wsserver worklet
    ###########################################
    
    recognizer = KaldiRecognizer(model, 16000) # Vosk will be provided with fixed 16KHz sample rate
    transcription = ""

    while True:
        data = audio_stream.read(BUFFER_SIZE)
        if len(data) == 0:
            break
        
        #DEBUGGING
        # chunk_saver_gen.send(data)    # saves chunks to wav files so they can be inspected in audacity or similar audio editing software
        #DEBUGGING
        if recognizer.AcceptWaveform(data):  # Test single chunk
            result = json.loads(recognizer.Result())
            print("Single chunk result:", result)
            transcription += result.get("text", "")
        else:
            partial_result = json.loads(recognizer.PartialResult())
            print("Partial result:", partial_result)

    return {"text": transcription}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)


    # Open the byte stream as a WAV file
    # with wave.open(audio_stream, "rb") as audio:
    #     recognizer = KaldiRecognizer(model, audio.getframerate())
    #     transcription = ""

    #     while True:
    #         data = audio.readframes(4000)
    #         if len(data) == 0:
    #             break
    #         if recognizer.AcceptWaveform(data):
    #             result = json.loads(recognizer.Result())
    #             transcription += result.get("text", "")

    # return {"text": transcription}

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