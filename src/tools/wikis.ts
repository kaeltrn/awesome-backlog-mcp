import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiDelete, apiGet, apiPatch, apiPost } from "../services/backlog-client.js";
import { handleApiError } from "../utils/error-handler.js";
import { formatDateTime, jsonOutput, truncateIfNeeded } from "../utils/formatters.js";
import { ResponseFormat, type BacklogWiki } from "../types.js";

function formatWiki(wiki: BacklogWiki): string {
  const lines = [
    `## ${wiki.name} (ID: ${wiki.id})`,
    `- **Project ID**: ${wiki.projectId}`,
    `- **Created by**: ${wiki.createdUser.name} on ${formatDateTime(wiki.created)}`,
    `- **Updated by**: ${wiki.updatedUser.name} on ${formatDateTime(wiki.updated)}`,
  ];

  if (wiki.tags.length > 0) {
    lines.push(`- **Tags**: ${wiki.tags.map((t) => t.name).join(", ")}`);
  }

  if (wiki.content) {
    lines.push("", "### Content", "", wiki.content);
  }

  return lines.join("\n");
}

export function registerWikiTools(server: McpServer): void {
  server.registerTool(
    "backlog_get_wikis",
    {
      title: "Get Backlog Wiki Pages",
      description: `Returns wiki pages for a project, or a single wiki page by ID.

Args:
  - project_id_or_key (required when listing): Project ID or key (e.g., "MYPROJ")
  - wiki_id (optional): Numeric wiki page ID. If provided, returns that single page with full content.
  - keyword (optional): Filter pages by keyword (only when listing)
  - response_format: 'markdown' (default) or 'json'

Returns:
  - List mode: id, name, projectId, tags, createdUser, created, updatedUser, updated
  - Single mode: Full page including content`,
      inputSchema: z.object({
        project_id_or_key: z
          .union([z.string(), z.number()])
          .optional()
          .describe("Project ID or key (required when listing pages, e.g., 'MYPROJ')"),
        wiki_id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Numeric wiki page ID. If provided, returns that single page with full content."),
        keyword: z
          .string()
          .optional()
          .describe("Filter wiki pages by keyword (only applies when listing)"),
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
    },
    async ({ project_id_or_key, wiki_id, keyword, response_format }) => {
      try {
        if (wiki_id !== undefined) {
          const wiki = await apiGet<BacklogWiki>(`/wikis/${wiki_id}`);

          if (response_format === ResponseFormat.JSON) {
            return { content: [{ type: "text", text: jsonOutput(wiki) }] };
          }

          return {
            content: [
              { type: "text", text: truncateIfNeeded(formatWiki(wiki)) },
            ],
          };
        }

        if (!project_id_or_key) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Either project_id_or_key or wiki_id is required.",
              },
            ],
          };
        }

        const params: Record<string, unknown> = { projectIdOrKey: project_id_or_key };
        if (keyword) params["keyword"] = keyword;

        const wikis = await apiGet<BacklogWiki[]>("/wikis", params);

        if (response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: jsonOutput(wikis) }] };
        }

        if (wikis.length === 0) {
          return {
            content: [{ type: "text", text: "No wiki pages found." }],
          };
        }

        const lines = [`# Wiki Pages (${wikis.length})`, ""];
        for (const wiki of wikis) {
          lines.push(`### ${wiki.name} (ID: ${wiki.id})`);
          lines.push(`Updated by ${wiki.updatedUser.name} on ${formatDateTime(wiki.updated)}`);
          if (wiki.tags.length > 0) {
            lines.push(`Tags: ${wiki.tags.map((t) => t.name).join(", ")}`);
          }
          lines.push("");
        }

        return {
          content: [
            { type: "text", text: truncateIfNeeded(lines.join("\n"), "wiki pages") },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "backlog_create_wiki",
    {
      title: "Create Backlog Wiki Page",
      description: `Creates a new wiki page in a project.

Args:
  - project_id (required): Numeric project ID
  - name (required): Wiki page title/name
  - content (required): Wiki page content (supports Markdown or BacklogWiki notation depending on project settings)
  - mail_notify (optional): If true, sends email notifications to project members (default false)
  - response_format: 'markdown' (default) or 'json'`,
      inputSchema: z.object({
        project_id: z
          .number()
          .int()
          .positive()
          .describe("Numeric project ID"),
        name: z
          .string()
          .min(1)
          .describe("Wiki page title/name"),
        content: z
          .string()
          .describe("Wiki page content"),
        mail_notify: z
          .boolean()
          .default(false)
          .describe("Send email notifications to project members (default false)"),
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
    },
    async ({ project_id, name, content, mail_notify, response_format }) => {
      try {
        const wiki = await apiPost<BacklogWiki>("/wikis", {
          projectId: project_id,
          name,
          content,
          mailNotify: mail_notify,
        });

        if (response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: jsonOutput(wiki) }] };
        }

        return {
          content: [
            {
              type: "text",
              text: `# Wiki Page Created\n\n${formatWiki(wiki)}`,
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "backlog_update_wiki",
    {
      title: "Update Backlog Wiki Page",
      description: `Updates an existing wiki page's name or content.

Args:
  - wiki_id (required): Numeric wiki page ID
  - name (optional): New page title
  - content (optional): New page content
  - mail_notify (optional): If true, sends email notifications to project members
  - response_format: 'markdown' (default) or 'json'`,
      inputSchema: z.object({
        wiki_id: z
          .number()
          .int()
          .positive()
          .describe("Numeric wiki page ID"),
        name: z
          .string()
          .min(1)
          .optional()
          .describe("New page title"),
        content: z
          .string()
          .optional()
          .describe("New page content"),
        mail_notify: z
          .boolean()
          .optional()
          .describe("Send email notifications to project members"),
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
    },
    async ({ wiki_id, name, content, mail_notify, response_format }) => {
      try {
        const body: Record<string, unknown> = {};
        if (name !== undefined) body["name"] = name;
        if (content !== undefined) body["content"] = content;
        if (mail_notify !== undefined) body["mailNotify"] = mail_notify;

        const wiki = await apiPatch<BacklogWiki>(`/wikis/${wiki_id}`, body);

        if (response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: jsonOutput(wiki) }] };
        }

        return {
          content: [
            {
              type: "text",
              text: `# Wiki Page Updated\n\n${formatWiki(wiki)}`,
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
