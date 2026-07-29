// Resumable GitHub Actions asset pipeline for long Griot Studio stories.
// Each command is intentionally bounded so a job can upload its checkpoint
// well before GitHub's six-hour hosted-runner limit.

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPrompt, jobsFromCSV, slug } from "./csv.mjs";
import {
  LOCKED_NARRATOR_VOICE,
  fetchImage,
  fetchTTS,
  planStory,
  probeDuration
} from "./render.mjs";
import { generateUniqueFemalePresenter } from "./presenter.mjs";

try { process.loadEnvFile(); } catch (error) { /* .env is optional */ }

const STAGE_ROOT = path.resolve(process.env.CF_STAGE_ROOT || "_stage");
const CONTENT_DIR = path.resolve(process.env.CF_INPUT || "content");
const ASSET_DIR = path.join(STAGE_ROOT, "assets");
const SCRIPT_PATTERN = /\.(csv|txt)$/i;

function log(message) {
  console.log("[" + new Date().toISOString().replace("T", " ").slice(0, 19) + "] " + message);
}

function makeConfig() {
  return {
    input: CONTENT_DIR,
    output: STAGE_ROOT,
    style: process.env.CF_STYLE || "story",
    sceneSeconds: Number(process.env.CF_SCENE_SECONDS || 6),
    wps: Number(process.env.CF_WPS || 2.4),
    width: Number(process.env.CF_WIDTH || 1920),
    height: Number(process.env.CF_HEIGHT || 1080),
    imageBase: process.env.CF_IMAGE_BASE || "https://image.pollinations.ai/prompt",
    imageModel: process.env.CF_IMAGE_MODEL || "flux",
    imageToken: process.env.CF_IMAGE_TOKEN || "",
    imageEnhance: process.env.CF_IMAGE_ENHANCE === "0" ? false : true,
    anthropicKey: process.env.ANTHROPIC_API_KEY || "",
    seoModel: process.env.CF_SEO_MODEL || "claude-haiku-4-5-20251001",
    ttsProvider: "edge",
    ttsEnabled: true,
    edgeCmd: process.env.CF_EDGE_CMD || "python3",
    edgeVoice: LOCKED_NARRATOR_VOICE,
    edgeRate: process.env.CF_EDGE_RATE || "-5%",
    edgePitch: process.env.CF_EDGE_PITCH || "+0Hz",
    ffprobe: process.env.CF_FFPROBE || "ffprobe",
    log
  };
}

async function fileIsUsable(file, minimum = 1000) {
  const stat = await fs.stat(file).catch(() => null);
  return !!(stat && stat.isFile() && stat.size >= minimum);
}

async function appendOutputs(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${String(value)}\n`).join("");
  await fs.appendFile(process.env.GITHUB_OUTPUT, lines);
}

async function eligibleScripts() {
  const onlyFile = String(process.env.CF_ONLY_FILE || "").trim();
  const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) =>
      entry.isFile() &&
      SCRIPT_PATTERN.test(entry.name) &&
      !entry.name.startsWith("_") &&
      !entry.name.startsWith(".") &&
      (!onlyFile || entry.name === onlyFile)
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function jobForFile(fileName) {
  const text = (await fs.readFile(path.join(CONTENT_DIR, fileName), "utf8"))
    .replace(/\r/g, "")
    .trim();
  if (!text) throw new Error(fileName + " is empty");
  if (/\.txt$/i.test(fileName)) {
    const title = fileName.replace(/\.txt$/i, "").replace(/[_-]+/g, " ").trim();
    return { title: title || "Video", script: text, hook: "", style: process.env.CF_STYLE || "story", voice: LOCKED_NARRATOR_VOICE, music: "" };
  }
  const jobs = jobsFromCSV(text);
  if (jobs.length !== 1) {
    throw new Error(
      fileName + " contains " + jobs.length +
      " videos. Resumable publishing requires one video per file so each script has its own checkpoint."
    );
  }
  return { ...jobs[0], voice: LOCKED_NARRATOR_VOICE, gender: "female" };
}

export async function createPlan() {
  await fs.mkdir(STAGE_ROOT, { recursive: true });
  const scripts = await eligibleScripts();
  if (!scripts.length) {
    if (process.env.CF_REQUIRE_INPUT === "1") {
      throw new Error("No active script was found in content/");
    }
    log("no active script; scheduled run will finish without generating a duplicate");
    await appendOutputs({ has_input: "false", matrix: "[]" });
    return null;
  }
  const fileName = scripts[0];
  const job = await jobForFile(fileName);
  const cfg = makeConfig();
  if (!cfg.anthropicKey) {
    throw new Error("ANTHROPIC_API_KEY is required to verify the female presenter");
  }
  const planned = planStory(job, cfg);
  const scriptHash = createHash("sha256").update(job.script).digest("hex");
  const batchSize = Math.max(20, Number(process.env.CF_IMAGE_BATCH_SIZE || 84));
  const batchCount = Math.ceil(planned.scenes.length / batchSize);
  const matrix = Array.from({ length: batchCount }, (_, index) => index);

  const presenter = await generateUniqueFemalePresenter({
    job: { ...job, gender: "female", voice: LOCKED_NARRATOR_VOICE },
    cfg,
    workDir: STAGE_ROOT,
    fetchImage
  });
  if (!presenter || !(await fileIsUsable(presenter.file))) {
    throw new Error("female presenter generation failed; refusing to continue");
  }

  const plan = {
    ...planned,
    scriptHash,
    scriptFile: fileName,
    scriptSlug: slug(job.title),
    title: job.title,
    hook: job.hook || "",
    style: job.style || cfg.style,
    voice: LOCKED_NARRATOR_VOICE,
    presenterIdentity: presenter.identity,
    batchSize,
    batchCount,
    createdAt: new Date().toISOString()
  };
  await fs.writeFile(path.join(STAGE_ROOT, "plan.json"), JSON.stringify(plan, null, 2));
  await appendOutputs({
    has_input: "true",
    matrix: JSON.stringify(matrix),
    script_file: fileName,
    script_slug: plan.scriptSlug,
    script_hash: scriptHash
  });
  log(
    `planned ${planned.scenes.length} scenes as ${batchCount} image batches; ` +
    `presenter ${presenter.identity}; narrator ${LOCKED_NARRATOR_VOICE}`
  );
  return plan;
}

async function readPlan() {
  return JSON.parse(await fs.readFile(path.join(STAGE_ROOT, "plan.json"), "utf8"));
}

function batchBounds(plan, batch) {
  const start = batch * plan.batchSize;
  return { start, end: Math.min(plan.scenes.length, start + plan.batchSize) };
}

export async function generateImageBatch() {
  const plan = await readPlan();
  const cfg = makeConfig();
  const batch = Number(process.env.CF_BATCH_INDEX);
  const round = Math.max(0, Number(process.env.CF_IMAGE_ROUND || 0));
  if (!Number.isInteger(batch) || batch < 0 || batch >= plan.batchCount) {
    throw new Error("CF_BATCH_INDEX is outside the planned batch range");
  }
  await fs.mkdir(ASSET_DIR, { recursive: true });
  const { start, end } = batchBounds(plan, batch);
  const budgetMinutes = Math.max(15, Number(process.env.CF_BATCH_BUDGET_MIN || 90));
  const deadline = Date.now() + budgetMinutes * 60000;
  const concurrency = Math.max(1, Number(process.env.CF_IMG_CONCURRENCY || 2));
  const pending = [];
  for (let i = start; i < end; i++) {
    if (!(await fileIsUsable(path.join(ASSET_DIR, "img" + i + ".jpg")))) pending.push(i);
  }
  let cursor = 0;
  let completed = 0;
  async function worker() {
    while (true) {
      if (Date.now() >= deadline - 120000) return;
      const offset = cursor++;
      if (offset >= pending.length) return;
      const i = pending[offset];
      const outFile = path.join(ASSET_DIR, "img" + i + ".jpg");
      const seed = 3000 + i * 7 + round * 1000003;
      try {
        await fetchImage(buildPrompt(plan.scenes[i], plan.style), seed, outFile, cfg, {
          width: plan.width,
          height: plan.height,
          attempts: round === 0 ? 3 : 4,
          enhance: round === 0
        });
      } catch (error) {
        log(`image ${i + 1} attempt failed: ${error.message}`);
      }
      completed++;
      if (completed % 10 === 0 || completed === pending.length) {
        log(`batch ${batch + 1}/${plan.batchCount} round ${round}: attempted ${completed}/${pending.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, pending.length)) }, worker));

  const succeeded = [];
  const missing = [];
  for (let i = start; i < end; i++) {
    if (await fileIsUsable(path.join(ASSET_DIR, "img" + i + ".jpg"))) succeeded.push(i);
    else missing.push(i);
  }
  const manifest = {
    version: 1,
    scriptHash: plan.scriptHash,
    batch,
    round,
    start,
    end,
    succeeded,
    missing,
    complete: missing.length === 0,
    savedAt: new Date().toISOString()
  };
  await fs.writeFile(path.join(ASSET_DIR, `batch-${batch}.json`), JSON.stringify(manifest, null, 2));
  log(
    `batch ${batch + 1}/${plan.batchCount} checkpoint: ${succeeded.length}/${end - start} images saved; ` +
    `${missing.length} still missing`
  );
  return manifest;
}

async function narrationReady(index, cfg) {
  const audio = path.join(ASSET_DIR, "voice" + index + ".mp3");
  const words = audio + ".words.json";
  if (!(await fileIsUsable(audio)) || !(await fileIsUsable(words, 2))) return false;
  return !!(await probeDuration(audio, cfg));
}

export async function generateNarration() {
  const plan = await readPlan();
  const cfg = makeConfig();
  await fs.mkdir(ASSET_DIR, { recursive: true });
  const budgetMinutes = Math.max(20, Number(process.env.CF_NARRATION_BUDGET_MIN || 150));
  const deadline = Date.now() + budgetMinutes * 60000;
  const concurrency = Math.max(1, Number(process.env.CF_TTS_CONCURRENCY || 4));
  const pending = [];
  for (let i = 0; i < plan.scenes.length; i++) {
    if (!(await narrationReady(i, cfg))) pending.push(i);
  }
  let cursor = 0;
  let completed = 0;
  async function worker() {
    while (true) {
      if (Date.now() >= deadline - 120000) return;
      const offset = cursor++;
      if (offset >= pending.length) return;
      const i = pending[offset];
      const outFile = path.join(ASSET_DIR, "voice" + i + ".mp3");
      for (let attempt = 0; attempt < 5; attempt++) {
        if (await fetchTTS(plan.scenes[i], LOCKED_NARRATOR_VOICE, outFile, cfg) &&
            await narrationReady(i, cfg)) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(30000, 2500 * 2 ** attempt)));
      }
      completed++;
      if (completed % 20 === 0 || completed === pending.length) {
        log(`Jenny narration attempted ${completed}/${pending.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, pending.length)) }, worker));

  const succeeded = [];
  const missing = [];
  for (let i = 0; i < plan.scenes.length; i++) {
    if (await narrationReady(i, cfg)) succeeded.push(i);
    else missing.push(i);
  }
  const manifest = {
    version: 1,
    scriptHash: plan.scriptHash,
    voice: LOCKED_NARRATOR_VOICE,
    succeeded,
    missing,
    complete: missing.length === 0,
    savedAt: new Date().toISOString()
  };
  await fs.writeFile(path.join(ASSET_DIR, "narration.json"), JSON.stringify(manifest, null, 2));
  log(`Jenny narration checkpoint: ${succeeded.length}/${plan.scenes.length}; ${missing.length} missing`);
  return manifest;
}

export async function verifyAssets() {
  const plan = await readPlan();
  const cfg = makeConfig();
  const missingImages = [];
  const missingNarration = [];
  for (let i = 0; i < plan.scenes.length; i++) {
    if (!(await fileIsUsable(path.join(ASSET_DIR, "img" + i + ".jpg")))) missingImages.push(i + 1);
    if (!(await narrationReady(i, cfg))) missingNarration.push(i + 1);
  }
  if (!(await fileIsUsable(path.join(STAGE_ROOT, "presenter.jpg")))) {
    throw new Error("verified female presenter checkpoint is missing");
  }
  if (missingImages.length || missingNarration.length) {
    throw new Error(
      `asset validation failed: ${missingImages.length} image(s) and ` +
      `${missingNarration.length} Jenny narration segment(s) are missing`
    );
  }
  log(`asset validation passed: ${plan.scenes.length} images, ${plan.scenes.length} Jenny narration segments`);
  return { images: plan.scenes.length, narration: plan.scenes.length };
}

async function main() {
  const command = process.argv[2];
  if (command === "plan") await createPlan();
  else if (command === "images") await generateImageBatch();
  else if (command === "narration") await generateNarration();
  else if (command === "verify") await verifyAssets();
  else throw new Error("usage: node staged.mjs <plan|images|narration|verify>");
}

const isEntrypoint = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  main().catch((error) => {
    console.error("::error title=Resumable Griot pipeline failed::" + error.message);
    process.exit(1);
  });
}
