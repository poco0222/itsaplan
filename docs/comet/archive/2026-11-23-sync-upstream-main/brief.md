# Outcome

Merge upstream `croffasia/itsaplan` main at `cc396276` into the fork based on `ec5556ad`. Open a PR against `poco0222/itsaplan:main` and deploy the verified PR revision to the existing local Colima instance.

# Scope

Resolve the document creation, locale, and Drizzle migration conflicts. Preserve weekly report snapshots, delivery progress and handoff, nested tasks, and inline numeric editing. Preserve the upstream changes, including private document sharing, inherited access for private subpages, and the Docs home.

The local database has applied `0187_delivery_workflow`. Rehearse the upgrade on an isolated copy with that migration history and from an empty database. Confirm that the resulting schema and migration history support future migrations, that a second startup is safe, and that the existing project data survives the upgrade.

After Comet acceptance, push the verified integration branch and open the fork PR. Back up the local database before deployment, use the existing local upgrade procedure, and verify the running revision, migration result, service health, login endpoint, and Rolling Plan data.

## Directory structure

### Modified

- `apps/api/src/modules/documents/` — document creation and access behavior.
- `apps/web/messages/*/documents.json` — document and weekly report translations.
- `packages/db/drizzle/` — migration SQL, journal, and schema snapshots.
- `apps/api/`, `apps/web/`, and `packages/db/` — targeted regression checks for the integration.

# Non-goals

Production deployment, unrelated features, and merging the PR on GitHub are outside this delivery.

# Acceptance examples

- The candidate includes both Git histories. No conflict remains, and relevant type, lint, and format checks pass.
- Targeted tests cover private document sharing and inherited access, weekly report snapshots, delivery progress and handoff, nested task display, and inline numeric editing.
- Migrations complete on an empty PostgreSQL database and on an isolated copy of the local database that has applied the fork's `0187_delivery_workflow`. Both paths produce the expected schema, the upgrade preserves existing project data, and a second migration run has no pending work.
