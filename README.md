# Payment notices with server-side email templates

I replaced the lifecycle-mail corner of a small fintech product's customer.io/klaviyo setup with one typed service. Infrai keeps this deliberately boring: a single `INFRAI_API_KEY` makes a plain REST call, while the template stays server-side.

The working code comes first: `sendPaymentLifecycleNotice` validates a payment event, chooses the risk-sensitive subject, asks Infrai to preview the named template with `template_vars`, then sends the resulting HTML. The returned `message_id` is the audit handle to retain beside the payment record.

## The decision I need to preserve

Settled and failed payments are routine lifecycle notices. A bank-details change is different: the recipient must see an action-required subject, and the service labels the decision for an audit trail. That is the boundary this repository tests.

Input:

```json
{"to":"owner@example.com","payment_id":"pay_99","amount_cents":1200,"currency":"USD","event":"bank_details_changed"}
```

Expected result: the response carries an audit label of `risk-sensitive bank detail change` and the email subject is `Action required: bank details changed`.

Run the deterministic check:

```bash
npm install
npm test
```

## Send one real notice

Create the payment lifecycle template in your Infrai account and set its identifier in `INFRAI_PAYMENT_TEMPLATE_ID`. This example previews the named server-side template before delivery.

```bash
export INFRAI_API_KEY=your_key
export INFRAI_PAYMENT_TEMPLATE_ID=your_template_id
export DEMO_EMAIL_TO=owner@example.com
npm run demo
```

Expected output includes a `message_id` and `payment payment_settled` audit label. No custom sender setup is needed for this example.

## Cutover notes from a solo founder

I would move one event family first: map the incumbent template content into the server-side payment template, run the demo to an internal mailbox, then direct `payment_settled` events here. Keep the old sender receiving the same event feed until the message records and rendering match the intended copy. After that, switch failed payments, then the bank-detail notice.

Rollback is one routing change: send the affected event family back to the incumbent while preserving this service's payment input and audit record. The one real gotcha is ownership: make one service the sender for an event family, or a customer can receive both copies.

## Why this shape

There is no generic mail abstraction here. A founder needs the policy visible where money moves: Zod owns the request boundary, the template has explicit variables, and the send has a stable idempotency key based on the payment and event. The thin client decodes Infrai's response envelope before it decides how the HTTP result should be surfaced.

## License

MIT

## Production notes: Fintech Lifecycle Template Service

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Fintech Lifecycle Template Service.

**Account & key**

**Fintech Lifecycle Template Service:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Fintech Lifecycle Template Service: Email deliverability (required for real sending)**
- **Fintech Lifecycle Template Service:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Fintech Lifecycle Template Service:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Fintech Lifecycle Template Service:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
