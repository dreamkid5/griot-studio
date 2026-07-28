GRIOT STUDIO — FOLKTALE SCRIPTS FOLDER

This folder feeds the cloud automation that runs on GitHub and publishes to YouTube.

How to add a folktale:
1. Create a plain text file in this folder. Name it exactly what you want the video
   titled, for example:  Why the Tortoise Has a Cracked Shell.txt
2. Write the tale inside as normal sentences. Each sentence or two becomes a scene.
   Write it the way a griot would tell it aloud — that is exactly how it is narrated.
3. Commit and push the file to GitHub.

What happens next (automatically):
- GitHub Actions renders each new script into a narrated, illustrated video.
- Narration is permanently locked to Jenny (en-US-JennyNeural); male voices and
  script-selected voices cannot override her.
- Every video uses a new white adult woman presenter on the left. The generated
  portrait must pass two visual checks confirming exactly one adult woman and no
  man before it can enter the video or thumbnail.
- Narration-matched photorealistic story scenes appear on the right.
- Anthropic is used only for two strict visual checks of the presenter. Optional
  Claude SEO and scene-planning calls are disabled to reduce cost and failures.
- The finished video is uploaded to your YouTube channel.
- The script is then moved into the published/ folder so it is never made twice.

You can also trigger a run by hand from the repo's Actions tab
(the "Publish folktales to YouTube" workflow → Run workflow).

Two ready-made sample tales are already in this folder, so your first push produces
real videos. Tip: name a recurring narrator (e.g. "Baba the storyteller") in your
scripts and describe him once, and he will be drawn the same way in every scene.

Files whose name starts with an underscore, like this one, are ignored.
