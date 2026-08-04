import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  newFemalePresenterIdentity,
  normalizePresenterAgeProfile,
  presenterAgeAssessmentMatches,
  presenterAssessmentApproved,
  resolvePresenterAgeProfile,
  validateFemalePresenterImage
} from "./presenter.mjs";
import { femaleVoice, LOCKED_NARRATOR_VOICE } from "./render.mjs";

test("every presenter prompt requires a white adult woman and excludes men", () => {
  for (let i = 0; i < 12; i++) {
    const profile = newFemalePresenterIdentity({
      title: "Regression check " + i,
      script: "My name is Claire. I was forty two when this happened.",
      presenterAge: {
        targetAge: 42,
        minAge: 42,
        maxAge: 42,
        source: "explicit",
        confidence: "high",
        evidence: "I was forty two when this happened."
      }
    });
    assert.match(profile.prompt, /adult white European woman presenter/i);
    assert.match(profile.prompt, /exactly 42 years old/i);
    assert.match(profile.prompt, /white female presenter only/i);
    assert.match(profile.prompt, /no man, no male person/i);
  }
});

test("presenter age profiles reject children, broad guesses, and low confidence", () => {
  const valid = normalizePresenterAgeProfile({
    target_age: 52,
    min_age: 52,
    max_age: 52,
    source: "explicit",
    confidence: "high",
    evidence: "I was fifty two when this happened."
  });
  assert.deepEqual(valid, {
    targetAge: 52,
    minAge: 52,
    maxAge: 52,
    source: "explicit",
    confidence: "high",
    evidence: "I was fifty two when this happened."
  });
  assert.equal(normalizePresenterAgeProfile({ ...valid, targetAge: 17, minAge: 17, maxAge: 17 }), null);
  assert.equal(normalizePresenterAgeProfile({ ...valid, minAge: 30, maxAge: 50, targetAge: 40 }), null);
  assert.equal(normalizePresenterAgeProfile({ ...valid, confidence: "low" }), null);
});

test("script analysis targets the narrator's main-event age", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.match(request.messages[0].content, /not the age of her husband, child, mother, mother-in-law/i);
    return {
      status: 200,
      ok: true,
      async json() {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              resolved: true,
              target_age: 36,
              min_age: 36,
              max_age: 36,
              source: "explicit",
              confidence: "high",
              evidence: "I was thirty six when this happened."
            })
          }]
        };
      }
    };
  };
  try {
    const age = await resolvePresenterAgeProfile({
      title: "House story",
      script: "My name is Claire. I was thirty six when this happened. My mother-in-law was seventy."
    }, {
      anthropicKey: "test-key",
      seoModel: "test-model"
    });
    assert.equal(age.targetAge, 36);
    assert.equal(age.source, "explicit");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("every narration request resolves to Jenny", () => {
  assert.equal(LOCKED_NARRATOR_VOICE, "en-US-JennyNeural");
  for (const requested of ["en-US-BrianNeural", "male", "", undefined]) {
    assert.equal(femaleVoice("edge", requested, {}), LOCKED_NARRATOR_VOICE);
  }
});

test("visual validation accepts only one verified white adult woman", () => {
  const requiredAge = {
    targetAge: 52,
    minAge: 52,
    maxAge: 52,
    source: "explicit",
    confidence: "high",
    evidence: "I was fifty two."
  };
  const approved = {
    person_count: 1,
    adult_woman: true,
    white_presenting: true,
    man_present: false,
    photorealistic: true,
    face_visible: true,
    presenter_framing: true,
    estimated_age_min: 49,
    estimated_age_max: 55,
    age_matches_required_range: true
  };
  assert.equal(presenterAssessmentApproved(approved, requiredAge), true);
  assert.equal(presenterAgeAssessmentMatches(approved, requiredAge), true);

  for (const invalid of [
    { ...approved, person_count: 2 },
    { ...approved, adult_woman: false },
    { ...approved, white_presenting: false },
    { ...approved, man_present: true },
    { ...approved, photorealistic: false },
    { ...approved, face_visible: false },
    { ...approved, presenter_framing: false },
    { ...approved, age_matches_required_range: false },
    { ...approved, estimated_age_min: 27, estimated_age_max: 34 }
  ]) {
    assert.equal(presenterAssessmentApproved(invalid, requiredAge), false);
  }
});

test("the image itself must pass two independent API inspections", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "griot-presenter-test-"));
  const imagePath = path.join(tempDir, "presenter.jpg");
  await fs.writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return {
      status: 200,
      ok: true,
      async json() {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              person_count: 1,
              adult_woman: true,
              white_presenting: true,
              man_present: false,
              photorealistic: true,
              face_visible: true,
              presenter_framing: true,
              estimated_age_min: 33,
              estimated_age_max: 39,
              age_matches_required_range: true,
              reason: "verified"
            })
          }]
        };
      }
    };
  };

  try {
    const result = await validateFemalePresenterImage(imagePath, {
      anthropicKey: "test-key",
      seoModel: "test-model"
    }, {
      targetAge: 36,
      minAge: 36,
      maxAge: 36,
      source: "explicit",
      confidence: "high",
      evidence: "I was thirty six."
    });
    assert.equal(result.approved, true);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("validator outages are treated as infrastructure failures, not bad presenters", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "griot-presenter-test-"));
  const imagePath = path.join(tempDir, "presenter.jpg");
  await fs.writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 401, ok: false });

  try {
    const result = await validateFemalePresenterImage(imagePath, {
      anthropicKey: "invalid-test-key",
      seoModel: "test-model"
    }, {
      targetAge: 36,
      minAge: 36,
      maxAge: 36,
      source: "explicit",
      confidence: "high",
      evidence: "I was thirty six."
    });
    assert.equal(result.approved, false);
    assert.equal(result.infrastructureFailure, true);
    assert.match(result.reason, /validator HTTP 401/);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(tempDir, { recursive: true, force: true });
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

test("presenter generation requires two visual checks and remembers rejected images", async () => {
  const presenterSource = await fs.readFile(new URL("./presenter.mjs", import.meta.url), "utf8");
  assert.match(presenterSource, /const VALIDATION_PASSES = 2/);
  assert.match(presenterSource, /ANTHROPIC_API_KEY is required to verify every female presenter/);
  assert.match(presenterSource, /presenter verification could not run/);
  assert.match(presenterSource, /rejectedHashes/);
  assert.match(presenterSource, /validateFemalePresenterImage/);
  assert.match(presenterSource, /presenter age could not be resolved from the script/);
});

test("the final renderer refuses a staged presenter without an age profile", async () => {
  const renderSource = await fs.readFile(new URL("./render.mjs", import.meta.url), "utf8");
  assert.match(renderSource, /staged presenter age profile is missing; refusing to render/);
  assert.match(renderSource, /validateFemalePresenterImage\(presenter, cfg, stagedPlan\.presenterAge\)/);
});
