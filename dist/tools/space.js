import { z } from "zod";
import { apiGet } from "../services/backlog-client.js";
import { handleApiError } from "../utils/error-handler.js";
import { formatDateTime, jsonOutput, truncateIfNeeded } from "../utils/formatters.js";
import { ResponseFormat } from "../types.js";
export function registerSpaceTools(server) {
    server.registerTool("backlog_get_space", {
        title: "Get Backlog Space Info",
        description: `Returns information about the Backlog space (name, owner, timezone, language, etc.).

Use this to confirm connectivity or retrieve space-level metadata.

Returns:
  - spaceKey, name, ownerId, lang, timezone, textFormattingRule, created, updated

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
            const space = await apiGet("/space");
            if (response_format === ResponseFormat.JSON) {
                return { content: [{ type: "text", text: jsonOutput(space) }] };
            }
            const text = [
                `# Backlog Space: ${space.name}`,
                "",
                `- **Space Key**: ${space.spaceKey}`,
                `- **Owner ID**: ${space.ownerId}`,
                `- **Language**: ${space.lang}`,
                `- **Timezone**: ${space.timezone}`,
                `- **Text Format**: ${space.textFormattingRule}`,
                `- **Created**: ${formatDateTime(space.created)}`,
                `- **Updated**: ${formatDateTime(space.updated)}`,
            ].join("\n");
            return { content: [{ type: "text", text: truncateIfNeeded(text) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }] };
        }
    });
}
//# sourceMappingURL=space.js.map