import { z } from "zod";
import { apiDelete, apiGet, apiPatch, apiPost } from "../services/backlog-client.js";
import { handleApiError } from "../utils/error-handler.js";
import { formatDateTime, jsonOutput, truncateIfNeeded } from "../utils/formatters.js";
import { ResponseFormat } from "../types.js";
function formatComment(comment) {
    return [
        `### Comment #${comment.id}`,
        `**By**: ${comment.createdUser.name} | **Posted**: ${formatDateTime(comment.created)} | **Updated**: ${formatDateTime(comment.updated)}`,
        "",
        comment.content ?? "*(no content)*",
    ].join("\n");
}
export function registerCommentTools(server) {
    server.registerTool("backlog_get_comments", {
        title: "Get Backlog Issue Comments",
        description: `Returns comments for a specific issue.

Args:
  - issue_id_or_key (required): Issue ID or key (e.g., "MYPROJ-123")
  - limit (optional): Max comments to return (1-100, default 20)
  - offset (optional): Pagination offset (default 0)
  - order (optional): "asc" or "desc" (default "desc" = newest first)
  - response_format: 'markdown' (default) or 'json'

Returns: List of comments with author, timestamp, and content`,
        inputSchema: z.object({
            issue_id_or_key: z
                .union([z.string(), z.number()])
                .describe("Issue ID or key (e.g., 'MYPROJ-123')"),
            limit: z
                .number()
                .int()
                .min(1)
                .max(100)
                .default(20)
                .describe("Max comments to return (1-100, default 20)"),
            offset: z
                .number()
                .int()
                .min(0)
                .default(0)
                .describe("Pagination offset (default 0)"),
            order: z
                .enum(["asc", "desc"])
                .default("desc")
                .describe("Sort order: 'asc' (oldest first) or 'desc' (newest first, default)"),
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
    }, async ({ issue_id_or_key, limit, offset, order, response_format }) => {
        try {
            const comments = await apiGet(`/issues/${issue_id_or_key}/comments`, { count: limit, offset, order });
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(comments) }] };
            }
            if (comments.length === 0) {
                return {
                    content: [{ type: "text", text: "No comments found for this issue." }],
                };
            }
            const lines = [
                `# Comments for ${issue_id_or_key} (${comments.length} returned)`,
                "",
                ...comments.flatMap((c) => [formatComment(c), ""]),
            ];
            if (comments.length === limit) {
                lines.push(`> Use offset: ${offset + limit} to see more comments.`);
            }
            return {
                content: [
                    { type: "text", text: truncateIfNeeded(lines.join("\n"), "comments") },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
    server.registerTool("backlog_add_comment", {
        title: "Add Comment to Backlog Issue",
        description: `Adds a new comment to an issue.

Args:
  - issue_id_or_key (required): Issue ID or key (e.g., "MYPROJ-123")
  - content (required): Comment text content
  - response_format: 'markdown' (default) or 'json'

Returns: The created comment with ID, author, and timestamp`,
        inputSchema: z.object({
            issue_id_or_key: z
                .union([z.string(), z.number()])
                .describe("Issue ID or key (e.g., 'MYPROJ-123')"),
            content: z
                .string()
                .min(1)
                .describe("Comment text content"),
            response_format: z
                .nativeEnum(ResponseFormat)
                .default(ResponseFormat.MARKDOWN)
                .describe("Output format: 'markdown' or 'json'"),
        }),
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
        },
    }, async ({ issue_id_or_key, content, response_format }) => {
        try {
            const comment = await apiPost(`/issues/${issue_id_or_key}/comments`, { content });
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(comment) }] };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `# Comment Added\n\n${formatComment(comment)}`,
                    },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
    server.registerTool("backlog_update_comment", {
        title: "Update Backlog Comment",
        description: `Updates the content of an existing comment. Only the comment author can update it.

Args:
  - issue_id_or_key (required): Issue ID or key (e.g., "MYPROJ-123")
  - comment_id (required): Numeric comment ID
  - content (required): New comment text content
  - response_format: 'markdown' (default) or 'json'`,
        inputSchema: z.object({
            issue_id_or_key: z
                .union([z.string(), z.number()])
                .describe("Issue ID or key (e.g., 'MYPROJ-123')"),
            comment_id: z
                .number()
                .int()
                .positive()
                .describe("Numeric comment ID"),
            content: z
                .string()
                .min(1)
                .describe("New comment text content"),
            response_format: z
                .nativeEnum(ResponseFormat)
                .default(ResponseFormat.MARKDOWN)
                .describe("Output format: 'markdown' or 'json'"),
        }),
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
        },
    }, async ({ issue_id_or_key, comment_id, content, response_format }) => {
        try {
            const comment = await apiPatch(`/issues/${issue_id_or_key}/comments/${comment_id}`, { content });
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(comment) }] };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `# Comment Updated\n\n${formatComment(comment)}`,
                    },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
    server.registerTool("backlog_delete_comment", {
        title: "Delete Backlog Comment",
        description: `Deletes a comment from an issue. Only the comment author or project admin can delete it.

Args:
  - issue_id_or_key (required): Issue ID or key (e.g., "MYPROJ-123")
  - comment_id (required): Numeric comment ID to delete

Returns: Confirmation with the deleted comment ID`,
        inputSchema: z.object({
            issue_id_or_key: z
                .union([z.string(), z.number()])
                .describe("Issue ID or key (e.g., 'MYPROJ-123')"),
            comment_id: z
                .number()
                .int()
                .positive()
                .describe("Numeric comment ID to delete"),
        }),
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
        },
    }, async ({ issue_id_or_key, comment_id }) => {
        try {
            const comment = await apiDelete(`/issues/${issue_id_or_key}/comments/${comment_id}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Deleted comment #${comment.id} from issue ${issue_id_or_key}.`,
                    },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
}
//# sourceMappingURL=comments.js.map