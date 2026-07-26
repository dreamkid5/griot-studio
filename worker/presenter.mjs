import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const HISTORY_FILE = ".presenter-history.json";
const historyStores = new Map();

const HAIR = [
  "a short natural afro",
  "shoulder-length box braids",
  "a neat braided bun",
  "a natural curly bob",
  "medium-length locs",
  "shoulder-length Senegalese twists",
  "elegant cornrows gathered at the back",
  "soft natural coils"
];
const CLOTHING = [
  "a rust orange modern blouse",
  "a teal modern blouse",
  "a mustard yellow casual top",
  "a burgundy modern top",
  "a forest green casual blouse",
  "a royal blue modern top",
  "a cream blouse with subtle African-print trim",
  "a coral casual top"
];
const BACKGROUNDS = [
  "a softly blurred warm reading room",
  "a softly blurred cosy living room",
  "a softly blurred home library",
  "a softly blurred studio with warm wooden details",
  "a softly blurred sunlit interior",
  "a softly blurred room with a houseplant and warm lamp"
];
const FEATURES = [
  "an oval face and high cheekbones",
  "a round face and gentle features",
  "a heart-shaped face and defined cheekbones",
  "a long face and graceful features",
  "a square face and soft features",
  "a softly angular face and expressive eyes"
];

function pick(items, byte) {
  return items[byte % items.length];
}

export function newFemalePresenterIdentity(job = {}) {
  const storyFingerprint = createHash("sha256")
    .update(String(job.title || "") + "\n" + String(job.script || ""))
    .digest("hex");
  const entropy = randomBytes(32);
  const digest = createHash("sha256")
    .update(storyFingerprint)
    .update(entropy)
    .digest();
  const seed = (digest.readUInt32BE(0) % 2147483646) + 1;
  const identity = digest.toString("hex").slice(0, 16);
  const who = [
    "one friendly relatable adult African woman presenter in her late twenties or early thirties",
    "with " + pick(FEATURES, digest[4]),
    "and " + pick(HAIR, digest[5]),
    "wearing " + pick(CLOTHING, digest[6])
  ].join(", ");
  const prompt = [
    "cinematic photorealistic upper body portrait of " + who,
    "warm genuine calm expression, facing the camera",
    "soft natural indoor lighting",
    pick(BACKGROUNDS, digest[7]),
    "shallow depth of field, 35mm, highly detailed realistic skin and face",
    "one woman only, female presenter only, no man, no male person",
    "not an illustration"
  ].join(", ");
  return { identity, seed, prompt };
}

async function getHistoryStore(outputDir) {
  const historyPath = path.join(path.resolve(outputDir || "."), HISTORY_FILE);
  if (historyStores.has(historyPath)) return historyStores.get(historyPath);

  const store = { historyPath, entries: [], hashes: new Set(), seeds: new Set() };
  try {
    const saved = JSON.parse(await fs.readFile(historyPath, "utf8"));
    store.entries = Array.isArray(saved.entries) ? saved.entries : [];
    for (const entry of store.entries) {
      if (entry && entry.hash) store.hashes.add(entry.hash);
      if (entry && Number.isInteger(entry.seed)) store.seeds.add(entry.seed);
    }
  } catch (e) {
    // A missing or invalid history file simply starts a new ledger.
  }
  historyStores.set(historyPath, store);
  return store;
}

async function saveHistory(store) {
  await fs.mkdir(path.dirname(store.historyPath), { recursive: true });
  const temp = store.historyPath + "." + randomBytes(6).toString("hex") + ".tmp";
  await fs.writeFile(temp, JSON.stringify({ version: 1, entries: store.entries }, null, 2));
  await fs.rename(temp, store.historyPath);
}

export async function generateUniqueFemalePresenter({ job, cfg, workDir, fetchImage }) {
  const store = await getHistoryStore(cfg.output || path.dirname(workDir));
  const presenterPath = path.join(workDir, "presenter.jpg");

  for (let attempt = 0; attempt < 8; attempt++) {
    let profile = newFemalePresenterIdentity(job);
    while (store.seeds.has(profile.seed)) profile = newFemalePresenterIdentity(job);

    const generated = await fetchImage(profile.prompt, profile.seed, presenterPath, cfg, {
      width: 768,
      height: 1024,
      attempts: 3
    });
    if (!generated) continue;

    const imageHash = createHash("sha256").update(await fs.readFile(presenterPath)).digest("hex");
    if (store.hashes.has(imageHash)) {
      if (cfg.log) cfg.log("  presenter duplicate rejected; generating a different woman");
      continue;
    }

    store.entries.push({
      hash: imageHash,
      seed: profile.seed,
      identity: profile.identity,
      createdAt: new Date().toISOString()
    });
    store.hashes.add(imageHash);
    store.seeds.add(profile.seed);
    await saveHistory(store);
    return { file: presenterPath, ...profile };
  }

  return null;
}
