const express = require('express');
const router = express.Router();
const Lottery = require('../models/Lottery');

// Get active/featured lottery
router.get('/featured', async (req, res) => {
  try {
    const lottery = await Lottery.findOne({ isFeatured: true, status: 'active' });
    if (!lottery) return res.status(404).json({ message: 'No active lottery found' });
    res.json(lottery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;