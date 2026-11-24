# Outcome

Merge the nine upstream commits through `croffasia/itsaplan` main `50e69a2e` into a PR branch based on `poco0222/itsaplan` main `f20299e8`. Open the PR against the fork's `main` after verification and acceptance.

# Scope

Use a merge commit to preserve both parents and all upstream commits since `cc396276`. Resolve the five paths identified by the merge preview and address integration failures caused by combining the two branches. Keep upstream initiative search and fork delivery hierarchy, weighted progress, and table editing behavior. Complete Italian translations for fork-added keys where the locale check requires them.

Preserve the existing fork migration SQL, checksums and timestamps for `0196_delivery_workflow` and `0197_plan_delivery_hierarchy`. Append the upstream company showcase preference and repository issue sync migrations with unique entries and a consistent snapshot chain. Verify fresh installation and upgrade from the fork's applied migration history on isolated PostgreSQL databases. Verify that repeat migration does no work and existing delivery data survives the upgrade.

## Directory structure

### Modified

- `apps/api/src/modules/initiatives/` and `apps/web/src/lib/api/endpoints/initiatives.ts` for initiative search and delivery progress integration.
- `apps/web/messages/it/` for the Italian locale and fork-added keys.
- `packages/db/drizzle/` for the migration journal, SQL and snapshots.
- `apps/api/` and `apps/web/` for any additional integration corrections demonstrated by checks.

# Non-goals

GitHub merge into the fork's `main`, deployment, and changes to the running database are outside this delivery.

# Acceptance examples

- The candidate preserves fork `f20299e8` and upstream `50e69a2e` as merge parents, includes all nine upstream commits, and has no unresolved conflicts or whitespace errors.
- Workspace type, lint and format checks pass. Targeted tests cover initiative search and delivery behavior, repository issue sync and Webhook handling, and relevant Web regressions. The Italian locale contains the fork's translated keys.
- A fresh isolated database and an isolated database at the current fork migration baseline reach the same schema, retain existing delivery data, and complete a second migration run with no pending work. Drizzle schema generation reports no drift.
