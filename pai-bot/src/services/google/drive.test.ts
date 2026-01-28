import { test, expect, mock } from "bun:test";

// Mock googleapis
mock.module("googleapis", () => ({
  google: {
    drive: () => ({
      files: {
        create: mock(() => Promise.resolve({
          data: { id: "test-id", name: "test.mp3", webViewLink: "https://drive.google.com/test" }
        })),
      },
    }),
    auth: { OAuth2: class {} },
  },
}));

// Mock auth
mock.module("./auth", () => ({
  getAuthClient: () => ({}),
}));

import { uploadBinaryFile } from "./drive";

test("uploadBinaryFile uploads buffer to Google Drive", async () => {
  const buffer = Buffer.from("test audio data");
  const result = await uploadBinaryFile("recording.mp3", buffer, "audio/mpeg");

  expect(result).toBeDefined();
  expect(result.id).toBe("test-id");
  expect(result.name).toBe("test.mp3");
});
