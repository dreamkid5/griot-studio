# The Nigerian narration voice (Microsoft Azure)

Griot Studio narrates every folktale with a professional **Nigerian English** neural voice
from Microsoft Azure. The default is **`en-NG-EzinneNeural`** (a warm Nigerian female
storyteller). The male elder voice is **`en-NG-AbeoNeural`**.

Azure gives about **500,000 characters a month free** — plenty for daily uploads. The signup
asks for a card only to verify identity; the free Speech tier is not charged.

## Get the key (about 3 minutes)

1. Go to https://portal.azure.com and sign in (create a free account if needed).
2. In the top search bar type **Speech services**, open it, then click **Create**.
3. Choose your subscription, create or pick a resource group, choose a region such as
   **East US**, name the resource, and for pricing tier pick **Free F0**.
   Click **Review and create**, then **Create**.
4. Open the resource → **Keys and Endpoint**. Copy **KEY 1** and the **Location/Region**
   (for example `eastus`).

## Use it locally (worker/.env)

Open `worker/.env` and fill in:

```
AZURE_SPEECH_KEY=your_key_here
AZURE_SPEECH_REGION=eastus
CF_TTS_PROVIDER=azure
CF_AZURE_VOICE=en-NG-EzinneNeural
```

Then render:

```
cd worker
npm run once          # process the current folktales once
# or
npm run now           # keep watching and render new ones as they arrive
```

## Use it on GitHub (cloud publishing)

Add the same values as repository **secrets**
(GitHub repo → Settings → Secrets and variables → Actions → New repository secret):

| Secret | Value |
| :-- | :-- |
| `AZURE_SPEECH_KEY` | your KEY 1 |
| `AZURE_SPEECH_REGION` | e.g. `eastus` |

The publish workflow already sets the voice to `en-NG-EzinneNeural`. To switch the whole
channel to the male elder, change `CF_AZURE_VOICE` in `.github/workflows/publish.yml` to
`en-NG-AbeoNeural`, or set a repository **variable** of the same name.

## Voice options

| Voice | Who |
| :-- | :-- |
| `en-NG-EzinneNeural` | Nigerian female storyteller (default) |
| `en-NG-AbeoNeural` | Nigerian male elder / griot |

The pace and warmth are tuned in `CF_AZURE_RATE` (default `-6%`) and `CF_AZURE_PITCH`
(default `-2%`) for a measured, fireside storytelling cadence.
