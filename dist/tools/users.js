import { z } from "zod";
import { apiGet } from "../services/backlog-client.js";
import { handleApiError } from "../utils/error-handler.js";
import { formatDateTime, jsonOutput, truncateIfNeeded } from "../utils/formatters.js";
import { ResponseFormat } from "../types.js";
function formatUser(user) {
    return [
        `## ${user.name} (ID: ${user.id})`,
        `- **User ID**: ${user.userId}`,
        `- **Email**: ${user.mailAddress}`,
        `- **Role**: ${user.roleType}`,
        `- **Last Login**: ${formatDateTime(user.lastLoginTime)}`,
    ].join("\n");
}
export function registerUserTools(server) {
    server.registerTool("backlog_get_myself", {
        title: "Get Current Backlog User",
        description: `Returns the authenticated user's profile.

Use this to get the current user's ID, name, email, and role. Useful before assigning issues to yourself.

Returns: id, userId, name, mailAddress, roleType, lastLoginTime

Args:
  - response_format: 'markdown' (default) or 'json'`,
        inputSchema: z.object({
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
    }, async ({ response_format }) => {
        try {
            const user = await apiGet("/users/myself");
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(user) }] };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `# Current User\n\n${formatUser(user)}`,
                    },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
    server.registerTool("backlog_get_users", {
        title: "Get Backlog Users",
        description: `Returns users in the space or filtered by project, or a single user by ID.

Use this to find user IDs for issue assignment. When assigning issues, prefer passing project_key to get only users who belong to that project.

Args:
  - user_id (optional): Numeric user ID to fetch a single user. Omit to list users.
  - project_key (optional): Project key (e.g. "MYPROJ") to list only users in that project. Cannot be combined with user_id.
  - response_format: 'markdown' (default) or 'json'

Returns: id, userId, name, mailAddress, roleType, lastLoginTime`,
        inputSchema: z.object({
            user_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Numeric user ID to fetch a single user. Omit to list users."),
            project_key: z
                .union([z.string(), z.number()])
                .optional()
                .describe("Project key (e.g. 'MYPROJ') or numeric ID to list only users in that project."),
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
    }, async ({ user_id, project_key, response_format }) => {
        try {
            if (user_id !== undefined) {
                const user = await apiGet(`/users/${user_id}`);
                if (response_format === ResponseFormat.JSON) {
                    return { content: [{ type: "text", text: jsonOutput(user) }] };
                }
                return {
                    content: [{ type: "text", text: `# User\n\n${formatUser(user)}` }],
                };
            }
            const endpoint = project_key
                ? `/projects/${project_key}/users`
                : "/users";
            const users = await apiGet(endpoint);
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(users) }] };
            }
            const title = project_key
                ? `# Users in project ${project_key} (${users.length})`
                : `# Users (${users.length})`;
            const lines = [title, ""];
            for (const user of users) {
                lines.push(formatUser(user));
                lines.push("");
            }
            return {
                content: [{ type: "text", text: truncateIfNeeded(lines.join("\n"), "users") }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
}
//# sourceMappingURL=users.js.map