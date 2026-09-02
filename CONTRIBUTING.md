# Contributing

Thank you for improving this integration reference. The repository documents a
third-party API, so accuracy is more important than coverage or convenience.

## Before opening a change

1. Read the current [H2H reference](./docs/reference/h2h-api.md) and relevant
   guide before changing an example.
2. Keep provider-published behavior distinct from merchant-specific conventions.
   For example, `courir_id: 1` is an account agreement, not a universal API
   rule.
3. Do not add credentials, personal data, live transaction identifiers, or
   unverified response fields.
4. Preserve API spelling exactly, including provider field names such as
   `courir_id` and `reff_id`.

## Documentation changes

- Update the endpoint reference when an endpoint, request field, or response
  example changes.
- Update `openapi/autolaris-h2h.openapi.json` in the same change when a
  published contract changes.
- Link to the primary source: a current Postman collection, provider support
  response, or a reproducible sanitized request/response.
- Label inference, account-specific behavior, and unknown provider behavior
  explicitly. Do not promote an observed success response into a settlement
  guarantee.

## Local validation

Run before opening a pull request:

```bash
npm test
```

The validator checks Markdown links and anchors, code-fence balance, endpoint
coverage, OpenAPI references, and likely credential leakage.

## Pull requests

Keep each pull request focused. Describe the source of truth, which files were
updated, and any behavior that still requires confirmation from AutoLaris.
