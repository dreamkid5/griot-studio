// Scene matching. Turns each stretch of narration into a concrete VISUAL image
// prompt, so the picture matches what is being said rather than the literal
// words. Claude reads the narration in batches, keeps the main characters
// consistent using the character bible, and returns one image prompt per scene.
// Needs ANTHROPIC_API_KEY. Returns null to fall back to plain per-scene prompts.

function extractJSON(text) {
  if (!text) return null;
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch (x) { return null; }
}

async function ask(cfg, prompt, maxTokens) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": cfg.anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: cfg.seoModel, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] })
      });
      if (r.status === 429 || r.status === 529) { await new Promise((s) => setTimeout(s, 4000 * (a + 1))); continue; }
      if (!r.ok) return null;
      const j = await r.json();
      return j && j.content && j.content[0] && j.content[0].text;
    } catch (e) { await new Promise((s) => setTimeout(s, 2500 * (a + 1))); }
  }
  return null;
}

export async function buildSceneVisuals(scenes, bible, cfg) {
  if (!cfg.anthropicKey || !scenes.length) return null;
  const chars = (bible && bible.characters) || [];
  const charBlock = chars.length
    ? ("Main recurring characters, draw each one consistently every time they appear:\n" +
        chars.map((c) => "- " + c.name + ": " + c.description).join("\n") + "\n\n")
    : "";

  const BATCH = 12;
  const out = new Array(scenes.length).fill(null);

  for (let start = 0; start < scenes.length; start += BATCH) {
    const batch = scenes.slice(start, start + BATCH);
    const numbered = batch.map((s, k) => (start + k + 1) + ". " + s).join("\n");
    const prompt =
      "You are the visual director for a narrated video essay on philosophy, power, strategy and human psychology, in the spirit of Machiavelli and the Stoic thinkers. Every scene is illustrated as a vintage 1800s pen-and-ink engraving with dramatic, cinematic, moody lighting and Renaissance or classical antiquity settings.\n\n" +
      charBlock +
      "Below are numbered narration segments. For EACH number, write ONE concrete visual image prompt describing what an illustrator should draw for that exact moment: a clear main subject, the setting, the action, and the mood, all matching the meaning of the narration. Rules:\n" +
      "- Translate the meaning into a picture. Do NOT just repeat the narration words.\n" +
      "- BE LITERAL AND ON-THE-NOSE. Draw the actual thing the line describes, not a generic scene of robed men. If the line mentions a specific object, animal, place or action, that exact thing MUST be the clear main subject of the image.\n" +
      "- Metaphors and similes must be shown LITERALLY as their concrete image. Examples: 'a lion and a fox' -> draw an actual lion beside an actual fox; 'fortune is a violent river that floods' -> draw a raging, overflowing river sweeping away a village; 'chains of obligation' -> draw literal iron chains; 'fortune is a woman' -> draw a regal woman as the figure of Fortune; 'the lion and the wolves' -> draw a lion facing wolves; 'a puppet' -> draw a puppet on strings; 'a crumbling statue' -> draw a cracked, toppling statue. Never replace a stated image with a vague council of figures.\n" +
      "- Do NOT default to 'a group of bearded robed men standing together'. Vary the subject every scene to match its specific line — a single figure, an object, an animal, a landscape, an action.\n" +
      "- Setting & subjects: keep everything in a timeless historical/classical world — philosophers, kings, generals, soldiers, palaces, courts, studies, battlefields, statues, chessboards, masks, scales, mirrors, candlelit chambers, landscapes — but always choose the one that literally fits THIS line.\n" +
      "- Framing: vary the shot for a cinematic feel — sweeping wide establishing scenes, medium two-person compositions of tension, and striking close-ups of a face, hand or object for dramatic emphasis.\n" +
      "- Lighting & mood: dramatic and moody chiaroscuro, deep shadows and pools of warm candle or torch light, serious and atmospheric. Keep the main subject readable within the scene.\n" +
      "- When a main character appears, describe them using their fixed look above.\n" +
      "- For purely abstract or transitional lines with no concrete image of their own, pick a strong single symbolic object (a chess piece, a puppet on strings, a crumbling statue, a coiled serpent, a mask, a lone throne, an hourglass) shown clearly on its own — still literal, not a crowd of figures.\n" +
      "- Never put on-screen text, captions, letters, or numbers in the image.\n" +
      "- Keep each prompt vivid but under about 40 words.\n\n" +
      "Return ONLY JSON covering every number in this batch, in this shape:\n" +
      '{"prompts":[{"n":<number>,"prompt":"..."}]}\n\n' +
      "Segments:\n" + numbered;

    const text = await ask(cfg, prompt, 2200);
    const data = extractJSON(text);
    if (data && Array.isArray(data.prompts)) {
      for (const p of data.prompts) {
        const idx = Number(p.n) - 1;
        if (idx >= 0 && idx < scenes.length && p && p.prompt) out[idx] = String(p.prompt).trim();
      }
    }
  }

  return out.some(Boolean) ? out : null;
}
