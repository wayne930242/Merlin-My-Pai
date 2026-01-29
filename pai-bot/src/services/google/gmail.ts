// Gmail 服務

import { type gmail_v1, google } from "googleapis";
import { Err, Ok, type Result } from "ts-results";
import { getAuthClient } from "./auth";

function getGmail() {
  return google.gmail({ version: "v1", auth: getAuthClient() });
}

export async function listMessages(
  options: { q?: string; maxResults?: number; labelIds?: string[] } = {},
): Promise<Result<gmail_v1.Schema$Message[], Error>> {
  try {
    const gmail = getGmail();
    const res = await gmail.users.messages.list({
      userId: "me",
      q: options.q,
      maxResults: options.maxResults || 10,
      labelIds: options.labelIds,
    });
    return Ok(res.data.messages || []);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function getMessage(
  messageId: string,
  format: "full" | "metadata" | "minimal" = "full",
): Promise<Result<gmail_v1.Schema$Message, Error>> {
  try {
    const gmail = getGmail();
    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format,
    });
    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

interface MessageContent {
  subject: string;
  from: string;
  date?: string;
  body: string;
  id?: string | null;
}

export async function getMessageContent(
  messageId: string,
): Promise<Result<MessageContent, Error>> {
  const messageResult = await getMessage(messageId, "full");
  if (messageResult.err) {
    return messageResult;
  }

  const message = messageResult.val;
  const payload = message.payload;

  if (!payload) return Ok({ subject: "", from: "", body: "" });

  const headers = payload.headers || [];
  const subject = headers.find((h) => h.name === "Subject")?.value || "";
  const from = headers.find((h) => h.name === "From")?.value || "";
  const date = headers.find((h) => h.name === "Date")?.value || "";

  function extractBody(part: gmail_v1.Schema$MessagePart): string {
    if (part.body?.data) {
      return Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.parts) {
      for (const p of part.parts) {
        if (p.mimeType === "text/plain") {
          return extractBody(p);
        }
      }
      for (const p of part.parts) {
        const result = extractBody(p);
        if (result) return result;
      }
    }
    return "";
  }

  const body = extractBody(payload);

  return Ok({ subject, from, date, body, id: message.id });
}

export async function sendMessage(
  to: string,
  subject: string,
  body: string,
  options: { cc?: string; bcc?: string; replyTo?: string } = {},
): Promise<Result<gmail_v1.Schema$Message, Error>> {
  try {
    const gmail = getGmail();

    const headers = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8"];

    if (options.cc) headers.push(`Cc: ${options.cc}`);
    if (options.bcc) headers.push(`Bcc: ${options.bcc}`);
    if (options.replyTo) headers.push(`Reply-To: ${options.replyTo}`);

    const message = [...headers, "", body].join("\r\n");
    const encodedMessage = Buffer.from(message).toString("base64url");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function replyToMessage(
  messageId: string,
  body: string,
): Promise<Result<gmail_v1.Schema$Message, Error>> {
  try {
    const gmail = getGmail();
    const originalResult = await getMessage(messageId, "metadata");
    if (originalResult.err) {
      return originalResult;
    }

    const original = originalResult.val;
    const headers = original.payload?.headers || [];
    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const from = headers.find((h) => h.name === "From")?.value || "";
    const messageIdHeader = headers.find((h) => h.name === "Message-ID")?.value || "";

    const replyHeaders = [
      `To: ${from}`,
      `Subject: Re: ${subject.replace(/^Re:\s*/i, "")}`,
      `In-Reply-To: ${messageIdHeader}`,
      `References: ${messageIdHeader}`,
      "Content-Type: text/plain; charset=utf-8",
    ];

    const message = [...replyHeaders, "", body].join("\r\n");
    const encodedMessage = Buffer.from(message).toString("base64url");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
        threadId: original.threadId,
      },
    });

    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function trashMessage(messageId: string): Promise<Result<void, Error>> {
  try {
    const gmail = getGmail();
    await gmail.users.messages.trash({ userId: "me", id: messageId });
    return Ok(undefined);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function listLabels(): Promise<Result<gmail_v1.Schema$Label[], Error>> {
  try {
    const gmail = getGmail();
    const res = await gmail.users.labels.list({ userId: "me" });
    return Ok(res.data.labels || []);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export type { gmail_v1 };
