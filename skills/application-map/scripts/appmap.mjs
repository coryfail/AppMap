#!/usr/bin/env node
import { readFile, writeFile, mkdir, realpath, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arrays = ["modules", "pages", "states", "relationships", "screenshots", "annotations", "technicalEntities", "technicalRelationships", "evidence", "openQuestions"];
const basis = new Set(["observed", "user-defined", "inferred"]);
const review = new Set(["proposed", "confirmed"]);
const kinds = new Set(["source-file", "ui-component", "controller", "service", "api-endpoint", "database-table", "database-view", "stored-procedure", "database-function", "query", "background-job", "external-service", "other"]);
const annotationTypes = new Set(["rectangle", "circle", "arrow", "numbered-marker", "text-note"]);
const imageTypes = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = (value) => value && typeof value === "object" && !Array.isArray(value);
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

export function validateMap(map) {
  const errors = [];
  const fail = (path, message) => errors.push(`${path}: ${message}`);
  if (!record(map)) return ["root: expected an object"];
  if (map.format !== "codex-application-map") fail("format", "unsupported format");
  if (map.schemaVersion !== 1) fail("schemaVersion", "unsupported version");
  if (!record(map.project)) fail("project", "expected object");
  else {
    for (const key of ["id", "title", "createdAt", "updatedAt"]) if (!nonempty(map.project[key])) fail(`project.${key}`, "required string");
    if (!record(map.project.scope)) fail("project.scope", "expected object");
    else {
      if (!["application", "module", "page"].includes(map.project.scope.kind)) fail("project.scope.kind", "invalid scope");
      if (!nonempty(map.project.scope.label)) fail("project.scope.label", "required string");
      if (!nonempty(map.project.scope.boundary)) fail("project.scope.boundary", "required string");
    }
  }
  if (!["discovery", "manual", "mixed"].includes(map.definitionMode)) fail("definitionMode", "invalid mode");
  for (const key of arrays) if (!Array.isArray(map[key])) fail(key, "expected array");
  if (!record(map.coverage)) fail("coverage", "expected object");
  else for (const key of ["visited", "unvisited", "excluded", "blocked"]) if (!Array.isArray(map.coverage[key])) fail(`coverage.${key}`, "expected array");
  if (errors.length) return errors;

  const ids = new Map();
  for (const key of arrays) for (const [index, item] of map[key].entries()) {
    const path = `${key}[${index}]`;
    if (!record(item)) { fail(path, "expected object"); continue; }
    if (!nonempty(item.id)) { fail(`${path}.id`, "required stable ID"); continue; }
    if (ids.has(item.id)) fail(`${path}.id`, `duplicate of ${ids.get(item.id)}`);
    else ids.set(item.id, key);
    if (["modules", "pages", "states", "relationships", "annotations", "technicalEntities", "technicalRelationships"].includes(key)) {
      if (!basis.has(item.basis)) fail(`${path}.basis`, "invalid basis");
      if (!review.has(item.review)) fail(`${path}.review`, "invalid review");
    }
  }
  const type = (id, allowed, path, nullable = false) => {
    if (nullable && id === null) return;
    if (!nonempty(id) || !allowed.includes(ids.get(id))) fail(path, `expected existing ${allowed.join("/")} ID`);
  };
  const evidence = (item, path) => {
    if (!Array.isArray(item.evidenceIds)) { fail(`${path}.evidenceIds`, "expected array"); return; }
    for (const [index, id] of item.evidenceIds.entries()) type(id, ["evidence"], `${path}.evidenceIds[${index}]`);
    if (item.basis === "observed" && item.evidenceIds.length === 0) fail(`${path}.evidenceIds`, "observed claim needs evidence");
  };
  for (const [index, item] of map.modules.entries()) if (record(item) && !nonempty(item.name)) fail(`modules[${index}].name`, "required string");
  for (const [index, item] of map.pages.entries()) if (record(item)) {
    const path = `pages[${index}]`;
    if (!nonempty(item.name)) fail(`${path}.name`, "required string");
    type(item.moduleId, ["modules"], `${path}.moduleId`, true);
    evidence(item, path);
  }
  for (const [index, item] of map.states.entries()) if (record(item)) {
    const path = `states[${index}]`;
    if (!nonempty(item.name)) fail(`${path}.name`, "required string");
    type(item.pageId, ["pages"], `${path}.pageId`);
    evidence(item, path);
  }
  for (const [index, item] of map.relationships.entries()) if (record(item)) {
    const path = `relationships[${index}]`;
    type(item.sourceId, ["pages", "states"], `${path}.sourceId`);
    type(item.destinationId, ["pages", "states"], `${path}.destinationId`);
    type(item.annotationId, ["annotations"], `${path}.annotationId`, true);
    if (!nonempty(item.interaction)) fail(`${path}.interaction`, "required string");
    evidence(item, path);
  }
  for (const [index, item] of map.screenshots.entries()) if (record(item)) {
    const path = `screenshots[${index}]`;
    type(item.targetId, ["pages", "states"], `${path}.targetId`);
    if (!nonempty(item.src) || !validImageSource(item.src)) fail(`${path}.src`, "expected local PNG/JPEG/WebP path or image data URL");
  }
  for (const [index, item] of map.annotations.entries()) if (record(item)) {
    const path = `annotations[${index}]`;
    type(item.screenshotId, ["screenshots"], `${path}.screenshotId`);
    type(item.destinationId, ["pages", "states"], `${path}.destinationId`, true);
    if (!annotationTypes.has(item.type)) fail(`${path}.type`, "invalid type");
    if (!record(item.geometry) || ["x", "y", "width", "height"].some((key) => typeof item.geometry[key] !== "number" || item.geometry[key] < 0 || item.geometry[key] > 1)
      || item.geometry.x + item.geometry.width > 1.000001 || item.geometry.y + item.geometry.height > 1.000001) fail(`${path}.geometry`, "expected normalized rectangle within 0–1");
    evidence(item, path);
  }
  for (const [index, item] of map.technicalEntities.entries()) if (record(item)) {
    const path = `technicalEntities[${index}]`;
    if (!kinds.has(item.kind)) fail(`${path}.kind`, "invalid technical kind");
    if (!nonempty(item.name)) fail(`${path}.name`, "required string");
    evidence(item, path);
  }
  for (const [index, item] of map.technicalRelationships.entries()) if (record(item)) {
    const path = `technicalRelationships[${index}]`;
    type(item.sourceId, ["pages", "states", "technicalEntities"], `${path}.sourceId`);
    type(item.targetId, ["technicalEntities"], `${path}.targetId`);
    if (!nonempty(item.type)) fail(`${path}.type`, "required string");
    if (item.confidence !== null && (typeof item.confidence !== "number" || item.confidence < 0 || item.confidence > 1)) fail(`${path}.confidence`, "expected 0–1 or null");
    evidence(item, path);
  }
  for (const [index, item] of map.evidence.entries()) if (record(item)) {
    const path = `evidence[${index}]`;
    if (!nonempty(item.kind) || !nonempty(item.location) || !nonempty(item.description)) fail(path, "kind, location, and description are required");
    if (item.lineStart !== null && item.lineStart !== undefined && (!Number.isSafeInteger(item.lineStart) || item.lineStart < 1)) fail(`${path}.lineStart`, "invalid line");
    if (item.lineEnd !== null && item.lineEnd !== undefined && (!Number.isSafeInteger(item.lineEnd) || item.lineEnd < (item.lineStart ?? 1))) fail(`${path}.lineEnd`, "invalid line");
  }
  for (const [index, item] of map.openQuestions.entries()) if (record(item)) {
    const path = `openQuestions[${index}]`;
    if (!nonempty(item.question) || !["open", "resolved"].includes(item.status)) fail(path, "question and status are required");
    if (!Array.isArray(item.relatedIds)) fail(`${path}.relatedIds`, "expected array");
    else for (const [i, id] of item.relatedIds.entries()) if (!ids.has(id)) fail(`${path}.relatedIds[${i}]`, "unknown ID");
  }
  for (const key of ["visited", "unvisited", "excluded", "blocked"]) for (const [index, item] of map.coverage[key].entries())
    if (!record(item) || !nonempty(item.idOrLabel) || !nonempty(item.reason)) fail(`coverage.${key}[${index}]`, "idOrLabel and reason are required");
  return errors;
}

function validImageSource(src) {
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(src)) return true;
  if (src.startsWith("/") || src.includes("\\") || src.split("/").includes("..") || /^(?:[a-z]+:|\/\/)/i.test(src)) return false;
  return own(imageTypes, extname(src).toLowerCase());
}

export function extractHtml(html) {
  const match = html.match(/<script\s+id="appmap-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match) throw new Error("Embedded appmap-data section not found");
  return JSON.parse(match[1]);
}

export function markdown(map) {
  const byId = new Map([...map.modules, ...map.pages, ...map.states, ...map.technicalEntities].map((item) => [item.id, item]));
  const lines = [`# ${map.project.title}`, "", `Scope: **${map.project.scope.kind}** — ${map.project.scope.label} (${map.project.scope.boundary})`, `Page definition: **${map.definitionMode}**`, "", map.project.description || "", "", "## User flow", ""];
  const groups = map.modules.length ? map.modules : [{ id: null, name: "Application" }];
  for (const group of groups) {
    const pages = map.pages.filter((page) => page.moduleId === group.id || (!group.id && !page.moduleId));
    const nodes = [...pages, ...map.states.filter((state) => pages.some((page) => page.id === state.pageId))];
    const nodeIds = new Set(nodes.map((item) => item.id));
    const edges = map.relationships.filter((edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.destinationId));
    lines.push(`### ${group.name}`, "", "```mermaid", "flowchart LR");
    const shown = nodes.slice(0, 100), shownIds = new Set(shown.map((item) => item.id));
    const keys = new Map(shown.map((item, index) => [item.id, `n${index}`]));
    for (const item of shown) lines.push(`  ${keys.get(item.id)}["${mermaid(item.name)}"]`);
    for (const edge of edges.filter((item) => shownIds.has(item.sourceId) && shownIds.has(item.destinationId)).slice(0, 200))
      lines.push(`  ${keys.get(edge.sourceId)} -->|"${mermaid(edge.interaction)}"| ${keys.get(edge.destinationId)}`);
    lines.push("```", "");
    if (nodes.length > shown.length || edges.length > 200) lines.push(`Diagram shortened: ${nodes.length} nodes and ${edges.length} relationships are retained in the structured data.`, "");
  }
  if (!groups.some((group) => group.id === null) && map.pages.some((page) => !page.moduleId)) {
    const ungrouped = map.pages.filter((page) => !page.moduleId);
    lines.push("### Ungrouped pages", "", ...ungrouped.map((item) => `- ${item.name} — ID: \`${item.id}\``), "");
  }
  lines.push("## Pages and states", "");
  for (const page of map.pages) {
    lines.push(`### ${page.name}`, "", `ID: \`${page.id}\` · ${page.basis}, ${page.review}`, `URL: ${page.url ?? "Not recorded"}`, `Purpose: ${page.purpose || "Not documented"}`, `Description: ${page.description || "Not documented"}`, "");
    for (const state of map.states.filter((item) => item.pageId === page.id)) lines.push(`- State: **${state.name}** (\`${state.id}\`, ${state.basis}/${state.review}) — ${state.description || "No description"}`);
    lines.push("");
  }
  lines.push("## Navigation", "");
  for (const edge of map.relationships) lines.push(`- **${byId.get(edge.sourceId)?.name ?? edge.sourceId}** → **${byId.get(edge.destinationId)?.name ?? edge.destinationId}** via ${edge.interaction} (\`${edge.id}\`, ${edge.basis}/${edge.review})`);
  lines.push("", "## Technical architecture", "");
  for (const edge of map.technicalRelationships) lines.push(`- **${byId.get(edge.sourceId)?.name ?? edge.sourceId}** → **${byId.get(edge.targetId)?.name ?? edge.targetId}** (${edge.type}, ${edge.basis}/${edge.review}; evidence: ${edge.evidenceIds.join(", ") || "none"})`);
  if (!map.technicalRelationships.length) lines.push("No technical relationships documented.");
  lines.push("", "## Coverage", "");
  for (const key of ["visited", "unvisited", "excluded", "blocked"]) lines.push(`- ${key}: ${map.coverage[key].length}`, ...map.coverage[key].map((item) => `  - ${item.idOrLabel}: ${item.reason}`));
  lines.push("", "## Open questions", "");
  for (const item of map.openQuestions.filter((question) => question.status === "open")) lines.push(`- ${item.question} (\`${item.id}\`)`);
  if (!map.openQuestions.some((item) => item.status === "open")) lines.push("None recorded.");
  lines.push("", "## Evidence", "");
  for (const item of map.evidence) lines.push(`- \`${item.id}\` ${item.kind}: ${item.description} — ${item.location}${item.lineStart ? `:${item.lineStart}${item.lineEnd ? `–${item.lineEnd}` : ""}` : ""}`);
  return lines.join("\n") + "\n";
}

function mermaid(value) { return String(value).replaceAll("\\", "\\\\").replaceAll('"', "'").replaceAll("|", "/").replaceAll("\n", " ").slice(0, 80); }
function encoded(map) { return JSON.stringify(map).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029"); }

async function portableMap(map, inputDir) {
  const copy = structuredClone(map);
  const root = await realpath(inputDir);
  for (const shot of copy.screenshots) if (!shot.src.startsWith("data:")) {
    const path = resolve(inputDir, shot.src);
    if (!path.startsWith(resolve(inputDir) + "/") || !existsSync(path)) throw new Error(`Missing or unsafe screenshot: ${shot.src}`);
    const actual = await realpath(path);
    if (!actual.startsWith(root + "/") || !(await stat(actual)).isFile()) throw new Error(`Unsafe screenshot path: ${shot.src}`);
    const mime = imageTypes[extname(path).toLowerCase()];
    shot.src = `data:${mime};base64,${(await readFile(actual)).toString("base64")}`;
  }
  return copy;
}

export async function render(map, inputDir) {
  const errors = validateMap(map); if (errors.length) throw new Error(errors.join("\n"));
  const template = await readFile(join(skillDir, "assets", "viewer.html"), "utf8");
  const portable = await portableMap(map, inputDir);
  return { html: template.replace("__APPMAP_JSON__", encoded(portable)), markdown: markdown(map) };
}

async function main() {
  const [command, input, output] = process.argv.slice(2);
  if (!["validate", "render", "extract"].includes(command) || !input || (command !== "validate" && !output)) {
    process.stderr.write("Usage: node appmap.mjs validate <map.json|map.html> | render <map.json> <output-directory> | extract <map.html> <output.json>\n"); process.exitCode = 2; return;
  }
  try {
    const source = await readFile(input, "utf8");
    const map = extname(input).toLowerCase() === ".html" ? extractHtml(source) : JSON.parse(source);
    const errors = validateMap(map);
    if (errors.length) throw new Error(errors.join("\n"));
    if (command === "validate") { process.stdout.write(`Valid map: ${map.pages.length} pages, ${map.states.length} states, ${map.relationships.length} navigation edges\n`); return; }
    if (command === "extract") { await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(output, JSON.stringify(map, null, 2) + "\n", { flag: "wx" }); process.stdout.write(`Extracted ${output}\n`); return; }
    if (extname(input).toLowerCase() !== ".json") throw new Error("Render requires JSON input");
    const result = await render(map, dirname(resolve(input)));
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "appmap.md"), result.markdown);
    await writeFile(join(output, "appmap.html"), result.html);
    process.stdout.write(`Rendered ${join(output, "appmap.md")} and ${join(output, "appmap.html")}\n`);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
