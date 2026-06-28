import { getDb } from '../db/db.js';
import crypto from 'crypto';

export async function initiatePayment(userId, phoneNumber, amount, provider) {
  const db = getDb();
  
  // Clean phone number: should be in format 255XXXXXXXXX (Tanzania standard)
  let cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '255' + cleanPhone.substring(1);
  } else if (!cleanPhone.startsWith('255')) {
    cleanPhone = '255' + cleanPhone;
  }

  // Generate unique payment reference
  const reference = `${provider.toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  // Insert payment record as pending
  await db.run(
    `INSERT INTO payments (user_id, phone_number, amount, provider, reference, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [userId, cleanPhone, amount, provider, reference]
  );

  // Trigger async push notification simulator
  simulatePushNotification(reference).catch(err => 
    console.error('Payment simulation failed:', err)
  );

  return {
    success: true,
    reference,
    message: provider === 'mpesa'
      ? 'Ombi la M-Pesa limegongwa. Tafadhali weka PIN kwenye simu yako.'
      : 'Ombi la Tigo Pesa limegongwa. Tafadhali weka PIN kwenye simu yako.'
  };
}

// Simulate M-Pesa / Tigo Pesa USSD Push callback
async function simulatePushNotification(reference) {
  // Simulate network delay for user inputting PIN (5 seconds)
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const db = getDb();
  
  // Find payment
  const payment = await db.get('SELECT * FROM payments WHERE reference = ?', [reference]);
  if (!payment) return;

  // Mark payment as success
  await db.run(
    'UPDATE payments SET status = "success" WHERE reference = ?',
    [reference]
  );

  // Determine subscription upgrade length
  // e.g., 10,000 TZS = 30 days of Pro, 25,000 TZS = 30 days of Premium
  let days = 30;
  let plan = 'pro';
  if (payment.amount >= 25000) {
    plan = 'premium';
  }

  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);
  const activeUntil = expirationDate.toISOString().slice(0, 19).replace('T', ' ');

  // Update user subscription
  await db.run(
    'UPDATE users SET plan = ?, active_until = ? WHERE id = ?',
    [plan, activeUntil, payment.user_id]
  );

  console.log(`Payment SUCCESS: User ${payment.user_id} upgraded to ${plan} until ${activeUntil}. Reference: ${reference}`);
}

export async function getPaymentStatus(reference) {
  const db = getDb();
  return await db.get('SELECT * FROM payments WHERE reference = ?', [reference]);
}
