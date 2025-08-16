# nactranslate/src/backend/python-scripts/speech_to_text.py

from vosk import Model, KaldiRecognizer
from flask import Flask, request
import io
import os
import json
import argostranslate.package
import argostranslate.translate

def translate_text(from_lang: str, to_lang: str, text: str) -> str:
    installed_languages = argostranslate.translate.get_installed_languages()
    from_language = next(filter(lambda x: x.code == from_lang, installed_languages), None)
    to_language = next(filter(lambda x: x.code == to_lang, installed_languages), None)
    
    if from_language and to_language and text and isinstance(text, str):
        translation = from_language.get_translation(to_language).translate(text)
        return translation
    else: 
        return ""

# Buffer size for Vosk internal processing - this is for reading chunks from the complete audio data
# 4096 is a common value for Vosk processing chunks
# BUFFER_SIZE = 4096
BUFFER_SIZE = 65536 # testing larger buffer size

VOSK_MODELS: dict[str, str] = {
    "en": "vosk-models/vosk-model-small-en-us-0.15",
    "es": "vosk-models/vosk-model-small-es-0.42",
    "fr": "vosk-models/vosk-model-small-fr-0.22",
    "ru": "vosk-models/vosk-model-small-ru-0.22",
    "pt": "vosk-models/vosk-model-small-pt-0.3",
    "uk": "vosk-models/vosk-model-small-uk-v3-small",
    "tl": "vosk-models/vosk-model-small-tl-ph-generic-0.6",
    "de": "vosk-models/vosk-model-small-de-0.15",
    "ar": "vosk-models/vosk-model-ar-mgb2-0.4",
}

app = Flask(__name__)

@app.route("/process_audio", methods=["POST"])
def process_audio():
    # Get the complete audio recording from the request body
    audio_data = request.data
    
    # Extract language configuration from request headers
    from_lang = request.headers.get('Lang-From', "en")
    to_lang = request.headers.get('Lang-To', "ru")
    
    print(f"Processing audio: {len(audio_data)} bytes, {from_lang} -> {to_lang}")
    
    # Resolve file paths for Vosk model directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    
    # Validate and get the correct Vosk model path for source language
    try:
        vosk_model_filepath = VOSK_MODELS.get(from_lang)
        if vosk_model_filepath:
            model_path = os.path.join(parent_dir, vosk_model_filepath)
        else:
            print("-" * 25)
            print("ERROR: Unable to retrieve vosk model from supplied filepath.")
            print(f"Requested language: {from_lang}")
            print("Available models:", list(VOSK_MODELS.keys()))
            print("-" * 25)
            return {"text": "Error: Unsupported language model"}
            
    except Exception as e:
        print("Error resolving spoken language model:")
        print(f"From language: {from_lang}")
        print(f"Error: {e}")
        return {"text": "Error: Model resolution failed"}

    # Initialize Vosk model and recognizer with 16kHz sample rate
    model = Model(model_path)
    recognizer = KaldiRecognizer(model, 16000)
    
    print("Processing complete audio recording...")
    
    # Feed the entire audio recording to Vosk recognizer at once
    # This processes the complete utterance instead of streaming chunks
    recognizer.AcceptWaveform(audio_data)
    
    # Get the final transcription result from the complete audio
    final_result = json.loads(recognizer.FinalResult())
    transcription = final_result.get("text", "").strip()
    
    print(f"Complete transcription: '{transcription}'")
    
    # Handle translation if source and target languages are different
    if from_lang and to_lang and from_lang != to_lang and transcription:
        translated_text = translate_text(from_lang, to_lang, transcription)
        print(f"Translation: '{translated_text}'")
        return {"text": translated_text}
    
    # Return transcription if no translation needed or same language
    elif transcription:
        return {"text": transcription}
    
    # Return error message if no speech was detected in the audio
    else:
        return {"text": "No speech detected"}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)