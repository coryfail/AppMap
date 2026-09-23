import assert from "node:assert/strict";
import test from "node:test";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { validateMap, render, extractHtml } from "./appmap.mjs";

const skillDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const samplePath = resolve(skillDir, "assets/example-map.json");
const sample = JSON.parse(await readFile(samplePath, "utf8"));

test("sample validates and keeps same-URL page/state identities", () => {
  assert.deepEqual(validateMap(sample), []);
  assert.notEqual(sample.pages[0].id, sample.states[0].id);
  assert.equal(sample.pages[0].url, sample.states[0].url);
});

test("rejects duplicate and dangling references", () => {
  const map = structuredClone(sample);
  map.states[0].id = map.pages[0].id;
  map.relationships[0].destinationId = "missing";
  const errors = validateMap(map).join("\n");
  assert.match(errors, /duplicate/);
  assert.match(errors, /destinationId/);
});

test("observed claims require evidence and annotations must stay normalized", () => {
  const map = structuredClone(sample);
  map.pages[0].evidenceIds = [];
  map.screenshots.push({ id: "shot-1", targetId: map.pages[0].id, src: "image.png" });
  map.annotations.push({ id: "note-1", screenshotId: "shot-1", destinationId: null, type: "rectangle", geometry: { x: .8, y: .8, width: .5, height: .5 }, evidenceIds: [], basis: "user-defined", review: "confirmed" });
  const errors = validateMap(map).join("\n");
  assert.match(errors, /observed claim needs evidence/);
  assert.match(errors, /normalized rectangle/);
});

test("rejects unsafe screenshot sources", () => {
  for (const src of ["../secret.png", "/private/secret.png", "https://example.com/image.png", "data:image/svg+xml;base64,PHN2Zz4="]) {
    const map = structuredClone(sample);
    map.screenshots.push({ id: "shot-1", targetId: map.pages[0].id, src });
    assert.match(validateMap(map).join("\n"), /screenshots\[0\]\.src/);
  }
});

test("portable HTML contains editable structured data and inert hostile text", async () => {
  const map = structuredClone(sample);
  map.project.title = '</script><script>alert("x")</script>';
  const result = await render(map, resolve(skillDir, "assets"));
  assert.deepEqual(extractHtml(result.html), map);
  assert.match(result.html, /\\u003c\/script/);
  assert.doesNotMatch(result.html, /<script>alert\("x"\)<\/script>/);
  assert.doesNotMatch(result.html, /(?:src|href)=["']https?:\/\//);
  assert.match(result.markdown, /flowchart LR/);
});

test("portable HTML embeds a project-local screenshot", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "appmap-image-test-"));
  try {
    await writeFile(resolve(directory, "screen.png"), Buffer.from("iVBORw0KGgo=", "base64"));
    const map = structuredClone(sample);
    map.screenshots.push({ id: "shot-1", targetId: map.pages[0].id, src: "screen.png" });
    const result = await render(map, directory);
    const extracted = extractHtml(result.html);
    assert.match(extracted.screenshots[0].src, /^data:image\/png;base64,/);
    assert.equal(map.screenshots[0].src, "screen.png");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
