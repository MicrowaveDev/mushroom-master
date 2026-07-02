import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, freshDb } from './helpers.js';
import { query } from '../../app/server/db.js';
import { createPurchaseIntent } from '../../app/server/services/wallet-service.js';
import {
  runWalletOpsChecks,
  sendWalletOpsAlert
} from '../../app/server/services/wallet-ops-check-service.js';

test('[Req 4-Z] wallet ops check stays quiet when wallet and payment reconciliation are clean', async () => {
  await freshDb();
  const report = await runWalletOpsChecks({ limit: 10 });
  const alert = await sendWalletOpsAlert(report, {
    webhookUrl: 'https://ops.example.test/wallet-alert',
    fetchImpl: async () => {
      throw new Error('clean reports should not send alerts');
    }
  });

  assert.equal(report.ok, true);
  assert.equal(report.summary.walletMirrorDrift, 0);
  assert.equal(report.summary.paymentReconciliationIssues, 0);
  assert.deepEqual(alert, { sent: false, reason: 'report_ok' });
});

test('[Req 4-Z] wallet ops check posts alert payload when reconciliation issues exist', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4901 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'ops-check-missing-grant'
  });
  const now = new Date().toISOString();
  await query(
    `UPDATE wallet_purchase_intents
     SET status = 'completed',
         completed_at = $2,
         updated_at = $2
     WHERE id = $1`,
    [intent.id, now]
  );

  const report = await runWalletOpsChecks({ limit: 10 });
  const calls = [];
  const alert = await sendWalletOpsAlert(report, {
    webhookUrl: 'https://ops.example.test/wallet-alert',
    fetchImpl: async (url, options) => {
      calls.push({ url, options, body: JSON.parse(options.body) });
      return { ok: true, status: 202 };
    }
  });

  assert.equal(report.ok, false);
  assert.equal(report.summary.paymentCategoryCounts.completedIntentsMissingWalletGrant, 1);
  assert.equal(alert.sent, true);
  assert.equal(alert.status, 202);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://ops.example.test/wallet-alert');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].body.type, 'wallet_ops_check_failed');
  assert.equal(calls[0].body.summary.paymentReconciliationIssues, 1);
});
