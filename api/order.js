module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    name, email, phone, qty, notes,
    colours, text_elements, logos, extras, total,
    svg_b64, underbrim_b64, underbrim_ext
  } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  console.log('svg_b64 length:', svg_b64 ? svg_b64.length : 0);
  console.log('underbrim_b64 length:', underbrim_b64 ? underbrim_b64.length : 0);

  const emailHtml = ''
    + '<h2 style="color:#47360B;font-family:sans-serif">New Cap Design Order 🧢</h2>'
    + '<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%">'
    + '<tr><td style="padding:8px;font-weight:bold;width:140px">Name</td><td style="padding:8px">' + name + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px"><a href="mailto:' + email + '">' + email + '</a></td></tr>'
    + '<tr><td style="padding:8px;font-weight:bold">Phone</td><td style="padding:8px">' + (phone || '—') + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold">Quantity</td><td style="padding:8px">' + qty + ' hats</td></tr>'
    + '<tr><td style="padding:8px;font-weight:bold">Total</td><td style="padding:8px;font-size:18px;font-weight:bold;color:#F74D24">' + total + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold">Notes</td><td style="padding:8px">' + (notes || '—') + '</td></tr>'
    + '</table>'
    + '<h3 style="font-family:sans-serif;color:#47360B;margin-top:24px">Design Details</h3>'
    + '<table style="font-family:sans-serif;font-size:13px;border-collapse:collapse;width:100%">'
    + '<tr><td style="padding:8px;font-weight:bold;width:140px;vertical-align:top">Colours</td><td style="padding:8px;white-space:pre-line">' + (colours || '—') + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold;vertical-align:top">Text</td><td style="padding:8px;white-space:pre-line">' + (text_elements || 'None') + '</td></tr>'
    + '<tr><td style="padding:8px;font-weight:bold;vertical-align:top">Logos</td><td style="padding:8px">' + (logos || 'None') + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold;vertical-align:top">Extras</td><td style="padding:8px;white-space:pre-line">' + (extras || 'None') + '</td></tr>'
    + '</table>'
    + '<p style="font-family:sans-serif;font-size:13px;color:#47360B;margin-top:24px">'
    + (svg_b64 && svg_b64.length > 100 ? '📎 Cap design attached as <strong>cap-design.svg</strong>' : '⚠️ No cap design file received') + '</p>'
    + (underbrim_b64 && underbrim_b64.length > 100 ? '<p style="font-family:sans-serif;font-size:13px;color:#47360B">📎 Underbrim photo attached</p>' : '')
    + '<p style="font-family:sans-serif;font-size:11px;color:#9A8A6A;margin-top:24px">Sent from brandem-cap-designer.vercel.app</p>';

  // Resend attachment format (confirmed from docs): { filename, content }
  // Resend infers MIME type from extension — no content_type field needed
  const attachments = [];

  if (svg_b64 && svg_b64.length > 100) {
    try {
      const decoded = Buffer.from(svg_b64, 'base64');
      console.log('SVG decoded size:', decoded.length, 'bytes');
      attachments.push({ filename: 'cap-design.svg', content: svg_b64 });
    } catch(e) {
      console.error('SVG attachment error:', e.message);
    }
  }

  if (underbrim_b64 && underbrim_b64.length > 100) {
    try {
      const decoded = Buffer.from(underbrim_b64, 'base64');
      const ext = (underbrim_ext || 'jpg').replace('jpeg', 'jpg');
      console.log('Underbrim decoded size:', decoded.length, 'bytes');
      attachments.push({ filename: 'underbrim-photo.' + ext, content: underbrim_b64 });
    } catch(e) {
      console.error('Underbrim attachment error:', e.message);
    }
  }

  console.log('Attachments:', attachments.map(a => a.filename + ' (' + a.content.length + ' b64 chars)'));

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY
      },
      body: JSON.stringify({
        from:        'Brandem Cap Designer <howdy@brandemau.com>',
        to:          ['howdy@brandemau.com'],
        reply_to:    email,
        subject:     'New Cap Order — ' + name + ' — ' + qty + ' hats — ' + total,
        html:        emailHtml,
        attachments: attachments
      })
    });

    clearTimeout(timeoutId);
    const txt = await response.text();
    console.log('Resend status:', response.status, '| response:', txt.slice(0, 150));

    if (!response.ok) {
      return res.status(500).json({ error: 'Resend ' + response.status + ': ' + txt.slice(0, 300) });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    clearTimeout(timeoutId);
    console.error('Fetch error:', err.name, err.message);
    return res.status(500).json({
      error: err.name === 'AbortError' ? 'Email service timed out' : err.message
    });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};
