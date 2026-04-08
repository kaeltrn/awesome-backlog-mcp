import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import FormData from "form-data";
import fs from "fs";
import { backlogClient, apiGet } from "../services/backlog-client.js";
import { handleApiError } from "../utils/error-handler.js";
import { formatDateTime, jsonOutput } from "../utils/formatters.js";
import { ResponseFormat, type BacklogAttachment } from "../types.js";

export function registerAttachmentTools(server: McpServer): void {
  server.registerTool(
    "backlog_get_issue_attachments",
    {
      title: "Get Issue Attachments",
      description: `Returns the list of attachments on an issue, with download URLs.

The download URLs can be opened directly in a browser to view or download the file.

Args:
  - issue_key (required): Issue ID or key (e.g., "MYPROJ-123")
  - response_format: 'markdown' (default) or 'json'

Returns: id, name, size, uploader, uploaded date, and a direct download URL for each attachment`,
      inputSchema: z.object({
        issue_key: z
          .union([z.string(), z.number()])
          .describe("Issue ID or key (e.g., 'MYPROJ-123')"),
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
    async ({ issue_key, response_format }) => {
      try {
        const attachments = await apiGet<BacklogAttachment[]>(
          `/issues/${issue_key}/attachments`
        );

        if (attachments.length === 0) {
          return {
            content: [{ type: "text", text: "No attachments found for this issue." }],
          };
        }

        const host = process.env["BACKLOG_HOST"];
        const apiKey = process.env["BACKLOG_API_KEY"];

        const withUrls = attachments.map((a) => ({
          ...a,
          download_url: `https://${host}/api/v2/issues/${issue_key}/attachments/${a.id}?apiKey=${apiKey}`,
        }));

        if (response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: jsonOutput(withUrls) }] };
        }

        const lines = [`# Attachments for ${issue_key} (${attachments.length})`, ""];
        for (const a of withUrls) {
          lines.push(`### ${a.name}`);
          lines.push(`- **ID**: ${a.id}`);
          lines.push(`- **Size**: ${(a.size / 1024).toFixed(1)} KB`);
          lines.push(`- **Uploaded by**: ${a.createdUser.name} on ${formatDateTime(a.created)}`);
          lines.push(`- **Download URL**: ${a.download_url}`);
          lines.push("");
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "backlog_upload_attachment",
    {
      title: "Upload Attachment to Backlog",
      description: `Uploads a file as an attachment. The returned attachment ID can then be used when creating or updating issues.

Typical workflow:
1. Call this tool with the local file path to upload
2. Note the returned attachment ID
3. Use the attachment ID in backlog_create_issue or backlog_update_issue

Args:
  - file_path (required): Absolute path to the local file to upload

Returns: attachment ID and file name (use the ID in issue create/update calls)`,
      inputSchema: z.object({
        file_path: z
          .string()
          .min(1)
          .describe("Absolute path to the local file to upload"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ file_path }) => {
      try {
        if (!fs.existsSync(file_path)) {
          return {
            content: [{ type: "text", text: `Error: File not found: ${file_path}` }],
          };
        }

        const form = new FormData();
        form.append("file", fs.createReadStream(file_path));

        const response = await backlogClient.post<BacklogAttachment>(
          "/space/attachment",
          form,
          {
            headers: form.getHeaders(),
          }
        );

        const attachment = response.data;
        return {
          content: [
            {
              type: "text",
              text: [
                `# Attachment Uploaded`,
                "",
                `- **ID**: ${attachment.id}`,
                `- **Name**: ${attachment.name}`,
                `- **Size**: ${attachment.size} bytes`,
                "",
                `Use attachment ID **${attachment.id}** in backlog_create_issue or backlog_update_issue.`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
