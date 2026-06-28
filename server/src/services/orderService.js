/**
 * Order Service
 * Inashughulikia orders za wateja kutoka WhatsApp
 * Tracking: Pending → Processing → Shipped → Delivered → Cancelled
 */

import { getDb } from '../db/db.js';
import { getSession } from './whatsappManager.js';
import { sendWhatsAppMessage } from './whatsappService.js';
import { triggerWebhook, WEBHOOK_EVENTS } from './webhookService.js';

const ORDER_STATUS_LABELS = {
  pending: '⏳ Inasubiri',
  processing: '⚙️ Inaandaliwa',
  shipped: '🚚 Imesafirishwa',
  delivered: '✅ Imefikia',
  cancelled: '❌ Imefutwa',
};

/**
 * Generate order number wa kipekee
 */
function generateOrderNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `NKO-${dateStr}-${random}`;
}

/**
 * Unda order mpya
 */
export async function createOrder(userId, orderData) {
  const db = getDb();
  
  const orderNumber = generateOrderNumber();
  const items = Array.isArray(orderData.items) ? orderData.items : [];
  
  // Hesabu totals
  const subtotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  const discount = orderData.discount || 0;
  const total = subtotal - discount;

  const result = await db.run(
    `INSERT INTO orders 
     (user_id, contact_id, order_number, items, subtotal, discount, total, 
      status, delivery_type, delivery_address, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      userId, orderData.contact_id || null, orderNumber,
      JSON.stringify(items), subtotal, discount, total,
      orderData.delivery_type || 'delivery',
      orderData.delivery_address || null,
      orderData.notes || null
    ]
  );

  const order = await db.get('SELECT * FROM orders WHERE id = ?', [result.lastID]);
  
  // Trigger webhook
  await triggerWebhook(userId, WEBHOOK_EVENTS.NEW_ORDER, {
    order_number: orderNumber,
    total,
    status: 'pending',
  });

  return order;
}

/**
 * Update status ya order na tuma notification kwa mteja
 */
export async function updateOrderStatus(userId, orderId, newStatus, trackingNumber = null) {
  const db = getDb();
  
  const order = await db.get(
    'SELECT * FROM orders WHERE id = ? AND user_id = ?',
    [orderId, userId]
  );
  
  if (!order) throw new Error('Order not found');

  await db.run(
    `UPDATE orders SET 
       status = ?, 
       tracking_number = COALESCE(?, tracking_number),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [newStatus, trackingNumber, orderId, userId]
  );

  // Tuma notification kwa mteja kama contact_id ipo
  if (order.contact_id) {
    const contact = await db.get(
      'SELECT * FROM contacts WHERE id = ?',
      [order.contact_id]
    );

    if (contact) {
      const config = await db.get(
        'SELECT gateway_type FROM whatsapp_gateway_configs WHERE user_id = ?',
        [userId]
      );
      const gatewayType = config ? config.gateway_type : 'baileys';

      let session = null;
      let isSendable = true;

      if (gatewayType === 'baileys') {
        session = getSession(userId);
        if (!session || session.status !== 'connected') {
          isSendable = false;
        }
      }

      if (isSendable) {
        const statusLabel = ORDER_STATUS_LABELS[newStatus] || newStatus;
        let notificationMsg = `📦 *Hali ya Order #${order.order_number}*\n\n`;
        notificationMsg += `Hali mpya: *${statusLabel}*\n`;
        
        if (trackingNumber) {
          notificationMsg += `🔍 Namba ya Tracking: *${trackingNumber}*\n`;
        }

        if (newStatus === 'shipped') {
          notificationMsg += `\n🚚 Order yako imesafirishwa! Utaipata hivi karibuni.`;
        } else if (newStatus === 'delivered') {
          notificationMsg += `\n✅ Order yako imefikia! Asante kwa kununua natumaini utaifurahia.`;
        } else if (newStatus === 'processing') {
          notificationMsg += `\n⚙️ Tunaandaa order yako sasa hivi.`;
        }

        try {
          await sendWhatsAppMessage(userId, contact.phone_number, notificationMsg);
          
          await db.run(
            `INSERT INTO messages (user_id, contact_id, sender_phone, recipient_phone, text, direction)
             VALUES (?, ?, ?, ?, ?, 'outgoing')`,
            [userId, contact.id, gatewayType === 'baileys' ? session.sock.user?.id?.split(':')[0] : 'meta', contact.phone_number, notificationMsg]
          );
          
          await db.run(
            'UPDATE orders SET notified_at = CURRENT_TIMESTAMP WHERE id = ?',
            [orderId]
          );
        } catch (sendErr) {
          console.error('Order notification send error:', sendErr.message);
        }
      }
    }
  }

  // Trigger webhook
  await triggerWebhook(userId, WEBHOOK_EVENTS.ORDER_STATUS_CHANGED, {
    order_number: order.order_number,
    old_status: order.status,
    new_status: newStatus,
    tracking_number: trackingNumber,
  });

  return db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
}

/**
 * Pata orders na contact info
 */
export async function getOrdersWithContacts(userId, status = null) {
  const db = getDb();
  
  let query = `
    SELECT o.*, c.name as contact_name, c.phone_number as contact_phone
    FROM orders o
    LEFT JOIN contacts c ON o.contact_id = c.id
    WHERE o.user_id = ?
  `;
  const params = [userId];
  
  if (status) {
    query += ' AND o.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY o.created_at DESC';
  return db.all(query, params);
}

/**
 * Pata order stats
 */
export async function getOrderStats(userId) {
  const db = getDb();
  
  const stats = await db.all(
    `SELECT status, COUNT(*) as count, SUM(total) as revenue
     FROM orders WHERE user_id = ?
     GROUP BY status`,
    [userId]
  );

  const result = {
    total: 0,
    total_revenue: 0,
    by_status: {}
  };

  for (const row of stats) {
    result.by_status[row.status] = { count: row.count, revenue: row.revenue || 0 };
    result.total += row.count;
    result.total_revenue += row.revenue || 0;
  }

  return result;
}
