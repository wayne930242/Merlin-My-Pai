import { expect, test } from "bun:test";

import { InMemoryStore, MemoryService } from "./index";

test("public API exports service and store", () => {
  expect(typeof MemoryService).toBe("function");
  expect(typeof InMemoryStore).toBe("function");
});
