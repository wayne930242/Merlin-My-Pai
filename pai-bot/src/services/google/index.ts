// Google 服務匯出

export { isGoogleConfigured, getAuthClient } from "./auth";

export * as calendar from "./calendar";
export * as drive from "./drive";
export * as gmail from "./gmail";
export * as contacts from "./contacts";
export * as tasks from "./tasks";

export type { calendar_v3 } from "./calendar";
export type { drive_v3 } from "./drive";
export type { gmail_v1 } from "./gmail";
export type { people_v1 } from "./contacts";
export type { tasks_v1 } from "./tasks";
