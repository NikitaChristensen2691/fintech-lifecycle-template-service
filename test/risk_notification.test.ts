import assert from "node:assert/strict";
import test from "node:test";
import { notificationDecision } from "../src/payment_lifecycle_notice.js";

test("bank detail changes receive the action-required subject and audit label", () => {
  process.env.INFRAI_PAYMENT_TEMPLATE_ID = "template_demo";
  const decision = notificationDecision({
    to: "owner@example.com",
    payment_id: "pay_99",
    amount_cents: 1200,
    currency: "USD",
    event: "bank_details_changed",
  });

  assert.equal(decision.subject, "Action required: bank details changed");
  assert.equal(decision.auditLabel, "risk-sensitive bank detail change");
});
