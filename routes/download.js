const router = require('express').Router();
const { supabaseAdmin } = require('../lib/supabase');

// GET /api/download/:token
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Cari order berdasarkan token
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*, products(title, gdrive_url)')
      .eq('download_token', token)
      .eq('status', 'paid')
      .single();

    if (error || !order) {
      return res.status(404).send(renderError('Link tidak valid atau sudah tidak tersedia.'));
    }

    // Cek expired
    if (order.expired_at && new Date(order.expired_at) < new Date()) {
      return res.status(410).send(renderError('Link download sudah expired (7 hari). Hubungi admin untuk perpanjangan.'));
    }

    // Log download
    await supabaseAdmin
      .from('orders')
      .update({ last_download_at: new Date().toISOString() })
      .eq('id', order.id);

    // Convert Google Drive share link ke direct download link
    const gdriveUrl = order.products.gdrive_url;
    const directUrl = convertGdriveUrl(gdriveUrl);

    // Redirect ke Google Drive
    res.redirect(directUrl);

  } catch (err) {
    res.status(500).send(renderError('Terjadi kesalahan server.'));
  }
});

// Convert Google Drive share URL ke direct download
function convertGdriveUrl(url) {
  // Format: https://drive.google.com/file/d/FILE_ID/view
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  // Kalau sudah dalam format lain, return as is
  return url;
}

function renderError(message) {
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #0f0f0f;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .box {
      text-align: center;
      padding: 40px;
      background: #1a1a1a;
      border-radius: 16px;
      border: 1px solid #333;
      max-width: 400px;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h2 { color: #ff4444; margin-bottom: 12px; }
    p { color: #aaa; line-height: 1.6; }
    a {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 24px;
      background: #7c3aed;
      color: white;
      border-radius: 8px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">⚠️</div>
    <h2>Download Gagal</h2>
    <p>${message}</p>
    <a href="/">Kembali ke Toko</a>
  </div>
</body>
</html>`;
}

module.exports = router;
