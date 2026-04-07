import { z } from "zod";
import { apiGet, apiPost } from "../services/backlog-client.js";
import { handleApiError } from "../utils/error-handler.js";
import { formatDateTime, jsonOutput, truncateIfNeeded } from "../utils/formatters.js";
import { ResponseFormat } from "../types.js";
function formatRepo(repo) {
    return [
        `## ${repo.name} (ID: ${repo.id})`,
        `- **HTTP URL**: ${repo.httpUrl}`,
        `- **SSH URL**: ${repo.sshUrl}`,
        `- **Description**: ${repo.description ?? "—"}`,
        `- **Last Push**: ${formatDateTime(repo.pushedAt)}`,
    ].join("\n");
}
function formatPR(pr) {
    return [
        `## PR #${pr.number}: ${pr.summary}`,
        `- **Status**: ${pr.status.name}`,
        `- **Branch**: \`${pr.branch}\` → \`${pr.base}\``,
        `- **Assignee**: ${pr.assignee ? pr.assignee.name : "—"}`,
        `- **Created by**: ${pr.createdUser.name} on ${formatDateTime(pr.created)}`,
        `- **Updated**: ${formatDateTime(pr.updated)}`,
        ...(pr.description ? ["", "### Description", "", pr.description] : []),
    ].join("\n");
}
export function registerGitTools(server) {
    server.registerTool("backlog_get_git_repositories", {
        title: "Get Backlog Git Repositories",
        description: `Returns git repositories for a project, or a single repository by name/ID.

Args:
  - project_id_or_key (required): Project ID or key (e.g., "MYPROJ")
  - repo_id_or_name (optional): Repository ID or name. If provided, returns that single repository.
  - response_format: 'markdown' (default) or 'json'

Returns: id, name, httpUrl, sshUrl, description, pushedAt`,
        inputSchema: z.object({
            project_id_or_key: z
                .union([z.string(), z.number()])
                .describe("Project ID or key (e.g., 'MYPROJ')"),
            repo_id_or_name: z
                .union([z.string(), z.number()])
                .optional()
                .describe("Repository ID or name. Omit to list all repositories."),
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
    }, async ({ project_id_or_key, repo_id_or_name, response_format }) => {
        try {
            if (repo_id_or_name !== undefined) {
                const repo = await apiGet(`/projects/${project_id_or_key}/git/repositories/${repo_id_or_name}`);
                if (response_format === ResponseFormat.JSON) {
                    return { content: [{ type: "text", text: jsonOutput(repo) }] };
                }
                return {
                    content: [{ type: "text", text: `# Repository\n\n${formatRepo(repo)}` }],
                };
            }
            const repos = await apiGet(`/projects/${project_id_or_key}/git/repositories`);
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(repos) }] };
            }
            const lines = [`# Git Repositories (${repos.length})`, ""];
            for (const repo of repos) {
                lines.push(formatRepo(repo));
                lines.push("");
            }
            return {
                content: [
                    { type: "text", text: truncateIfNeeded(lines.join("\n"), "repositories") },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
    server.registerTool("backlog_get_pull_requests", {
        title: "Get Backlog Pull Requests",
        description: `Returns pull requests for a repository, or a single PR by number.

Args:
  - project_id_or_key (required): Project ID or key (e.g., "MYPROJ")
  - repo_id_or_name (required): Repository ID or name
  - pr_number (optional): PR number. If provided, returns that single PR with full details.
  - status_id (optional): Filter by status (1=Open, 2=Closed, 3=Merged) — only when listing
  - limit (optional): Max results (1-100, default 20)
  - offset (optional): Pagination offset (default 0)
  - response_format: 'markdown' (default) or 'json'`,
        inputSchema: z.object({
            project_id_or_key: z
                .union([z.string(), z.number()])
                .describe("Project ID or key (e.g., 'MYPROJ')"),
            repo_id_or_name: z
                .union([z.string(), z.number()])
                .describe("Repository ID or name"),
            pr_number: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("PR number. If provided, returns that single pull request."),
            status_id: z
                .array(z.number().int().min(1).max(3))
                .optional()
                .describe("Filter by status ID(s): 1=Open, 2=Closed, 3=Merged"),
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
    }, async ({ project_id_or_key, repo_id_or_name, pr_number, status_id, limit, offset, response_format, }) => {
        try {
            const basePath = `/projects/${project_id_or_key}/git/repositories/${repo_id_or_name}/pullRequests`;
            if (pr_number !== undefined) {
                const pr = await apiGet(`${basePath}/${pr_number}`);
                if (response_format === ResponseFormat.JSON) {
                    return { content: [{ type: "text", text: jsonOutput(pr) }] };
                }
                return {
                    content: [
                        { type: "text", text: truncateIfNeeded(formatPR(pr)) },
                    ],
                };
            }
            const params = { count: limit, offset };
            if (status_id?.length) {
                status_id.forEach((id, i) => {
                    params[`statusId[${i}]`] = id;
                });
            }
            const prs = await apiGet(basePath, params);
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(prs) }] };
            }
            if (prs.length === 0) {
                return {
                    content: [{ type: "text", text: "No pull requests found." }],
                };
            }
            const lines = [`# Pull Requests (${prs.length} returned)`, ""];
            for (const pr of prs) {
                lines.push(`### PR #${pr.number}: ${pr.summary}`);
                lines.push(`Status: **${pr.status.name}** | Branch: \`${pr.branch}\` → \`${pr.base}\` | By: ${pr.createdUser.name}`);
                lines.push("");
            }
            return {
                content: [
                    { type: "text", text: truncateIfNeeded(lines.join("\n"), "pull requests") },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
    server.registerTool("backlog_add_pull_request", {
        title: "Create Backlog Pull Request",
        description: `Creates a new pull request in a git repository.

Args:
  - project_id_or_key (required): Project ID or key (e.g., "MYPROJ")
  - repo_id_or_name (required): Repository ID or name
  - summary (required): PR title
  - description (required): PR description
  - base (required): Target branch name (e.g., "main")
  - branch (required): Source branch name (e.g., "feature/my-feature")
  - assignee_id (optional): Assignee user ID
  - issue_id (optional): Related Backlog issue ID to link
  - response_format: 'markdown' (default) or 'json'`,
        inputSchema: z.object({
            project_id_or_key: z
                .union([z.string(), z.number()])
                .describe("Project ID or key (e.g., 'MYPROJ')"),
            repo_id_or_name: z
                .union([z.string(), z.number()])
                .describe("Repository ID or name"),
            summary: z
                .string()
                .min(1)
                .describe("Pull request title"),
            description: z
                .string()
                .describe("Pull request description"),
            base: z
                .string()
                .min(1)
                .describe("Target/base branch name (e.g., 'main')"),
            branch: z
                .string()
                .min(1)
                .describe("Source branch name (e.g., 'feature/my-feature')"),
            assignee_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Assignee user ID"),
            issue_id: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Related Backlog issue numeric ID to link to this PR"),
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
    }, async ({ project_id_or_key, repo_id_or_name, summary, description, base, branch, assignee_id, issue_id, response_format, }) => {
        try {
            const body = { summary, description, base, branch };
            if (assignee_id !== undefined)
                body["assigneeId"] = assignee_id;
            if (issue_id !== undefined)
                body["issueId"] = issue_id;
            const pr = await apiPost(`/projects/${project_id_or_key}/git/repositories/${repo_id_or_name}/pullRequests`, body);
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(pr) }] };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `# Pull Request Created\n\n${formatPR(pr)}`,
                    },
                ],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
}
//# sourceMappingURL=git.js.map