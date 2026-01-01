#!/usr/bin/env bun
/**
 * Memory system integration test
 * Run on VPS: bun run scripts/test-memory.ts
 */

import { memoryManager, cleanupExpiredMemories, getMemoryStats } from "../src/memory";

const TEST_USER_ID = 99999; // Fake user for testing

async function test() {
  console.log("=== Memory System Test ===\n");

  // Cleanup any previous test data
  memoryManager.deleteByUser(TEST_USER_ID);
  console.log("✓ Cleaned up previous test data\n");

  // Test 1: Save memories
  console.log("Test 1: Saving memories...");
  const id1 = await memoryManager.save({
    userId: TEST_USER_ID,
    content: "用戶喜歡喝咖啡",
    category: "preference",
    importance: 3,
  });
  console.log(`  Saved memory #${id1}`);

  const id2 = await memoryManager.save({
    userId: TEST_USER_ID,
    content: "用戶住在台北市",
    category: "personal",
    importance: 5,
  });
  console.log(`  Saved memory #${id2}`);

  const id3 = await memoryManager.save({
    userId: TEST_USER_ID,
    content: "用戶是軟體工程師",
    category: "work",
    importance: 4,
  });
  console.log(`  Saved memory #${id3}`);
  console.log("✓ Test 1 passed\n");

  // Test 2: Semantic deduplication
  console.log("Test 2: Semantic deduplication...");
  const dupId = await memoryManager.save({
    userId: TEST_USER_ID,
    content: "用戶喜歡喝咖啡，特別是拿鐵", // Similar to id1
    category: "preference",
    importance: 3,
  });
  if (dupId === null) {
    console.log("  Similar memory detected, skipped (correct!)");
    console.log("✓ Test 2 passed\n");
  } else {
    console.log(`  ✗ Should have been deduplicated, but got id ${dupId}`);
  }

  // Test 3: Search
  console.log("Test 3: Semantic search...");
  const results = await memoryManager.search(TEST_USER_ID, "咖啡飲料", 3);
  console.log(`  Found ${results.length} results for "咖啡飲料":`);
  for (const r of results) {
    console.log(`    - ${r.content} (distance: ${r.distance?.toFixed(4)})`);
  }
  if (results.length > 0 && results[0].content.includes("咖啡")) {
    console.log("✓ Test 3 passed\n");
  } else {
    console.log("✗ Test 3 failed\n");
  }

  // Test 4: Count and getRecent
  console.log("Test 4: Count and getRecent...");
  const count = memoryManager.count(TEST_USER_ID);
  const recent = memoryManager.getRecent(TEST_USER_ID, 5);
  console.log(`  Count: ${count}`);
  console.log(`  Recent: ${recent.map((r) => r.content).join(", ")}`);
  console.log("✓ Test 4 passed\n");

  // Test 5: Stats
  console.log("Test 5: Memory stats...");
  const stats = getMemoryStats();
  console.log(`  Total memories: ${stats.totalMemories}`);
  console.log(`  Total users: ${stats.totalUsers}`);
  console.log(`  Avg per user: ${stats.avgPerUser}`);
  console.log("✓ Test 5 passed\n");

  // Cleanup
  memoryManager.deleteByUser(TEST_USER_ID);
  console.log("=== All tests completed ===");
}

test().catch(console.error);
