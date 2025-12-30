#!/usr/bin/env bun

/**
 * PreCompact Hook - Context 壓縮前通知
 */

import { notify } from "./lib/notify";

async function main() {
  await notify("[Memory] Context 即將壓縮...", "warning");
}

main();
