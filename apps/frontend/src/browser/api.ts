import { enteredAddress, isCanonicalInternalAddress } from "./address";

export interface Person {
  _id: string;
  name: string;
}
export interface Site {
  _id: string;
  address: string;
  title: string;
  author: string;
  publishedAt: string;
  sanitizedHtml: string;
}
export type NavigationSource = "typed" | "link";
export interface VisitInput {
  person: string;
  address: string;
  source: NavigationSource;
}
export interface BrowserApi {
  listPeople(signal?: AbortSignal): Promise<Person[]>;
  getSite(address: string, signal?: AbortSignal): Promise<Site>;
  recordVisit(visit: VisitInput, signal?: AbortSignal): Promise<void>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function id(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
}

export function createBrowserApi(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): BrowserApi {
  const base = new URL(baseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.search ||
    base.hash
  ) {
    throw new Error("NEXT_PUBLIC_API_URL must be an HTTP(S) API base URL");
  }
  const url = base.href.replace(/\/+$/, "");

  async function request(
    path: string,
    init: RequestInit = {},
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetcher(`${url}${path}`, {
        ...init,
        redirect: "error",
        credentials: "omit",
        headers: { Accept: "application/json", ...init.headers },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new ApiError(
        0,
        "Cannot reach the API. Check the connection and try again.",
      );
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      if (response.ok)
        throw new ApiError(
          response.status,
          "The API returned an invalid response.",
        );
    }
    if (!response.ok) {
      const message = object(data) ? data.message : null;
      const detail =
        typeof message === "string"
          ? message
          : Array.isArray(message) &&
              message.every((part) => typeof part === "string")
            ? message.join(". ")
            : `API request failed (${response.status}).`;
      throw new ApiError(response.status, detail);
    }
    return data;
  }

  return {
    async listPeople(signal) {
      const data = await request("/people", { signal });
      if (
        !Array.isArray(data) ||
        !data.every(
          (person) =>
            object(person) && id(person._id) && typeof person.name === "string",
        )
      ) {
        throw new ApiError(0, "The API returned an invalid people list.");
      }
      return data.map((person) => ({ _id: person._id, name: person.name }));
    },
    async getSite(input, signal) {
      const address = enteredAddress(input);
      if (!address) throw new ApiError(400, "Enter a valid internal address.");
      const data = await request(`/sites/${encodeURIComponent(address)}`, {
        signal,
      });
      if (
        !object(data) ||
        !id(data._id) ||
        data.address !== address ||
        !isCanonicalInternalAddress(data.address) ||
        typeof data.title !== "string" ||
        !id(data.author) ||
        typeof data.publishedAt !== "string" ||
        !Number.isFinite(Date.parse(data.publishedAt)) ||
        typeof data.sanitizedHtml !== "string"
      ) {
        throw new ApiError(0, "The API did not return a valid sanitized page.");
      }
      return {
        _id: data._id,
        address: data.address,
        title: data.title,
        author: data.author,
        publishedAt: data.publishedAt,
        sanitizedHtml: data.sanitizedHtml,
      };
    },
    async recordVisit(visit, signal) {
      await request("/visits", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visit),
      });
    },
  };
}
