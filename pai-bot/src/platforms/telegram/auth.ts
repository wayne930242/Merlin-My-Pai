import { config } from "../../config";
import { logger } from "../../utils/logger";

export function isAuthorized(userId: number): boolean {
  const allowed = config.telegram.allowedUserIds.includes(userId);

  if (!allowed) {
    logger.warn({ userId }, "Unauthorized access attempt");
  }

  return allowed;
}
