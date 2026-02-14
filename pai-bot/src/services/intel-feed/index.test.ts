import { beforeEach, expect, mock, test } from "bun:test";

const listSchedulesMock = mock();
const setScheduleEnabledMock = mock(() => true);

mock.module("../scheduler", () => ({
  listSchedules: listSchedulesMock,
  setScheduleEnabled: setScheduleEnabledMock,
}));

import { pauseIntelFeedSchedules } from "./index";

beforeEach(() => {
  listSchedulesMock.mockReset();
  setScheduleEnabledMock.mockReset();
  setScheduleEnabledMock.mockImplementation(() => true);
});

test("pauseIntelFeedSchedules disables existing intel-feed schedules", async () => {
  listSchedulesMock.mockReturnValueOnce([
    { id: 1, name: "Intel Feed Daily", task_type: "prompt", task_data: "/intel-digest", enabled: 1 },
    { id: 2, name: "Random", task_type: "message", task_data: "hello", enabled: 1 },
    { id: 3, name: "Digest Legacy", task_type: "prompt", task_data: "/intel-digest", enabled: 1 },
  ]);

  const paused = await pauseIntelFeedSchedules(42);

  expect(paused).toBe(2);
  expect(setScheduleEnabledMock).toHaveBeenCalledTimes(2);
  expect(setScheduleEnabledMock).toHaveBeenCalledWith(1, false);
  expect(setScheduleEnabledMock).toHaveBeenCalledWith(3, false);
});

test("pauseIntelFeedSchedules skips when no intel-feed schedule exists", async () => {
  listSchedulesMock.mockReturnValueOnce([
    { id: 10, name: "Morning Task", task_type: "message", task_data: "hey", enabled: 1 },
  ]);

  const paused = await pauseIntelFeedSchedules(42);

  expect(paused).toBe(0);
  expect(setScheduleEnabledMock).toHaveBeenCalledTimes(0);
});
