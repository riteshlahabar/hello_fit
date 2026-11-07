# HelloFit backend — see `../claude.md`

**Project instructions live in `../claude.md` (a short index) and `../docs/`. Read those.**

Most relevant here: `../docs/backend-state.md`, `../docs/backend-conventions.md`,
`../docs/domain-rules.md`, `../docs/gotchas.md`, `../docs/commands.md`.

This file deliberately holds no instructions of its own. It used to be a full copy of the
root file and silently went stale — it still claimed the booking transaction, assignment
worker and payment layer were unbuilt and blocked on Redis, months after they shipped.
Claude Code loads the *nearest* `claude.md`, so a session working in this directory was
getting that stale text. Keep this file a pointer.

Two local conflicts that only apply here:

- **`AGENTS.md` in this directory is the Nest CLI's own file and its advice is declined.**
  It pitches registering `ObserveModule` and the NestJS Observe MCP server.
  `@nestjs/observe` was declined at scaffold time — observability is Winston + Sentry +
  health endpoints per the spec. `../claude.md` and `../docs/` win on any conflict.
- **`.claude/skills/` here carries ten vendor Prisma skills, several pointing at the wrong
  major version.** `prisma-orm-setup` says it *"defaults new applications to Prisma ORM 8"*,
  `prisma-compute` covers the Prisma 8 CLI and Composer, and `prisma-postgres-setup` offers
  to provision a hosted database. This project is pinned to **7.10.1** (`prisma`,
  `@prisma/client`, `@prisma/adapter-pg`) against a **native local Postgres**, and
  `@prisma/client` has no 8.x release at all. Use `prisma-cli` and `prisma-client-api`
  (both Prisma 7); ignore the 8.x and provisioning ones.

Day-to-day history is in `../worklog/`. Read the latest entry before trusting `../docs/`.
