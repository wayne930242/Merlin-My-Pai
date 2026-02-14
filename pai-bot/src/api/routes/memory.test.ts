import { expect, test } from "bun:test";

import { handleMemoryRoutes } from "./memory";

function post(path: string, body: unknown) {
  return handleMemoryRoutes(
    path,
    "POST",
    new Request(`http://localhost:3000${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function get(path: string) {
  return handleMemoryRoutes(
    path,
    "GET",
    new Request(`http://localhost:3000${path}`, {
      method: "GET",
    }),
  );
}

test("POST /api/memory/save returns ok with id or duplicate", async () => {
  const content = `test-memory-${Date.now()}`;
  const result = await post("/api/memory/save", {
    content,
    category: "test",
    importance: 1,
  });

  expect(result.handled).toBe(true);
  const body = (await result.response.json()) as { ok: boolean; id?: number; duplicate?: boolean };
  expect(body.ok).toBe(true);
  expect(typeof body.id === "number" || body.duplicate === true).toBe(true);
});

test("POST /api/memory/search returns count and memories", async () => {
  const content = `searchable-memory-${Date.now()}`;
  await post("/api/memory/save", {
    content,
    category: "test",
    importance: 1,
  });

  const result = await post("/api/memory/search", {
    query: "searchable-memory",
    limit: 10,
  });

  expect(result.handled).toBe(true);
  const body = (await result.response.json()) as {
    ok: boolean;
    count: number;
    memories: Array<{ content: string }>;
  };
  expect(body.ok).toBe(true);
  expect(typeof body.count).toBe("number");
  expect(Array.isArray(body.memories)).toBe(true);
});

test("GET /api/memory/stats returns total/limit/usage", async () => {
  const result = await get("/api/memory/stats");

  expect(result.handled).toBe(true);
  const body = (await result.response.json()) as { total: number; limit: number; usage: string };
  expect(typeof body.total).toBe("number");
  expect(typeof body.limit).toBe("number");
  expect(typeof body.usage).toBe("string");
});

test("POST /api/memory/cleanup returns removed count", async () => {
  const result = await post("/api/memory/cleanup", {});

  expect(result.handled).toBe(true);
  const body = (await result.response.json()) as { ok: boolean; removed: number };
  expect(body.ok).toBe(true);
  expect(typeof body.removed).toBe("number");
});
