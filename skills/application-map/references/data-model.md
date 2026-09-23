# AppMap project contract (version 1)

`appmap.json` is the editable source of truth. The portable `appmap.html` embeds the same JSON in `<script id="appmap-data" type="application/json">`; it is a self-contained, read-only viewer and can be edited by an external coding agent by changing only that JSON section. `appmap.md` is a generated, human-readable companion. Run the bundled validator after any edit, and regenerate outputs after JSON changes. Never use a rendered diagram as the only source of project data.

Use the supplied `assets/example-map.json` as a complete shape example. All top-level arrays must exist, even when empty:

| Key | Meaning |
|---|---|
| `format`, `schemaVersion` | Exactly `codex-application-map`, `1` |
| `project` | Stable `id`, `title`, `description`, UTC timestamps, and `scope` (`application`, `module`, or `page`; label, boundary, exclusions, roles) |
| `definitionMode` | `discovery`, `manual`, or `mixed` |
| `modules` | Optional organizational areas; stable ID, name, description, basis, review, notes |
| `pages` | Conceptual pages: module ID or null, name, URL or null, purpose, description, behaviors, roles, tags, notes, evidence IDs, basis, review |
| `states` | Named state of a parent page: `pageId`, URL or null, trigger, description, notes, evidence IDs, basis, review |
| `relationships` | Directed user-flow edge: source and destination page/state IDs, interaction, optional source annotation ID, notes, evidence IDs, basis, review |
| `screenshots` | Optional local relative path or portable data URL, target page/state ID, capture time, browser title, viewport, URL, notes. Never store secrets or raw form values. |
| `annotations` | Stable screenshot-linked visual notes: screenshot ID, type (`rectangle`, `circle`, `arrow`, `numbered-marker`, `text-note`), normalized 0–1 geometry, name, description, behavior, optional destination ID, technical notes, tags, basis, review |
| `technicalEntities` | Reusable file, component, controller, service, endpoint, table, view, procedure, function, query, job, external service, or other dependency; stable ID, kind, name, identifier, description, notes, evidence IDs, basis, review |
| `technicalRelationships` | Directed dependency between a page/state/technical entity and a technical entity: source ID, target ID, type, description, confidence, notes, evidence IDs, basis, review |
| `evidence` | Observation or source-code provenance: stable ID, kind, location, description, captured time, optional line range, optional local screenshot reference |
| `coverage` | `visited`, `unvisited`, `excluded`, and `blocked` arrays of `{idOrLabel, reason}`. These are explicit claims about the agreed scope, not a guess at completeness. |
| `openQuestions` | Stable ID, question, related IDs, and status (`open` or `resolved`) |

`basis` and `review` are separate axes. `basis` is `observed`, `user-defined`, or `inferred`; `review` is `proposed` or `confirmed`. A browser-observed item can remain unconfirmed by the user. A manually supplied item is user-defined and may be confirmed immediately if the user explicitly named it. `inferred` never means observed. Keep a rejected candidate in `coverage.excluded` or an open decision note rather than silently losing the history.

IDs are opaque, unique, and stable across renames, exports, merges, and agent enrichment. Use UUIDs or short random IDs with a type prefix. Never derive identity solely from URL, route, title, or array index. Same-URL states may be distinct; a URL change need not mean a new page. Relationships may be many-to-many, parallel, cyclic, or self-referential. Every referenced ID must exist. Do not merge entities just because names or URLs match. Reuse one technical entity across all pages that depend on it.

Evidence rules:

- `observed` browser claims cite a browser observation or screenshot showing the relevant page/interaction; a link not followed is not proof of its destination.
- Source-code claims cite exact relative repository path and line range where possible. Directly supported relationships may be `observed`; reasoned but unverified links must be `inferred` with confidence and an open question.
- User-provided architecture may be `user-defined` without code evidence. Never upgrade it to observed merely because it is plausible.
- Keep sensitive URLs and data out of generated artifacts. Redact tokens/query values and ask before retaining sensitive paths, screenshots, or account-specific information. Store screenshot files only in the agreed output directory; HTML embeds them only when the user requests a portable file and the data is appropriate to share.

The bundled script validates required fields, identity/reference integrity, geometry, and local asset paths. It does not establish factual accuracy. Review claims against browser or source evidence. Preserve unknown fields when editing an existing project, but do not silently change its schema version.
