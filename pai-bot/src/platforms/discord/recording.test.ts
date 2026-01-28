import { test, expect, beforeEach } from "bun:test";
import {
  type RecordingSession,
  createRecordingSession,
  isRecording,
  getRecordingSession,
  clearAllSessions,
} from "./recording";

// 每個測試前清理 sessions
beforeEach(() => {
  clearAllSessions();
});

test("createRecordingSession returns session object", () => {
  const session = createRecordingSession("guild-1", "channel-1");

  expect(session).toBeDefined();
  expect(session.guildId).toBe("guild-1");
  expect(session.channelId).toBe("channel-1");
  expect(session.startTime).toBeInstanceOf(Date);
  expect(session.userStreams).toBeInstanceOf(Map);
  expect(session.isActive).toBe(true);
});

test("isRecording returns true for active session", () => {
  createRecordingSession("guild-active", "channel-1");
  expect(isRecording("guild-active")).toBe(true);
});

test("isRecording returns false when no session exists", () => {
  expect(isRecording("nonexistent-guild")).toBe(false);
});

test("getRecordingSession returns session when exists", () => {
  const created = createRecordingSession("guild-get", "channel-1");
  const retrieved = getRecordingSession("guild-get");

  expect(retrieved).toBe(created);
});

test("getRecordingSession returns null when not exists", () => {
  expect(getRecordingSession("no-such-guild")).toBeNull();
});
