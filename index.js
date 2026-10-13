require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Bot, InlineKeyboard, Keyboard } = require('grammy');

const User = require('./models/User');
const Ticket = require('./models/Ticket');
const Lottery = require('./models/Lottery');

const app = express();
app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads/receipts');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
if (!BOT_TOKEN || BOT_TOKEN === 'your_telegram_bot_token_here') {
  console.error('\n❌ ERROR: Please configure your real Telegram Bot Token!');
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://gechocarekub.netlify.app';

bot.catch((err) => {
  console.error(`❌ Bot Error:`, err.error);
});

bot.command('start', async (ctx) => {
  try {
    const telegramId = String(ctx.from.id);

    let user = await User.findOne({ telegramId });
    if (!user) {
      user = await User.create({
        telegramId,
        firstName: ctx.from.first_name || '',
        username: ctx.from.username || ''
      });
    }

    const welcomeMessage = 
      `🚗 *Getachew Fikadu Jirata*\n\n` +
      `Baga gara Bot keenyaa dhuftan.\n` +
      `ወደ Bot'ችን እንኳን በደህና መጡ።\n` +
      `Welcome to our Bot.\n\n` +
      `Maaloo Afaan filadhaa.\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `እባክዎ ቋንቋ ይምረጡ።\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `Please select your language.`;

    const keyboard = new InlineKeyboard()
      .text('🇪🇹 Afaan Oromo', 'lang_or').row()
      .text('🇪🇹 አማርኛ', 'lang_am').row()
      .text('🇬🇧 English', 'lang_en');

    await ctx.reply(welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Error in /start command:', error);
  }
});

// INTELLIGENT CALLBACK: Checks if phone number exists in DB to prevent asking twice!
bot.callbackQuery(/^lang_(or|am|en)$/, async (ctx) => {
  try {
    const selectedLang = ctx.match[1];
    const telegramId = String(ctx.from.id);

    const user = await User.findOneAndUpdate(
      { telegramId }, 
      { language: selectedLang },
      { returnDocument: 'after' }
    );
    await ctx.answerCallbackQuery();

    const botUsername = ctx.me.username;
    const inviteLink = `https://t.me/share/url?url=https://t.me/${botUsername}?start=ref_${telegramId}&text=Join%20our%20Car%20Lottery!`;

    const appBtnTexts = { or: '🚗 App Banadhu', am: '🚗 መተግበሪያውን ክፈት', en: '🚗 Getachew Fikadu app' };
    const inviteBtnTexts = { or: '✉️ Hiriyoota affeeri', am: '✉️ ጓደኞችን ይጋብዙ', en: '✉️ Invite friends' };

    // If user already has a phone number saved, skip asking for phone number completely!
    if (user && user.phoneNumber && user.phoneNumber.trim() !== '') {
      const welcomeBackMsgs = {
        or: '👋 Baga deebitan! Appichaa gaditi banadhaa.',
        am: '👋 እንኳን ደስ ብሎዎት! መተግበሪያውን ከታች ይክፈቱ።',
        en: '👋 Welcome back! Open the app below.'
      };

      const inlineKeyboard = new InlineKeyboard()
        .webApp(appBtnTexts[selectedLang], MINI_APP_URL).row()
        .url(inviteBtnTexts[selectedLang], inviteLink);

      await ctx.reply(welcomeBackMsgs[selectedLang], { reply_markup: inlineKeyboard });
      return;
    }

    const prompts = {
      or: 'Maaloo lakkoofsa bilbilaa keessan ergaa.',
      am: 'እባክዎ ስልክ ቁጥርዎን ያካፍሉ።',
      en: 'Please share your phone number.'
    };

    const buttonTexts = {
      or: '📱 Lakkoofsa bilbilaa ergi',
      am: '📱 ስልክ ቁጥር ያካፍሉ',
      en: '📱 Share my phone'
    };

    const contactKeyboard = new Keyboard()
      .requestContact(buttonTexts[selectedLang])
      .resized()
      .oneTime();

    await ctx.reply(prompts[selectedLang], { reply_markup: contactKeyboard });
  } catch (error) {
    console.error('Error in language callback:', error);
  }
});

bot.on('message:contact', async (ctx) => {
  try {
    const telegramId = String(ctx.from.id);
    const phoneNumber = ctx.message.contact.phone_number;

    const user = await User.findOneAndUpdate(
      { telegramId },
      { phoneNumber, isRegistered: true },
      { upsert: true, returnDocument: 'after' }
    );

    const lang = user ? user.language : 'en';
    const appBtnTexts = { or: '🚗 App Banadhu', am: '🚗 መተግበሪያውን ክፈት', en: '🚗 Getachew Fikadu app' };
    const inviteBtnTexts = { or: '✉️ Hiriyoota affeeri', am: '✉️ ጓደኞችን ይጋብዙ', en: '✉️ Invite friends' };

    await ctx.reply('✅ Phone number confirmed.', { reply_markup: { remove_keyboard: true } });

    const botUsername = ctx.me.username;
    const inviteLink = `https://t.me/share/url?url=https://t.me/${botUsername}?start=ref_${telegramId}&text=Join%20our%20Car%20Lottery!`;

    const inlineKeyboard = new InlineKeyboard()
      .webApp(appBtnTexts[lang], MINI_APP_URL).row()
      .url(inviteBtnTexts[lang], inviteLink);

    await ctx.reply('👇 Tap below to open the app.', { reply_markup: inlineKeyboard });
  } catch (error) {
    console.error('Error in contact handler:', error);
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 }, storage });

app.get('/', (req, res) => res.json({ success: true, message: 'Backend live' }));

app.get('/api/users/:telegramId', async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: String(req.params.telegramId) });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch('/api/users/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { phoneNumber, fullName } = req.body;
    const updateData = { isRegistered: true };
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (fullName) {
      updateData.fullName = fullName;
      updateData.firstName = fullName;
    }

    const user = await User.findOneAndUpdate(
      { telegramId: String(telegramId) },
      updateData,
      { upsert: true, new: true, returnDocument: 'after' }
    );
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/lotteries', async (req, res) => {
  try {
    const lotteries = await Lottery.find().sort({ createdAt: -1 });
    res.json({ success: true, lotteries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/lotteries', async (req, res) => {
  try {
    const newLottery = new Lottery(req.body);
    await newLottery.save();
    res.status(201).json({ success: true, lottery: newLottery });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch('/api/admin/tickets/:orderId/approve', async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndUpdate({ orderId: req.params.orderId }, { status: 'APPROVED' }, { returnDocument: 'after' });
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch('/api/admin/tickets/:orderId/reject', async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndUpdate({ orderId: req.params.orderId }, { status: 'REJECTED' }, { returnDocument: 'after' });
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/tickets/order', upload.single('receipt'), async (req, res) => {
  try {
    const { lotteryId, telegramId, fullName, phoneNumber, selectedNumbers, isQuickPick, ticketCount, totalPrice, senderAccount } = req.body;
    const parsedNumbers = selectedNumbers ? JSON.parse(selectedNumbers) : [];
    const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : null;
    const orderId = 'swCX' + Math.random().toString(36).substring(2, 8) + 'JT';

    const newTicket = new Ticket({
      orderId, lotteryId, telegramId: String(telegramId), fullName,
      phoneNumber: phoneNumber || '+251900000000',
      selectedNumbers: parsedNumbers, isQuickPick: isQuickPick === 'true',
      ticketCount: Number(ticketCount), totalPrice: Number(totalPrice),
      senderAccount, receiptUrl, status: 'PENDING REVIEW'
    });

    await newTicket.save();
    res.status(201).json({ success: true, orderId, ticket: newTicket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/tickets/user-tickets', async (req, res) => {
  try {
    const { phoneNumber, telegramId } = req.query;
    const query = {};
    if (phoneNumber) query.phoneNumber = phoneNumber;
    if (telegramId) query.telegramId = String(telegramId);
    const tickets = await Ticket.find(query).populate('lotteryId').sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI).then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`🚀 API running on port ${PORT}`));
  bot.start().catch((err) => console.warn('Telegram warning:', err.message));
});