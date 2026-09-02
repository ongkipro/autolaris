# Getting Started

Use this guide to make a first server-side AutoLaris H2H integration. It is a
companion to the [endpoint reference](./reference/h2h-api.md), not a substitute
for the provider contract.

## Prerequisites

- An AutoLaris account and an API key obtained from the
  [Seller Dashboard](https://seller.autolaris.com).
- A server-side runtime. Do not call the H2H API from browser JavaScript.
- Production IP allowlisting. The published provider documentation allows up to
  five whitelisted IP addresses.
- Node.js 22 to run this repository's validation command. No package install is
  required for the documentation checks.

## 1. Clone and validate the reference

```bash
git clone https://github.com/ongkipro/autolaris.git
cd autolaris
npm test
```

The command validates the local Markdown links, OpenAPI contract, endpoint
coverage, and accidental credential patterns. It does not call AutoLaris.

## 2. Configure the API key safely

Store your own API key in the server environment or a secret manager. The name
below is a convention used by the examples in this repository:

```text
AUTOLARIS_API_KEY=<your-own-key>
```

Never commit it, expose it in a frontend bundle, or reuse a token copied from a
public example. Treat any publicly visible credential as exposed and rotate it
through its owner.

## 3. Verify the account configuration

Start by reading the payment channels enabled for the account. The channel list
and fees are account-specific, so this must precede any hardcoded checkout UI.

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $AUTOLARIS_API_KEY" \
  "https://api-h2h.autolaris.com/api/h2h/list_payment"
```

An HTTP `200` is not enough. Process the response data only when `rc` is
`"00"`.

## 4. Choose one flow

| Requirement | Start with |
|---|---|
| Quote and create physical shipment | [`/ongkir` → `/order`](./reference/h2h-api.md#1-cek-ongkir) |
| Physical shipment with a payment instruction | [`/ongkir` → `/submit`](./reference/h2h-api.md#7-create-order) |
| Digital, subscription, or non-physical payment | [`/list_payment` → `/submit` → `/advice`](./guides/integration.md#8-profil-create-order-payment-only) |
| Payment instruction without shipment | [`/list_payment` → `/create_payment`](./guides/payment-gateway.md#4-create-payment) |

For physical shipment, take `courir_id` from `/ongkir`. The non-physical
`courir_id: 1` profile is valid only when AutoLaris has approved it for the
merchant account.

## 5. Implement and verify

Use the [integration guide](./guides/integration.md) for server-side examples
in Node.js, Astro, Next.js, Cloudflare Workers, and PHP. Persist the local
`reff_id` before creating a transaction, then persist the provider identifier
returned by the API.

Before production, verify with development data that the selected channel,
request payload, expiry, and response instruction (`va`, `qr`, or `url`) match
the account. Reconcile payment status through Advice using the provider
`transaction_id`; do not treat a tracking callback or generic success wording as
payment settlement.

## Next steps

- Read the [payment gateway guide](./guides/payment-gateway.md) for fees,
  QRIS/VA handling, Advice, retries, and go-live checks.
- Read the [full H2H reference](./reference/h2h-api.md) for all request and
  response examples.
- Open an issue or pull request following [CONTRIBUTING.md](../CONTRIBUTING.md)
  if the provider contract changes.
