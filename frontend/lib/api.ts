const configuredBase = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_BASE_URL = configuredBase?.replace(/\/+$/, "") ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly kind?: "notConfigured" | "unreachable" | "response",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiConfigured() {
  return API_BASE_URL.length > 0;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!isApiConfigured()) {
    throw new ApiError("Backend API URL is not configured.", undefined, "notConfigured");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("The backend API is unavailable.", undefined, "unreachable");
  }

  if (!response.ok) {
    let message = `API error (${response.status})`;
    try {
      const payload = (await response.json()) as {
        detail?: string;
        message?: string;
      };
      message = payload.detail ?? payload.message ?? message;
    } catch {
      // 非 JSON 錯誤回應保留安全且清楚的狀態訊息。
    }
    throw new ApiError(message, response.status, "response");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function extractItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["items", "data", "results"]) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
  }
  return [];
}

export function displayError(
  error: unknown,
  messages?: {
    notConfigured: string;
    unreachable: string;
    response: string;
    unexpected: string;
  },
) {
  if (error instanceof ApiError && messages) {
    if (error.kind === "notConfigured") return messages.notConfigured;
    if (error.kind === "unreachable") return messages.unreachable;
    if (error.kind === "response" && !error.message.startsWith("API error")) {
      return error.message;
    }
    if (error.kind === "response") return `${messages.response} (${error.status})`;
  }
  return error instanceof Error ? error.message : (messages?.unexpected ?? "Something went wrong.");
}
