/**
 * Worker-safe try-on barrel.
 *
 * Do NOT re-export `./actions`, admin UI, or reflection panel from here —
 * those pull `server-only` (anon-cookie / next/headers) and crash the outbox
 * worker under `tsx`. Import those modules by deep path instead:
 *   `@/modules/tryon/actions`
 *   `@/modules/tryon/admin-dashboard`
 *   `@/modules/tryon/reflection-panel`
 */
export * from "./types";
export * from "./defaults";
export {
  getTryOnAdminDashboard,
  listPendingSelfies,
  countCacheEntriesByDesign,
  type TryOnAdminDashboardData,
} from "./queries";
export * from "./providers";
export { registerTryOnHandlers } from "./handler";
export { purgeExpiredSelfies } from "./purge";
