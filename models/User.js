const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true }, // Changed from Number to String
  firstName: { type: String },
  username: { type: String },
  language: { type: String, enum: ['or', 'am', 'en'], default: 'en' },
  phoneNumber: { type: String },
  isRegistered: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);