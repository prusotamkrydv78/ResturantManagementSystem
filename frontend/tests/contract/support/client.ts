import { apiUrl } from "./env";

/** A response that failed, carrying enough to say why in an assertion message. */
export class ApiCallError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiCallError";
  }
}

/**
 * A caller holding one signed-in session.
 *
 * Deliberately a thin wrapper over fetch rather than a reuse of the app own
 * `apiFetch`. These tests exist to check what the API actually returns, so they must
 * not inherit the client that shapes, retries or reinterprets it; a bug in that
 * client would otherwise hide itself.
 */
export class Caller {
  constructor(
    readonly label: string,
    /**
     * The access token, or null for a caller with no account at all.
     *
     * Null exists for the public table ordering routes. A guest has no session, and
     * the tests have to reach those routes the way a guest does: sending a token to
     * them would test something no scanned phone ever does.
     */
    private readonly token: string | null,
  ) {}

  async get<T>(path: string): Promise<T> {
    return this.send<T>("GET", path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.send<T>("POST", path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.send<T>("PUT", path, body);
  }

  /**
   * Uploads a file as multipart, the way a browser does.
   *
   * Deliberately does not set a content type. The boundary is part of that header
   * and only the runtime knows it, so naming the type by hand produces a body the
   * server cannot parse - which is the exact mistake this route has to be proved
   * against.
   */
  async upload(
    path: string,
    file: Blob,
    fileName: string,
    field = "file",
  ): Promise<{ status: number; body: unknown }> {
    const form = new FormData();
    form.append(field, file, fileName);

    const headers: Record<string, string> = { Accept: "application/json" };

    if (this.token !== null) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers,
      body: form,
    });

    return { status: response.status, body: await readBody(response) };
  }

  /** Fetches a URL as bytes, for the routes that answer with an image. */
  async bytes(path: string): Promise<{
    status: number;
    contentType: string | null;
    cacheControl: string | null;
    length: number;
  }> {
    const response = await fetch(`${apiUrl}${path}`, {
      headers:
        this.token === null ? {} : { Authorization: `Bearer ${this.token}` },
    });

    return {
      status: response.status,
      contentType: response.headers.get("content-type"),
      cacheControl: response.headers.get("cache-control"),
      length: (await response.arrayBuffer()).byteLength,
    };
  }

  /**
   * Sends a request and returns the raw status and body without throwing, for the
   * many tests whose subject is the refusal rather than the success.
   */
  async attempt(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: unknown }> {
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: this.headers(body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    return { status: response.status, body: await readBody(response) };
  }

  private async send<T>(method: string, path: string, body?: unknown): Promise<T> {
    const { status, body: payload } = await this.attempt(method, path, body);

    if (status < 200 || status >= 300) {
      throw new ApiCallError(
        `${this.label}: ${method} ${path} returned ${status} — ${describe(payload)}`,
        status,
        payload,
      );
    }

    return payload as T;
  }

  private headers(hasBody: boolean): HeadersInit {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.token !== null) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    if (hasBody) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }
}

/**
 * A caller with no account, for the table ordering routes a guest reaches by scanning.
 *
 * Shared rather than constructed per test, because it holds nothing: there is no
 * session behind it, which is the whole point.
 */
export const guest = new Caller("guest", null);

/** Signs in and returns a caller for that account. */
export async function signIn(
  label: string,
  email: string,
  password: string,
): Promise<Caller> {
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = await readBody(response);

  if (!response.ok) {
    throw new ApiCallError(
      `Could not sign in as ${label} (${email}): ${response.status} — ${describe(body)}`,
      response.status,
      body,
    );
  }

  const token = (body as { accessToken?: string }).accessToken;

  if (!token) {
    throw new Error(`Sign-in as ${label} returned no access token.`);
  }

  return new Caller(label, token);
}

/**
 * Confirms the API is up before a suite starts, so a connection refusal reads as
 * "start the backend" rather than as a hundred unrelated failures.
 */
export async function requireApi(): Promise<void> {
  try {
    const response = await fetch(`${apiUrl}/health`);

    if (!response.ok) {
      throw new Error(`health check returned ${response.status}`);
    }
  } catch (cause) {
    throw new Error(
      [
        `The API at ${apiUrl} is not answering.`,
        "",
        "Contract tests run against a live backend. Start it first:",
        "  dotnet run --project backend/src/RestaurantManagement.Api",
        "",
        `Set RMS_API_URL if it listens somewhere other than ${apiUrl}.`,
        `Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
      ].join("\n"),
    );
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function describe(body: unknown): string {
  if (body === null) {
    return "no body";
  }

  if (typeof body === "string") {
    return body.slice(0, 300);
  }

  const problem = body as { detail?: string; title?: string };

  return problem.detail ?? problem.title ?? JSON.stringify(body).slice(0, 300);
}
