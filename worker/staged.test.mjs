import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { LOCKED_NARRATOR_VOICE, planStory, renderJob } from "./render.mjs";

const cfg = {
  style: "story",
  sceneSeconds: 6,
  wps: 2.4,
  width: 1920,
  height: 1080
};

test("long stories are planned without truncation and switch to 720p", () => {
  const sentences = Array.from(
    { length: 900 },
    (_, index) => `Scene ${index + 1} keeps every important word in the complete story.`
  );
  const script = sentences.join(" ");
  const plan = planStory({ title: "Long Story", script, style: "story" }, cfg);

  assert.ok(plan.scenes.length <= 600);
  assert.equal(plan.width, 1280);
  assert.equal(plan.height, 720);
  assert.equal(plan.scenes.join(" ").replace(/\s+/g, " ").trim(), script.replace(/\s+/g, " ").trim());
});

test("staged narration remains locked to Jenny", () => {
  assert.equal(LOCKED_NARRATOR_VOICE, "en-US-JennyNeural");
});

test("the final renderer refuses staged assets from a different script", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "griot-staged-test-"));
  const previous = process.env.CF_STAGED_ASSET_DIR;
  await fs.writeFile(path.join(root, "plan.json"), JSON.stringify({
    scriptHash: "not-the-current-script",
    scenes: ["A complete story."],
    width: 1280,
    height: 720
  }));
  process.env.CF_STAGED_ASSET_DIR = root;
  try {
    await assert.rejects(
      renderJob(
        { title: "Story", script: "A complete story.", style: "story" },
        { ...cfg, log: () => {} },
        path.join(root, "work"),
        path.join(root, "video.mp4")
      ),
      /staged assets belong to a different script/
    );
  } finally {
    if (previous === undefined) delete process.env.CF_STAGED_ASSET_DIR;
    else process.env.CF_STAGED_ASSET_DIR = previous;
    await fs.rm(root, { recursive: true, force: true });
  }
});
