import {
  createProviderSettlementAdapterRegistry,
  createProviderSettlementRecordMapper
} from '@microwavedev/backpack-game-core/modules/wallet/settlement-adapters';
import { WALLET_PURCHASE_PROVIDERS } from './wallet-service.js';

function normalizeBtcpayStatus(record, { getScopedValue }) {
  const type = String(getScopedValue(record, ['type', 'eventType', 'event_type']) || '').trim().toLowerCase();
  const status = getScopedValue(record, ['settlementStatus', 'status', 'invoiceStatus', 'paymentStatus']);
  if (type === 'invoicesettled' || type === 'invoicepaymentsettled') return 'settled';
  if (type === 'invoiceexpired') return 'expired';
  if (type === 'invoiceinvalid') return 'failed';
  if (type.includes('refund')) return 'refunded';
  return status;
}

const providerSettlementRegistry = createProviderSettlementAdapterRegistry({
  supportedProviders: WALLET_PURCHASE_PROVIDERS,
  adapters: {
    btcpay: createProviderSettlementRecordMapper({
      provider: 'btcpay',
      fields: {
        localIntentId: [
          'localIntentId',
          'walletPurchaseIntentId',
          'intentId',
          'orderId',
          'order_id',
          'metadataOrderId'
        ],
        providerInvoiceId: [
          'providerInvoiceId',
          'invoiceId',
          'invoice_id',
          'invoice',
          'id',
          'InvoiceId',
          'Invoice ID'
        ],
        providerPaymentId: [
          'providerPaymentId',
          'paymentId',
          'payment_id',
          'PaymentId',
          'Payment ID',
          'transactionId',
          'Transaction ID'
        ],
        status: normalizeBtcpayStatus,
        amount: [
          'priceAmount',
          'price_amount',
          'amount',
          'price',
          'invoiceAmount',
          'Invoice Amount',
          'Amount',
          'total',
          'Total'
        ],
        currency: [
          'priceCurrency',
          'price_currency',
          'currency',
          'invoiceCurrency',
          'Invoice Currency',
          'Currency'
        ],
        settledAt: [
          'settledAt',
          'settled_at',
          'paidAt',
          'paid_at',
          'paymentDate',
          'Payment Date',
          'createdTime',
          'CreatedTime',
          'createdAt',
          'updatedAt'
        ]
      }
    }),
    nowpayments: createProviderSettlementRecordMapper({
      provider: 'nowpayments',
      fields: {
        localIntentId: [
          'localIntentId',
          'walletPurchaseIntentId',
          'intentId',
          'orderId',
          'order_id'
        ],
        providerInvoiceId: [
          'providerInvoiceId',
          'invoiceId',
          'invoice_id',
          'payment_id',
          'paymentId',
          'id'
        ],
        providerPaymentId: [
          'providerPaymentId',
          'paymentId',
          'payment_id',
          'id'
        ],
        payment_status: ['payment_status', 'paymentStatus', 'status'],
        price_amount: ['price_amount', 'priceAmount', 'amount', 'Amount'],
        price_currency: ['price_currency', 'priceCurrency', 'currency', 'Currency'],
        settledAt: [
          'actually_paid_at',
          'settledAt',
          'created_at',
          'updated_at',
          'createdAt',
          'updatedAt'
        ]
      }
    }),
    telegram_stars: createProviderSettlementRecordMapper({
      provider: 'telegram_stars',
      fields: {
        localIntentId: [
          'localIntentId',
          'walletPurchaseIntentId',
          'intentId',
          'invoice_payload',
          'invoicePayload',
          'payload'
        ],
        providerPaymentId: [
          'providerPaymentId',
          'telegram_payment_charge_id',
          'telegramPaymentChargeId',
          'provider_payment_charge_id',
          'providerPaymentChargeId',
          'paymentId',
          'payment_id'
        ],
        status: {
          keys: ['settlementStatus', 'status', 'payment_status'],
          defaultValue: 'completed'
        },
        priceAmountMinor: [
          'priceAmountMinor',
          'total_amount',
          'totalAmount',
          'amount',
          'Amount'
        ],
        priceCurrency: {
          keys: ['priceCurrency', 'currency'],
          defaultValue: 'XTR'
        },
        settledAt: ['settledAt', 'paidAt', 'createdAt', 'date']
      }
    })
  }
});

export const adaptProviderSettlementRecords = providerSettlementRegistry.adaptProviderSettlementRecords;
export const parseProviderSettlementInput = providerSettlementRegistry.parseProviderSettlementInput;
