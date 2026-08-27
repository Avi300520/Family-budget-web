# Handoff - separate accounts frontend

## What is ready

The frontend uses a local mock in `apps/web/src/lib/sepacctMock.ts`; it must be replaced with the
eight-route contract in `API_CONTRACT_FOR_CLAUDE_CODE.md`. Do not hand-edit `packages/shared-types`
or `packages/api-client`; add the client methods in the source repository and run the sync process.

## Backend work required

1. Implement routes 1-8 from the contract and the three requested store projections/writes R1-R3.
2. Decide and implement R4 before claiming onboarding persists an exact first ratio. The current
   onboarding step records the declaration, and settings records the named ratio once two adults
   exist.
3. Preserve all viewer narrowing, limited-member exclusions, freeze checks, and exact agorot
   allocation already implemented by the store.
4. Replace the frontend mock with `@shopping-assistant/api-client` methods only after the paired
   backend commit exists.

## Migration intent

No new migration is required for the routes as designed. Existing schema support is in backend
migrations `0049_sepacct_purchase_splits.sql`, `0050_sepacct_watermark_comment.sql`,
`0051_sepacct_money_boundary_clock_defaults.sql`, and `0052_sepacct_member_income.sql`.

If an unapplied environment lacks these objects, apply the existing migrations in numeric order.
Their intent is: create split rows with `share_bp`, previous share, dispute timestamp and freeze
support; then create `member_income(household_id, user_id, monthly_agorot, updated_at)` with a
composite key. Do not invent a migration number. R1-R3 should be code/query projections over
existing tables and JSONB, not new schema.

## Deploy order

1. Apply the existing migrations where absent and verify runtime grants.
2. Deploy the backend store methods and HTTP routes with flags still off.
3. Add API-client methods in the source repository, then run `pnpm sync:shared` from the backend
   workflow so the frontend receives the synced `packages/shared-types` and `packages/api-client`.
4. Replace `sepacctMock` imports in the frontend, deploy frontend, and run route-level privacy and
   money tests.
5. Arm the relevant backend flags only after the endpoints, route auth, migrations, and frontend
   are live.

## Paired commit

A paired backend commit is required. This frontend intentionally has no HTTP integration because
the specified routes do not yet exist. The frontend also needs a follow-up commit that removes the
mock after synced API-client methods land.
