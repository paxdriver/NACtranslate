# NACtranslate

Translation for Live Church Services

## Overview

NACtranslate is designed to facilitate real-time translation for live church services by leveraging two open source projects:
- **Vosk** for speech-to-text transcription
- **Argos** for text-to-text translation

This project prioritizes privacy by keeping all user interactions on your private network. It avoids using external APIs to ensure that client data remains strictly confidential—a key consideration for environments such as churches, accounting, healthcare, and legal services.

[![NACtranslate Demo Video](http://img.youtube.com/vi/xH9t3SOSoH8/0.jpg)](https://www.youtube.com/watch?v=xH9t3SOSoH8)

## Features

- Real-time speech-to-text conversion using Vosk.
- Real-time text translation using Argos.
- **Privacy Focus:** All processing stays within your network.
- Docker-based deployment for the internal server.
- React-powered user interface.
- Dedicated branch (e.g., `raspberrypi`) for deployment on Raspberry Pi hardware.

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js and npm](https://nodejs.org) (for developing and running the React interface)
- [Python](https://www.python.org) (for backend services)

### Installation

1. **Clone the Repository**  
   Replace `your_username` with your GitHub username if necessary:
   ```bash
   git clone git@github.com:your_username/NACtranslate.git
   cd NACtranslate
