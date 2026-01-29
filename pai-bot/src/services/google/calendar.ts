// Google Calendar 服務

import { type calendar_v3, google } from "googleapis";
import { Err, Ok, type Result } from "ts-results";
import { getAuthClient } from "./auth";

function getCalendar() {
  return google.calendar({ version: "v3", auth: getAuthClient() });
}

export async function listCalendars(): Promise<
  Result<calendar_v3.Schema$CalendarListEntry[], Error>
> {
  try {
    const calendar = getCalendar();
    const res = await calendar.calendarList.list();
    return Ok(res.data.items || []);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function listEvents(
  calendarId = "primary",
  options: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    q?: string;
  } = {},
): Promise<Result<calendar_v3.Schema$Event[], Error>> {
  try {
    const calendar = getCalendar();
    const res = await calendar.events.list({
      calendarId,
      timeMin: options.timeMin || new Date().toISOString(),
      timeMax: options.timeMax,
      maxResults: options.maxResults || 10,
      singleEvents: true,
      orderBy: "startTime",
      q: options.q,
    });
    return Ok(res.data.items || []);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function getEvent(
  eventId: string,
  calendarId = "primary",
): Promise<Result<calendar_v3.Schema$Event, Error>> {
  try {
    const calendar = getCalendar();
    const res = await calendar.events.get({ calendarId, eventId });
    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function createEvent(
  event: calendar_v3.Schema$Event,
  calendarId = "primary",
): Promise<Result<calendar_v3.Schema$Event, Error>> {
  try {
    const calendar = getCalendar();
    const res = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function updateEvent(
  eventId: string,
  event: calendar_v3.Schema$Event,
  calendarId = "primary",
): Promise<Result<calendar_v3.Schema$Event, Error>> {
  try {
    const calendar = getCalendar();
    const res = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: event,
    });
    return Ok(res.data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function deleteEvent(
  eventId: string,
  calendarId = "primary",
): Promise<Result<void, Error>> {
  try {
    const calendar = getCalendar();
    await calendar.events.delete({ calendarId, eventId });
    return Ok(undefined);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

export type { calendar_v3 };
