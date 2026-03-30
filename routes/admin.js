const router = require('express').Router();
const { supabase, supabaseAdmin } = require('../lib/supabase');
const adminAuth = require('../middleware/adminAuth');
const { v4: uuidv4 } = require('uuid');

// Semua route admin butuh auth
router.use(adminAuth);

// ========================
// PRODUK
// ========================

// GET semua produk (termasuk yang nonaktif)
router.get('/products', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST tambah produk baru
router.post('/products', async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      thumbnail_url,
      preview_html,   // HTML/CSS/JS untuk sandbox preview
      gdrive_url,     // Link Google Drive ZIP
      tech_stack,     // array: ['Node.js', 'Express', 'Supabase']
      features,       // array: ['Auth sistem', 'Dashboard admin', ...]
    } = req.body;

    if (!title || !price || !gdrive_url) {
      return res.status(400).json({ error: 'title, price, gdrive_url wajib diisi' });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        title,
        description,
        price: parseInt(price),
        category: category || 'website',
        thumbnail_url,
        preview_html,
        gdrive_url,
        tech_stack: tech_stack || [],
        features: features || [],
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Produk berhasil ditambahkan', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update produk
router.put('/products/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Produk diupdate', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE / nonaktifkan produk
router.delete('/products/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('products')
      .update({ is_active: false })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'Produk dinonaktifkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// ORDERS
// ========================

// GET semua order
router.get('/orders', async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        products (title, price)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST konfirmasi pembayaran - generate download token
router.post('/orders/:id/confirm', async (req, res) => {
  try {
    // Cek order dulu
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, products(gdrive_url, title)')
      .eq('id', req.params.id)
      .single();

    if (orderError || !order) return res.status(404).json({ error: 'Order tidak ditemukan' });
    if (order.status === 'paid') return res.status(400).json({ error: 'Order sudah dikonfirmasi' });

    // Generate token unik
    const downloadToken = uuidv4();
    const expiredAt = new Date();
    expiredAt.setDate(expiredAt.getDate() + 7); // Expire 7 hari

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'paid',
        download_token: downloadToken,
        expired_at: expiredAt.toISOString(),
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: `Order ${req.params.id.slice(0, 8).toUpperCase()} dikonfirmasi`,
      data: {
        download_token: downloadToken,
        download_url: `/api/download/${downloadToken}`,
        expired_at: expiredAt,
        buyer_whatsapp: order.buyer_whatsapp,
        // Teks WA siap kirim ke buyer
        whatsapp_message: `https://wa.me/${order.buyer_whatsapp}?text=Halo+${encodeURIComponent(order.buyer_name)},+pembayaran+kamu+sudah+kami+konfirmasi!+%0A%0ASilakan+download+source+code+*${encodeURIComponent(order.products.title)}*+di+link+berikut+(berlaku+7+hari):%0A${encodeURIComponent(`${process.env.BASE_URL}/api/download/${downloadToken}`)}`,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST tolak order
router.post('/orders/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ status: 'rejected', reject_reason: reason || 'Pembayaran tidak valid' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Order ditolak', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET statistik dashboard
router.get('/stats', async (req, res) => {
  try {
    const [productsRes, ordersRes, paidRes] = await Promise.all([
      supabaseAdmin.from('products').select('id', { count: 'exact' }).eq('is_active', true),
      supabaseAdmin.from('orders').select('id', { count: 'exact' }),
      supabaseAdmin.from('orders').select('amount').eq('status', 'paid'),
    ]);

    const totalRevenue = paidRes.data?.reduce((sum, o) => sum + o.amount, 0) || 0;

    res.json({
      success: true,
      data: {
        total_products: productsRes.count || 0,
        total_orders: ordersRes.count || 0,
        total_paid: paidRes.data?.length || 0,
        total_revenue: totalRevenue,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
