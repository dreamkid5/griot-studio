# Publish folktales from GitHub to YouTube

Write a folktale → push it to GitHub → it becomes a narrated, illustrated video on your
YouTube channel, automatically. This is the workflow in
[`.github/workflows/publish.yml`](.github/workflows/publish.yml).

## The loop

1. Add a plain-text tale to the [`content/`](content/) folder (one file = one video, the
   file name is the title).
2. `git commit` and `git push`.
3. GitHub Actions renders it (3D African folktale visuals + Nigerian narration), writes the
   SEO with Claude, and uploads it to YouTube.
4. The script is moved to `content/published/` and the upload ledger is committed back, so a
   tale is never published twice.

It also runs on a **daily schedule** (06:00 UTC) and can be started by hand from the repo's
**Actions** tab.

## One-time setup

### 1. Put this project on GitHub

```
cd "YouTube African Folktales"
git init
git add .
git commit -m "Griot Studio"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`worker/.env`, `node_modules/`, and `dist/` are gitignored, so your keys are **not** pushed.
Keys live in GitHub Secrets instead (next step).

### 2. Add the secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**. Add:

| Secret | What it is | Get it from |
| :-- | :-- | :-- |
| `AZURE_SPEECH_KEY` | Nigerian narration | [worker/SETUP-AZURE-NIGERIAN.md](worker/SETUP-AZURE-NIGERIAN.md) |
| `AZURE_SPEECH_REGION` | e.g. `eastus` | same |
| `ANTHROPIC_API_KEY` | SEO + character consistency | console.anthropic.com |
| `YT_CLIENT_ID` | YouTube OAuth | [GET-API-KEYS.md](GET-API-KEYS.md) |
| `YT_CLIENT_SECRET` | YouTube OAuth | same |
| `YT_REFRESH_TOKEN` | YouTube OAuth | same |
| `CF_IMAGE_TOKEN` | *(optional)* higher image limits | enter.pollinations.ai |

> You already have working YouTube OAuth values in `worker/.env`
> (`YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`) — copy those same three values
> straight into the matching secrets.

Optional repo **variable** (Settings → Variables): `CF_YT_PRIVACY` = `public`, `unlisted`,
or `private`. Default is `private`, so you can review each upload before making it public.

### 3. Push your first tale

Two sample tales already sit in `content/`, so the very first push will produce real videos.
Watch progress under the **Actions** tab. When it finishes, the videos are on your channel and
the scripts have moved to `content/published/`.

## Notes

- **No duplicates:** dedup is enforced two ways — the `content/published/` archive and the
  YouTube ledger (`content/.cf-uploaded.json`), which survives even if you rename a video.
- **Cost:** images are free (Pollinations), narration is Azure's free tier, Claude SEO is a
  few cents a video on Haiku. YouTube upload is free.
- **Change the look or voice for the whole channel:** edit `CF_STYLE` / `CF_AZURE_VOICE` in
  the workflow file, or `styleKeywords.folktale3d` in `worker/csv.mjs`.
