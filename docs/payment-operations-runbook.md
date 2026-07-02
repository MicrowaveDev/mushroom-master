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

## Webhook Freshness

Payment webhooks fail signature verification first, then timestamp freshness
when a provider sends an explicit webhook/event timestamp header or payload
field. The default window is 5 minutes. Override with:

```bash
PAYMENT_WEBHOOK_TIMESTAMP_TOLERANCE_MS=300000
```

If a provider starts sending reliable webhook timestamps, require them with
`PAYMENT_WEBHOOK_REQUIRE_TIMESTAMP=true` or a provider-specific flag such as
`BTCPAY_WEBHOOK_REQUIRE_TIMESTAMP=true` / `NOWPAYMENTS_WEBHOOK_REQUIRE_TIMESTAMP=true`.
Keep the requirement off until sandbox/live provider payloads confirm the exact
timestamp field and retry behavior.

## Webhook Secret Rotation

Payment webhook signature checks accept the existing single-secret env vars and
optional plural env vars so providers can rotate secrets without dropping retry
deliveries:

```bash
BTCPAY_WEBHOOK_SECRET=<new-secret>
BTCPAY_WEBHOOK_SECRETS=<old-secret>,<older-secret>

NOWPAYMENTS_IPN_SECRET=<new-secret>
NOWPAYMENTS_IPN_SECRETS='["<old-secret>","<older-secret>"]'
```

Rotation procedure:

1. Create the new provider webhook secret in the provider dashboard.
2. Deploy the new secret as `BTCPAY_WEBHOOK_SECRET` or
   `NOWPAYMENTS_IPN_SECRET`, and keep the currently active secret in the matching
   plural env var.
3. Update the provider dashboard to sign new deliveries with the new secret.
4. Watch webhook failures and `payment_webhook_events` replay/audit rows through
   at least the provider retry window.
5. Remove the old secret from the plural env var only after retries signed with
   the old value have stopped.

Keep all webhook secrets in the production secret manager. Do not commit real
secret values to this repository or issue trackers.

## Structured Payment Logs

Payment routes emit JSON lines through the normal app logger. Route these log
kinds to the production payment/support log sink:

- `wallet_purchase_intent`: checkout intent created or reused for a player.
- `payment_webhook_rejected`: webhook failed signature or timestamp validation.
- `payment_webhook_processed`: verified webhook was processed, replayed, or
  ignored with an explicit reason.
- `payment_webhook_failed`: verified webhook failed during processing after a
  `payment_webhook_events` row was created.

These logs include request ids, local intent/event ids, provider names, status
fields, and provider invoice/payment references. They do not include raw
provider payloads, webhook secrets, player auth tokens, or checkout URLs. Keep
the retention window aligned with the final payment dispute and tax/accounting
policy.

## Follow-Up Actions

Use `npm run game:support:money-lookup -- --query=<id-or-reference>` before any
manual intervention. Use `npm run game:support:money-action` for audited wallet
or asset grants/revokes/freezes/unfreezes and purchase refund marking. Attach
provider evidence JSON to manual actions whenever a settlement row is disputed.

For disputed assets, use `asset-freeze` first. Frozen assets do not count as
active owned assets and cannot stay equipped. Use `asset-unfreeze` if the
dispute is resolved in the player's favor, or `asset-revoke` if the chargeback
or refund is confirmed and the asset should be permanently removed.
When a support packet gives a specific `player_asset_instances.id`, pass
`--instance=<assetInstanceId>` to `asset-freeze`, `asset-unfreeze`, or
`asset-revoke`; otherwise pass `--asset=<assetId>` for the current one-copy skin
model.

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
`refund_operator`, `support_approver`, and `admin`. If no operator map is
configured, the support admin API keeps the token-only behavior for
local/internal deployments.

Set `SUPPORT_ADMIN_APPROVAL_REQUIRED=true` to require a second support actor on
wallet, asset, and refund mutations. The approving actor must be different from
the action actor and must have `support_approver` or `admin`. Pass the approver
with `x-support-approval-actor-id` or `approvalActorId`; successful mutations
store the approval under `support_actions.evidence.approval`.
Asset admin API mutations accept the same optional `assetInstanceId` body field
for instance-scoped disputes.

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
