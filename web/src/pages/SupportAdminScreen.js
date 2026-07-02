const SUPPORT_ADMIN_STORAGE_KEY = 'supportAdminCredentials';

function readStoredCredentials() {
  try {
    return JSON.parse(sessionStorage.getItem(SUPPORT_ADMIN_STORAGE_KEY) || 'null') || {};
  } catch {
    return {};
  }
}

function writeStoredCredentials({ token, actorId, approvalActorId }) {
  sessionStorage.setItem(SUPPORT_ADMIN_STORAGE_KEY, JSON.stringify({
    token: String(token || ''),
    actorId: String(actorId || ''),
    approvalActorId: String(approvalActorId || '')
  }));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function rowPlayerLabel(player) {
  if (!player) return '';
  return player.telegramUsername || player.name || player.friendCode || player.id;
}

async function supportJson(path, { token, actorId, approvalActorId = '', method = 'GET', body = null }) {
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      'x-support-actor-id': actorId,
      ...(approvalActorId ? { 'x-support-approval-actor-id': approvalActorId } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.success) {
    throw new Error(json.error || `Support request failed (${response.status})`);
  }
  return json.data;
}

export const SupportAdminScreen = {
  name: 'SupportAdminScreen',
  data() {
    const credentials = readStoredCredentials();
    return {
      token: credentials.token || '',
      actorId: credentials.actorId || '',
      approvalActorId: credentials.approvalActorId || '',
      query: '',
      limit: 25,
      lookup: null,
      loading: false,
      actionLoading: false,
      error: '',
      status: '',
      walletForm: {
        playerId: '',
        direction: 'grant',
        amount: 25,
        reason: 'support_adjustment',
        note: ''
      },
      assetForm: {
        playerId: '',
        action: 'grant',
        assetId: '',
        assetInstanceId: '',
        reason: 'support_asset_review',
        note: ''
      },
      refundForm: {
        intentId: '',
        clawback: true,
        reason: 'support_refund',
        note: ''
      }
    };
  },
  computed: {
    counts() {
      return this.lookup?.counts || {};
    },
    playerOptions() {
      return this.lookup?.players || [];
    },
    selectedBalance() {
      const playerId = this.walletForm.playerId;
      return (this.lookup?.walletBalances || []).find((row) => row.playerId === playerId) || null;
    },
    latestTransactions() {
      return (this.lookup?.walletTransactions || []).slice(0, 8);
    },
    latestPurchases() {
      return (this.lookup?.purchaseIntents || []).slice(0, 8);
    },
    latestActions() {
      return (this.lookup?.supportActions || []).slice(0, 10);
    },
    latestAssets() {
      return (this.lookup?.assetInstances || []).slice(0, 8);
    },
    latestRolls() {
      return (this.lookup?.assetRolls || []).slice(0, 6);
    },
    latestWebhookEvents() {
      return (this.lookup?.paymentWebhookEvents || []).slice(0, 6);
    },
    assetInstanceOptions() {
      const playerId = this.assetForm.playerId;
      return (this.lookup?.assetInstances || [])
        .filter((asset) => !playerId || asset.playerId === playerId)
        .slice(0, 25);
    },
    selectedAssetInstance() {
      return this.assetInstanceOptions.find((asset) => asset.id === this.assetForm.assetInstanceId) || null;
    },
    refundIntentOptions() {
      return (this.lookup?.purchaseIntents || []).slice(0, 25);
    },
    selectedRefundIntent() {
      return this.refundIntentOptions.find((intent) => intent.id === this.refundForm.intentId) || null;
    },
    canSubmitLookup() {
      return this.token.trim() && this.actorId.trim() && this.query.trim() && !this.loading;
    },
    canSubmitWalletAction() {
      return this.token.trim()
        && this.actorId.trim()
        && this.walletForm.playerId.trim()
        && Number.isInteger(Number(this.walletForm.amount))
        && Number(this.walletForm.amount) > 0
        && this.walletForm.reason.trim()
        && !this.actionLoading;
    },
    canSubmitAssetAction() {
      const action = this.assetForm.action;
      const needsAssetId = action === 'grant' || !this.assetForm.assetInstanceId.trim();
      return this.token.trim()
        && this.actorId.trim()
        && this.assetForm.playerId.trim()
        && ['grant', 'freeze', 'unfreeze', 'revoke'].includes(action)
        && (!needsAssetId || this.assetForm.assetId.trim())
        && (action === 'grant' || this.assetForm.assetId.trim() || this.assetForm.assetInstanceId.trim())
        && this.assetForm.reason.trim()
        && !this.actionLoading;
    },
    canSubmitRefundAction() {
      return this.token.trim()
        && this.actorId.trim()
        && this.refundForm.intentId.trim()
        && this.refundForm.reason.trim()
        && !this.actionLoading;
    }
  },
  methods: {
    formatDate,
    rowPlayerLabel,
    assetInstanceLabel(asset) {
      if (!asset) return '';
      return `${asset.assetId} · ${asset.status} · ${asset.id}`;
    },
    purchaseIntentLabel(intent) {
      if (!intent) return '';
      return `${intent.status} · ${intent.provider} · ${intent.walletAmount} ${intent.currencyCode} · ${intent.id}`;
    },
    setWalletDirection(direction) {
      this.walletForm.direction = direction === 'revoke' ? 'revoke' : 'grant';
    },
    setAssetAction(action) {
      this.assetForm.action = ['grant', 'freeze', 'unfreeze', 'revoke'].includes(action) ? action : 'grant';
    },
    applyLookupDefaults() {
      const playerId = this.lookup?.players?.[0]?.id || '';
      if (playerId) {
        if (!this.walletForm.playerId) this.walletForm.playerId = playerId;
        if (!this.assetForm.playerId) this.assetForm.playerId = playerId;
      }
      const preferredIntent = this.refundIntentOptions.find((intent) => intent.status === 'completed')
        || this.refundIntentOptions[0]
        || null;
      if (!this.refundForm.intentId && preferredIntent?.id) {
        this.refundForm.intentId = preferredIntent.id;
      }
    },
    syncAssetFromInstance() {
      const selected = this.selectedAssetInstance;
      if (!selected) return;
      this.assetForm.assetId = selected.assetId;
      this.assetForm.playerId = selected.playerId;
    },
    supportRequest(path, { method = 'GET', body = null } = {}) {
      return supportJson(path, {
        token: this.token.trim(),
        actorId: this.actorId.trim(),
        approvalActorId: this.approvalActorId.trim(),
        method,
        body
      });
    },
    rememberCredentials() {
      writeStoredCredentials({
        token: this.token.trim(),
        actorId: this.actorId.trim(),
        approvalActorId: this.approvalActorId.trim()
      });
    },
    async runLookup() {
      if (!this.canSubmitLookup) return;
      this.loading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const params = new URLSearchParams({
          query: this.query.trim(),
          limit: String(this.limit || 25)
        });
        this.lookup = await this.supportRequest(`/api/admin/support/money-lookup?${params.toString()}`);
        this.applyLookupDefaults();
        this.status = 'Lookup complete.';
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },
    async submitWalletAction() {
      if (!this.canSubmitWalletAction) return;
      this.actionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      const direction = this.walletForm.direction === 'revoke' ? 'revoke' : 'grant';
      try {
        const data = await this.supportRequest(`/api/admin/support/actions/wallet-${direction}`, {
          method: 'POST',
          body: {
            playerId: this.walletForm.playerId.trim(),
            amount: Number(this.walletForm.amount),
            reason: this.walletForm.reason.trim(),
            note: this.walletForm.note.trim(),
            evidence: { source: 'support_admin_ui' }
          }
        });
        this.status = `${data.action.actionType} applied.`;
        this.query = this.walletForm.playerId.trim();
        await this.runLookup();
      } catch (error) {
        this.error = error.message;
      } finally {
        this.actionLoading = false;
      }
    },
    async submitAssetAction() {
      if (!this.canSubmitAssetAction) return;
      this.actionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      const action = this.assetForm.action;
      try {
        const body = {
          playerId: this.assetForm.playerId.trim(),
          reason: this.assetForm.reason.trim(),
          note: this.assetForm.note.trim(),
          evidence: { source: 'support_admin_ui' }
        };
        if (this.assetForm.assetId.trim()) body.assetId = this.assetForm.assetId.trim();
        if (this.assetForm.assetInstanceId.trim()) body.assetInstanceId = this.assetForm.assetInstanceId.trim();
        const data = await this.supportRequest(`/api/admin/support/actions/asset-${action}`, {
          method: 'POST',
          body
        });
        this.status = `${data.action.actionType} applied.`;
        this.query = this.assetForm.playerId.trim();
        await this.runLookup();
      } catch (error) {
        this.error = error.message;
      } finally {
        this.actionLoading = false;
      }
    },
    async submitRefundAction() {
      if (!this.canSubmitRefundAction) return;
      this.actionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const data = await this.supportRequest('/api/admin/support/actions/purchase-refund', {
          method: 'POST',
          body: {
            intentId: this.refundForm.intentId.trim(),
            clawback: this.refundForm.clawback !== false,
            reason: this.refundForm.reason.trim(),
            note: this.refundForm.note.trim(),
            evidence: { source: 'support_admin_ui' }
          }
        });
        this.status = `${data.action.actionType} applied.`;
        this.query = this.refundForm.intentId.trim();
        await this.runLookup();
      } catch (error) {
        this.error = error.message;
      } finally {
        this.actionLoading = false;
      }
    }
  },
  template: `
    <section class="support-admin-screen stack" data-testid="support-admin-screen">
      <header class="support-admin-header">
        <div>
          <p class="support-admin-kicker">Operations</p>
          <h2>Support Console</h2>
        </div>
        <p v-if="status" class="support-admin-message support-admin-message--ok" data-testid="support-admin-status">{{ status }}</p>
        <p v-if="error" class="support-admin-message support-admin-message--error" data-testid="support-admin-error">{{ error }}</p>
      </header>

      <section class="panel support-admin-panel support-admin-lookup">
        <label>
          <span>Token</span>
          <input class="support-admin-input" data-testid="support-token" type="password" v-model="token" autocomplete="off" />
        </label>
        <label>
          <span>Actor</span>
          <input class="support-admin-input" data-testid="support-actor" v-model="actorId" autocomplete="off" />
        </label>
        <label>
          <span>Approval</span>
          <input class="support-admin-input" data-testid="support-approval-actor" v-model="approvalActorId" autocomplete="off" />
        </label>
        <label class="support-admin-query">
          <span>Lookup</span>
          <input class="support-admin-input" data-testid="support-query" v-model="query" @keydown.enter.prevent="runLookup" />
        </label>
        <label>
          <span>Limit</span>
          <input class="support-admin-input" data-testid="support-limit" type="number" min="1" max="100" v-model.number="limit" />
        </label>
        <button class="primary support-admin-submit" data-testid="support-lookup-submit" type="button" :disabled="!canSubmitLookup" @click="runLookup">
          {{ loading ? 'Searching' : 'Lookup' }}
        </button>
      </section>

      <section v-if="lookup" class="panel support-admin-panel" data-testid="support-counts">
        <h3>Record Counts</h3>
        <dl class="support-admin-metrics">
          <div><dt>Players</dt><dd>{{ counts.players || 0 }}</dd></div>
          <div><dt>Balances</dt><dd>{{ counts.walletBalances || 0 }}</dd></div>
          <div><dt>Purchases</dt><dd>{{ counts.purchaseIntents || 0 }}</dd></div>
          <div><dt>Transactions</dt><dd>{{ counts.walletTransactions || 0 }}</dd></div>
          <div><dt>Actions</dt><dd>{{ counts.supportActions || 0 }}</dd></div>
          <div><dt>Assets</dt><dd>{{ counts.assetInstances || 0 }}</dd></div>
        </dl>
      </section>

      <div v-if="lookup" class="support-admin-columns">
        <section class="panel support-admin-panel">
          <h3>Players</h3>
          <div class="support-admin-table-wrap">
            <table class="support-admin-table" data-testid="support-players-table">
              <thead><tr><th>Player</th><th>Telegram</th><th>Mirror</th><th>Created</th></tr></thead>
              <tbody>
                <tr v-for="player in lookup.players" :key="player.id" :data-player-id="player.id">
                  <td><strong>{{ rowPlayerLabel(player) }}</strong><small>{{ player.id }}</small></td>
                  <td>{{ player.telegramId || '-' }}</td>
                  <td>{{ player.walletMirrorBalance }}</td>
                  <td>{{ formatDate(player.createdAt) }}</td>
                </tr>
                <tr v-if="!lookup.players.length"><td colspan="4">No players found.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel support-admin-panel support-admin-wallet" data-testid="support-wallet-form">
          <h3>Wallet Adjustment</h3>
          <label>
            <span>Player</span>
            <select class="support-admin-input" data-testid="support-wallet-player" v-model="walletForm.playerId">
              <option value="">Select player</option>
              <option v-for="player in playerOptions" :key="player.id" :value="player.id">{{ rowPlayerLabel(player) }} · {{ player.id }}</option>
            </select>
          </label>
          <p class="support-admin-balance" data-testid="support-selected-balance">
            Balance: <strong>{{ selectedBalance ? selectedBalance.balance : 0 }}</strong>
          </p>
          <div class="support-admin-segment" role="group" aria-label="Wallet action">
            <button type="button" :class="{ active: walletForm.direction === 'grant' }" @click="setWalletDirection('grant')">Grant</button>
            <button type="button" :class="{ active: walletForm.direction === 'revoke' }" data-testid="support-wallet-revoke-mode" @click="setWalletDirection('revoke')">Revoke</button>
          </div>
          <label>
            <span>Amount</span>
            <input class="support-admin-input" data-testid="support-wallet-amount" type="number" min="1" step="1" v-model.number="walletForm.amount" />
          </label>
          <label>
            <span>Reason</span>
            <input class="support-admin-input" data-testid="support-wallet-reason" v-model="walletForm.reason" />
          </label>
          <label>
            <span>Note</span>
            <textarea class="support-admin-input" data-testid="support-wallet-note" rows="3" v-model="walletForm.note"></textarea>
          </label>
          <button class="primary support-admin-submit" data-testid="support-wallet-submit" type="button" :disabled="!canSubmitWalletAction" @click="submitWalletAction">
            {{ actionLoading ? 'Applying' : 'Apply' }}
          </button>
        </section>
      </div>

      <div v-if="lookup" class="support-admin-columns support-admin-operator-columns">
        <section class="panel support-admin-panel support-admin-action-form" data-testid="support-asset-form">
          <h3>Asset Actions</h3>
          <label>
            <span>Player</span>
            <select class="support-admin-input" data-testid="support-asset-player" v-model="assetForm.playerId">
              <option value="">Select player</option>
              <option v-for="player in playerOptions" :key="player.id" :value="player.id">{{ rowPlayerLabel(player) }} · {{ player.id }}</option>
            </select>
          </label>
          <div class="support-admin-segment support-admin-segment--four" role="group" aria-label="Asset action">
            <button type="button" :class="{ active: assetForm.action === 'grant' }" data-testid="support-asset-grant-mode" @click="setAssetAction('grant')">Grant</button>
            <button type="button" :class="{ active: assetForm.action === 'freeze' }" data-testid="support-asset-freeze-mode" @click="setAssetAction('freeze')">Freeze</button>
            <button type="button" :class="{ active: assetForm.action === 'unfreeze' }" data-testid="support-asset-unfreeze-mode" @click="setAssetAction('unfreeze')">Unfreeze</button>
            <button type="button" :class="{ active: assetForm.action === 'revoke' }" data-testid="support-asset-revoke-mode" @click="setAssetAction('revoke')">Revoke</button>
          </div>
          <label>
            <span>Asset ID</span>
            <input class="support-admin-input" data-testid="support-asset-id" v-model="assetForm.assetId" />
          </label>
          <label>
            <span>Instance</span>
            <select class="support-admin-input" data-testid="support-asset-instance" v-model="assetForm.assetInstanceId" @change="syncAssetFromInstance">
              <option value="">Use asset id</option>
              <option v-for="asset in assetInstanceOptions" :key="asset.id" :value="asset.id">{{ assetInstanceLabel(asset) }}</option>
            </select>
          </label>
          <label>
            <span>Reason</span>
            <input class="support-admin-input" data-testid="support-asset-reason" v-model="assetForm.reason" />
          </label>
          <label>
            <span>Note</span>
            <textarea class="support-admin-input" data-testid="support-asset-note" rows="3" v-model="assetForm.note"></textarea>
          </label>
          <button class="primary support-admin-submit" data-testid="support-asset-submit" type="button" :disabled="!canSubmitAssetAction" @click="submitAssetAction">
            {{ actionLoading ? 'Applying' : 'Apply Asset Action' }}
          </button>
        </section>

        <section class="panel support-admin-panel support-admin-action-form" data-testid="support-refund-form">
          <h3>Purchase Refund</h3>
          <label>
            <span>Intent</span>
            <select class="support-admin-input" data-testid="support-refund-intent" v-model="refundForm.intentId">
              <option value="">Select purchase intent</option>
              <option v-for="intent in refundIntentOptions" :key="intent.id" :value="intent.id">{{ purchaseIntentLabel(intent) }}</option>
            </select>
          </label>
          <p v-if="selectedRefundIntent" class="support-admin-balance" data-testid="support-refund-intent-summary">
            {{ selectedRefundIntent.status }} · {{ selectedRefundIntent.walletAmount }} {{ selectedRefundIntent.currencyCode }} · {{ selectedRefundIntent.provider }}
          </p>
          <label class="support-admin-checkbox">
            <input type="checkbox" data-testid="support-refund-clawback" v-model="refundForm.clawback" />
            <span>Claw back wallet balance</span>
          </label>
          <label>
            <span>Reason</span>
            <input class="support-admin-input" data-testid="support-refund-reason" v-model="refundForm.reason" />
          </label>
          <label>
            <span>Note</span>
            <textarea class="support-admin-input" data-testid="support-refund-note" rows="3" v-model="refundForm.note"></textarea>
          </label>
          <button class="primary support-admin-submit" data-testid="support-refund-submit" type="button" :disabled="!canSubmitRefundAction" @click="submitRefundAction">
            {{ actionLoading ? 'Applying' : 'Mark Refunded' }}
          </button>
        </section>
      </div>

      <section v-if="lookup" class="panel support-admin-panel">
        <h3>Wallet Transactions</h3>
        <div class="support-admin-table-wrap">
          <table class="support-admin-table" data-testid="support-wallet-transactions">
            <thead><tr><th>Amount</th><th>Balance</th><th>Reason</th><th>Source</th><th>Created</th></tr></thead>
            <tbody>
              <tr v-for="tx in latestTransactions" :key="tx.id">
                <td>{{ tx.amount }}</td>
                <td>{{ tx.balanceAfter }}</td>
                <td>{{ tx.reason }}</td>
                <td>{{ tx.sourceType || '-' }}<small>{{ tx.sourceId || tx.id }}</small></td>
                <td>{{ formatDate(tx.createdAt) }}</td>
              </tr>
              <tr v-if="!latestTransactions.length"><td colspan="5">No wallet transactions found.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="lookup" class="panel support-admin-panel">
        <h3>Purchase Intents</h3>
        <div class="support-admin-table-wrap">
          <table class="support-admin-table" data-testid="support-purchase-intents">
            <thead><tr><th>Status</th><th>Provider</th><th>Wallet</th><th>Price</th><th>Invoice</th><th>Updated</th></tr></thead>
            <tbody>
              <tr v-for="intent in latestPurchases" :key="intent.id">
                <td>{{ intent.status }}</td>
                <td>{{ intent.provider }}</td>
                <td>{{ intent.walletAmount }} {{ intent.currencyCode }}</td>
                <td>{{ intent.priceAmount }} {{ intent.priceCurrency }}</td>
                <td>{{ intent.providerInvoiceId || '-' }}<small>{{ intent.id }}</small></td>
                <td>{{ formatDate(intent.updatedAt) }}</td>
              </tr>
              <tr v-if="!latestPurchases.length"><td colspan="6">No purchase intents found.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <div v-if="lookup" class="support-admin-columns">
        <section class="panel support-admin-panel">
          <h3>Assets</h3>
          <div class="support-admin-table-wrap">
            <table class="support-admin-table" data-testid="support-assets-table">
              <thead><tr><th>Asset</th><th>Status</th><th>Source</th><th>Acquired</th></tr></thead>
              <tbody>
                <tr v-for="asset in latestAssets" :key="asset.id">
                  <td>{{ asset.assetId }}<small>{{ asset.id }}</small></td>
                  <td>{{ asset.status }}</td>
                  <td>{{ asset.acquisitionSource }}</td>
                  <td>{{ formatDate(asset.acquiredAt) }}</td>
                </tr>
                <tr v-if="!latestAssets.length"><td colspan="4">No assets found.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel support-admin-panel">
          <h3>Support Actions</h3>
          <div class="support-admin-table-wrap">
            <table class="support-admin-table" data-testid="support-actions-table">
              <thead><tr><th>Action</th><th>Actor</th><th>Reason</th><th>Created</th></tr></thead>
              <tbody>
                <tr v-for="action in latestActions" :key="action.id">
                  <td>{{ action.actionType }}<small>{{ action.id }}</small></td>
                  <td>{{ action.actorId }}</td>
                  <td>{{ action.reason || '-' }}</td>
                  <td>{{ formatDate(action.createdAt) }}</td>
                </tr>
                <tr v-if="!latestActions.length"><td colspan="4">No support actions found.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div v-if="lookup" class="support-admin-columns">
        <section class="panel support-admin-panel">
          <h3>Pack Rolls</h3>
          <div class="support-admin-table-wrap">
            <table class="support-admin-table" data-testid="support-rolls-table">
              <thead><tr><th>Pack</th><th>Result</th><th>Price</th><th>Created</th></tr></thead>
              <tbody>
                <tr v-for="roll in latestRolls" :key="roll.id">
                  <td>{{ roll.packId }}<small>{{ roll.id }}</small></td>
                  <td>{{ roll.resultAssetIds?.length ? roll.resultAssetIds.join(', ') : (roll.selectedAssetId || '-') }}</td>
                  <td>{{ roll.priceAmount }} {{ roll.currencyCode }}</td>
                  <td>{{ formatDate(roll.createdAt) }}</td>
                </tr>
                <tr v-if="!latestRolls.length"><td colspan="4">No pack rolls found.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel support-admin-panel">
          <h3>Webhook Events</h3>
          <div class="support-admin-table-wrap">
            <table class="support-admin-table" data-testid="support-webhook-table">
              <thead><tr><th>Provider</th><th>Status</th><th>Event</th><th>Processed</th></tr></thead>
              <tbody>
                <tr v-for="event in latestWebhookEvents" :key="event.id">
                  <td>{{ event.provider }}</td>
                  <td>{{ event.processingStatus }}</td>
                  <td>{{ event.eventKey }}<small>{{ event.id }}</small></td>
                  <td>{{ formatDate(event.processedAt || event.receivedAt) }}</td>
                </tr>
                <tr v-if="!latestWebhookEvents.length"><td colspan="4">No webhook events found.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  `
};
