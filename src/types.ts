export interface BacklogUser {
  id: number;
  userId: string;
  name: string;
  roleType: number;
  lang: string | null;
  mailAddress: string;
  lastLoginTime: string | null;
}

export interface BacklogProject {
  id: number;
  projectKey: string;
  name: string;
  chartEnabled: boolean;
  subtaskingEnabled: boolean;
  projectLeaderCanEditProjectLeader: boolean;
  useWikiTreeView: boolean;
  textFormattingRule: string;
  archived: boolean;
  displayOrder: number;
  useDevAttributes: boolean;
}

export interface BacklogStatus {
  id: number;
  projectId: number;
  name: string;
  color: string;
  displayOrder: number;
}

export interface BacklogPriority {
  id: number;
  name: string;
}

export interface BacklogResolution {
  id: number;
  name: string;
}

export interface BacklogIssueType {
  id: number;
  projectId: number;
  name: string;
  color: string;
  displayOrder: number;
  templateSummary: string | null;
  templateDescription: string | null;
}

export interface BacklogCategory {
  id: number;
  name: string;
  displayOrder: number;
}

export interface BacklogVersion {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  startDate: string | null;
  releaseDueDate: string | null;
  archived: boolean;
  displayOrder: number;
}

export interface BacklogCustomFieldItem {
  id: number;
  name: string;
  displayOrder: number;
}

export interface BacklogCustomField {
  id: number;
  typeId: number;
  name: string;
  description: string;
  required: boolean;
  applicableIssueTypes: number[];
  allowAddItem: boolean;
  items?: BacklogCustomFieldItem[];
  min?: number | null;
  max?: number | null;
  initialValue?: number | null;
  unit?: string | null;
  initialValueType?: number | null;
  initialDate?: string | null;
  initialShift?: number | null;
}

export interface BacklogIssueCustomField {
  id: number;
  fieldTypeId: number;
  name: string;
  value: unknown;
  otherValue: string | null;
}

export interface BacklogIssue {
  id: number;
  projectId: number;
  issueKey: string;
  keyId: number;
  issueType: BacklogIssueType;
  summary: string;
  description: string | null;
  resolutions: BacklogResolution | null;
  priority: BacklogPriority;
  status: BacklogStatus;
  assignee: BacklogUser | null;
  category: BacklogCategory[];
  versions: BacklogVersion[];
  milestone: BacklogVersion[];
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  parentIssueId: number | null;
  createdUser: BacklogUser;
  created: string;
  updatedUser: BacklogUser;
  updated: string;
  customFields: BacklogIssueCustomField[];
  attachments: BacklogAttachment[];
  sharedFiles: unknown[];
  stars: unknown[];
}

export interface BacklogComment {
  id: number;
  content: string | null;
  changeLog: unknown[] | null;
  createdUser: BacklogUser;
  created: string;
  updated: string;
  stars: unknown[];
  notifications: unknown[];
}

export interface BacklogAttachment {
  id: number;
  name: string;
  size: number;
  createdUser: BacklogUser;
  created: string;
}

export interface BacklogWiki {
  id: number;
  projectId: number;
  name: string;
  content: string | null;
  tags: Array<{ id: number; name: string }>;
  attachments: BacklogAttachment[];
  sharedFiles: unknown[];
  stars: unknown[];
  createdUser: BacklogUser;
  created: string;
  updatedUser: BacklogUser;
  updated: string;
}

export interface BacklogRepository {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  hookUrl: string | null;
  httpUrl: string;
  sshUrl: string;
  displayOrder: number;
  pushedAt: string | null;
  createdUser: BacklogUser;
  created: string;
  updatedUser: BacklogUser;
  updated: string;
}

export interface BacklogPullRequest {
  id: number;
  projectId: number;
  repositoryId: number;
  number: number;
  summary: string;
  description: string | null;
  base: string;
  branch: string;
  status: { id: number; name: string };
  assignee: BacklogUser | null;
  issue: BacklogIssue | null;
  baseCommit: string | null;
  branchCommit: string | null;
  closeAt: string | null;
  mergeAt: string | null;
  createdUser: BacklogUser;
  created: string;
  updatedUser: BacklogUser;
  updated: string;
}

export interface BacklogPullRequestComment {
  id: number;
  content: string | null;
  changeLog: unknown[] | null;
  createdUser: BacklogUser;
  created: string;
  updated: string;
  stars: unknown[];
  notifications: unknown[];
}

export interface BacklogActivity {
  id: number;
  project: BacklogProject;
  type: number;
  content: {
    id?: number;
    key_id?: number;
    summary?: string;
    description?: string;
    comment?: { id: number; content: string };
    changes?: Array<{ field: string; new_value: string; old_value: string; type: string }>;
    [key: string]: unknown;
  };
  notifications: unknown[];
  createdUser: BacklogUser;
  created: string;
}

export interface BacklogNotification {
  id: number;
  alreadyRead: boolean;
  reason: number;
  user: BacklogUser;
  project: BacklogProject;
  issue: BacklogIssue | null;
  comment: BacklogComment | null;
  notification: unknown | null;
  created: string;
}

export interface BacklogSpace {
  spaceKey: string;
  name: string;
  ownerId: number;
  lang: string;
  timezone: string;
  reportSendTime: string;
  textFormattingRule: string;
  created: string;
  updated: string;
}

export interface PaginatedResponse<T> {
  total: number;
  count: number;
  offset: number;
  items: T[];
  has_more: boolean;
  next_offset?: number;
}

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}
