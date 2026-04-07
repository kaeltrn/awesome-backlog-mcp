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
  - issue_key (required): Issue ID or key (e.g., "MYPROJ-123")
  - count (optional): Max comments to return (1-200, default 20)
  - min_id (optional): Return comments with ID greater than this value (for pagination forward)
  - max_id (optional): Return comments with ID less than this value (for pagination backward)
  - order (optional): "asc" or "desc" (default "desc" = newest first)
  - response_format: 'markdown' (default) or 'json'

Returns: List of comments with author, timestamp, and content`,
        inputSchema: z.object({
            issue_key: z
                .union([z.string(), z.number()])
                .describe("Issue ID or key (e.g., 'MYPROJ-123')"),
            count: z
                .number()
                .int()
                .min(1)
                .max(200)
                .default(20)
                .describe("Max comments to return (1-200, default 20)"),
            min_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Return comments with ID greater than this (pagination: get next page)"),
            max_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Return comments with ID less than this (pagination: get previous page)"),
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
    }, async ({ issue_key, count, min_id, max_id, order, response_format }) => {
        try {
            const params = { count, order };
            if (min_id !== undefined)
                params["minId"] = min_id;
            if (max_id !== undefined)
                params["maxId"] = max_id;
            const comments = await apiGet(`/issues/${issue_key}/comments`, params);
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(comments) }] };
            }
            if (comments.length === 0) {
                return {
                    content: [{ type: "text", text: "No comments found for this issue." }],
                };
            }
            const lines = [
                `# Comments for ${issue_key} (${comments.length} returned)`,
                "",
                ...comments.flatMap((c) => [formatComment(c), ""]),
            ];
            if (comments.length === count) {
                const lastId = comments[comments.length - 1].id;
                lines.push(`> To see older comments, use max_id: ${lastId}`);
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
  - issue_key (required): Issue ID or key (e.g., "MYPROJ-123")
  - content (required): Comment text content
  - response_format: 'markdown' (default) or 'json'

Returns: The created comment with ID, author, and timestamp`,
        inputSchema: z.object({
            issue_key: z
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
    }, async ({ issue_key, content, response_format }) => {
        try {
            const comment = await apiPost(`/issues/${issue_key}/comments`, { content });
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
  - issue_key (required): Issue ID or key (e.g., "MYPROJ-123")
  - comment_id (required): Numeric comment ID
  - content (required): New comment text content
  - response_format: 'markdown' (default) or 'json'`,
        inputSchema: z.object({
            issue_key: z
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
    }, async ({ issue_key, comment_id, content, response_format }) => {
        try {
            const comment = await apiPatch(`/issues/${issue_key}/comments/${comment_id}`, { content });
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
  - issue_key (required): Issue ID or key (e.g., "MYPROJ-123")
  - comment_id (required): Numeric comment ID to delete

Returns: Confirmation with the deleted comment ID`,
        inputSchema: z.object({
            issue_key: z
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
    }, async ({ issue_key, comment_id }) => {
        try {
            const comment = await apiDelete(`/issues/${issue_key}/comments/${comment_id}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Deleted comment #${comment.id} from issue ${issue_key}.`,
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