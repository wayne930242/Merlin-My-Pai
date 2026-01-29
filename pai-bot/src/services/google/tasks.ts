// Google Tasks 服務

import { google, type tasks_v1 } from "googleapis";
import { Err, Ok, type Result } from "ts-results";
import { getAuthClient } from "./auth";

function getTasks() {
  return google.tasks({ version: "v1", auth: getAuthClient() });
}

/**
 * 列出所有工作清單
 */
export async function listTaskLists(): Promise<Result<tasks_v1.Schema$TaskList[], Error>> {
  try {
    const tasks = getTasks();
    const res = await tasks.tasklists.list();
    return Ok(res.data.items || []);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 列出工作清單中的工作
 */
export async function listTasks(
  taskListId = "@default",
  options: {
    showCompleted?: boolean;
    showHidden?: boolean;
    maxResults?: number;
  } = {},
): Promise<Result<tasks_v1.Schema$Task[], Error>> {
  try {
    const tasks = getTasks();
    const res = await tasks.tasks.list({
      tasklist: taskListId,
      showCompleted: options.showCompleted ?? false,
      showHidden: options.showHidden ?? false,
      maxResults: options.maxResults || 100,
    });
    return Ok(res.data.items || []);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 取得單一工作
 */
export async function getTask(
  taskId: string,
  taskListId = "@default",
): Promise<Result<tasks_v1.Schema$Task, Error>> {
  try {
    const tasks = getTasks();
    const res = await tasks.tasks.get({
      tasklist: taskListId,
      task: taskId,
    });
    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 建立新工作
 */
export async function createTask(
  task: {
    title: string;
    notes?: string;
    due?: string; // RFC 3339 timestamp
  },
  taskListId = "@default",
): Promise<Result<tasks_v1.Schema$Task, Error>> {
  try {
    const tasks = getTasks();
    const res = await tasks.tasks.insert({
      tasklist: taskListId,
      requestBody: task,
    });
    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 更新工作
 */
export async function updateTask(
  taskId: string,
  task: Partial<tasks_v1.Schema$Task>,
  taskListId = "@default",
): Promise<Result<tasks_v1.Schema$Task, Error>> {
  try {
    const tasks = getTasks();
    const res = await tasks.tasks.patch({
      tasklist: taskListId,
      task: taskId,
      requestBody: task,
    });
    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 完成工作
 */
export async function completeTask(
  taskId: string,
  taskListId = "@default",
): Promise<Result<tasks_v1.Schema$Task, Error>> {
  return updateTask(taskId, { status: "completed" }, taskListId);
}

/**
 * 刪除工作
 */
export async function deleteTask(
  taskId: string,
  taskListId = "@default",
): Promise<Result<void, Error>> {
  try {
    const tasks = getTasks();
    await tasks.tasks.delete({
      tasklist: taskListId,
      task: taskId,
    });
    return Ok(undefined);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 建立新工作清單
 */
export async function createTaskList(
  title: string,
): Promise<Result<tasks_v1.Schema$TaskList, Error>> {
  try {
    const tasks = getTasks();
    const res = await tasks.tasklists.insert({
      requestBody: { title },
    });
    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 刪除工作清單
 */
export async function deleteTaskList(taskListId: string): Promise<Result<void, Error>> {
  try {
    const tasks = getTasks();
    await tasks.tasklists.delete({
      tasklist: taskListId,
    });
    return Ok(undefined);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export type { tasks_v1 };
