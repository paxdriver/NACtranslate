from vosk import Model, KaldiRecognizer
from flask import Flask, request
# import wave  # Required for testing with a file instead of a stream
import io  # Required for handling in-memory streams
import os # Required for robustly handling relative paths
import json # Required for the parsing of the API responses
import argostranslate.package
import argostranslate.translate

# Provide the language codes from, translated to, and the text that is being translated. Outputs text in the other language as expected
def translate_text(from_lang: str, to_lang: str, text: str) -> str:
    installed_languages = argostranslate.translate.get_installed_languages()
    from_language = next(filter(lambda x: x.code == from_lang, installed_languages), None)
    to_language = next(filter(lambda x: x.code == to_lang, installed_languages), None)
    
    if from_language and to_language and text and isinstance(text, str):
        translation = from_language.get_translation(to_language).translate(text) # type: ignore
        return translation
    else: return ""
    

# NOTE: this buffer_size MUST match the BUFFER_SIZE in pcmProcessor.js. keep fine-tuning things but make sure that the values are updated in both places every time or nothing will work and no errors will be helpful.
# BUFFER_SIZE = 4096 # 256ms
# BUFFER_SIZE = 96000 # 96000 = 6 seconds
BUFFER_SIZE = 48000 * 5
VOSK_MODELS: dict[str, str] = {
    "en": "vosk-models/vosk-model-small-en-us-0.15",
    "es": "vosk-models/vosk-model-small-es-0.42",
    "fr": "vosk-models/vosk-model-small-fr-0.22",
    "ru": "vosk-models/vosk-model-small-ru-0.22",
    "pt": "vosk-models/vosk-model-small-pt-0.3",
    "uk": "vosk-models/vosk-model-small-uk-v3-small",
    "tl": "vosk-models/vosk-model-small-tl-ph-generic-0.6",
    "de": "vosk-models/vosk-model-small-de-0.15",
    # "ar": "vosk-models/vosk-model-small-ar-tn-0.1-linto",
    "ar": "vosk-models/vosk-model-ar-mgb2-0.4",
    "ca": "vosk-models/vosk-model-small-ca-0.4"
}

app = Flask(__name__)

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


@app.route("/process_audio", methods=["POST"])  # type: ignore
def process_audio():
    # file = request.files['file']
    
    ########################################### DEV NOTE: ##############################
    # Convert FileStorage to a byte stream
    audio_stream = io.BytesIO(request.data) # Read raw PCM data from message contents in request from wsserver worklet
    ###########################################
    
    # From and To languages are provided to the websocket and stored in app state. Event handler is triggered when they're updated, and that sends a serialized message (not audio stream) to the open websocket and tells it to update the variable used to store the current language configuration. When a post request hits this endpoint, the from and to language configuration strings are provided to the header sent with the post request, and that's were we get them from to provide to the translate function.
    from_lang = request.headers.get('Lang-From', "en")
    to_lang = request.headers.get('Lang-To', "ru")
    
    # Get the absolute path to the Vosk model
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    
    try:
        vosk_model_filepath = VOSK_MODELS.get(from_lang)
        # vosk_model_filepath = VOSK_MODELS.get(from_lang)
        if vosk_model_filepath and vosk_model_filepath != None:
            model_path = os.path.join(parent_dir, vosk_model_filepath)
        else:
            print("-"*25)
            print("ERROR!!!! Unable to retrieve vosk model from supplied filepath. The vosk models are expected to be ../vosk-models/vosk-model-small... which is a folder extracted from the zip files obtained here: https://alphacephei.com/vosk/models") 
            print("-"*25)
            
    except:
        print("Was unable to resolve spoken language model selection! check these variables and see which is not being represented accurately:")
        print("from language spoken via POST headers:")
        print(from_lang)
        print("Vosk models and their path names:")
        print(VOSK_MODELS)

    # Load the Vosk model
    model = Model(model_path)
    
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
    if from_lang and to_lang and from_lang != to_lang: 
        return {"text": translate_text(from_lang, to_lang, transcription)}
    elif to_lang == from_lang: return {"text": transcription}

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