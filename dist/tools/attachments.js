import { z } from "zod";
import FormData from "form-data";
import fs from "fs";
import { backlogClient } from "../services/backlog-client.js";
import { handleApiError } from "../utils/error-handler.js";
export function registerAttachmentTools(server) {
    server.registerTool("backlog_upload_attachment", {
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
    }, async ({ file_path }) => {
        try {
            if (!fs.existsSync(file_path)) {
                return {
                    content: [{ type: "text", text: `Error: File not found: ${file_path}` }],
                };
            }
            const form = new FormData();
            form.append("file", fs.createReadStream(file_path));
            const response = await backlogClient.post("/space/attachment", form, {
                headers: form.getHeaders(),
            });
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
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
}
//# sourceMappingURL=attachments.js.map