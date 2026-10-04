import { sendPaymentLifecycleNotice } from "../src/payment_lifecycle_notice.js";

const to = process.env.DEMO_EMAIL_TO;
if (!to) throw new Error("DEMO_EMAIL_TO is required");

const result = await sendPaymentLifecycleNotice({
  to,
  payment_id: "pay_demo_2048",
  amount_cents: 4900,
  currency: "usd",
  event: "payment_settled",
});

console.log("payment lifecycle notice sent:", result);
