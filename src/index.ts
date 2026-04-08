#!/usr/bin/env node
/**
 * Backlog MCP Server
 *
 * Provides 28 tools to interact with the Backlog project management API,
 * covering issues, comments, wikis, git repositories, notifications, and more.
 *
 * Required environment variables:
 *   BACKLOG_HOST    - e.g. "yourspace.backlog.com"
 *   BACKLOG_API_KEY - your Backlog API key
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerSpaceTools } from "./tools/space.js";
import { registerUserTools } from "./tools/users.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerWikiTools } from "./tools/wikis.js";
import { registerGitTools } from "./tools/git.js";
import { registerNotificationTools } from "./tools/notifications.js";
import { registerAttachmentTools } from "./tools/attachments.js";

const server = new McpServer({
  name: "awesome-backlog-mcp",
  version: "1.0.0",
});

registerSpaceTools(server);
registerUserTools(server);
registerProjectTools(server);
registerIssueTools(server);
registerCommentTools(server);
registerWikiTools(server);
registerGitTools(server);
registerNotificationTools(server);
registerAttachmentTools(server);

async function main(): Promise<void> {
  if (!process.env.BACKLOG_HOST) {
    console.error("ERROR: BACKLOG_HOST environment variable is required (e.g. yourspace.backlog.com)");
    process.exit(1);
  }
  if (!process.env.BACKLOG_API_KEY) {
    console.error("ERROR: BACKLOG_API_KEY environment variable is required");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Backlog MCP server running via stdio");
}

main().catch((error: unknown) => {
  console.error("Server error:", error);
  process.exit(1);
});
