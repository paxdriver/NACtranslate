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
BUFFER_SIZE = 4096

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
    # Get the complete audio recording from the request
    audio_data = request.data
    audio_stream = io.BytesIO(audio_data)
    
    # Get language configuration from headers
    from_lang = request.headers.get('Lang-From', "en")
    to_lang = request.headers.get('Lang-To', "ru")
    
    print(f"Processing audio: {len(audio_data)} bytes, {from_lang} -> {to_lang}")
    
    # Get the absolute path to the Vosk model
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    
    try:
        vosk_model_filepath = VOSK_MODELS.get(from_lang)
        if vosk_model_filepath and vosk_model_filepath != None:
            model_path = os.path.join(parent_dir, vosk_model_filepath)
        else:
            print("-" * 25)
            print("ERROR!!!! Unable to retrieve vosk model from supplied filepath.")
            print(f"Requested language: {from_lang}")
            print("Available models:", list(VOSK_MODELS.keys()))
            print("-" * 25)
            return {"text": "Error: Unsupported language model"}
            
    except Exception as e:
        print("Error resolving spoken language model:")
        print(f"From language: {from_lang}")
        print(f"Error: {e}")
        return {"text": "Error: Model resolution failed"}

    # Load the Vosk model
    model = Model(model_path)
    recognizer = KaldiRecognizer(model, 16000)
    
    # Reset audio stream position
    audio_stream.seek(0)
    
    # Process the complete audio recording
    transcription = ""
    partial_text = ""
    
    print("Starting audio processing...")
    
    # Process audio in chunks for Vosk, but treat as one complete recording
    while True:
        chunk = audio_stream.read(BUFFER_SIZE)
        if len(chunk) == 0:
            break
            
        if recognizer.AcceptWaveform(chunk):
            result = json.loads(recognizer.Result())
            chunk_text = result.get("text", "").strip()
            if chunk_text:
                print(f"Final chunk result: '{chunk_text}'")
                transcription += " " + chunk_text
        else:
            partial_result = json.loads(recognizer.PartialResult())
            partial_text = partial_result.get("partial", "")
            if partial_text:
                print(f"Partial result: '{partial_text}'")
    
    # Get any remaining results after processing all audio
    final_result = json.loads(recognizer.FinalResult())
    final_text = final_result.get("text", "").strip()
    if final_text:
        print(f"Final result: '{final_text}'")
        transcription += " " + final_text
    
    # Clean up transcription
    transcription = transcription.strip()
    
    if not transcription:
        # If no final transcription, try to use the last partial result
        transcription = partial_text.strip()
    
    print(f"Complete transcription: '{transcription}'")
    
    # Translate if needed
    if from_lang and to_lang and from_lang != to_lang and transcription:
        translated_text = translate_text(from_lang, to_lang, transcription)
        print(f"Translation: '{translated_text}'")
        return {"text": translated_text}
    elif transcription:
        return {"text": transcription}
    else:
        return {"text": "No speech detected"}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)