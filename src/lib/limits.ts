// Shared by the UI and the API.
// Users pick at least MIN_PICKS roles (no upper limit); all picks get live
// market data and go into the simulation.
export const MIN_PICKS = 5;
// Live market lookups per request; more picks are fetched in parallel batches.
export const LIVE_BATCH = 5;
