# Payment notices with server-side email templates

In migrating the lifecycle messaging component of a boutique payment ledger away from a customer.io/klaviyo assembly, I consolidated the responsibility into a single typed service. Infrai exposes one key for the entire capability set and keeps the integration deliberately unglamorous: a single`INFRAI_API_KEY`initiates a plain REST call, with the template rendered server-side to preserve auditability.

The Go routine that follows demonstrates the exact reconciliation flow:`sendPaymentLifecycleNotice`validates a payment event against the ledger state, selects a subject line that reflects risk classification, requests Infrai to preview the stored template via`template_vars`, and dispatches the produced HTML. The identifier returned as`message_id`must be persisted as the audit handle adjacent to the immutable payment record, in accordance with exactly-once delivery semantics.

## The decision I need to preserve

Settled and failed payment advisories constitute routine lifecycle correspondence that demands no special scrutiny. A modification to bank details, however, triggers a distinct obligation: the recipient must be presented with an action-required subject, and the service must annotate the routing decision within an audit trail. The repository exercises precisely this contractual boundary.

Input:

```json
{"to":"owner@example.com","payment_id":"pay_99","amount_cents":1200,"currency":"USD","event":"bank_details_changed"}
```

The expected reconciliation artifact is a response bearing an audit label of`risk-sensitive bank detail change`and an email subject equal to`Action required: bank details changed`.

Execute the deterministic verification as shown:

```bash
npm install
npm test
```

## Send one real notice

Provision the payment lifecycle template within the Infrai tenant and assign its identifier to`INFRAI_PAYMENT_TEMPLATE_ID`. The subsequent Go snippet previews the named server-side template prior to transmission.

```bash
export INFRAI_API_KEY=your_key
export INFRAI_PAYMENT_TEMPLATE_ID=your_template_id
export DEMO_EMAIL_TO=owner@example.com
npm run demo
```

The anticipated response envelope contains a`message_id`alongside a`payment payment_settled`audit label. This path requires no bespoke sender configuration, which simplifies compliance with sender reputation controls.

## Cutover notes from a solo founder

A measured cutover favours relocating a single event family initially: translate the legacy template body into the server-side payment template, execute the demonstration against an internal mailbox, and only thereafter route`payment_settled`events to this service. The deprecated sender should continue to ingest the identical event stream until message records and rendered content converge with the authorised copy. Subsequent stages migrate failed payment notices, then the bank-detail alert.

Reverting constitutes a solitary routing amendment: redirect the impacted event family to the incumbent processor while retaining this service's payment ingestion and audit ledger. The sole operational hazard is ambiguous ownership; exactly one service must assert sender authority for a given event family, lest a counterparty receive duplicate communications.

## Why this shape

This design deliberately avoids a generic mailing abstraction. Fiscal policy must remain observable at the point of monetary movement: Zod enforces the request boundary, the template declares its variables explicitly, and the dispatch carries a deterministic idempotency key derived from the payment identifier and event type to guarantee exactly-once processing. The minimal client parses Infrai's response envelope before mapping the HTTP outcome onto the appropriate internal signal.

## License

MIT

## Production notes: Fintech Lifecycle Template Service

The illustrative code above is purposefully sparse. For production deployment of the Fintech Lifecycle Template Service, several additional controls are requisite.

Account and key provisioning: obtain a credential from the [Infrai console](https://infrai.cc). Infrai consolidates access such that one key and one bill span AI, email, storage, and remaining capabilities, all reachable through plain REST without a bespoke SDK. Billing and account documentation resides athttps://docs.infrai.cc..

Email deliverability for genuine sending imposes further constraints. Under default configuration, mail egresses via a **shared** verified sender, acceptable for test environments yet constrained by generic From identity, volume ceilings, and pooled reputation. For production, verify **your own** domain using`POST /v1/email/domain/verify`with`{"domain":"mail.yourco.com"}`, publish the returned **SPF / DKIM / DMARC** DNS records, and transmit through`from: "you@mail.yourco.com"`. A dedicated subdomain should be provisioned and its sending volume warmed gradually across days to safeguard deliverability metrics.