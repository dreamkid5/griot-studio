# Jenny narration — free, no key

Griot Studio uses one female neural narrator for every video:
**Jenny (`en-US-JennyNeural`)**. This voice is locked in the worker and speech
endpoint; environment variables, CSV values, and premium-provider keys cannot
replace it.

## It is free. No AI-generator bill.

The narration uses **`edge-tts`** — the same free neural voices built into the Microsoft Edge
browser's "Read aloud" feature. There is **no API key, no account, and no card**, and it does
**not** cost money per video. It is not a paid AI speech service; it is a free public voice
engine.

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

## Locked voice

| Voice | Who |
| :-- | :-- |
| `en-US-JennyNeural` | Jenny, US female storytime narrator |

The `voice` CSV column remains only so older script files continue to parse; its
value is ignored. `CF_TTS_PROVIDER`, `CF_FEMALE_VOICE`, `CF_EDGE_VOICE`, and
premium-provider voice settings also cannot change the narrator. Pace and warmth
can still be tuned with `CF_EDGE_RATE` and `CF_EDGE_PITCH`.
