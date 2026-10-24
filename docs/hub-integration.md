# Hub data integration

Hub remains the source for authentication, athlete identity, the calendar and original measurements. Performance reads this data; it does not insert copies of Hub sessions, food diaries, clinical records or time-series arrays into its database.

## Transport and access

`performance-hub-bridge/context` accepts either `athlete_id` or `athlete_email`. Every request includes the Hub session JWT in `Authorization` and the active Performance application token in `X-Planner-Token`. The server validates both and checks the current self/coach/admin relationship before querying private tables. Application tokens alone are not user authorization.

The endpoint reads the whole available history with stable paging, not a 30-day calendar or a single 200-row result. It reports failed sections individually. `useHubData` cancels stale results by request generation and clears previous athlete data. A local profile/email is not required for a coach's Hub athlete; lookup can use the Hub UUID.

## Calendar and models

The completed calendar combines external activities, wearable executions, manual endurance completions, completed gym assignments/logs and extra training logs. Only explicit source IDs/fusion/planning links suppress duplicates. Separate same-day workouts remain separate. Planned entries are shown separately and do not enter actual-load calculations.

Read-only virtual sessions preserve Hub IDs and source types. Session lists, the load engine, Performance charts, power-duration/critical-power analysis and simulators consume the combined dataset. Hub rows cannot be deleted from Performance. Original arrays are downloaded when needed and calculations run in memory. Cycling power-model inputs are restricted to cycling activities with actual available power; other sports retain their measured channels without being treated as cycling. Missing power or pulse stays missing.

`streams` reads external activity arrays or delegates wearable reads to Hub. Wearable samples use a different timestamped-series contract, normalized at the boundary. The wearable provider's downsampled series are for display; the cycling MMP pipeline uses original external arrays. Existing local-import ingestion maps Hub IDs back to the local session ID before saving derived metrics.

## Clinical and recovery data

The adapter maps the actual ISAK/Kerr/bioimpedance schemas, biological passports, wellness check-ins, actual daily nutrition and food diary totals. Daily nutrition and food diary totals are not added twice. Generic Hub VFC is represented as HRV in milliseconds, not relabelled RMSSD or a proprietary HRV score. Trend calculations select a homogeneous measurement series. Passport and body-composition values feed the model athlete in memory; no write-back to Hub or automatic overwrite of the local profile occurs.

## Verification

Run `npm ci`, `npm run test:hub` and `npm run build`. The integration test covers multiple completed sources, explicit deduplication, multiple same-day sessions, units, body/passport values, nutrition aggregation, generic HRV, both auth headers, UUID identity, wearable contract normalization, and actual PMC/PDC consumption using a server-rendered hook probe. It mocks HTTP and local persistence; it is not a production-user end-to-end test.

The repository already has TypeScript diagnostics in its incomplete Supabase database typings and other existing files. Compare `npm run typecheck` against the base revision: this change must add no diagnostics. Build compilation and the integration tests are required independently.

The Hub companion change supplies `performance-hub-bridge` and a read-only satellite authentication fallback in `open-wearables`. Both validate authentication inside their handlers. The fallback is restricted to `get-session-timeseries`, an active Performance application token and a verified Hub JWT; current athlete permissions and wearable consent remain enforced. Mutation actions retain their original Supabase-session requirement.
