import { config } from "../../config";
import { logger } from "../../utils/logger";

export function isAuthorized(userId: string): boolean {
  const allowed = config.discord.allowedUserIds.includes(userId);

  if (!allowed) {
    logger.warn({ userId, platform: "discord" }, "Unauthorized access attempt");
  }

  return allowed;
}
