const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  lotteryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lottery', required: true },
  telegramId: { type: String, required: true },
  fullName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  selectedNumbers: [{ type: Number }],
  isQuickPick: { type: Boolean, default: false },
  ticketCount: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  bankName: { type: String },
  senderAccount: { type: String },
  receiptUrl: { type: String },
  status: { 
    type: String, 
    enum: ['PENDING REVIEW', 'APPROVED', 'REJECTED'], 
    default: 'PENDING REVIEW' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);