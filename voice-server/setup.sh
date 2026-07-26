#!/bin/bash
# One time setup for the local voice server. Free, no card, no key.
# Installs Piper (a local voice engine) and downloads a good voice.
set -e
cd "$(dirname "$0")"

echo "1. Installing Piper. This uses Python 3, which macOS already has."
python3 -m pip install --user --upgrade piper-tts || pip3 install --user --upgrade piper-tts

echo "2. Downloading a voice. Lessac, a clear US female, good for narration."
mkdir -p voices
BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high"
curl -L -o voices/en_US-lessac-high.onnx "$BASE/en_US-lessac-high.onnx"
curl -L -o voices/en_US-lessac-high.onnx.json "$BASE/en_US-lessac-high.onnx.json"

echo ""
echo "Done. Start the voice server with:"
echo "   node server.mjs"
echo ""
echo "Another female voice you can download the same way, then set PIPER_MODEL to the file:"
echo "   en_US/amy/medium/en_US-amy-medium           a US female"
