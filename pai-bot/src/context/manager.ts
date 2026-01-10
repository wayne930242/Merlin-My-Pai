import { getDb } from "../storage/db";

interface Message {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export class ContextManager {
  private maxMessages = 20;

  // Get conversation context for a user
  getConversationContext(userId: number): string {
    const db = getDb();
    const messages = db
      .query<Message, [number, number]>(
        `
        SELECT role, content, created_at
        FROM conversations
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      )
      .all(userId, this.maxMessages);

    if (messages.length === 0) {
      return "";
    }

    // Build context from messages (oldest first)
    const context = messages
      .reverse()
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    return context;
  }

  // Save a message
  saveMessage(
    userId: number,
    role: "user" | "assistant",
    content: string,
    messageId?: string,
  ): void {
    const db = getDb();
    db.run(
      `
      INSERT INTO conversations (user_id, role, content, message_id)
      VALUES (?, ?, ?, ?)
    `,
      [userId, role, content, messageId || null],
    );
  }

  // Get all message IDs for a user session (for deduplication)
  getMessageIds(userId: number): Set<string> {
    const db = getDb();
    const results = db
      .query<{ message_id: string }, [number]>(
        `
        SELECT message_id
        FROM conversations
        WHERE user_id = ? AND message_id IS NOT NULL
      `,
      )
      .all(userId);
    return new Set(results.map((r) => r.message_id));
  }

  // Clear conversation history
  clearHistory(userId: number): void {
    const db = getDb();
    db.run(
      `
      DELETE FROM conversations
      WHERE user_id = ?
    `,
      [userId],
    );
  }

  // Get conversation count
  getMessageCount(userId: number): number {
    const db = getDb();
    const result = db
      .query<{ count: number }, [number]>(
        `
        SELECT COUNT(*) as count
        FROM conversations
        WHERE user_id = ?
      `,
      )
      .get(userId);
    return result?.count || 0;
  }

  // Get raw messages for display (with timestamps)
  getMessages(
    userId: number,
    limit = 50,
  ): Array<{ role: "user" | "assistant"; content: string; timestamp: number }> {
    const db = getDb();
    const messages = db
      .query<Message, [number, number]>(
        `
        SELECT role, content, created_at
        FROM conversations
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      )
      .all(userId, limit);

    // Return oldest first with timestamp
    return messages.reverse().map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(m.created_at).getTime(),
    }));
  }
}

export const contextManager = new ContextManager();
