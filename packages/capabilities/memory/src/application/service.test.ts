import { describe, expect, test } from "bun:test";

import { InMemoryStore } from "../infrastructure/in-memory-store";
import { MemoryService } from "./service";

const now = new Date().toISOString();

describe("MemoryService", () => {
  test("upsertSemantic should keep one record for the same semantic key", async () => {
    const store = new InMemoryStore();
    const service = new MemoryService(store);

    await service.upsertSemantic({
      id: "a",
      tier: "semantic",
      key: "runtime",
      value: "bun",
      category: "preference",
      source: "user",
      confidence: 0.9,
      tags: ["runtime"],
      createdAt: now,
      updatedAt: now,
    });

    await service.upsertSemantic({
      id: "b",
      tier: "semantic",
      key: "runtime",
      value: "bun-over-node",
      category: "preference",
      source: "user",
      confidence: 0.95,
      tags: ["runtime", "bun"],
      createdAt: now,
      updatedAt: now,
    });

    const results = await service.retrieveContext({
      text: "runtime",
      tiers: ["semantic"],
      limit: 10,
    });

    expect(results.length).toBe(1);
    expect(results[0]?.tier).toBe("semantic");
    expect((results[0] as { value?: string }).value).toBe("bun-over-node");
  });

  test("rememberWorking + cleanupWorking removes expired entries", async () => {
    const store = new InMemoryStore();
    const service = new MemoryService(store);
    const oldIso = new Date(Date.now() - 60_000).toISOString();

    await service.rememberWorking({
      id: "w1",
      tier: "working",
      content: "temporary",
      ttlSeconds: 1,
      source: "test",
      confidence: 0.5,
      tags: ["tmp"],
      createdAt: oldIso,
      updatedAt: oldIso,
    });

    const removed = await service.cleanupWorking(now);
    expect(removed).toBe(1);
  });

  test("appendEpisode stores episodic entries", async () => {
    const store = new InMemoryStore();
    const service = new MemoryService(store);

    await service.appendEpisode({
      id: "e1",
      tier: "episodic",
      sessionId: "s1",
      eventType: "decision",
      summary: "chose capability architecture",
      source: "test",
      confidence: 0.9,
      tags: ["decision"],
      createdAt: now,
      updatedAt: now,
    });

    const results = await service.retrieveContext({
      text: "capability",
      tiers: ["episodic"],
      limit: 10,
    });
    expect(results.length).toBe(1);
    expect(results[0]?.tier).toBe("episodic");
  });

  test("addProcedure upserts by name and trigger", async () => {
    const store = new InMemoryStore();
    const service = new MemoryService(store);

    await service.addProcedure({
      id: "p1",
      tier: "procedural",
      name: "security-check",
      trigger: "pre-tool-use",
      instruction: "detect injection",
      source: "test",
      confidence: 0.9,
      tags: ["security"],
      createdAt: now,
      updatedAt: now,
    });

    await service.addProcedure({
      id: "p2",
      tier: "procedural",
      name: "security-check",
      trigger: "pre-tool-use",
      instruction: "detect injection and secrets",
      source: "test",
      confidence: 0.95,
      tags: ["security", "policy"],
      createdAt: now,
      updatedAt: now,
    });

    const results = await service.retrieveContext({
      text: "security-check",
      tiers: ["procedural"],
      limit: 10,
    });

    expect(results.length).toBe(1);
    expect(results[0]?.tier).toBe("procedural");
    expect((results[0] as { instruction?: string }).instruction).toContain("secrets");
  });
});
