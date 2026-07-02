# Payment Operations Runbook

This is the local operator reference for wallet-coin purchase reconciliation.
It does not replace legal, tax, provider, or content-policy review before paid
launch.

## Settlement Import

Use the provider settlement importer after downloading a provider export or API
payload:

```bash
npm run game:wallet:import-settlement -- --provider=btcpay --file=btcpay-settlement.csv --dry-run
npm run game:wallet:import-settlement -- --provider=nowpayments --file=nowpayments-payments.json --dry-run
npm run game:wallet:import-settlement -- --provider=telegram_stars --file=telegram-stars-payments.json --dry-run
```

Supported providers are `telegram_stars`, `btcpay`, and `nowpayments`.
`--format=auto` is the default: `.csv` files parse as CSV, everything else
parses as JSON. Override with `--format=csv` or `--format=json` when needed.

The importer accepts:

- normalized JSON records;
- provider JSON arrays or objects with `records`, `data`, `payments`,
  `invoices`, `items`, `rows`, or `transactions`;
- provider CSV exports with common invoice, payment, status, amount, currency,
  and settled-at headers.

Run with `--dry-run` first. A clean report has `report.ok: true`. If the report
contains issues, do not persist the import until support has reviewed the
missing local intent, status mismatch, amount mismatch, missing wallet grant, or
missing refund clawback category.

After a clean dry run, repeat the same command without `--dry-run` and include
operator/source metadata:

```bash
npm run game:wallet:import-settlement -- \
  --provider=btcpay \
  --file=btcpay-settlement.csv \
  --source-ref=btcpay-export-2026-07-02 \
  --imported-by=<operator-id>
```

## Provider Field Notes

- BTCPay: invoice ids reconcile through `Invoice ID` / `invoiceId`; checkout
  `Order ID` maps to the local wallet purchase intent id when present.
- NOWPayments: `payment_id` can be both the provider invoice and payment
  reference; `order_id` maps to the local wallet purchase intent id when
  present.
- Telegram Stars: `invoice_payload` is the local wallet purchase intent id;
  `telegram_payment_charge_id` / `provider_payment_charge_id` are payment
  references; `total_amount` is in Stars (`XTR`) units.

## Follow-Up Actions

Use `npm run game:support:money-lookup -- --query=<id-or-reference>` before any
manual intervention. Use `npm run game:support:money-action` for audited wallet
or asset grants/revokes and purchase refund marking. Attach provider evidence
JSON to manual actions whenever a settlement row is disputed.

For API-backed support tooling, set `SUPPORT_ADMIN_API_TOKEN` and pass an
explicit support actor id. To restrict operators by role, configure
`SUPPORT_ADMIN_OPERATORS_JSON`, for example:

```json
{
  "alice": ["support_viewer", "wallet_operator"],
  "bob": ["support_viewer", "asset_operator", "refund_operator"],
  "ops-lead": ["admin"]
}
```

Supported roles are `support_viewer`, `wallet_operator`, `asset_operator`,
`refund_operator`, and `admin`. If no operator map is configured, the support
admin API keeps the token-only behavior for local/internal deployments.

Keep provider raw exports according to the final data-retention policy. Do not
store payment exports in the repository.

## Scheduled Checks And Alerts

Use the wallet ops check from cron or the production scheduler:

```bash
npm run game:wallet:ops-check -- --limit=100
```

The command runs wallet mirror drift and wallet-payment reconciliation checks in
one report. If `WALLET_OPS_ALERT_WEBHOOK_URL` is configured, any non-clean
report is posted to that webhook as JSON and the command exits with status `1`.
Use `--alert-webhook-url=<url>` to override the environment value or
`--no-alert` for local dry runs.

The alert payload has `type: "wallet_ops_check_failed"`, a compact `summary`,
and the full report. Production routing should send this to the support/ops
channel that owns payment incidents.
