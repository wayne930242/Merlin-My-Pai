// Google Tasks 服務

import { google, tasks_v1 } from "googleapis";
import { getAuthClient } from "./auth";

function getTasks() {
  return google.tasks({ version: "v1", auth: getAuthClient() });
}

/**
 * 列出所有工作清單
 */
export async function listTaskLists() {
  const tasks = getTasks();
  const res = await tasks.tasklists.list();
  return res.data.items || [];
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
  } = {}
) {
  const tasks = getTasks();
  const res = await tasks.tasks.list({
    tasklist: taskListId,
    showCompleted: options.showCompleted ?? false,
    showHidden: options.showHidden ?? false,
    maxResults: options.maxResults || 100,
  });
  return res.data.items || [];
}

/**
 * 取得單一工作
 */
export async function getTask(taskId: string, taskListId = "@default") {
  const tasks = getTasks();
  const res = await tasks.tasks.get({
    tasklist: taskListId,
    task: taskId,
  });
  return res.data;
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
  taskListId = "@default"
) {
  const tasks = getTasks();
  const res = await tasks.tasks.insert({
    tasklist: taskListId,
    requestBody: task,
  });
  return res.data;
}

/**
 * 更新工作
 */
export async function updateTask(
  taskId: string,
  task: Partial<tasks_v1.Schema$Task>,
  taskListId = "@default"
) {
  const tasks = getTasks();
  const res = await tasks.tasks.patch({
    tasklist: taskListId,
    task: taskId,
    requestBody: task,
  });
  return res.data;
}

/**
 * 完成工作
 */
export async function completeTask(taskId: string, taskListId = "@default") {
  return updateTask(taskId, { status: "completed" }, taskListId);
}

/**
 * 刪除工作
 */
export async function deleteTask(taskId: string, taskListId = "@default") {
  const tasks = getTasks();
  await tasks.tasks.delete({
    tasklist: taskListId,
    task: taskId,
  });
}

/**
 * 建立新工作清單
 */
export async function createTaskList(title: string) {
  const tasks = getTasks();
  const res = await tasks.tasklists.insert({
    requestBody: { title },
  });
  return res.data;
}

/**
 * 刪除工作清單
 */
export async function deleteTaskList(taskListId: string) {
  const tasks = getTasks();
  await tasks.tasklists.delete({
    tasklist: taskListId,
  });
}

export type { tasks_v1 };
