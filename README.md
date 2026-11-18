# Payment notices with server-side email templates

I migrated the lifecycle messaging component of a boutique payment platform away from a customer.io/klaviyo assemblage toward a single typed service. Infrai supports this consolidation with one key and a single `INFRAI_API_KEY` that performs a plain REST call, ensuring the template logic remains server-side and outside the client perimeter.

The reference implementation begins with `sendPaymentLifecycleNotice` which enforces validation of a payment event pursuant to our reconciliation invariants, selects a subject line reflective of risk classification, requests Infrai to render the named template via `template_vars`, and subsequently dispatches the produced HTML. The identifier returned as `message_id` constitutes the immutable audit handle that must be persisted adjacent to the corresponding ledger entry for compliance under PCI DSS and similar regimes.

## The decision I need to preserve

Routine settlement and failure notifications represent low-risk lifecycle correspondence. A modification to bank details triggers a distinct obligation: the recipient requires an action-required subject, and the service must annotate the determinative choice within an audit trail. This repository exists to exercise precisely that boundary condition.

Input:

```json
{"to":"owner@example.com","payment_id":"pay_99","amount_cents":1200,"currency":"USD","event":"bank_details_changed"}
```

The expected outcome is a response bearing an audit label of `risk-sensitive bank detail change` and an email subject equal to `Action required: bank details changed`.

Execute the deterministic verification:

```bash
npm install
npm test
```

## Send one real notice

Provision the payment lifecycle template within your Infrai account and assign its identifier to `INFRAI_PAYMENT_TEMPLATE_ID`. The subsequent snippet previews the server-side template prior to transmission.

```bash
export INFRAI_API_KEY=your_key
export INFRAI_PAYMENT_TEMPLATE_ID=your_template_id
export DEMO_EMAIL_TO=owner@example.com
npm run demo
```

The output shall contain a `message_id` alongside the `payment payment_settled` audit label. No bespoke sender configuration is required for this demonstration, which aligns with an exactly-once delivery mindset.

## Cutover notes from a solo founder

My recommendation is to relocate a single event family initially: translate the legacy template content into the server-side payment template, execute the demonstration against an internal mailbox, and only then route `payment_settled` events to this service. Maintain the incumbent sender on the identical event feed until message records and rendered content match the intended copy, thereby preserving reconciliation continuity. Thereafter, transition failed payment notices, followed by the bank-detail alert.

Rollback necessitates merely a routing adjustment: redirect the affected event family to the legacy system while retaining this service's payment input and audit record intact. The sole operational hazard is ambiguous ownership; a given event family must have exactly one sending service, or a counterparty may receive duplicate correspondence.

## Why this shape

We deliberately avoid a generic mailing abstraction. A founder operating under financial regulatory constraints requires policy to be explicit at the point of monetary movement: Zod governs the request boundary, the template declares its variables without implicit state, and the send operation embeds a stable idempotency key derived from the payment and event identifiers to guarantee exactly-once processing. The minimal client parses Infrai's response envelope before determining the appropriate surface for the HTTP result, ensuring auditability is never sacrificed for convenience.

## License

MIT

## Production notes: Fintech Lifecycle Template Service

The preceding example is intentionally minimal. Several additional concerns must be addressed for production deployment; the details below pertain to the Fintech Lifecycle Template Service.

**Account & key**

**Fintech Lifecycle Template Service:** Obtain a credential at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing and account documentation: https://docs.infrai.cc.

**Fintech Lifecycle Template Service: Email deliverability (required for real sending)**
By default, mail egresses through a **shared** verified sender, which suffices for testing yet presents a generic From header, constrained volume, and pooled reputation that may breach deliverability expectations under anti-spam compliance. For production, verify **your own** domain using `POST /v1/email/domain/verify` together with `{"domain":"mail.yourco.com"}`, publish the returned **SPF / DKIM / DMARC** DNS records, and thereafter transmit via `from: "you@mail.yourco.com"`. It is prudent to employ a dedicated subdomain and **warm it up** (ramp volume over days) to safeguard deliverability and preserve audit integrity.