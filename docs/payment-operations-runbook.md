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

Keep provider raw exports according to the final data-retention policy. Do not
store payment exports in the repository.
