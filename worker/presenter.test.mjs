import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { newFemalePresenterIdentity } from "./presenter.mjs";
import { femaleVoice, LOCKED_NARRATOR_VOICE } from "./render.mjs";

test("every presenter prompt requires a white adult woman and excludes men", () => {
  for (let i = 0; i < 12; i++) {
    const profile = newFemalePresenterIdentity({
      title: "Regression check " + i,
      script: "A story whose characters must never determine the presenter."
    });
    assert.match(profile.prompt, /adult white European woman presenter/i);
    assert.match(profile.prompt, /white female presenter only/i);
    assert.match(profile.prompt, /no man, no male person/i);
  }
});

test("every narration request resolves to Jenny", () => {
  assert.equal(LOCKED_NARRATOR_VOICE, "en-US-JennyNeural");
  for (const requested of ["en-US-BrianNeural", "male", "", undefined]) {
    assert.equal(femaleVoice("edge", requested, {}), LOCKED_NARRATOR_VOICE);
  }
});

test("the automated worker cannot select gender or a male voice", async () => {
  const watchSource = await fs.readFile(new URL("./watch.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(watchSource, /\bdetectGender\b|\bvoiceForGender\b|\bmaleVoice\b/);
  assert.match(watchSource, /job\.gender = "female"/);
  assert.match(watchSource, /job\.voice = cfg\.femaleVoice/);
});

test("rendering fails closed when a female presenter cannot be generated", async () => {
  const renderSource = await fs.readFile(new URL("./render.mjs", import.meta.url), "utf8");
  assert.match(renderSource, /const storyMode = true/);
  assert.match(renderSource, /refusing to render without a female presenter/);
});
