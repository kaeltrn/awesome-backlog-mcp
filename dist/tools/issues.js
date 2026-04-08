import { z } from "zod";
import { apiDelete, apiGet, apiPatch, apiPost } from "../services/backlog-client.js";
import { handleApiError } from "../utils/error-handler.js";
import { formatDate, formatDateTime, jsonOutput, truncateIfNeeded } from "../utils/formatters.js";
import { ResponseFormat } from "../types.js";
// Accept single number OR array of numbers — AI often passes a single value
const numOrArray = z
    .union([z.number().int().positive(), z.array(z.number().int().positive())])
    .optional();
function toArray(val) {
    if (val === undefined)
        return undefined;
    return Array.isArray(val) ? val : [val];
}
function formatIssue(issue) {
    const lines = [
        `## [${issue.issueKey}] ${issue.summary}`,
        "",
        `- **Status**: ${issue.status.name} (id: ${issue.status.id})`,
        `- **Type**: ${issue.issueType.name}`,
        `- **Priority**: ${issue.priority.name}`,
        `- **Assignee**: ${issue.assignee ? `${issue.assignee.name} (id: ${issue.assignee.id})` : "Unassigned"}`,
        `- **Created by**: ${issue.createdUser.name}`,
        `- **Created**: ${formatDateTime(issue.created)}`,
        `- **Updated**: ${formatDateTime(issue.updated)}`,
        `- **Start Date**: ${formatDate(issue.startDate)}`,
        `- **Due Date**: ${formatDate(issue.dueDate)}`,
    ];
    if (issue.category.length > 0) {
        lines.push(`- **Categories**: ${issue.category.map((c) => c.name).join(", ")}`);
    }
    if (issue.versions.length > 0) {
        lines.push(`- **Versions**: ${issue.versions.map((v) => v.name).join(", ")}`);
    }
    if (issue.milestone.length > 0) {
        lines.push(`- **Milestones**: ${issue.milestone.map((m) => m.name).join(", ")}`);
    }
    if (issue.description) {
        lines.push("", "### Description", "", issue.description);
    }
    if (issue.customFields.length > 0) {
        lines.push("", "### Custom Fields");
        for (const cf of issue.customFields) {
            const val = cf.value !== null && cf.value !== undefined ? String(cf.value) : "—";
            lines.push(`- **${cf.name}**: ${val}`);
        }
    }
    return lines.join("\n");
}
export function registerIssueTools(server) {
    server.registerTool("backlog_search_issues", {
        title: "Search Backlog Issues",
        description: `Search, filter, and list issues. Supports rich filtering. Can also return just a count.

Args:
  - project_key (optional): Filter by project key string, e.g. "MYPROJ". The key is resolved to a project ID automatically.
  - status_id (optional): Filter by status ID — single number (e.g. 1) or array (e.g. [1,2]). Use backlog_get_project_config to get IDs.
  - assignee_id (optional): Filter by assignee user ID — single number or array.
  - issue_type_id (optional): Filter by issue type ID — single number or array. Use backlog_get_project_config to get IDs.
  - milestone_id (optional): Filter by milestone ID — single number or array. Use backlog_get_project_config to get IDs.
  - keyword (optional): Full-text search keyword
  - updated_since (optional): Only issues updated on or after this date (YYYY-MM-DD)
  - updated_until (optional): Only issues updated on or before this date (YYYY-MM-DD)
  - due_date_since (optional): Only issues with due date on or after this date (YYYY-MM-DD)
  - due_date_until (optional): Only issues with due date on or before this date (YYYY-MM-DD)
  - count_only (optional): If true, returns only the count of matching issues
  - limit (optional): Max results (1-100, default 20)
  - offset (optional): Pagination offset (default 0)
  - sort (optional): Sort field — "created", "updated", "dueDate", "status", "priority"
  - order (optional): "asc" or "desc" (default "desc")
  - response_format: 'markdown' (default) or 'json'`,
        inputSchema: z.object({
            project_key: z
                .string()
                .optional()
                .describe("Project key string (e.g., 'MYPROJ'). Auto-resolved to project ID."),
            status_id: numOrArray.describe("Filter by status ID(s). Pass a single number (e.g. 1) or array (e.g. [1,2]). Use backlog_get_project_config to get valid IDs."),
            assignee_id: numOrArray.describe("Filter by assignee user ID(s). Pass a single number or array."),
            issue_type_id: numOrArray.describe("Filter by issue type ID(s). Pass a single number or array. Use backlog_get_project_config to get valid IDs."),
            milestone_id: numOrArray.describe("Filter by milestone ID(s). Pass a single number or array. Use backlog_get_project_config to get valid IDs."),
            keyword: z.string().optional().describe("Full-text search keyword"),
            updated_since: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional()
                .describe("Only issues updated on or after this date (YYYY-MM-DD)"),
            updated_until: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional()
                .describe("Only issues updated on or before this date (YYYY-MM-DD)"),
            due_date_since: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional()
                .describe("Only issues with due date on or after this date (YYYY-MM-DD)"),
            due_date_until: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional()
                .describe("Only issues with due date on or before this date (YYYY-MM-DD)"),
            count_only: z
                .boolean()
                .optional()
                .describe("If true, returns only the count of matching issues"),
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
            sort: z
                .string()
                .optional()
                .describe("Sort field: 'created', 'updated', 'dueDate', 'status', 'priority'"),
            order: z
                .enum(["asc", "desc"])
                .default("desc")
                .describe("Sort order: 'asc' or 'desc' (default 'desc')"),
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
    }, async ({ project_key, status_id, assignee_id, issue_type_id, milestone_id, keyword, updated_since, updated_until, due_date_since, due_date_until, count_only, limit, offset, sort, order, response_format, }) => {
        try {
            const params = { count: limit, offset, order };
            // Resolve project key → numeric project ID (Backlog issues API only accepts projectId[])
            if (project_key) {
                const project = await apiGet(`/projects/${project_key}`);
                params["projectId[0]"] = project.id;
            }
            // Normalize single value or array → indexed params (e.g. statusId[0], statusId[1])
            toArray(status_id)?.forEach((id, i) => { params[`statusId[${i}]`] = id; });
            toArray(assignee_id)?.forEach((id, i) => { params[`assigneeId[${i}]`] = id; });
            toArray(issue_type_id)?.forEach((id, i) => { params[`issueTypeId[${i}]`] = id; });
            toArray(milestone_id)?.forEach((id, i) => { params[`milestoneId[${i}]`] = id; });
            if (keyword)
                params["keyword"] = keyword;
            if (sort)
                params["sort"] = sort;
            if (updated_since)
                params["updatedSince"] = updated_since;
            if (updated_until)
                params["updatedUntil"] = updated_until;
            if (due_date_since)
                params["dueDateSince"] = due_date_since;
            if (due_date_until)
                params["dueDateUntil"] = due_date_until;
            if (count_only) {
                const result = await apiGet("/issues/count", params);
                return { content: [{ type: "text", text: `**Issue count**: ${result.count}` }] };
            }
            const issues = await apiGet("/issues", params);
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(issues) }] };
            }
            if (issues.length === 0) {
                return {
                    content: [{ type: "text", text: "No issues found matching your criteria." }],
                };
            }
            const lines = [`# Issues (${issues.length} returned, offset: ${offset})`, ""];
            for (const issue of issues) {
                lines.push(`### [${issue.issueKey}] ${issue.summary}`);
                lines.push(`Status: **${issue.status.name}** | Priority: ${issue.priority.name} | Assignee: ${issue.assignee?.name ?? "—"} | Due: ${formatDate(issue.dueDate)}`);
                lines.push("");
            }
            if (issues.length === limit) {
                lines.push(`> Use offset: ${offset + limit} to see more results.`);
            }
            return {
                content: [{ type: "text", text: truncateIfNeeded(lines.join("\n"), "issues") }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
    server.registerTool("backlog_get_issue", {
        title: "Get Backlog Issue",
        description: `Returns full details of a single issue including description, status, assignee, custom fields, and attachments.

Args:
  - issue_key (required): Issue ID (number) or issue key (e.g., "MYPROJ-123")
  - response_format: 'markdown' (default) or 'json'

Returns: Full issue with all fields including customFields array`,
        inputSchema: z.object({
            issue_key: z
                .union([z.string(), z.number()])
                .describe("Issue numeric ID or key (e.g., 'MYPROJ-123')"),
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
    }, async ({ issue_key, response_format }) => {
        try {
            const issue = await apiGet(`/issues/${issue_key}`);
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(issue) }] };
            }
            return {
                content: [
                    { type: "text", text: truncateIfNeeded(formatIssue(issue)) },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
    server.registerTool("backlog_create_issue", {
        title: "Create Backlog Issue",
        description: `Creates a new issue in a Backlog project.

IMPORTANT: Call backlog_get_project_config first to get valid projectId, issueTypeId, statusId, priorityId, categoryId, versionId, and customField IDs.

Args:
  - project_id (required): Numeric project ID
  - summary (required): Issue title/summary
  - issue_type_id (required): Issue type ID (from backlog_get_project_config)
  - priority_id (required): Priority ID (from backlog_get_project_config)
  - description (optional): Issue body/description
  - status_id (optional): Status ID (from backlog_get_project_config)
  - assignee_id (optional): Assignee user ID
  - category_id (optional): Category ID(s) array
  - version_id (optional): Version ID(s) array
  - milestone_id (optional): Milestone ID(s) array
  - start_date (optional): Start date in "YYYY-MM-DD" format
  - due_date (optional): Due date in "YYYY-MM-DD" format
  - estimated_hours (optional): Estimated hours
  - custom_fields (optional): Array of { id, value } for custom fields
  - response_format: 'markdown' (default) or 'json'`,
        inputSchema: z.object({
            project_id: z.number().int().positive().describe("Numeric project ID"),
            summary: z.string().min(1).describe("Issue title/summary"),
            issue_type_id: z
                .number()
                .int()
                .positive()
                .describe("Issue type ID (from backlog_get_project_config)"),
            priority_id: z
                .number()
                .int()
                .positive()
                .describe("Priority ID (from backlog_get_project_config)"),
            description: z.string().optional().describe("Issue description/body"),
            status_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Status ID (from backlog_get_project_config)"),
            assignee_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Assignee user ID"),
            category_id: z
                .array(z.number().int().positive())
                .optional()
                .describe("Category ID(s)"),
            version_id: z
                .array(z.number().int().positive())
                .optional()
                .describe("Version ID(s)"),
            milestone_id: z
                .array(z.number().int().positive())
                .optional()
                .describe("Milestone ID(s)"),
            start_date: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional()
                .describe("Start date in YYYY-MM-DD format"),
            due_date: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional()
                .describe("Due date in YYYY-MM-DD format"),
            estimated_hours: z
                .number()
                .positive()
                .optional()
                .describe("Estimated hours"),
            custom_fields: z
                .array(z.object({
                id: z.number().int().positive().describe("Custom field ID"),
                value: z.unknown().describe("Custom field value"),
            }))
                .optional()
                .describe("Custom field values: [{ id, value }]. Use backlog_get_project_config to get valid field IDs and list options."),
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
    }, async ({ project_id, summary, issue_type_id, priority_id, description, status_id, assignee_id, category_id, version_id, milestone_id, start_date, due_date, estimated_hours, custom_fields, response_format, }) => {
        try {
            const body = {
                projectId: project_id,
                summary,
                issueTypeId: issue_type_id,
                priorityId: priority_id,
            };
            if (description !== undefined)
                body["description"] = description;
            if (status_id !== undefined)
                body["statusId"] = status_id;
            if (assignee_id !== undefined)
                body["assigneeId"] = assignee_id;
            if (start_date !== undefined)
                body["startDate"] = start_date;
            if (due_date !== undefined)
                body["dueDate"] = due_date;
            if (estimated_hours !== undefined)
                body["estimatedHours"] = estimated_hours;
            if (category_id?.length) {
                category_id.forEach((id, i) => {
                    body[`categoryId[${i}]`] = id;
                });
            }
            if (version_id?.length) {
                version_id.forEach((id, i) => {
                    body[`versionId[${i}]`] = id;
                });
            }
            if (milestone_id?.length) {
                milestone_id.forEach((id, i) => {
                    body[`milestoneId[${i}]`] = id;
                });
            }
            if (custom_fields?.length) {
                custom_fields.forEach((cf) => {
                    body[`customField_${cf.id}`] = cf.value;
                });
            }
            const issue = await apiPost("/issues", body);
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(issue) }] };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `# Issue Created\n\n${formatIssue(issue)}`,
                    },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
    server.registerTool("backlog_update_issue", {
        title: "Update Backlog Issue",
        description: `Updates an existing issue. Only provide fields you want to change.

WORKFLOW FOR STATUS CHANGES — ALWAYS follow these steps when changing status_id:
  1. Call with preview: true first → shows current values and proposed changes
  2. Present the preview to the user and ask them to confirm:
     - Is the assignee correct? (or who should it be assigned to?)
     - Any other fields to update? (comment, resolution, due date, etc.)
  3. Once confirmed, call again with preview: false (or omit preview) to apply

IMPORTANT: Call backlog_get_project_config first to get valid status IDs, issue type IDs, etc.

Args:
  - issue_key (required): Issue ID or key (e.g., "MYPROJ-123")
  - preview (optional): If true, shows current state + proposed changes WITHOUT applying. Use this before any status change to confirm with user. Default: false.
  - summary (optional): New title
  - description (optional): New description
  - status_id (optional): New status ID (from backlog_get_project_config)
  - assignee_id (optional): New assignee user ID. Pass null to unassign.
  - issue_type_id (optional): New issue type ID
  - priority_id (optional): New priority ID
  - resolution_id (optional): Resolution ID (use when closing/resolving an issue)
  - category_id (optional): New category ID(s)
  - version_id (optional): New version ID(s)
  - milestone_id (optional): New milestone ID(s)
  - start_date (optional): New start date in "YYYY-MM-DD"
  - due_date (optional): New due date in "YYYY-MM-DD"
  - estimated_hours (optional): New estimated hours
  - actual_hours (optional): Actual hours spent
  - custom_fields (optional): Array of { id, value } for custom fields to update
  - comment (optional): Comment to add with this update
  - response_format: 'markdown' (default) or 'json'`,
        inputSchema: z.object({
            issue_key: z
                .union([z.string(), z.number()])
                .describe("Issue ID or key (e.g., 'MYPROJ-123')"),
            preview: z
                .boolean()
                .default(false)
                .describe("If true, fetches current issue and shows a before/after diff WITHOUT applying changes. " +
                "ALWAYS set preview: true when changing status_id so user can confirm assignee and other fields first."),
            summary: z.string().optional().describe("New issue title"),
            description: z.string().optional().describe("New description"),
            status_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("New status ID (from backlog_get_project_config)"),
            assignee_id: z
                .number()
                .int()
                .nullable()
                .optional()
                .describe("New assignee user ID. Pass null to unassign."),
            issue_type_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("New issue type ID"),
            priority_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("New priority ID"),
            resolution_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Resolution ID (use when closing/resolving an issue)"),
            category_id: z
                .array(z.number().int().positive())
                .optional()
                .describe("New category ID(s)"),
            version_id: z
                .array(z.number().int().positive())
                .optional()
                .describe("New version ID(s)"),
            milestone_id: z
                .array(z.number().int().positive())
                .optional()
                .describe("New milestone ID(s)"),
            start_date: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional()
                .describe("New start date in YYYY-MM-DD format"),
            due_date: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional()
                .describe("New due date in YYYY-MM-DD format"),
            estimated_hours: z
                .number()
                .positive()
                .optional()
                .describe("New estimated hours"),
            actual_hours: z
                .number()
                .min(0)
                .optional()
                .describe("Actual hours spent"),
            custom_fields: z
                .array(z.object({
                id: z.number().int().positive().describe("Custom field ID"),
                value: z.unknown().describe("New value for the custom field"),
            }))
                .optional()
                .describe("Custom field values to update: [{ id, value }]"),
            comment: z
                .string()
                .optional()
                .describe("Comment to add alongside this update"),
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
    }, async ({ issue_key, preview, summary, description, status_id, assignee_id, issue_type_id, priority_id, resolution_id, category_id, version_id, milestone_id, start_date, due_date, estimated_hours, actual_hours, custom_fields, comment, response_format, }) => {
        try {
            // Always fetch current issue for preview, or when status is changing
            const current = await apiGet(`/issues/${issue_key}`);
            if (preview) {
                const lines = [
                    `# Preview: Changes to [${current.issueKey}] ${current.summary}`,
                    "",
                    "> ⚠️ No changes applied yet. Confirm the details below, then call again with preview: false.",
                    "",
                    "## Current State",
                    `- **Status**: ${current.status.name} (id: ${current.status.id})`,
                    `- **Assignee**: ${current.assignee ? `${current.assignee.name} (id: ${current.assignee.id})` : "Unassigned"}`,
                    `- **Type**: ${current.issueType.name}`,
                    `- **Priority**: ${current.priority.name}`,
                    `- **Due Date**: ${formatDate(current.dueDate)}`,
                    `- **Estimated Hours**: ${current.estimatedHours ?? "—"}`,
                    `- **Actual Hours**: ${current.actualHours ?? "—"}`,
                ];
                if (current.customFields.length > 0) {
                    lines.push("", "### Custom Fields (current)");
                    for (const cf of current.customFields) {
                        lines.push(`- **${cf.name}**: ${cf.value !== null && cf.value !== undefined ? String(cf.value) : "—"}`);
                    }
                }
                lines.push("", "## Proposed Changes");
                const changes = [];
                if (status_id !== undefined)
                    changes.push(`- **Status** → id: ${status_id} *(check name via backlog_get_project_config)*`);
                if (assignee_id !== undefined)
                    changes.push(`- **Assignee** → ${assignee_id === null ? "Unassigned" : `user id: ${assignee_id}`}`);
                if (summary !== undefined)
                    changes.push(`- **Summary** → "${summary}"`);
                if (description !== undefined)
                    changes.push(`- **Description** → (updated)`);
                if (issue_type_id !== undefined)
                    changes.push(`- **Issue Type** → id: ${issue_type_id}`);
                if (priority_id !== undefined)
                    changes.push(`- **Priority** → id: ${priority_id}`);
                if (resolution_id !== undefined)
                    changes.push(`- **Resolution** → id: ${resolution_id}`);
                if (due_date !== undefined)
                    changes.push(`- **Due Date** → ${due_date}`);
                if (start_date !== undefined)
                    changes.push(`- **Start Date** → ${start_date}`);
                if (estimated_hours !== undefined)
                    changes.push(`- **Estimated Hours** → ${estimated_hours}`);
                if (actual_hours !== undefined)
                    changes.push(`- **Actual Hours** → ${actual_hours}`);
                if (comment !== undefined)
                    changes.push(`- **Comment** → "${comment}"`);
                if (custom_fields?.length) {
                    for (const cf of custom_fields) {
                        changes.push(`- **Custom Field id:${cf.id}** → ${String(cf.value)}`);
                    }
                }
                if (changes.length === 0) {
                    lines.push("*(no changes specified)*");
                }
                else {
                    lines.push(...changes);
                }
                lines.push("", "## Action Required", "Please confirm:", "1. Is the **assignee** correct? If not, specify who to assign to.", "2. Are there any other fields to update? (comment, resolution, due date, etc.)", "3. Once confirmed, call `backlog_update_issue` again with `preview: false` to apply.");
                return {
                    content: [{ type: "text", text: lines.join("\n") }],
                };
            }
            // Apply the update
            const body = {};
            if (summary !== undefined)
                body["summary"] = summary;
            if (description !== undefined)
                body["description"] = description;
            if (status_id !== undefined)
                body["statusId"] = status_id;
            if (assignee_id !== undefined)
                body["assigneeId"] = assignee_id;
            if (issue_type_id !== undefined)
                body["issueTypeId"] = issue_type_id;
            if (priority_id !== undefined)
                body["priorityId"] = priority_id;
            if (resolution_id !== undefined)
                body["resolutionId"] = resolution_id;
            if (start_date !== undefined)
                body["startDate"] = start_date;
            if (due_date !== undefined)
                body["dueDate"] = due_date;
            if (estimated_hours !== undefined)
                body["estimatedHours"] = estimated_hours;
            if (actual_hours !== undefined)
                body["actualHours"] = actual_hours;
            if (comment !== undefined)
                body["comment"] = comment;
            if (category_id?.length) {
                category_id.forEach((id, i) => { body[`categoryId[${i}]`] = id; });
            }
            if (version_id?.length) {
                version_id.forEach((id, i) => { body[`versionId[${i}]`] = id; });
            }
            if (milestone_id?.length) {
                milestone_id.forEach((id, i) => { body[`milestoneId[${i}]`] = id; });
            }
            if (custom_fields?.length) {
                custom_fields.forEach((cf) => { body[`customField_${cf.id}`] = cf.value; });
            }
            const updated = await apiPatch(`/issues/${issue_key}`, body);
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(updated) }] };
            }
            return {
                content: [{ type: "text", text: `# Issue Updated\n\n${formatIssue(updated)}` }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
    server.registerTool("backlog_delete_issue", {
        title: "Delete Backlog Issue",
        description: `Permanently deletes an issue. This action cannot be undone.

Args:
  - issue_key (required): Issue ID or key (e.g., "MYPROJ-123")

Returns: The deleted issue's key and summary as confirmation.`,
        inputSchema: z.object({
            issue_key: z
                .union([z.string(), z.number()])
                .describe("Issue ID or key to delete (e.g., 'MYPROJ-123')"),
        }),
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
        },
    }, async ({ issue_key }) => {
        try {
            const issue = await apiDelete(`/issues/${issue_key}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Deleted issue **${issue.issueKey}**: ${issue.summary}`,
                    },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
}
//# sourceMappingURL=issues.js.map