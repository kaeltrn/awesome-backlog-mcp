import { z } from "zod";
import { apiGet } from "../services/backlog-client.js";
import { handleApiError } from "../utils/error-handler.js";
import { jsonOutput, truncateIfNeeded } from "../utils/formatters.js";
import { ResponseFormat, } from "../types.js";
export function registerProjectTools(server) {
    server.registerTool("backlog_get_projects", {
        title: "Get Backlog Projects",
        description: `Returns a list of accessible projects, or a single project by ID or key.

Use this to get project keys (e.g., "PROJ") needed for other tools.

Args:
  - project_id_or_key (optional): Project numeric ID or key string (e.g., "MYPROJ"). Omit to list all.
  - archived (optional): Filter by archived status (true/false). Only applies when listing all.
  - response_format: 'markdown' (default) or 'json'

Returns: id, projectKey, name, archived, textFormattingRule`,
        inputSchema: z.object({
            project_id_or_key: z
                .union([z.string(), z.number()])
                .optional()
                .describe("Project ID (number) or project key (string, e.g. 'MYPROJ')"),
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
    }, async ({ project_id_or_key, archived, response_format }) => {
        try {
            if (project_id_or_key !== undefined) {
                const project = await apiGet(`/projects/${project_id_or_key}`);
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
}
//# sourceMappingURL=projects.js.map