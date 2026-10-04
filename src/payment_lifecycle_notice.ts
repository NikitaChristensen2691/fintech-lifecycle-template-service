import { z } from "zod";
import { InfraiEmailError, infrai } from "./infrai_email.js";

const paymentNotice = z.object({
  to: z.string().email(),
  payment_id: z.string().min(1),
  amount_cents: z.number().int().positive(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  event: z.enum(["payment_settled", "payment_failed", "bank_details_changed"]),
});

export type PaymentNotice = z.infer<typeof paymentNotice>;

export function notificationDecision(input: PaymentNotice): {
  templateId: string;
  subject: string;
  auditLabel: string;
} {
  const templateId = process.env.INFRAI_PAYMENT_TEMPLATE_ID;
  if (!templateId) throw new Error("INFRAI_PAYMENT_TEMPLATE_ID is required");

  if (input.event === "bank_details_changed") {
    return {
      templateId,
      subject: "Action required: bank details changed",
      auditLabel: "risk-sensitive bank detail change",
    };
  }
  return {
    templateId,
    subject: input.event === "payment_settled" ? "Payment settled" : "Payment needs attention",
    auditLabel: `payment ${input.event}`,
  };
}

export async function sendPaymentLifecycleNotice(rawInput: unknown) {
  const input = paymentNotice.parse(rawInput);
  const decision = notificationDecision(input);
  const preview = await infrai.email.template.preview(decision.templateId);
  const html = preview.html;
  if (!html) throw new Error("The payment template must render HTML");

  const delivery = await infrai.email.send(
    { to: input.to, subject: decision.subject, html },
    `payment-notice:${input.payment_id}:${input.event}`,
  );
  return { message_id: delivery.message_id, audit_label: decision.auditLabel };
}

export async function postPaymentLifecycleNotice(request: Request): Promise<Response> {
  try {
    const result = await sendPaymentLifecycleNotice(await request.json());
    return Response.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid payment notice" }, { status: 400 });
    if (error instanceof InfraiEmailError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
