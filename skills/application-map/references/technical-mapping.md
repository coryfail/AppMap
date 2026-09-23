# Optional source-code and architecture enrichment

Use this only when the user supplies an application repository or explicitly asks for technical mapping. It does not authorize changing the target repository. Start read-only and locate likely page routes, components, controllers, service calls, APIs, database queries, jobs, and external dependencies using the repository's search and code navigation tools. Match to documented pages through routes, component imports, calls, or data-flow evidence—not name similarity alone.

Create one reusable `technicalEntities` record per real dependency, with a stable ID. Model links in `technicalRelationships`, never duplicate a database table or service name inside every page. A useful chain is page/state → UI component → endpoint → service → query/procedure → table. Record only the links actually supported by code. Other plausible links stay inferred with confidence and an open question.

For direct source evidence, use repository-relative path and one-based line range in `evidence`, plus a short description of the relationship supported. If the code calls a procedure but its implementation is absent, the call is observed while the procedure's downstream tables are unknown. Generated, stale, or environment-specific code may need a note. A live browser observation can support UI behavior, but it cannot by itself establish source files or database dependencies.

Preserve all existing page IDs, screenshots, annotations, user descriptions, and manually defined navigation. Do not rewrite human observations to fit code assumptions. Validate after enrichment and regenerate the portable outputs. Report confirmed source-backed links, inferred links, files/areas not inspected, and anything blocked by missing source or credentials.
