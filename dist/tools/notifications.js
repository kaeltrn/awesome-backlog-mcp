import { z } from "zod";
import { apiGet, apiPost } from "../services/backlog-client.js";
import { handleApiError } from "../utils/error-handler.js";
import { formatDateTime, jsonOutput, truncateIfNeeded } from "../utils/formatters.js";
import { ResponseFormat } from "../types.js";
export function registerNotificationTools(server) {
    server.registerTool("backlog_get_notifications", {
        title: "Get Backlog Notifications",
        description: `Returns your notifications, or just a count of unread notifications.

Args:
  - count_only (optional): If true, returns only the count of unread notifications
  - already_read (optional): Filter by read status. Omit for all, true for read, false for unread.
  - limit (optional): Max results (1-100, default 20)
  - offset (optional): Pagination offset (default 0)
  - response_format: 'markdown' (default) or 'json'

Returns: List of notifications with reason, project, issue, and comment info`,
        inputSchema: z.object({
            count_only: z
                .boolean()
                .optional()
                .describe("If true, returns only the count of unread notifications"),
            already_read: z
                .boolean()
                .optional()
                .describe("Filter: true = read only, false = unread only. Omit for all."),
            limit: z
                .number()
                .int()
                .min(1)
                .max(100)
                .default(20)
                .describe("Max results to return (1-100, default 20)"),
            offset: z
                .number()
                .int()
                .min(0)
                .default(0)
                .describe("Pagination offset (default 0)"),
            response_format: z
                .nativeEnum(ResponseFormat)
                .default(ResponseFormat.MARKDOWN)
                .describe("Output format: 'markdown' or 'json'"),
        }),
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async ({ count_only, already_read, limit, offset, response_format }) => {
        try {
            if (count_only) {
                const result = await apiGet("/notifications/count");
                return {
                    content: [{ type: "text", text: `**Unread notifications**: ${result.count}` }],
                };
            }
            const params = { count: limit, offset };
            if (already_read !== undefined)
                params["alreadyRead"] = already_read;
            const notifications = await apiGet("/notifications", params);
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(notifications) }] };
            }
            if (notifications.length === 0) {
                return {
                    content: [{ type: "text", text: "No notifications found." }],
                };
            }
            const lines = [
                `# Notifications (${notifications.length} returned)`,
                "",
            ];
            for (const n of notifications) {
                const status = n.alreadyRead ? "✓ Read" : "● Unread";
                const project = n.project.name;
                const issue = n.issue ? `[${n.issue.issueKey}] ${n.issue.summary}` : "—";
                const comment = n.comment ? `Comment: "${n.comment.content?.slice(0, 80) ?? ""}…"` : "";
                lines.push(`### ${status} — ${project}`);
                lines.push(`- **Issue**: ${issue}`);
                if (comment)
                    lines.push(`- **${comment}`);
                lines.push(`- **Time**: ${formatDateTime(n.created)}`);
                lines.push(`- **Notification ID**: ${n.id}`);
                lines.push("");
            }
            if (notifications.length === limit) {
                lines.push(`> Use offset: ${offset + limit} to see more notifications.`);
            }
            return {
                content: [
                    { type: "text", text: truncateIfNeeded(lines.join("\n"), "notifications") },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
    server.registerTool("backlog_mark_notification_as_read", {
        title: "Mark Backlog Notification as Read",
        description: `Marks one or all notifications as read.

Args:
  - notification_id (optional): Numeric notification ID to mark as read. Omit to mark ALL notifications as read.

Returns: Confirmation message`,
        inputSchema: z.object({
            notification_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Notification ID to mark as read. Omit to mark all notifications as read."),
        }),
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async ({ notification_id }) => {
        try {
            if (notification_id !== undefined) {
                await apiPost(`/notifications/${notification_id}/markAsRead`, {});
                return {
                    content: [
                        {
                            type: "text",
                            text: `Marked notification #${notification_id} as read.`,
                        },
                    ],
                };
            }
            await apiPost("/notifications/markAsRead", {});
            return {
                content: [{ type: "text", text: "All notifications marked as read." }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
}
//# sourceMappingURL=notifications.js.map