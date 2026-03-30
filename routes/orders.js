const router = require('express').Router();
const { supabase, supabaseAdmin } = require('../lib/supabase');
const { v4: uuidv4 } = require('uuid');

// POST - Buat order baru
router.post('/', async (req, res) => {
  try {
    const { product_id, buyer_name, buyer_email, buyer_whatsapp } = req.body;

    if (!product_id || !buyer_name || !buyer_email || !buyer_whatsapp) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }

    // Ambil data produk
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, title, price')
      .eq('id', product_id)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }

    // Buat order
    const orderId = uuidv4();
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        id: orderId,
        product_id,
        buyer_name,
        buyer_email,
        buyer_whatsapp,
        amount: product.price,
        status: 'pending',
        download_token: null,
        expired_at: null,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Info rekening untuk transfer
    const paymentInfo = {
      bank: process.env.BANK_NAME || 'BCA',
      account_number: process.env.BANK_ACCOUNT || '1234567890',
      account_name: process.env.BANK_OWNER || 'Nama Kamu',
      amount: product.price,
      note: `Pembayaran Source Code - ${orderId.slice(0, 8).toUpperCase()}`,
    };

    res.json({
      success: true,
      message: 'Order berhasil dibuat',
      data: {
        order_id: orderId,
        product_title: product.title,
        payment: paymentInfo,
        whatsapp_confirm: `https://wa.me/${process.env.ADMIN_WA}?text=Halo+admin,+saya+sudah+transfer+untuk+order+ID:+${orderId.slice(0, 8).toUpperCase()}+atas+nama+${encodeURIComponent(buyer_name)}`,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - Cek status order by ID
router.get('/:id/status', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, status, buyer_name, amount, download_token, expired_at, created_at')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Order tidak ditemukan' });

    const response = {
      success: true,
      data: {
        order_id: data.id,
        status: data.status,
        buyer_name: data.buyer_name,
        amount: data.amount,
        created_at: data.created_at,
      },
    };

    // Kalau sudah paid, kasih download token
    if (data.status === 'paid' && data.download_token) {
      const isExpired = data.expired_at && new Date(data.expired_at) < new Date();
      response.data.download_url = isExpired ? null : `/api/download/${data.download_token}`;
      response.data.expired_at = data.expired_at;
      response.data.is_expired = isExpired;
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
