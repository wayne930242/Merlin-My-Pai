// Google Drive 服務

import { Readable } from "node:stream";
import { type drive_v3, google } from "googleapis";
import { Err, Ok, type Result } from "ts-results";
import { getAuthClient } from "./auth";

function getDrive() {
  return google.drive({ version: "v3", auth: getAuthClient() });
}

export async function listFiles(
  options: { q?: string; pageSize?: number; folderId?: string; orderBy?: string } = {},
): Promise<Result<drive_v3.Schema$File[], Error>> {
  try {
    const drive = getDrive();

    let query = options.q || "";
    if (options.folderId) {
      const folderQuery = `'${options.folderId}' in parents`;
      query = query ? `${query} and ${folderQuery}` : folderQuery;
    }

    const res = await drive.files.list({
      q: query || undefined,
      pageSize: options.pageSize || 20,
      fields: "files(id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink)",
      orderBy: options.orderBy || "modifiedTime desc",
    });

    return Ok(res.data.files || []);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function searchFiles(query: string): Promise<Result<drive_v3.Schema$File[], Error>> {
  return listFiles({ q: `fullText contains '${query.replace(/'/g, "\\'")}'` });
}

export async function getFile(fileId: string): Promise<Result<drive_v3.Schema$File, Error>> {
  try {
    const drive = getDrive();
    const res = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink",
    });
    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function getFileContent(fileId: string): Promise<Result<string, Error>> {
  try {
    const drive = getDrive();
    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
    return Ok(res.data as string);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function createFile(
  name: string,
  content: string,
  mimeType = "text/plain",
  folderId?: string,
): Promise<Result<drive_v3.Schema$File, Error>> {
  try {
    const drive = getDrive();

    const fileMetadata: drive_v3.Schema$File = { name };
    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    const media = {
      mimeType,
      body: Readable.from([content]),
    };

    const res = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id,name,mimeType,webViewLink",
    });

    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function updateFileContent(
  fileId: string,
  content: string,
  mimeType = "text/plain",
): Promise<Result<drive_v3.Schema$File, Error>> {
  try {
    const drive = getDrive();

    const media = {
      mimeType,
      body: Readable.from([content]),
    };

    const res = await drive.files.update({
      fileId,
      media,
      fields: "id,name,mimeType,webViewLink",
    });

    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function deleteFile(fileId: string): Promise<Result<void, Error>> {
  try {
    const drive = getDrive();
    await drive.files.delete({ fileId });
    return Ok(undefined);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function uploadBinaryFile(
  name: string,
  buffer: Buffer,
  mimeType: string,
  folderId?: string,
): Promise<Result<drive_v3.Schema$File, Error>> {
  try {
    const drive = getDrive();

    const fileMetadata: drive_v3.Schema$File = { name };
    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    const media = {
      mimeType,
      body: Readable.from(buffer),
    };

    const res = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id,name,mimeType,webViewLink",
    });

    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export type { drive_v3 };
