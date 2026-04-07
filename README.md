# awesome-backlog-mcp

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for the [Nulab Backlog](https://backlog.com) API. Enables AI assistants like Claude to manage issues, comments, wikis, pull requests, and notifications directly in your Backlog workspace.

## Features

- **23 tools** carefully designed for AI tool-selection accuracy
- Covers the full Backlog workflow: issues, comments, wikis, git, notifications
- Smart `preview` mode before applying status changes — AI confirms assignee and fields with you first
- Custom field support on issue create/update
- Pagination and response truncation for large result sets
- Both `markdown` and `json` response formats

## Requirements

- Node.js >= 18
- A [Backlog](https://backlog.com) account with API key

## Installation

### Using npx (recommended)

No installation needed. Configure your MCP client to run it directly:

```json
{
  "mcpServers": {
    "backlog": {
      "command": "npx",
      "args": ["awesome-backlog-mcp"],
      "env": {
        "BACKLOG_HOST": "yourspace.backlog.com",
        "BACKLOG_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Using npm global install

```bash
npm install -g awesome-backlog-mcp
```

Then configure:

```json
{
  "mcpServers": {
    "backlog": {
      "command": "awesome-backlog-mcp",
      "env": {
        "BACKLOG_HOST": "yourspace.backlog.com",
        "BACKLOG_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Configuration

| Environment Variable | Required | Description |
|---|---|---|
| `BACKLOG_HOST` | Yes | Your Backlog space hostname, e.g. `yourspace.backlog.com` |
| `BACKLOG_API_KEY` | Yes | Your Backlog API key (Settings → Personal Settings → API) |

## Claude Desktop Setup

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "backlog": {
      "command": "npx",
      "args": ["awesome-backlog-mcp"],
      "env": {
        "BACKLOG_HOST": "yourspace.backlog.com",
        "BACKLOG_API_KEY": "your-api-key"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

## Available Tools

### Space & Users
| Tool | Description |
|---|---|
| `backlog_get_space` | Get space information (name, timezone, language) |
| `backlog_get_myself` | Get the authenticated user's profile |
| `backlog_get_users` | List all space users or users in a specific project |

### Projects
| Tool | Description |
|---|---|
| `backlog_get_projects` | List all projects or get a single project |
| `backlog_get_project_config` | Get all project config in one call: statuses, issue types, priorities, categories, versions, custom fields |

### Issues
| Tool | Description |
|---|---|
| `backlog_search_issues` | Search and filter issues with rich criteria |
| `backlog_get_issue` | Get full details of a single issue |
| `backlog_create_issue` | Create a new issue |
| `backlog_update_issue` | Update an issue (with preview/confirm flow for status changes) |
| `backlog_delete_issue` | Delete an issue |

### Comments
| Tool | Description |
|---|---|
| `backlog_get_comments` | List comments on an issue |
| `backlog_add_comment` | Add a comment to an issue |
| `backlog_update_comment` | Update a comment |
| `backlog_delete_comment` | Delete a comment |

### Wiki
| Tool | Description |
|---|---|
| `backlog_get_wikis` | List wiki pages or get a single page with content |
| `backlog_create_wiki` | Create a new wiki page |
| `backlog_update_wiki` | Update a wiki page |

### Git & Pull Requests
| Tool | Description |
|---|---|
| `backlog_get_git_repositories` | List git repositories in a project |
| `backlog_get_pull_requests` | List pull requests or get a single PR |
| `backlog_add_pull_request` | Create a pull request |

### Notifications
| Tool | Description |
|---|---|
| `backlog_get_notifications` | List notifications or get unread count |
| `backlog_mark_notification_as_read` | Mark one or all notifications as read |

### Attachments
| Tool | Description |
|---|---|
| `backlog_upload_attachment` | Upload a file; returns an attachment ID for use in issue create/update |

## Usage Examples

### Search issues assigned to me

```
Find all open issues assigned to me in the MYPROJ project
```

### Create an issue with custom fields

```
Create a bug in MYPROJ: title "Login fails on Safari", priority High, assign to me
```

### Update issue status with confirmation

When you ask Claude to change an issue's status, it will:
1. Show a **preview** of current state and proposed changes
2. Ask you to confirm the assignee and any additional fields
3. Apply the update only after your confirmation

### Get project configuration

```
What issue types and statuses are available in the MYPROJ project?
```

## Development

```bash
# Clone and install
git clone https://github.com/kaeltrn/awesome-backlog-mcp.git
cd awesome-backlog-mcp
npm install

# Build
npm run build

# Dev mode (auto-reload)
npm run dev
```

## License

MIT
