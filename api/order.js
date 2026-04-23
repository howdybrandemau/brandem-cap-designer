module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    name, email, phone, qty, sizes, notes,
    colours, text_elements, logos, extras, total,
    svg_b64, underbrim_b64, underbrim_ext, logos_data
  } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  console.log('svg_b64 length:', svg_b64 ? svg_b64.length : 0);
  console.log('underbrim_b64 length:', underbrim_b64 ? underbrim_b64.length : 0);
  console.log('logos_data count:', logos_data ? logos_data.length : 0);

  // ── Email body ─────────────────────────────────────────────────────────────
  const emailHtml = ''
    + '<h2 style="color:#47360B;font-family:sans-serif">New Cap Design Order 🧢</h2>'
    + '<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%">'
    + '<tr><td style="padding:8px;font-weight:bold;width:140px">Name</td><td style="padding:8px">' + name + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px"><a href="mailto:' + email + '">' + email + '</a></td></tr>'
    + '<tr><td style="padding:8px;font-weight:bold">Phone</td><td style="padding:8px">' + (phone || '—') + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold">Quantity</td><td style="padding:8px">' + qty + ' hats</td></tr>'
    + '<tr><td style="padding:8px;font-weight:bold;vertical-align:top">Sizes</td><td style="padding:8px;white-space:pre-line">' + (sizes || '—') + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold">Total</td><td style="padding:8px;font-size:18px;font-weight:bold;color:#F74D24">' + total + '</td></tr>'
    + '<tr><td style="padding:8px;font-weight:bold">Notes</td><td style="padding:8px">' + (notes || '—') + '</td></tr>'
    + '</table>'
    + '<h3 style="font-family:sans-serif;color:#47360B;margin-top:24px">Design Details</h3>'
    + '<table style="font-family:sans-serif;font-size:13px;border-collapse:collapse;width:100%">'
    + '<tr><td style="padding:8px;font-weight:bold;width:140px;vertical-align:top">Colours</td><td style="padding:8px;white-space:pre-line">' + (colours || '—') + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold;vertical-align:top">Text</td><td style="padding:8px;white-space:pre-line">' + (text_elements || 'None') + '</td></tr>'
    + '<tr><td style="padding:8px;font-weight:bold;vertical-align:top">Logos</td><td style="padding:8px">' + (logos || 'None') + '</td></tr>'
    + '<tr style="background:#FFF8EE"><td style="padding:8px;font-weight:bold;vertical-align:top">Extras</td><td style="padding:8px;white-space:pre-line">' + (extras || 'None') + '</td></tr>'
    + '</table>'
    + '<p style="font-family:sans-serif;font-size:13px;color:#47360B;margin-top:24px">'
    + (svg_b64 && svg_b64.length > 100 ? '📎 Cap design attached as cap-design.svg' : '⚠️ No cap design file received') + '</p>'
    + (underbrim_b64 && underbrim_b64.length > 100 ? '<p style="font-family:sans-serif;font-size:13px;color:#47360B">📎 Underbrim photo attached</p>' : '')
    + (logos_data && logos_data.length > 0 ? '<p style="font-family:sans-serif;font-size:13px;color:#47360B">📎 ' + logos_data.length + ' logo file(s) attached</p>' : '')
    + '<p style="font-family:sans-serif;font-size:11px;color:#9A8A6A;margin-top:24px">Sent from brandem-cap-designer.vercel.app</p>';

  // ── Attachments ────────────────────────────────────────────────────────────
  const attachments = [];

  // Cap design SVG
  if (svg_b64 && svg_b64.length > 100) {
    try {
      const decoded = Buffer.from(svg_b64, 'base64');
      console.log('SVG decoded size:', decoded.length, 'bytes');
      attachments.push({ filename: 'cap-design.svg', content: svg_b64 });
    } catch(e) { console.error('SVG attachment error:', e.message); }
  }

  // Underbrim photo
  if (underbrim_b64 && underbrim_b64.length > 100) {
    try {
      const ext = (underbrim_ext || 'jpg').replace('jpeg', 'jpg').replace('image/', '');
      attachments.push({ filename: 'underbrim-photo.' + ext, content: underbrim_b64 });
    } catch(e) { console.error('Underbrim attachment error:', e.message); }
  }

  // Logos
  if (logos_data && Array.isArray(logos_data)) {
    logos_data.forEach(function(logo, i) {
      try {
        if (logo.ext === 'svg' && logo.svg && logo.svg.length > 50) {
          // SVG logo — encode as base64
          const svgB64 = Buffer.from(logo.svg).toString('base64');
          attachments.push({ filename: 'logo-' + (i + 1) + '.svg', content: svgB64 });
          console.log('Logo', i + 1, 'SVG attached, size:', logo.svg.length);
        } else if (logo.b64 && logo.b64.length > 100) {
          // Raster logo (already compressed by client)
          const ext = (logo.ext || 'jpg').replace('jpeg', 'jpg').replace('image/', '');
          attachments.push({ filename: 'logo-' + (i + 1) + '.' + ext, content: logo.b64 });
          console.log('Logo', i + 1, 'raster attached, base64 length:', logo.b64.length);
        }
      } catch(e) { console.error('Logo ' + (i + 1) + ' attachment error:', e.message); }
    });
  }

  console.log('Total attachments:', attachments.map(a => a.filename));

  // ── Send email via Resend ─────────────────────────────────────────────────
  const emailController = new AbortController();
  const emailTimeout = setTimeout(() => emailController.abort(), 25000);
  let emailOk = false;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: emailController.signal,
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
    clearTimeout(emailTimeout);
    const txt = await response.text();
    console.log('Resend status:', response.status, txt.slice(0, 120));
    if (response.ok) emailOk = true;
    else console.error('Resend error:', txt);
  } catch(e) {
    clearTimeout(emailTimeout);
    console.error('Resend fetch error:', e.message);
  }

  // ── Create Monday.com item ─────────────────────────────────────────────────
  const boardId = process.env.MONDAY_BOARD_ID;
  const mondayKey = process.env.MONDAY_API_KEY;
  let mondayOk = false;

  if (boardId && mondayKey) {
    try {
      const columnValues = JSON.stringify({
        email:    { email: email, text: email },
        phone:    { phone: phone || '', countryShortName: 'AU' },
        numbers:  qty ? String(qty) : '',
        text:     total || '',
        long_text: { text: (colours || '') + '\n\nSizes: ' + (sizes || '—') + '\n\nText: ' + (text_elements || 'None') + '\nLogos: ' + (logos || 'None') + '\nExtras: ' + (extras || 'None') + (notes ? '\nNotes: ' + notes : '') }
      });

      const mondayQuery = `mutation {
        create_item (
          board_id: ` + boardId + `,
          item_name: "` + name.replace(/"/g, '\\"') + ` — ` + qty + ` hats — ` + total + `",
          column_values: "` + columnValues.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + `"
        ) { id }
      }`;

      const mondayRes = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': mondayKey,
          'API-Version':   '2024-01'
        },
        body: JSON.stringify({ query: mondayQuery })
      });

      const mondayData = await mondayRes.json();
      console.log('Monday response:', JSON.stringify(mondayData).slice(0, 200));

      if (mondayData.data && mondayData.data.create_item && mondayData.data.create_item.id) {
        mondayOk = true;
        console.log('Monday item created, id:', mondayData.data.create_item.id);
      } else if (mondayData.errors) {
        console.warn('Monday column error, retrying with name only:', JSON.stringify(mondayData.errors));
        const simpleQuery = `mutation {
          create_item (
            board_id: ` + boardId + `,
            item_name: "` + name.replace(/"/g, '\\"') + ` — ` + (phone || '') + ` — ` + qty + ` hats — ` + total + `"
          ) { id }
        }`;
        const retry = await fetch('https://api.monday.com/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': mondayKey, 'API-Version': '2024-01' },
          body: JSON.stringify({ query: simpleQuery })
        });
        const retryData = await retry.json();
        console.log('Monday retry response:', JSON.stringify(retryData).slice(0, 200));
        if (retryData.data && retryData.data.create_item) mondayOk = true;
      }
    } catch(e) {
      console.error('Monday error:', e.message);
    }
  } else {
    console.warn('Monday env vars missing');
  }

  console.log('Email:', emailOk ? 'OK' : 'FAILED', '| Monday:', mondayOk ? 'OK' : 'FAILED');

  if (emailOk) return res.status(200).json({ ok: true, monday: mondayOk });
  return res.status(500).json({ error: 'Email failed — please try again or contact howdy@brandemau.com' });
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};
