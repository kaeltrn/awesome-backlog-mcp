import { type AxiosInstance } from "axios";
export declare const backlogClient: AxiosInstance;
export declare function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T>;
export declare function apiPost<T>(path: string, data?: Record<string, unknown>, params?: Record<string, unknown>): Promise<T>;
export declare function apiPatch<T>(path: string, data?: Record<string, unknown>): Promise<T>;
export declare function apiDelete<T>(path: string, params?: Record<string, unknown>): Promise<T>;
//# sourceMappingURL=backlog-client.d.ts.map