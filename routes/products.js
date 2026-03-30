const router = require('express').Router();
const { supabase } = require('../lib/supabase');

// GET all products (public)
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;

    let query = supabase
      .from('products')
      .select('id, title, description, price, category, thumbnail_url, preview_html, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single product (public)
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, title, description, price, category, thumbnail_url, preview_html, tech_stack, features, created_at')
      .eq('id', req.params.id)
      .eq('is_active', true)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Product not found' });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
