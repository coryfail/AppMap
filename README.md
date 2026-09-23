# Application Map

A personal Codex skill for documenting and reverse-engineering existing web
applications. It maps a whole application, a named module, or a specific page;
the page inventory can be AI-discovered, user-defined, or mixed.

The skill uses Codex browser access to propose pages and states, record
observed interactions, and maintain evidence and coverage. With a supplied
source repository it can also map reusable code, API, service, and database
dependencies. It saves a versioned `appmap.json` plus a readable Markdown
report and self-contained offline HTML explorer. No custom Chrome extension,
backend, hosted service, or third-party API is required.

The [skill instructions](skills/application-map/SKILL.md) and supporting files
are the source copy.

To install it into your personal Codex skills directory from the published
GitHub repository (requires Node.js and npm):

```sh
npx skills add https://github.com/coryfail/AppMap --skill application-map --agent codex -g
```

A useful starting request is:

> Use $application-map to map the User Management module at [URL]. Define
> pages by discovery, but keep them proposed until I review them. Save the
> project locally.

For an existing Chrome login session, mention the connected Chrome tab. The
desktop app's built-in browser has a separate profile and may require sign-in.
The skill follows normal browser permission and confirmation controls.

The local generator needs Node.js at generation time, but the resulting HTML
file opens without Node, a server, the extension, or internet access.

```text
node skills/application-map/scripts/appmap.mjs validate path/to/appmap.json
node skills/application-map/scripts/appmap.mjs render path/to/appmap.json path/to/output
node --test skills/application-map/scripts/appmap.test.mjs
```
