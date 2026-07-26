# Five videos a day, on a schedule

This makes 5 narrated videos a day on your Mac, on a schedule, tidied into dated folders, and optionally uploaded to YouTube. Set up once, about ten minutes.

## Narration

Every automated video uses Jenny (`en-US-JennyNeural`) through free
`edge-tts`. No API key, account, or payment card is required, and voice settings
cannot replace Jenny.

## Part 1: prepare the worker (once)

```
brew install node ffmpeg
cd "/Users/mac/Desktop/WEBSITE/YouTube African Folktales/worker"
mkdir -p input output
cp .env.example .env
```
Each time you want videos, put them in one file named exactly `input/pending.csv`. One row per video: `title, script, hook, style, voice, music`. The automation always uses Jenny (`en-US-JennyNeural`); the compatibility `voice` column is ignored. Thumbnail text comes from the `hook` column, or from the opening hook of the script when that column is empty. Start from the template:
```
cp sample-videos.csv input/pending.csv
```

Each row receives a new white female presenter. The worker rejects any presenter image
already recorded in its presenter history, and GitHub Actions carries that
history into later video runs.

## Part 2: start it now

This begins immediately and keeps running. It renders whatever is waiting, then watches for the next batch:
```
npm run now
```
It renames each batch to the date, renders every row with Jenny, and files the finished MP4s into `output/<date>`. Leave it running and drop a new `input/pending.csv` whenever you want more, they render right away, no schedule.

To make one batch and stop instead, use `npm run once`.

## Part 3, optional: a fixed daily time instead

If you would rather it run at a set time than stay open, use cron. Run `crontab -e` and add one line, then save and quit:
```
0 3 * * * cd "/Users/mac/Desktop/WEBSITE/YouTube African Folktales/worker" && caffeinate -i /usr/local/bin/node daily.mjs >> worker.log 2>&1
```
The key comes from your `.env`, so it is not on this line. If `which node` shows a different path, use that instead of `/usr/local/bin/node`.

## Part 5, optional: upload to YouTube

Add your YouTube keys to the same cron line to upload each finished video:
```
YT_CLIENT_ID=... YT_CLIENT_SECRET=... YT_REFRESH_TOKEN=... CF_YT_PRIVACY=unlisted
```
See the main worker README for getting those keys.

## Two honest reminders

- The Mac must be awake at the scheduled time. Keep it plugged in and run `sudo pmset -c sleep 0`, or wake it just before with `sudo pmset repeat wakeorpoweron MTWRFSU 02:59:00`. A closed sleeping laptop skips the job, so an always on machine or a small cloud server is more dependable for a real daily channel.
- YouTube limits how many uploads a new channel can do per day. Five is usually fine, but if uploads fail, spread them out or grow your channel limits over time.
