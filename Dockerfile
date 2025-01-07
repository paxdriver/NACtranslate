# Use the official Python image with a specific version
FROM python:3.10-slim

# Create non-root user for this Flask API endpoint image
RUN useradd -m flaskuser

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY nactranslate/src/backend/python-scripts/requirements.txt ./python-scripts/

# Update and install dependencies to python environment, without the recommended packages to keep the image clean and small
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libffi-dev libfftw3-dev

# Clean up after installation to reduce the final image size
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# # Ensure script has the correct permissions
# RUN chmod +x ./python-scripts/speech_to_text.py

# Switch to the non-root flaskuser
USER flaskuser

# Install requirements using flaskuser (as opposed to root)
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r ./python-scripts/requirements.txt

USER root

# Copy the script that downloads and installs the text-to-text translation models to the python environment
COPY ./src/backend/python-scripts/get_argos_models.py ./python-scripts/
RUN ["python3", "./python-scripts/get_argos_models.py"]

# Copy the API to the container's scripts folder
COPY nactranslate/src/backend/python-scripts/speech_to_text.py ./python-scripts/

# Ensure your models are included, this is done manually https://alphacephei.com/vosk/models
COPY ./vosk-models ./vosk-models

# Ensure scripts have the correct permissions
RUN chown -R flaskuser:flaskuser /
USER flaskuser

# Remove the zip files, keeping only the extracted folders needed for the app
RUN find ./vosk-models -name '*.zip' -delete

# Expose the port Flask will run on
EXPOSE 5000

# Run the Flask app
CMD ["python3", "./python-scripts/speech_to_text.py"]


# TEST WITH...
# docker build -t flask-api .
# docker run --rm -p 5000:5000 flask-api