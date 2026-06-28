import { getDb } from '../db/db.js';

export async function syncWooCommerceProducts(userId) {
  const db = getDb();
  const config = await db.get('SELECT * FROM woocommerce_configs WHERE user_id = ? AND active = 1', [userId]);
  if (!config) {
    throw new Error('WooCommerce integration is not active or configured.');
  }

  const { domain_name, consumer_key, consumer_secret } = config;
  const cleanDomain = domain_name.replace(/\/$/, ''); // strip trailing slash
  const url = `${cleanDomain}/wp-json/wc/v3/products?per_page=100`;

  const authHeader = 'Basic ' + Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');

  console.log(`Syncing products from WooCommerce: ${url}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`WooCommerce API Error (${response.status}): ${errText}`);
  }

  const wcProducts = await response.json();

  // Clear existing products and load new ones
  await db.run('DELETE FROM products WHERE user_id = ?', [userId]);

  let count = 0;
  for (const p of wcProducts) {
    const rawDesc = p.short_description || p.description || '';
    const cleanDesc = rawDesc.replace(/<[^>]*>/g, '').trim().slice(0, 200); // Strip HTML tags
    const priceVal = parseFloat(p.price || 0);
    const stockStatus = p.stock_status === 'instock' ? 'available' : 'out_of_stock';

    await db.run(
      `INSERT INTO products (user_id, name, price, description, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, p.name, priceVal, cleanDesc || '[WooCommerce]', stockStatus]
    );
    count++;
  }

  console.log(`Successfully synced ${count} products from WooCommerce for user ${userId}`);
  return count;
}

export async function createWooCommerceOrder(userId, orderData) {
  const db = getDb();
  const config = await db.get('SELECT * FROM woocommerce_configs WHERE user_id = ? AND active = 1 AND create_orders = 1', [userId]);
  if (!config) {
    return null; // Sync WooCommerce order is disabled or not configured
  }

  const { domain_name, consumer_key, consumer_secret } = config;
  const cleanDomain = domain_name.replace(/\/$/, '');
  const url = `${cleanDomain}/wp-json/wc/v3/orders`;

  const authHeader = 'Basic ' + Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');

  // Format line items
  const lineItems = (orderData.items || []).map(item => ({
    name: item.name,
    quantity: item.quantity || 1,
    price: String(item.price || 0)
  }));

  const payload = {
    payment_method: 'whatsapp',
    payment_method_title: 'WhatsApp AI Agent Checkout',
    set_paid: false,
    billing: {
      first_name: orderData.customerName || 'WhatsApp Customer',
      phone: orderData.customerPhone || ''
    },
    shipping: {
      first_name: orderData.customerName || 'WhatsApp Customer',
      address_1: orderData.deliveryAddress || 'Pick-up'
    },
    line_items: lineItems
  };

  console.log(`Creating WooCommerce order: ${url}`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`WooCommerce Order Sync failed: ${errText}`);
      return null;
    }

    const wcOrder = await response.json();
    console.log(`WooCommerce Order created successfully: #${wcOrder.id}`);
    return wcOrder.id;
  } catch (err) {
    console.error(`Network error syncing WooCommerce order:`, err);
    return null;
  }
}
