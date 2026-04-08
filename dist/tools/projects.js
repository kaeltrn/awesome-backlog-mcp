import { z } from "zod";
import { apiGet } from "../services/backlog-client.js";
import { handleApiError } from "../utils/error-handler.js";
import { formatDateTime, jsonOutput, truncateIfNeeded } from "../utils/formatters.js";
import { ResponseFormat, } from "../types.js";
export function registerProjectTools(server) {
    server.registerTool("backlog_get_projects", {
        title: "Get Backlog Projects",
        description: `Returns a list of accessible projects, or a single project by ID or key.

Use this to get project keys (e.g., "PROJ") needed for other tools.

Args:
  - project_key (optional): Project key string (e.g., "MYPROJ") or numeric ID. Omit to list all.
  - archived (optional): Filter by archived status (true/false). Only applies when listing all.
  - response_format: 'markdown' (default) or 'json'

Returns: id, projectKey, name, archived, textFormattingRule`,
        inputSchema: z.object({
            project_key: z
                .union([z.string(), z.number()])
                .optional()
                .describe("Project key string (e.g. 'MYPROJ') or numeric ID. Omit to list all projects."),
            archived: z
                .boolean()
                .optional()
                .describe("Filter by archived status. Omit to return all projects."),
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
    }, async ({ project_key, archived, response_format }) => {
        try {
            if (project_key !== undefined) {
                const project = await apiGet(`/projects/${project_key}`);
                if (response_format === ResponseFormat.JSON) {
                    return { content: [{ type: "text", text: jsonOutput(project) }] };
                }
                const text = [
                    `# Project: ${project.name}`,
                    "",
                    `- **Key**: ${project.projectKey}`,
                    `- **ID**: ${project.id}`,
                    `- **Archived**: ${project.archived}`,
                    `- **Text Format**: ${project.textFormattingRule}`,
                    `- **Subtasking**: ${project.subtaskingEnabled}`,
                ].join("\n");
                return { content: [{ type: "text", text }] };
            }
            const params = {};
            if (archived !== undefined)
                params["archived"] = archived;
            const projects = await apiGet("/projects", params);
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(projects) }] };
            }
            const lines = [`# Projects (${projects.length})`, ""];
            for (const p of projects) {
                lines.push(`## ${p.name} [${p.projectKey}]`);
                lines.push(`- **ID**: ${p.id} | **Archived**: ${p.archived}`);
                lines.push("");
            }
            return {
                content: [
                    { type: "text", text: truncateIfNeeded(lines.join("\n"), "projects") },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
    server.registerTool("backlog_get_project_config", {
        title: "Get Backlog Project Configuration",
        description: `Returns all configuration for a project in a single call: statuses, priorities, resolutions, issue types, categories, milestones/versions, and custom fields (with their types and list options).

IMPORTANT: Always call this BEFORE creating or updating issues so you know valid status IDs, issue type IDs, category IDs, and custom field IDs/values.

Args:
  - project_key (required): Project key string (e.g., "MYPROJ") or numeric project ID
  - response_format: 'markdown' (default) or 'json'

Returns: { statuses, priorities, resolutions, issueTypes, categories, versions, customFields }
  - customFields includes: id, name, typeId, required, items (for list-type fields)`,
        inputSchema: z.object({
            project_key: z
                .union([z.string(), z.number()])
                .describe("Project key string (e.g., 'MYPROJ') or numeric project ID"),
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
    }, async ({ project_key, response_format }) => {
        try {
            const key = project_key;
            const [statuses, priorities, resolutions, issueTypes, categories, versions, customFields] = await Promise.all([
                apiGet(`/projects/${key}/statuses`),
                apiGet("/priorities"),
                apiGet("/resolutions"),
                apiGet(`/projects/${key}/issueTypes`),
                apiGet(`/projects/${key}/categories`),
                apiGet(`/projects/${key}/versions`),
                apiGet(`/projects/${key}/customFields`),
            ]);
            const config = {
                statuses,
                priorities,
                resolutions,
                issueTypes,
                categories,
                versions,
                customFields,
            };
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(config) }] };
            }
            const lines = [`# Project Config: ${key}`, ""];
            lines.push("## Statuses");
            for (const s of statuses)
                lines.push(`- **${s.name}** (id: ${s.id})`);
            lines.push("");
            lines.push("## Issue Types");
            for (const t of issueTypes)
                lines.push(`- **${t.name}** (id: ${t.id})`);
            lines.push("");
            lines.push("## Priorities");
            for (const p of priorities)
                lines.push(`- **${p.name}** (id: ${p.id})`);
            lines.push("");
            lines.push("## Resolutions");
            for (const r of resolutions)
                lines.push(`- **${r.name}** (id: ${r.id})`);
            lines.push("");
            lines.push("## Categories");
            for (const c of categories)
                lines.push(`- **${c.name}** (id: ${c.id})`);
            lines.push("");
            lines.push("## Versions / Milestones");
            for (const v of versions)
                lines.push(`- **${v.name}** (id: ${v.id}) archived: ${v.archived}`);
            lines.push("");
            lines.push("## Custom Fields");
            for (const cf of customFields) {
                lines.push(`- **${cf.name}** (id: ${cf.id}, typeId: ${cf.typeId}, required: ${cf.required})`);
                if (cf.items && cf.items.length > 0) {
                    for (const item of cf.items) {
                        lines.push(`  - ${item.name} (id: ${item.id})`);
                    }
                }
            }
            return {
                content: [
                    { type: "text", text: truncateIfNeeded(lines.join("\n"), "config") },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
    server.registerTool("backlog_get_project_activities", {
        title: "Get Backlog Project Activities",
        description: `Returns the recent activity log for a project — issues created/updated, comments, PRs, wiki changes, etc.

Useful for standup summaries, sprint retrospectives, and monitoring project health.

Activity type IDs:
  1=Issue created, 2=Issue updated, 3=Issue commented, 4=Issue deleted
  5=Wiki created, 6=Wiki updated, 7=Wiki deleted
  12=Git pushed, 13=Git repository created
  14=Issue bulk-updated, 15=Project joined, 16=Project left
  18=PR created, 19=PR updated, 20=PR commented, 21=PR merged

Args:
  - project_key (required): Project key string (e.g., "MYPROJ") or numeric project ID
  - activity_type_id (optional): Filter by activity type ID(s) — single number or array
  - count (optional): Max results to return (1-100, default 20)
  - min_id (optional): Return activities with ID greater than this (pagination forward)
  - max_id (optional): Return activities with ID less than this (pagination backward)
  - order (optional): "asc" or "desc" (default "desc" = newest first)
  - response_format: 'markdown' (default) or 'json'`,
        inputSchema: z.object({
            project_key: z
                .union([z.string(), z.number()])
                .describe("Project key string (e.g., 'MYPROJ') or numeric project ID"),
            activity_type_id: z
                .union([z.number().int().positive(), z.array(z.number().int().positive())])
                .optional()
                .describe("Filter by activity type ID(s). See description for type codes."),
            count: z
                .number()
                .int()
                .min(1)
                .max(100)
                .default(20)
                .describe("Max results to return (1-100, default 20)"),
            min_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Return activities with ID greater than this (pagination: get newer)"),
            max_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Return activities with ID less than this (pagination: get older)"),
            order: z
                .enum(["asc", "desc"])
                .default("desc")
                .describe("Sort order: 'desc' (newest first, default) or 'asc'"),
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
    }, async ({ project_key, activity_type_id, count, min_id, max_id, order, response_format }) => {
        try {
            const params = { count, order };
            if (min_id !== undefined)
                params["minId"] = min_id;
            if (max_id !== undefined)
                params["maxId"] = max_id;
            const typeIds = Array.isArray(activity_type_id)
                ? activity_type_id
                : activity_type_id !== undefined
                    ? [activity_type_id]
                    : undefined;
            typeIds?.forEach((id, i) => { params[`activityTypeId[${i}]`] = id; });
            const activities = await apiGet(`/projects/${project_key}/activities`, params);
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(activities) }] };
            }
            if (activities.length === 0) {
                return {
                    content: [{ type: "text", text: "No activities found for this project." }],
                };
            }
            const activityTypeLabel = {
                1: "Issue created", 2: "Issue updated", 3: "Issue commented", 4: "Issue deleted",
                5: "Wiki created", 6: "Wiki updated", 7: "Wiki deleted",
                8: "File added", 9: "File updated", 10: "File deleted",
                11: "SVN committed", 12: "Git pushed", 13: "Git repo created",
                14: "Issues bulk-updated", 15: "Member joined", 16: "Member left",
                17: "Notification", 18: "PR created", 19: "PR updated", 20: "PR commented",
                21: "PR merged",
            };
            const lines = [`# Project Activities: ${project_key} (${activities.length} returned)`, ""];
            for (const a of activities) {
                const typeLabel = activityTypeLabel[a.type] ?? `Type ${a.type}`;
                const content = a.content;
                let detail = "";
                if (content.summary) {
                    detail = content.key_id
                        ? `[${project_key}-${content.key_id}] ${content.summary}`
                        : content.summary;
                }
                else if (content.name) {
                    detail = String(content.name);
                }
                if (content.comment?.content) {
                    detail += detail ? ` — "${content.comment.content.slice(0, 80)}"` : `"${content.comment.content.slice(0, 80)}"`;
                }
                lines.push(`### ${typeLabel}${detail ? `: ${detail}` : ""}`);
                lines.push(`**By**: ${a.createdUser.name} | **At**: ${formatDateTime(a.created)} | ID: ${a.id}`);
                lines.push("");
            }
            if (activities.length === count) {
                const lastId = activities[activities.length - 1].id;
                lines.push(`> To see older activities, use max_id: ${lastId}`);
            }
            return {
                content: [{ type: "text", text: truncateIfNeeded(lines.join("\n"), "activities") }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
}
//# sourceMappingURL=projects.js.map