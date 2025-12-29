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
      .query<Message, [number]>(
        `
        SELECT role, content, created_at
        FROM conversations
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `
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
  saveMessage(userId: number, role: "user" | "assistant", content: string): void {
    const db = getDb();
    db.run(
      `
      INSERT INTO conversations (user_id, role, content)
      VALUES (?, ?, ?)
    `,
      [userId, role, content]
    );
  }

  // Clear conversation history
  clearHistory(userId: number): void {
    const db = getDb();
    db.run(
      `
      DELETE FROM conversations
      WHERE user_id = ?
    `,
      [userId]
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
      `
      )
      .get(userId);
    return result?.count || 0;
  }
}

export const contextManager = new ContextManager();
