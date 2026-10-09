const mongoose = require('mongoose');

const lotterySchema = new mongoose.Schema({
  title: { type: String, required: true }, // e.g. "BYD Leo Pard 7"
  color: { type: String, required: true }, // e.g. "Black"
  imageUrl: { type: String, required: true },
  ticketPrice: { type: Number, required: true }, // e.g. 6000
  totalTickets: { type: Number, required: true }, // e.g. 4000
  soldTickets: { type: Number, default: 0 },
  endDate: { type: Date, required: true },
  isFeatured: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lottery', lotterySchema);