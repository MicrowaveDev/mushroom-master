import {
  auditWalletMirror,
  reconcileWalletPayments
} from './wallet-service.js';

function categoryCounts(categories = {}) {
  return Object.fromEntries(
    Object.entries(categories).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])
  );
}

function buildSummary(report) {
  return {
    ok: report.ok,
    walletMirrorDrift: report.walletMirror.audit.total,
    paymentReconciliationIssues: report.paymentReconciliation.total,
    paymentCategoryCounts: categoryCounts(report.paymentReconciliation.categories)
  };
}

export async function runWalletOpsChecks({ limit = 100 } = {}) {
  const rowLimit = Math.max(1, Math.min(1000, Number(limit) || 100));
  const walletMirrorAudit = await auditWalletMirror({ limit: rowLimit });
  const paymentReconciliation = await reconcileWalletPayments({ limit: rowLimit });
  const report = {
    ok: walletMirrorAudit.total === 0 && paymentReconciliation.ok,
    generatedAt: paymentReconciliation.generatedAt,
    limit: rowLimit,
    walletMirror: {
      ok: walletMirrorAudit.total === 0,
      audit: walletMirrorAudit
    },
    paymentReconciliation
  };
  return {
    ...report,
    summary: buildSummary(report)
  };
}

export async function sendWalletOpsAlert(report, {
  webhookUrl = process.env.WALLET_OPS_ALERT_WEBHOOK_URL || '',
  fetchImpl = globalThis.fetch
} = {}) {
  const url = String(webhookUrl || '').trim();
  if (report?.ok || !url) return { sent: false, reason: report?.ok ? 'report_ok' : 'missing_webhook_url' };
  if (typeof fetchImpl !== 'function') throw new Error('Wallet ops alert fetch implementation is unavailable');
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'wallet_ops_check_failed',
      generatedAt: report.generatedAt,
      summary: report.summary,
      report
    })
  });
  if (!response?.ok) {
    throw new Error(`Wallet ops alert failed with status ${response?.status || 'unknown'}`);
  }
  return { sent: true, status: response.status || 200 };
}
