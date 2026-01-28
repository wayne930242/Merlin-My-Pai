import { test, expect, beforeEach, mock } from "bun:test";
import {
  type RecordingSession,
  createRecordingSession,
  isRecording,
  getRecordingSession,
  clearAllSessions,
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
} from "./recording";

// Mock VoiceConnection
const createMockConnection = () => {
  const speakingListeners = new Map<string, Function>();
  return {
    receiver: {
      speaking: {
        on: mock((event: string, fn: Function) => {
          speakingListeners.set(event, fn);
        }),
        off: mock(() => {}),
      },
      subscribe: mock(() => ({
        pipe: mock(() => ({
          pipe: mock(() => ({
            on: mock(() => {}),
          })),
        })),
        on: mock(() => {}),
      })),
    },
    joinConfig: { selfDeaf: false },
    _speakingListeners: speakingListeners,
  } as any;
};

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

test("startRecording creates session and sets up receiver", async () => {
  const mockConnection = createMockConnection();
  const result = await startRecording("guild-start", "channel-1", mockConnection);

  expect(result.ok).toBe(true);
  expect(isRecording("guild-start")).toBe(true);

  const session = getRecordingSession("guild-start");
  expect(session?.isPaused).toBe(false);
});

test("startRecording fails if already recording", async () => {
  const mockConnection = createMockConnection();
  await startRecording("guild-dup", "channel-1", mockConnection);
  const result = await startRecording("guild-dup", "channel-1", mockConnection);

  expect(result.ok).toBe(false);
});

test("pauseRecording sets isPaused to true", async () => {
  const mockConnection = createMockConnection();
  await startRecording("guild-pause", "channel-1", mockConnection);

  const result = pauseRecording("guild-pause");
  expect(result).toBe(true);

  const session = getRecordingSession("guild-pause");
  expect(session?.isPaused).toBe(true);
});

test("resumeRecording sets isPaused to false", async () => {
  const mockConnection = createMockConnection();
  await startRecording("guild-resume", "channel-1", mockConnection);
  pauseRecording("guild-resume");

  const result = resumeRecording("guild-resume");
  expect(result).toBe(true);

  const session = getRecordingSession("guild-resume");
  expect(session?.isPaused).toBe(false);
});
