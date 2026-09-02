<div align="center">

# AutoLaris H2H Integration Reference

**A practical, independent reference for secure server-side AutoLaris H2H integrations.**

[Documentation](#start-here) · [H2H Reference](./docs/reference/h2h-api.md) · [Payment Guide](./docs/guides/payment-gateway.md) · [Integration Guide](./docs/guides/integration.md) · [OpenAPI](./openapi/autolaris-h2h.openapi.json)

[![Release](https://img.shields.io/github/v/release/ongkipro/autolaris?display_name=tag&sort=semver)](https://github.com/ongkipro/autolaris/releases)
[![Documentation validation](https://img.shields.io/badge/docs-validated-1f883d?logo=markdown&logoColor=white)](#validation)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1.0-6BA539?logo=openapiinitiative&logoColor=white)](./openapi/autolaris-h2h.openapi.json)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

</div>

It covers shipping, tracking, payment channels, Create Order, and Advice. This
repository is **not affiliated with AutoLaris**; the provider's published
Postman collection remains the upstream contract.

> **Contract snapshot:** AutoLaris Postman collection `latest`, reviewed on
> 2026-09-03. The API has no versioned path. Re-test the workflow with a
> development credential before every production rollout.

## What this repository provides

- A complete endpoint map for the eight published H2H operations.
- Verified request examples and an [OpenAPI 3.1 specification](./openapi/autolaris-h2h.openapi.json).
- A payment-only/digital profile using Create Order `/submit` where the merchant
  account explicitly supports `courir_id: 1` as non-physical.
- Safe Advice reconciliation guidance: an HTTP success alone is never proof of
  settlement.
- Copy-ready server-side examples for Astro, Next.js, Node.js, Cloudflare
  Workers, and PHP.

It does **not** provide AutoLaris credentials, an SDK, callback signatures, or
an invented mapping for undocumented provider statuses.

## Start here

1. Obtain an API key from the [AutoLaris Seller Dashboard](https://seller.autolaris.com).
2. Store it only in a server-side secret manager as `AUTOLARIS_API_KEY`; never
   expose it in browser code or commit it to Git.
3. Select the document that matches the job:

| Need | Read |
|---|---|
| Endpoint reference, fields, and response examples | [H2H API reference](./docs/reference/h2h-api.md) |
| Payment channels, QRIS/VA, Create Order, and Advice | [Payment gateway guide](./docs/guides/payment-gateway.md) |
| Framework implementation and retry/reconciliation patterns | [Integration guide](./docs/guides/integration.md) |
| Machine-readable API contract | [OpenAPI 3.1](./openapi/autolaris-h2h.openapi.json) |

## API surface

**Base URL:** `https://api-h2h.autolaris.com`

| Operation | Method | Path | Use |
|---|---:|---|---|
| Cek Ongkir | `POST` | `/api/h2h/ongkir` | Get eligible services, prices, and `courir_id` |
| Create Resi | `POST` | `/api/h2h/order` | Create a shipping waybill, regular or COD |
| Tracking | `POST` | `/api/h2h/lacak` | Read status and history by `awb` |
| Cancel Resi | `POST` | `/api/h2h/cancel` | Cancel using provider `transaction_id` |
| Create Payment | `POST` | `/api/h2h/create_payment` | Create a VA, QRIS, or e-wallet instruction |
| List Payment Channel | `GET` | `/api/h2h/list_payment` | Read channels and account-specific fees |
| Create Order | `POST` | `/api/h2h/submit` | Create order, shipment data, and payment instruction |
| Advice | `POST` | `/api/h2h/advice` | Read a transaction by provider `transaction_id` |

All requests use a server-side Bearer token:

```http
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

`Content-Type` is not needed for `GET /api/h2h/list_payment`.

## Choose the correct flow

| Use case | Required flow | Do not do |
|---|---|---|
| Physical shipping | `/ongkir` → `/order`, then `/lacak` | Hardcode a shipping `courir_id` |
| Physical shipping with payment | `/ongkir` → `/submit` | Treat shipment terms as payment settlement |
| Digital, subscription, or non-physical payment | `/list_payment` → `/submit` → `/advice` | Call `/create_payment` after the same `/submit` checkout |
| Payment instruction only | `/list_payment` → `/create_payment` → provider-confirmed reconciliation | Assume generic callback/status wording means paid |

### Payment-only / digital profile

For a merchant account that has explicitly agreed to classify `courir_id: 1` as
digital/non-physical, Create Order `/submit` can carry a payment-only purchase.
The required origin, destination, address, and dimensions remain schema metadata;
they do not request an AWB, pickup, courier booking, or dispatch in this profile.

Use `cod_value: "0"` for prepaid QRIS/VA. Persist the local `reff_id` before the
request, call `/submit` once per checkout, save the returned `transaction_id`,
and reconcile it through `/advice`. See the [complete JSON example](./docs/guides/integration.md#8-profil-create-order-payment-only).

`courir_id: 1` is a **kontrak operasional akun** (an account-specific operational
agreement), not a global guarantee from the public Postman collection. Confirm
it with AutoLaris before using it on another account.

## Quick checks

List the payment channels enabled for the account:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $AUTOLARIS_API_KEY" \
  "https://api-h2h.autolaris.com/api/h2h/list_payment"
```

Read a payment/order transaction without creating a second transaction:

```bash
curl --fail-with-body \
  -X POST \
  -H "Authorization: Bearer $AUTOLARIS_API_KEY" \
  -H "Content-Type: application/json" \
  "https://api-h2h.autolaris.com/api/h2h/advice" \
  --data '{"transaction_id":"<PROVIDER_TRANSACTION_ID>"}'
```

Every response must pass both checks below. HTTP `200` only confirms transport;
process `data` only when the provider envelope has `rc === "00"`.

```json
{
  "rc": "00",
  "ket": "Success",
  "data": {}
}
```

## Payment reconciliation safety

Advice is a read operation. A scheduler should load only local pending
transactions with a saved provider `transaction_id`, use bounded/idempotent
updates, and isolate failures per transaction.

- `02/PENDING` stays pending.
- `DELIVERED` is shipping vocabulary, not proof of payment.
- `SUCCESS` and `BERHASIL` are generic wording, not a settlement mapping.
- Move a payment to paid only for a provider-confirmed final settlement status.
- A paid transition must not automatically dispatch a physical shipment.

The complete, provider-published settlement mapping and callback contract remain
undocumented. Keep manual reconciliation available for unproven states.

## Repository layout

```text
.
├── docs/
│   ├── guides/                       # Payment and framework implementation guides
│   └── reference/                    # Endpoint-by-endpoint H2H reference
├── openapi/                          # Machine-readable API contract
├── scripts/validate-docs.mjs         # Documentation consistency checks
├── CONTRIBUTING.md                   # Documentation contribution rules
└── SECURITY.md                       # Vulnerability disclosure guidance
```

## Sumber

The [public AutoLaris Postman collection](https://documenter.getpostman.com/view/25938923/2sB2iwFuwz)
is the source for published endpoints and examples. This repository clearly
labels account-specific conventions and unresolved provider behavior.

Before a production integration, confirm with AutoLaris:

- callback payload, signature, retries, and allowed source IPs;
- final Advice settlement statuses and codes;
- timezone of `expired` values;
- idempotency behavior for `/create_payment` and `/submit`;
- complete provider error code catalog.

## Validation

This repository uses Node.js built-ins only. Run the consistency checks after
changing Markdown or OpenAPI content:

```bash
npm test
```

The validator checks JSON syntax, OpenAPI references, endpoint coverage, local
links and anchors, code-fence balance, and likely credential leakage.

## License

Released under the [MIT License](./LICENSE). AutoLaris and related marks belong
to their respective owners.
