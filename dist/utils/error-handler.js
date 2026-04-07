import { AxiosError } from "axios";
export function handleApiError(error) {
    if (error instanceof AxiosError) {
        if (error.response) {
            const status = error.response.status;
            const body = error.response.data;
            const apiMessage = body?.errors?.[0]?.message;
            switch (status) {
                case 400:
                    return `Error: Bad request. ${apiMessage ?? "Check your parameters."}`;
                case 401:
                    return "Error: Authentication failed. Check your BACKLOG_API_KEY.";
                case 403:
                    return "Error: Permission denied. You don't have access to this resource.";
                case 404:
                    return `Error: Resource not found. ${apiMessage ?? "Check the ID or key is correct."}`;
                case 429:
                    return "Error: Rate limit exceeded. Please wait before making more requests.";
                default:
                    return `Error: API request failed with status ${status}. ${apiMessage ?? ""}`.trim();
            }
        }
        else if (error.code === "ECONNABORTED") {
            return "Error: Request timed out. Please try again.";
        }
        else if (error.code === "ENOTFOUND") {
            return "Error: Cannot connect to Backlog. Check your BACKLOG_HOST.";
        }
    }
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
//# sourceMappingURL=error-handler.js.map