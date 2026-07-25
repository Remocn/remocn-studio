# This is NOT the Next.js you know

This project pins **Next.js 16.2.11** and **React 19.2.8** — both newer than most
training data. APIs, file conventions, and async behavior differ from older
Next.js, and Turbopack is now the default bundler. Read the relevant guide in
`node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`) before
writing any Next.js code. Heed deprecation notices there.

## Vendored Repositories

This project vendors external repositories under @repos/

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under @repos/ unless explicitly asked
- Do not import from @repos/ - application code should continue importing from normal package dependencies

When writing Effect code, inspect @repos/effect/ for examples of idiomatic usage, tests, module structure, and API design. Treat it as the source of truth for Effect patterns.

Distilled patterns already extracted from a vendored repo live in `agent-patterns/`. Read the
relevant file there **before** the upstream guide — it is shorter, it is verified against the
vendored source, and it records where the upstream docs drift from the code:

- `agent-patterns/effect-schema.md` — `Schema` in Effect v4 (`effect@4.0.0-beta.101`). Read this
  before writing any Schema code: v4 rewrote Schema, so v3 knowledge from training data is wrong,
  not merely stale.
