import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import {
  PageQuery,
  StarNotificationBody,
  UpdateNotificationPrefsBody,
  type CountDto,
  type NotificationDto,
  type NotificationPrefsDto,
  type Page,
  type UnreadCountDto,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { parse } from "../http/validate.js";
import { actorIdOf } from "../ncr/handler-ctx.js";
import { NOTIFICATIONS_SERVICE } from "../tokens.js";
import type { NotificationsService } from "./notifications.service.js";

const uuid = z.string().uuid();
const ListQuery = PageQuery.extend({
  unread: z.coerce.boolean().optional(),
  starred: z.coerce.boolean().optional(),
  entityKind: z.string().max(40).optional(),
});

/**
 * Notification routes (06). No `@RequireCapability`: these are personal to the
 * authenticated user, and every method scopes to `actorId`, so a member reaches
 * only their own notifications and preferences.
 */
@Controller()
export class NotificationsController {
  constructor(@Inject(NOTIFICATIONS_SERVICE) private readonly notifications: NotificationsService) {}

  @Get("v1/notifications")
  async list(@Query() query: unknown): Promise<Page<NotificationDto>> {
    const q = parse(ListQuery, query);
    return this.notifications.list(currentTx(), actorIdOf(), {
      ...(q.unread !== undefined ? { unread: q.unread } : {}),
      ...(q.starred !== undefined ? { starred: q.starred } : {}),
      ...(q.entityKind !== undefined ? { entityKind: q.entityKind } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/notifications/unread-count")
  async unreadCount(): Promise<UnreadCountDto> {
    return { count: await this.notifications.unreadCount(currentTx(), actorIdOf()) };
  }

  @Post("v1/notifications/read-all")
  @HttpCode(200)
  async markAllRead(): Promise<CountDto> {
    return { count: await this.notifications.markAllRead(currentTx(), actorIdOf()) };
  }

  @Post("v1/notifications/:id/read")
  @HttpCode(200)
  async markRead(@Param("id") id: string): Promise<NotificationDto> {
    return this.notifications.markRead(currentTx(), actorIdOf(), parse(uuid, id));
  }

  @Post("v1/notifications/:id/star")
  @HttpCode(200)
  async star(@Param("id") id: string, @Body() body: unknown): Promise<NotificationDto> {
    const { starred } = parse(StarNotificationBody, body);
    return this.notifications.setStarred(currentTx(), actorIdOf(), parse(uuid, id), starred);
  }

  @Post("v1/notifications/:id/dismiss")
  @HttpCode(200)
  async dismiss(@Param("id") id: string): Promise<CountDto> {
    return { count: await this.notifications.dismiss(currentTx(), actorIdOf(), parse(uuid, id)) };
  }

  @Get("v1/notification-prefs")
  async getPrefs(): Promise<NotificationPrefsDto> {
    return this.notifications.getPrefs(currentTx(), actorIdOf());
  }

  @Put("v1/notification-prefs")
  async setPrefs(@Body() body: unknown): Promise<NotificationPrefsDto> {
    const input = parse(UpdateNotificationPrefsBody, body);
    return this.notifications.setPrefs(currentTx(), currentContext().tenantId, actorIdOf(), input);
  }
}
