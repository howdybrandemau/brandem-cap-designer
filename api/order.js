module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    name, email, phone, qty, notes,
    colours, text_elements, logos, extras, total,
    svg, underbrim_b64, underbrim_type
  } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  // Embed design preview inline in the email body (no attachments needed)
  let svgImgTag = '';
  if (svg && svg.length > 10) {
    svgImgTag = '<h3 style="color:#47360B;margin-top:32px">Cap Design Preview</h3>'
      + '<img src="data:image/svg+xml;base64,' + svg + '" width="600" '
      + 'style="max-width:100%;border:1px solid #eee;border-radius:8px;display:block;" alt="Cap Design"/>';
    console.log('SVG included, b64 length:', svg.length);
  } else {
    console.warn('No SVG in payload');
  }

  let underbrimImgTag = '';
  if (underbrim_b64 && underbrim_b64.length > 10) {
    const mime = underbrim_type || 'image/jpeg';
    underbrimImgTag = '<h3 style="color:#47360B;margin-top:24px">Underbrim Photo</h3>'
      + '<img src="data:' + mime + ';base64,' + underbrim_b64 + '" width="400" '
      + 'style="max-width:100%;border:1px solid #eee;border-radius:8px;display:block;" alt="Underbrim Photo"/>';
    console.log('Underbrim included, b64 length:', underbrim_b64.length);
  }

  const emailHtml = ''
    + '<h2 style="color:#47360B">New Cap Design Order 🧢</h2>'
    + '<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%">'
    + '<tr><td style="padding:8px;font-weight:bold;width:140px">Name</td><td style="padding:8px">' + name + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px"><a href="mailto:' + email + '">' + email + '</a></td></tr>'
    + '<tr><td style="padding:8px;font-weight:bold">Phone</td><td style="padding:8px">' + (phone || '—') + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold">Quantity</td><td style="padding:8px">' + qty + ' hats</td></tr>'
    + '<tr><td style="padding:8px;font-weight:bold">Total</td><td style="padding:8px;font-size:18px;font-weight:bold;color:#F74D24">' + total + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold">Notes</td><td style="padding:8px">' + (notes || '—') + '</td></tr>'
    + '</table>'
    + '<h3 style="color:#47360B;margin-top:24px">Design Details</h3>'
    + '<table style="font-family:sans-serif;font-size:13px;border-collapse:collapse;width:100%">'
    + '<tr><td style="padding:8px;font-weight:bold;width:140px;vertical-align:top">Colours</td><td style="padding:8px;white-space:pre-line">' + (colours || '—') + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold;vertical-align:top">Text</td><td style="padding:8px;white-space:pre-line">' + (text_elements || 'None') + '</td></tr>'
    + '<tr><td style="padding:8px;font-weight:bold;vertical-align:top">Logos</td><td style="padding:8px">' + (logos || 'None') + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold;vertical-align:top">Extras</td><td style="padding:8px;white-space:pre-line">' + (extras || 'None') + '</td></tr>'
    + '</table>'
    + svgImgTag
    + underbrimImgTag
    + '<p style="font-family:sans-serif;font-size:12px;color:#9A8A6A;margin-top:24px">Sent from brandem-cap-designer.vercel.app</p>';

  console.log('Email HTML size:', emailHtml.length);

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
        from:     'Brandem Cap Designer <howdy@brandemau.com>',
        to:       ['howdy@brandemau.com'],
        reply_to: email,
        subject:  'New Cap Order — ' + name + ' — ' + qty + ' hats — ' + total,
        html:     emailHtml
      })
    });

    clearTimeout(timeoutId);
    const responseText = await response.text();

    if (!response.ok) {
      console.error('Resend error:', response.status, responseText);
      return res.status(500).json({ error: 'Resend ' + response.status + ': ' + responseText.slice(0,300) });
    }

    console.log('Email sent OK');
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
