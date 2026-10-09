const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Ticket = require('../models/Ticket');
const Lottery = require('../models/Lottery');

// Multer storage configuration for payment receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/receipts/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 }, storage });

// Create New Ticket Order
router.post('/order', upload.single('receipt'), async (req, res) => {
  try {
    const { 
      lotteryId, telegramId, fullName, phoneNumber, 
      selectedNumbers, isQuickPick, ticketCount, totalPrice, 
      bankName, senderAccount 
    } = req.body;

    const parsedNumbers = selectedNumbers ? JSON.parse(selectedNumbers) : [];
    const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : null;
    const orderId = 'swCX' + Math.random().toString(36).substring(2, 8) + 'JT';

    const newTicket = new Ticket({
      orderId,
      lotteryId,
      telegramId,
      fullName,
      phoneNumber,
      selectedNumbers: parsedNumbers,
      isQuickPick: isQuickPick === 'true',
      ticketCount: Number(ticketCount),
      totalPrice: Number(totalPrice),
      bankName,
      senderAccount,
      receiptUrl,
      status: 'PENDING REVIEW'
    });

    await newTicket.save();

    // Update lottery sold tickets count
    await Lottery.findByIdAndUpdate(lotteryId, { 
      $inc: { soldTickets: Number(ticketCount) } 
    });

    res.status(201).json({ success: true, orderId, ticket: newTicket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fetch Tickets by User Phone / Telegram ID
router.get('/user-tickets', async (req, res) => {
  try {
    const { phoneNumber, telegramId } = req.query;
    const query = {};
    if (phoneNumber) query.phoneNumber = phoneNumber;
    if (telegramId) query.telegramId = telegramId;

    const tickets = await Ticket.find(query).populate('lotteryId').sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;