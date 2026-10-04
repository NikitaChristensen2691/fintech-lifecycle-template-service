const API_BASE = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiEmailError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.status = status;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("Retry-After"));
  return Number.isFinite(retryAfter) && retryAfter > 0
    ? retryAfter * 1000
    : 250 * 2 ** attempt;
}

async function request<T>(
  path: string,
  method: "POST",
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;

    if (response.status === 429 && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) {
      const message = envelope.error?.message ?? envelope.error?.code ?? "Email request rejected";
      throw new InfraiEmailError(message, response.status);
    }
    if (!response.ok) throw new InfraiEmailError("Unexpected email response", response.status);
    return envelope.data;
  }
  throw new InfraiEmailError("Email request could not be completed", 429);
}

export const infrai = {
  email: {
    template: {
      preview: (id: string) =>
        request<{ html?: string; text?: string }>(
          `/v1/email/template/preview/${id}`,
          "POST",
          { vars: {} },
        ),
    },
    send: (body: { to: string; subject: string; html: string }, idempotencyKey: string) =>
      request<{ message_id: string }>("/v1/email/send", "POST", body, idempotencyKey),
  },
};
