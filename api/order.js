const zlib = require('zlib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    name, email, phone, qty, notes,
    colours, text_elements, logos, extras, total,
    svg, underbrim_photo
  } = req.body;

  const html = `
    <h2 style="color:#47360B">New Cap Design Order 🧢</h2>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%">
      <tr><td style="padding:8px;font-weight:bold;width:140px">Name</td><td style="padding:8px">${name}</td></tr>
      <tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px"><a href="mailto:${email}">${email}</a></td></tr>
      <tr><td style="padding:8px;font-weight:bold">Phone</td><td style="padding:8px">${phone || '—'}</td></tr>
      <tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold">Quantity</td><td style="padding:8px">${qty} hats</td></tr>
      <tr><td style="padding:8px;font-weight:bold">Total</td><td style="padding:8px;font-size:18px;font-weight:bold;color:#F74D24">${total}</td></tr>
      <tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold">Notes</td><td style="padding:8px">${notes || '—'}</td></tr>
    </table>
    <h3 style="color:#47360B;margin-top:24px">Design Details</h3>
    <table style="font-family:sans-serif;font-size:13px;border-collapse:collapse;width:100%">
      <tr><td style="padding:8px;font-weight:bold;width:140px;vertical-align:top">Colours</td><td style="padding:8px;white-space:pre-line">${colours}</td></tr>
      <tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold;vertical-align:top">Text</td><td style="padding:8px;white-space:pre-line">${text_elements}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;vertical-align:top">Logos</td><td style="padding:8px">${logos}</td></tr>
      <tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold;vertical-align:top">Extras</td><td style="padding:8px;white-space:pre-line">${extras}</td></tr>
    </table>
    <p style="font-family:sans-serif;font-size:12px;color:#9A8A6A;margin-top:24px">Sent from brandem-cap-designer.vercel.app</p>
  `;

  const attachments = [];

  // Gzip the SVG and send as .svg.gz
  if (svg) {
    try {
      const svgBuffer = Buffer.from(svg, 'base64');
      const gzipped = zlib.gzipSync(svgBuffer);
      attachments.push({
        filename: 'cap-design.svg.gz',
        content: gzipped.toString('base64'),
        content_type: 'application/gzip'
      });
    } catch(e) {
      console.error('SVG gzip error:', e);
    }
  }

  // Underbrim photo as-is
  if (underbrim_photo) {
    const match = underbrim_photo.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const ext = match[1].split('/')[1] || 'jpg';
      attachments.push({
        filename: `underbrim-photo.${ext}`,
        content: match[2],
        content_type: match[1]
      });
    }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: 'Brandem Cap Designer <howdy@brandemau.com>',
      to: ['howdy@brandemau.com'],
      reply_to: email,
      subject: `New Cap Order — ${name} — ${qty} hats — ${total}`,
      html,
      attachments
    })
  });

  if (!response.ok) {
    const err = await response.text();
    return res.status(500).json({ error: err });
  }

  return res.status(200).json({ ok: true });
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};
