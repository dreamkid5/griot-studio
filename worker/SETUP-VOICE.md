# The Nigerian narration voice — free, no key

Griot Studio narrates every folktale with a professional **Nigerian English** neural voice.
The default is **`en-NG-EzinneNeural`** (warm Nigerian female storyteller); the male elder is
**`en-NG-AbeoNeural`**.

## It is free. No AI-generator bill.

The narration uses **`edge-tts`** — the same free neural voices built into the Microsoft Edge
browser's "Read aloud" feature. There is **no API key, no account, and no card**, and it does
**not** cost money per video. It is not a paid AI speech service; it is a free public voice
engine. (Microsoft Azure's paid TTS is still supported as an option, but you do not need it.)

## Install once

```
pip install edge-tts
```

That is the whole setup. On GitHub Actions the publish workflow installs it automatically, so
there is nothing to configure in the cloud.

## Use it

Locally:

```
cd worker
npm run once          # render the current folktales once
# or
npm run now           # keep watching and render new ones as they arrive
```

The worker calls `python3 -m edge_tts` under the hood. Requirements: Python 3 (already on
macOS and on the GitHub runners) and the one `pip install` above.

## Voice options

| Voice | Who |
| :-- | :-- |
| `en-NG-EzinneNeural` | Nigerian female storyteller (default) |
| `en-NG-AbeoNeural` | Nigerian male elder / griot |

Change the channel's voice by setting `CF_EDGE_VOICE` (in `worker/.env`, or as `env:` in
`.github/workflows/publish.yml`). Pace and warmth are tuned with `CF_EDGE_RATE` (default `-6%`)
and `CF_EDGE_PITCH` (default `-2Hz`) for a measured, fireside storytelling cadence.

Browse every available voice:

```
edge-tts --list-voices | grep en-NG
```

## Want even higher realism later?

`edge-tts` is excellent and free. If one day you want the most expressive possible voice for a
flagship video, ElevenLabs or Azure can be dropped in per the commented options in
`worker/.env.example` — but that is optional and costs money. The free Nigerian voice is the
default for a reason: it sounds great and never bills you.
