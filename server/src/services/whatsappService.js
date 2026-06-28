import fs from 'fs';
import { getDb } from '../db/db.js';
import { getSession } from './whatsappManager.js';

/**
 * Tuma ujumbe wa WhatsApp kwa kutumia Gateway iliyochaguliwa (Baileys au Meta API)
 * @param {number} userId - ID ya Mtumiaji
 * @param {string} recipientPhone - Namba ya simu ya mteja (e.g. 255712345678)
 * @param {string} text - Maudhui ya ujumbe
 * @param {object} options - Chaguzi za ziada (mfano receipt document path)
 */
export async function sendWhatsAppMessage(userId, recipientPhone, text, options = {}) {
  const db = getDb();
  
  // 1. Pata Configuration ya Gateway ya mtumiaji
  let config = await db.get(
    'SELECT * FROM whatsapp_gateway_configs WHERE user_id = ?',
    [userId]
  );

  const gatewayType = config ? config.gateway_type : 'baileys';
  const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');

  console.log(`Sending message via [${gatewayType}] to ${cleanPhone} (user ${userId})`);

  if (gatewayType === 'meta_api' && config && config.meta_access_token && config.meta_phone_number_id) {
    try {
      return await sendViaMetaApi(config, cleanPhone, text, options, userId);
    } catch (metaErr) {
      console.error(`Meta API failed, falling back to Baileys for user ${userId}:`, metaErr.message);
      return sendViaBaileys(userId, cleanPhone, text, options);
    }
  } else {
    // Fallback/Default: Baileys (QR Code)
    return sendViaBaileys(userId, cleanPhone, text, options);
  }
}

/**
 * Tuma ujumbe kupitia Baileys (QR Code) Gateway
 */
async function sendViaBaileys(userId, phone, text, options) {
  const session = getSession(userId);
  if (!session || session.status !== 'connected') {
    throw new Error('WhatsApp session (Baileys) is not connected');
  }

  const jid = `${phone}@s.whatsapp.net`;
  const db = getDb();

  // 1. Tuma ujumbe wa maandishi
  if (text) {
    await session.sock.sendMessage(jid, { text });
  }

  // 2. Tuma stakabadhi / PDF kama iko
  if (options.documentPath && fs.existsSync(options.documentPath)) {
    const filename = options.fileName || 'Stakabadhi.pdf';
    await session.sock.sendMessage(jid, {
      document: fs.readFileSync(options.documentPath),
      mimetype: 'application/pdf',
      fileName: filename
    });
  }

  return { success: true, gateway: 'baileys' };
}

/**
 * Tuma ujumbe kupitia Meta WhatsApp Business Cloud API
 */
async function sendViaMetaApi(config, phone, text, options, userId) {
  const { meta_access_token, meta_phone_number_id } = config;
  const baseUrl = `https://graph.facebook.com/v20.0/${meta_phone_number_id}`;

  // 1. Kama kuna document, pakia (upload) kwanza kupitia Meta Media API
  let mediaId = null;
  if (options.documentPath && fs.existsSync(options.documentPath)) {
    try {
      mediaId = await uploadMediaToMeta(meta_access_token, meta_phone_number_id, options.documentPath, options.fileName || 'Stakabadhi.pdf');
    } catch (uploadErr) {
      console.error('Meta Media Upload Error:', uploadErr.message);
    }
  }

  // 2. Tuma Ujumbe wa Maandishi
  if (text) {
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${meta_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: {
          preview_url: false,
          body: text
        }
      })
    });

    const resJson = await response.json();
    if (!response.ok) {
      throw new Error(`Meta API Send Text Error: ${resJson.error?.message || response.statusText}`);
    }
  }

  // 3. Tuma Ujumbe wa Document (kama mediaId ipo)
  if (mediaId) {
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${meta_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'document',
        document: {
          id: mediaId,
          filename: options.fileName || 'Stakabadhi.pdf'
        }
      })
    });

    const resJson = await response.json();
    if (!response.ok) {
      throw new Error(`Meta API Send Document Error: ${resJson.error?.message || response.statusText}`);
    }
  }

  return { success: true, gateway: 'meta_api' };
}

/**
 * Pakia faili la PDF kwenda Meta Media endpoint kupata mediaId
 */
async function uploadMediaToMeta(accessToken, phoneNumberId, filePath, fileName) {
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/media`;
  
  // Tunasoma faili kama Blob/Buffer
  const fileBuffer = fs.readFileSync(filePath);
  const formData = new FormData();
  
  // Kutengeneza Blob inayokubalika na fetch
  const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
  formData.append('file', fileBlob, fileName);
  formData.append('type', 'application/pdf');
  formData.append('messaging_product', 'whatsapp');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: formData
  });

  const resJson = await response.json();
  if (!response.ok) {
    throw new Error(resJson.error?.message || 'Media upload failed');
  }

  return resJson.id; // Hii ndiyo mediaId
}
