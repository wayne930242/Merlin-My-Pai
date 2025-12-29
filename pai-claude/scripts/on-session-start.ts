#!/usr/bin/env bun

// Session start hook - outputs context for Claude
const today = new Date().toISOString().split("T")[0];
const time = new Date().toLocaleTimeString("zh-TW", { hour12: false });

console.log(`[PAI] Session started: ${today} ${time}`);
console.log(`[PAI] Available skills: infrastructure, development, research, financial, philosophy, trpg`);
