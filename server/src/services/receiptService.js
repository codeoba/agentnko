import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function generateReceiptPdf(orderData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const tempDir = path.resolve(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      
      const fileName = `Receipt_${orderData.orderId || Date.now()}.pdf`;
      const filePath = path.join(tempDir, fileName);
      const writeStream = fs.createWriteStream(filePath);
      
      doc.pipe(writeStream);

      // Header Brand
      doc.fillColor('#7c3aed').fontSize(24).text(orderData.brandName || 'AgentNKO Store', { align: 'center' });
      doc.fontSize(10).fillColor('#6b7280').text('No-API WhatsApp AI Commerce Platform', { align: 'center' });
      doc.moveDown(1.5);

      // Invoice info block
      doc.fillColor('#1f2937').fontSize(14).text('STAKABADHI YA MALIPO / RECEIPT', { underline: true });
      doc.fontSize(10).fillColor('#374151');
      doc.moveDown(0.5);
      
      doc.text(`Namba ya Order: #${orderData.orderId || 'N/A'}`);
      doc.text(`Tarehe: ${new Date().toLocaleDateString()}`);
      doc.text(`Mteja: ${orderData.customerName || 'Mteja wetu'}`);
      doc.text(`Namba ya Simu: +${orderData.customerPhone || ''}`);
      doc.text(`Eneo la Delivery: ${orderData.deliveryAddress || 'Pick-up dukani'}`);
      doc.moveDown(1.5);

      // Draw table header
      doc.fillColor('#f3f4f6').rect(50, doc.y, 500, 20).fill();
      doc.fillColor('#374151').fontSize(10).text('Bidhaa (Item)', 60, doc.y + 5);
      doc.text('Kiasi (Qty)', 300, doc.y);
      doc.text('Bei (Unit)', 380, doc.y);
      doc.text('Jumla (Total)', 460, doc.y);
      doc.moveDown(1.5);

      // Draw items
      let totalAmount = 0;
      const items = orderData.items || [];
      items.forEach(item => {
        const itemTotal = item.price * (item.quantity || 1);
        totalAmount += itemTotal;
        doc.text(item.name, 60, doc.y);
        doc.text(String(item.quantity || 1), 300, doc.y);
        doc.text(`${item.price.toLocaleString()} TZS`, 380, doc.y);
        doc.text(`${itemTotal.toLocaleString()} TZS`, 460, doc.y);
        doc.moveDown(1.2);
      });

      doc.moveDown(0.5);
      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // Discount & Grand Total
      if (orderData.discount && orderData.discount > 0) {
        doc.text(`Punguzo (Discount): -${orderData.discount.toLocaleString()} TZS`, 350, doc.y);
        totalAmount = Math.max(0, totalAmount - orderData.discount);
        doc.moveDown(1);
      }

      doc.fontSize(12).fillColor('#111827').text(`JUMLA YOTE YA KULIPA (GRAND TOTAL): ${totalAmount.toLocaleString()} TZS`, 200, doc.y, { align: 'right' });
      doc.moveDown(2);

      // Thank you note
      doc.fontSize(11).fillColor('#10b981').text('ASANTE KWA UNUNUZI WAKO! / THANK YOU FOR SHOPPING!', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#9ca3af').text('Stakabadhi hii imetolewa kiotomatiki na AgentNKO AI Bot.', { align: 'center' });

      doc.end();

      writeStream.on('finish', () => {
        resolve(filePath);
      });

      writeStream.on('error', (err) => {
        reject(err);
      });

    } catch (err) {
      reject(err);
    }
  });
}
