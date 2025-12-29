#!/usr/bin/env bun

// Session stop hook - could be used to save session summary
// Currently just logs session end

const time = new Date().toISOString();
console.log(`[PAI] Session ended: ${time}`);
