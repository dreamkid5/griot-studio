# Local voice server

A free voice that runs on your own Mac. No card, no key, nothing leaves your machine. It wraps Piper, an open voice engine. Good quality and fast, a genuine step above the browser voice, though not quite a paid premium voice.

This is retained as a standalone development utility. Griot Studio's automated
videos do not use it; their narration is locked to Jenny
(`en-US-JennyNeural`).

## Setup, once

Needs Node and Python 3, which your Mac has. If not: `brew install node python`.

```
cd voice-server
bash setup.sh
```
That installs Piper and downloads the female Lessac voice.

## Run it

```
node server.mjs
```
Leave it open. It listens on `http://localhost:5111`. It is free and private.

## Changing the voice

Download another voice with the links printed by `setup.sh`, then set the file in your environment:
```
PIPER_MODEL=/full/path/to/en_US-amy-medium.onnx node server.mjs
```

## Honest note

Piper is clear and natural and completely free with no card, and it is faster than the on device browser voice. It is not as lifelike as ElevenLabs or the paid tiers of Azure and Google. For a documentary channel it is a solid free choice. If you later want the top polish, connect a free tier key on Azure or Google instead.
