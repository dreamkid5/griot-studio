# CreatorFlow worker

A small background service that renders CreatorFlow videos with the browser closed. It watches a folder for CSV files and turns every row into a finished MP4 using ffmpeg, so it can run on a server or on a cron schedule.

This is the unattended version of the Bulk Studio Watch folder feature.

## What it does

1. Watches an input folder for CSV files
2. For each new CSV, reads every row (title, script, style, voice, music)
3. Splits each script into scenes and generates an illustration per scene
4. Optionally generates a narration voiceover when a key is set
5. Assembles a video with Ken Burns motion and crossfades, mixes narration and music
6. Saves each finished MP4 to the output folder

No browser and no headless Chrome. All rendering is done by ffmpeg.

## Requirements

* Node 18 or newer (uses the built in fetch, no npm install needed)
* ffmpeg and ffprobe on your PATH. On a Mac: `brew install ffmpeg`

## Quick start

```
cd worker
mkdir -p input output
cp sample-videos.csv input/videos.csv
node watch.mjs --once
```

The finished videos appear in `output`. Run without `--once` to keep watching:

```
node watch.mjs
```

Then drop new CSV files into `input` and they render automatically.

## The CSV format

Columns: `title, script, hook, style, voice, music`. Only `script` is required. Thumbnail
text comes from `hook`, or from the opening hook of the script when it is blank.

```
title,script,hook,style,voice,music
"The Story of Valerian","In ancient Rome a weary man could not sleep...","A weary man could not sleep.",watercolor,en-US-JennyNeural,
```

* **style**: watercolor, cinematic, storybook, anime, 3d, or flat
* **voice**: retained for compatibility but ignored; automation is locked to Jenny (`en-US-JennyNeural`)
* **music**: a direct URL to an audio file, mixed under the narration

## Narration

Narration is always on and locked to Jenny (`en-US-JennyNeural`) through
`edge-tts`. It needs no API key. Provider keys, environment voice settings, and
the CSV `voice` column cannot change the narrator.

For storytime videos, the presenter on the left is always a newly generated
white woman. The worker records each presenter seed and image hash in
`output/.presenter-history.json`; exact duplicates are rejected. The GitHub
workflows cache this file so presenter photos stay unique across separate runs.

## Settings (all optional)

| Variable | Default | Meaning |
| :-- | :-- | :-- |
| `CF_INPUT` | `./input` | Folder to watch for CSV files |
| `CF_OUTPUT` | `./output` | Folder for finished videos |
| `CF_STYLE` | `watercolor` | Default art style when a row leaves it blank |
| `CF_SCENE_SECONDS` | `4` | Seconds per scene when there is no narration |
| `CF_IMAGE_BASE` | Pollinations prompt endpoint | Image model base URL |
| `CF_IMAGE_MODEL` | `flux` | Image model name |
| `CF_MUSIC` | empty | Path to a shared music file for rows without their own |
| `CF_EDGE_RATE` | `-5%` | Jenny's narration rate |
| `CF_EDGE_PITCH` | `+0Hz` | Jenny's narration pitch |
| `CF_INTERVAL` | `30` | Seconds between folder checks in watch mode |
| `CF_FFMPEG` / `CF_FFPROBE` | `ffmpeg` / `ffprobe` | Binary names or paths |
| `YT_CLIENT_ID` / `YT_CLIENT_SECRET` / `YT_REFRESH_TOKEN` | empty | Turn on YouTube upload |
| `CF_YT_PRIVACY` | `private` | private, unlisted, or public |
| `CF_YT_CATEGORY` | `27` | YouTube category id (27 is Education) |
| `CF_YT_TAGS` | empty | Comma separated tags |
| `CF_YT_UPLOAD` | auto | Set to `0` to keep uploads off even with keys set |

## Run with Docker (ffmpeg bundled)

The Dockerfile installs ffmpeg for you, so nothing else is needed on the host.

```
cd worker
docker build -t creatorflow-worker .
mkdir -p input output
docker run --rm -v "$PWD/input:/app/input" -v "$PWD/output:/app/output" creatorflow-worker
```

Or with compose, which reads keys from your shell or a `.env` file:

```
docker compose up --build
```

Drop CSV files into `input` and finished videos land in `output`.

## Upload to YouTube automatically

When YouTube keys are set, every finished video is uploaded straight to your channel (as private by default). To get the keys once:

1. In the Google Cloud console, enable the **YouTube Data API v3**
2. Create an **OAuth client** of type Desktop, which gives you a client id and secret
3. Do the one time OAuth consent to get a **refresh token** for the scope `https://www.googleapis.com/auth/youtube.upload` (the OAuth Playground is the quickest way)
4. Provide them to the worker:

```
YT_CLIENT_ID=... YT_CLIENT_SECRET=... YT_REFRESH_TOKEN=... \
CF_YT_PRIVACY=unlisted node watch.mjs
```

Each upload logs its link. Uploads run per video, and a failed upload never stops the rest of the batch. Note the YouTube Data API has a daily upload quota, so very large batches may need to spread across days.

## Running on a schedule with cron

Use `--once` from cron so each run processes new CSVs and exits. This example runs every 15 minutes:

```
*/15 * * * * cd /path/to/worker && TTS_API_KEY=sk-your-key /usr/local/bin/node watch.mjs --once >> worker.log 2>&1
```

The worker remembers which CSV files it has already handled, so a repeating cron never renders the same file twice.
