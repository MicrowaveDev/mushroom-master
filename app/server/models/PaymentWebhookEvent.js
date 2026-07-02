import { DataTypes } from 'sequelize';

export default function definePaymentWebhookEvent(sequelize) {
  return sequelize.define('PaymentWebhookEvent', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    provider: { type: DataTypes.TEXT, allowNull: false },
    event_key: { type: DataTypes.TEXT, allowNull: false },
    payload_hash: { type: DataTypes.TEXT, allowNull: false },
    processing_status: { type: DataTypes.TEXT, allowNull: false },
    result_json: { type: DataTypes.TEXT },
    error_message: { type: DataTypes.TEXT },
    received_at: { type: DataTypes.TEXT, allowNull: false },
    processed_at: { type: DataTypes.TEXT },
    metadata_json: { type: DataTypes.TEXT }
  }, {
    tableName: 'payment_webhook_events',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['provider', 'event_key'], name: 'idx_payment_webhook_events_provider_key' },
      { fields: ['provider', 'received_at'], name: 'idx_payment_webhook_events_provider_time' }
    ]
  });
}
