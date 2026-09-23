# Local output, portable handoff, and resumption

Keep one `appmap.json` in the agreed project directory. Use `assets/example-map.json` as a shape example, not as a default project to overwrite. All map files are local by default. The CLI in `scripts/appmap.mjs` has no npm dependencies:

```text
node <skill>/scripts/appmap.mjs validate <project>/appmap.json
node <skill>/scripts/appmap.mjs render <project>/appmap.json <project>
node <skill>/scripts/appmap.mjs validate <project>/appmap.html
node <skill>/scripts/appmap.mjs extract <edited-map.html> <new-json-path>
```

`render` generates `appmap.md` and `appmap.html`. The Markdown has module flow diagrams and detailed lists; large diagrams are abbreviated but the JSON and HTML retain all entities. HTML is a read-only, offline explorer with search, module filter, user/technical layers, details, evidence IDs, screenshot overlays, pan, zoom, and keyboard-accessible lists. The HTML embeds JSON in `#appmap-data`; an external coding agent can modify that data section, validate the HTML, and `extract` it to a new JSON file. Extraction refuses to overwrite an existing file. Regenerate from JSON after further edits. Never manually edit the generated UI runtime.

Screenshots are optional. In JSON, a screenshot `src` may be a relative PNG/JPEG/WebP path beneath the project directory or a matching image data URL. Rendering embeds local image bytes into the HTML, making it portable; that also makes any sensitive screenshot shareable with the file. Confirm that the user wants those images included before rendering or sharing a map with screenshots. Do not transmit artifacts to third parties without authorization. No external fonts, libraries, tiles, analytics, or API calls are used by the viewer.

Before each browser batch, read the existing JSON and the coverage queue. Preserve IDs, human wording, confirmations, and unknown fields. Add new evidence rather than silently changing the basis of an earlier claim. Update `project.updatedAt`, validate, render, and record what was explored. If an action fails, keep the last valid JSON; do not overwrite it with a partial document. If the next task has no writable directory, present a concise map in chat and ask where to save it rather than writing elsewhere.

Before declaring the agreed scope complete, verify: no dangling IDs; every observed claim has evidence; all proposed items are either reviewed or explicitly left proposed; blocked and unvisited areas are listed; Markdown and HTML reflect the same JSON; the HTML opens locally without network; and any technical claim cited to source is supported by the referenced file/line. Schema validation is necessary but not sufficient for factual accuracy.
