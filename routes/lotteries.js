const mongoose = require('mongoose');

const lotterySchema = new mongoose.Schema({
  title: { type: String, required: true },
  color: { type: String, required: true },
  imageUrl: { type: String, required: true },
  ticketPrice: { type: Number, required: true },
  totalTickets: { type: Number, required: true },
  soldTickets: { type: Number, default: 0 },
  takenNumbers: { type: [Number], default: [] },
  endDate: { type: Date, required: true },
  isFeatured: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lottery', lotterySchema);