#!/usr/bin/env bun
/**
 * Memory system integration test - Distance calibration
 * Run on VPS: bun run scripts/test-memory.ts
 */

import { memoryManager, getEmbedding } from "../src/memory";

const TEST_USER_ID = 99999;

// Test pairs: [memory1, memory2, shouldBeDuplicate]
const testPairs: [string, string, boolean][] = [
  // Should be duplicates (same meaning)
  ["用戶喜歡喝咖啡", "用戶喜歡喝咖啡，特別是拿鐵", true],
  ["用戶住在台北", "用戶住在台北市信義區", true],
  ["用戶是工程師", "用戶的職業是軟體工程師", true],
  ["用戶喜歡看電影", "用戶愛看電影，尤其是科幻片", true],

  // Should NOT be duplicates (different meanings)
  ["用戶喜歡喝咖啡", "用戶住在台北", false],
  ["用戶是工程師", "用戶喜歡看電影", false],
  ["用戶養了一隻貓", "用戶喜歡吃日本料理", false],
  ["用戶每天運動", "用戶在科技公司上班", false],
];

async function measureDistance(text1: string, text2: string): Promise<number> {
  const { embedding: e1 } = await getEmbedding(text1);
  const { embedding: e2 } = await getEmbedding(text2);

  // Calculate L2 distance
  let sum = 0;
  for (let i = 0; i < e1.length; i++) {
    const diff = e1[i] - e2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

async function calibrate() {
  console.log("=== Distance Calibration Test ===\n");

  const duplicateDistances: number[] = [];
  const differentDistances: number[] = [];

  for (const [text1, text2, shouldBeDuplicate] of testPairs) {
    const distance = await measureDistance(text1, text2);

    if (shouldBeDuplicate) {
      duplicateDistances.push(distance);
      console.log(`[SIMILAR] ${distance.toFixed(2)}: "${text1}" <-> "${text2.slice(0, 20)}..."`);
    } else {
      differentDistances.push(distance);
      console.log(`[DIFFER]  ${distance.toFixed(2)}: "${text1}" <-> "${text2.slice(0, 20)}..."`);
    }
  }

  console.log("\n=== Statistics ===");

  const dupMax = Math.max(...duplicateDistances);
  const dupMin = Math.min(...duplicateDistances);
  const dupAvg = duplicateDistances.reduce((a, b) => a + b, 0) / duplicateDistances.length;

  const diffMax = Math.max(...differentDistances);
  const diffMin = Math.min(...differentDistances);
  const diffAvg = differentDistances.reduce((a, b) => a + b, 0) / differentDistances.length;

  console.log(`\nSimilar pairs (should dedup):`);
  console.log(`  Min: ${dupMin.toFixed(2)}, Max: ${dupMax.toFixed(2)}, Avg: ${dupAvg.toFixed(2)}`);

  console.log(`\nDifferent pairs (should NOT dedup):`);
  console.log(`  Min: ${diffMin.toFixed(2)}, Max: ${diffMax.toFixed(2)}, Avg: ${diffAvg.toFixed(2)}`);

  // Suggest threshold
  const suggestedThreshold = (dupMax + diffMin) / 2;
  const margin = diffMin - dupMax;

  console.log(`\n=== Recommendation ===`);
  console.log(`Suggested threshold: ${suggestedThreshold.toFixed(2)}`);
  console.log(`Safety margin: ${margin.toFixed(2)} (${margin > 0 ? "GOOD ✓" : "OVERLAP ✗"})`);

  if (margin <= 0) {
    console.log(`\n⚠️  Warning: Some similar pairs have higher distance than different pairs!`);
    console.log(`   Consider using a middle value around ${suggestedThreshold.toFixed(1)}`);
  }
}

async function testDedup(threshold: number) {
  console.log(`\n=== Dedup Test with threshold ${threshold} ===\n`);

  // Cleanup
  memoryManager.deleteByUser(TEST_USER_ID);

  let correctDedups = 0;
  let incorrectDedups = 0;
  let correctSaves = 0;
  let incorrectSaves = 0;

  for (const [text1, text2, shouldBeDuplicate] of testPairs) {
    // Save first memory
    memoryManager.deleteByUser(TEST_USER_ID);
    await memoryManager.save({ userId: TEST_USER_ID, content: text1, category: "test" });

    // Try to save second (should be deduped or not based on expectation)
    const result = await memoryManager.save({ userId: TEST_USER_ID, content: text2, category: "test" });
    const wasDeduped = result === null;

    if (shouldBeDuplicate && wasDeduped) {
      correctDedups++;
      console.log(`✓ Correctly deduped: "${text2.slice(0, 30)}..."`);
    } else if (shouldBeDuplicate && !wasDeduped) {
      incorrectSaves++;
      console.log(`✗ Should have deduped: "${text2.slice(0, 30)}..."`);
    } else if (!shouldBeDuplicate && !wasDeduped) {
      correctSaves++;
      console.log(`✓ Correctly saved: "${text2.slice(0, 30)}..."`);
    } else {
      incorrectDedups++;
      console.log(`✗ Incorrectly deduped: "${text2.slice(0, 30)}..."`);
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Correct dedups: ${correctDedups}/${testPairs.filter(p => p[2]).length}`);
  console.log(`Correct saves: ${correctSaves}/${testPairs.filter(p => !p[2]).length}`);
  console.log(`Incorrect dedups: ${incorrectDedups}`);
  console.log(`Incorrect saves: ${incorrectSaves}`);
  console.log(`\nAccuracy: ${((correctDedups + correctSaves) / testPairs.length * 100).toFixed(1)}%`);

  // Cleanup
  memoryManager.deleteByUser(TEST_USER_ID);
}

async function main() {
  await calibrate();

  // Test with current threshold (8.0)
  await testDedup(8.0);
}

main().catch(console.error);
