import axios from "axios";
import http from "http";
import https from "https";
function getEnv(key) {
    const value = process.env[key];
    if (!value) {
        console.error(`ERROR: ${key} environment variable is required`);
        process.exit(1);
    }
    return value;
}
function createBacklogClient() {
    const host = getEnv("BACKLOG_HOST");
    const apiKey = getEnv("BACKLOG_API_KEY");
    const client = axios.create({
        baseURL: `https://${host}/api/v2`,
        timeout: 30000,
        adapter: "http", // Force Node.js http adapter — avoids "fetch failed" in axios 1.7+
        httpAgent: new http.Agent({ keepAlive: true }),
        httpsAgent: new https.Agent({ keepAlive: true }),
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
    });
    // Inject API key on every request
    client.interceptors.request.use((config) => {
        config.params = { ...config.params, apiKey };
        return config;
    });
    return client;
}
export const backlogClient = createBacklogClient();
/**
 * Backlog API write operations (POST/PATCH) require application/x-www-form-urlencoded,
 * NOT JSON — especially for dynamic keys like customField_xxx.
 * null values are sent as empty string (Backlog's way to clear a field).
 */
function toFormEncoded(data) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined)
            continue;
        if (value === null) {
            params.append(key, "");
        }
        else {
            params.append(key, String(value));
        }
    }
    return params;
}
export async function apiGet(path, params) {
    const response = await backlogClient.get(path, { params });
    return response.data;
}
export async function apiPost(path, data, params) {
    const response = await backlogClient.post(path, data ? toFormEncoded(data) : undefined, {
        params,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return response.data;
}
export async function apiPatch(path, data) {
    const response = await backlogClient.patch(path, data ? toFormEncoded(data) : undefined, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    return response.data;
}
export async function apiDelete(path, params) {
    const response = await backlogClient.delete(path, { params });
    return response.data;
}
//# sourceMappingURL=backlog-client.js.map