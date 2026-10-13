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
  console.error('\n❌ ERROR: Please configure your real Telegram Bot Token in Railway Variables!');
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://gechocarekub.netlify.app';

bot.catch((err) => {
  console.error(`❌ Bot Error (${err.ctx?.update?.update_id || 'unknown'}):`, err.error);
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

bot.callbackQuery(/^lang_(or|am|en)$/, async (ctx) => {
  try {
    const selectedLang = ctx.match[1];
    const telegramId = String(ctx.from.id);

    await User.findOneAndUpdate(
      { telegramId }, 
      { language: selectedLang },
      { returnDocument: 'after' }
    );
    await ctx.answerCallbackQuery();

    const botUsername = ctx.me.username;
    const inviteLink = `https://t.me/share/url?url=https://t.me/${botUsername}?start=ref_${telegramId}&text=Join%20our%20Car%20Lottery!`;

    const appBtnTexts = {
      or: '🚗 App Banadhu',
      am: '🚗 መተግበሪያውን ክፈት',
      en: '🚗 Getachew Fikadu app'
    };

    const inviteBtnTexts = {
      or: '✉️ Hiriyoota affeeri',
      am: '✉️ ጓደኞችን ይጋብዙ',
      en: '✉️ Invite friends'
    };

    const welcomeBackMsgs = {
      or: '👋 Baga deebitan! Appichaa gaditi banadhaa.',
      am: '👋 እንኳን ደስ ብሎዎት! መተግበሪያውን ከታች ይክፈቱ።',
      en: '👋 Welcome back! Open the app below.'
    };

    const inlineKeyboard = new InlineKeyboard()
      .webApp(appBtnTexts[selectedLang], MINI_APP_URL).row()
      .url(inviteBtnTexts[selectedLang], inviteLink);

    await ctx.reply(welcomeBackMsgs[selectedLang], {
      reply_markup: inlineKeyboard
    });
  } catch (error) {
    console.error('Error in language callback:', error);
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 }, storage });

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Car Lottery Backend is live!' });
});

app.get('/api/users/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const user = await User.findOne({ telegramId: String(telegramId) });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Robust Profile Upsert Route (Saves Name & Phone permanently)
app.patch('/api/users/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { phoneNumber, fullName } = req.body;
    
    const updateData = { isRegistered: true };
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (fullName) updateData.firstName = fullName;

    const user = await User.findOneAndUpdate(
      { telegramId: String(telegramId) },
      updateData,
      { upsert: true, new: true, returnDocument: 'after' }
    );
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/lotteries', async (req, res) => {
  try {
    const lotteries = await Lottery.find().sort({ createdAt: -1 });
    res.json({ success: true, lotteries });
  } catch (error) {
    console.error('Error fetching lotteries:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/lotteries', async (req, res) => {
  try {
    const { title, color, imageUrl, ticketPrice, totalTickets, durationDays, isFeatured } = req.body;
    const days = Number(durationDays) || 30;
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const newLottery = new Lottery({
      title, color, imageUrl,
      ticketPrice: Number(ticketPrice),
      totalTickets: Number(totalTickets),
      soldTickets: 0,
      endDate,
      isFeatured: isFeatured ?? true,
      status: 'active'
    });

    await newLottery.save();
    res.status(201).json({ success: true, lottery: newLottery });
  } catch (error) {
    console.error('Error creating lottery:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, tickets });
  } catch (error) {
    console.error('Error fetching admin tickets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch('/api/admin/tickets/:orderId/approve', async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndUpdate(
      { orderId: req.params.orderId },
      { status: 'APPROVED' },
      { returnDocument: 'after' }
    );

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (ticket.lotteryId && ticket.selectedNumbers && ticket.selectedNumbers.length > 0) {
      const numericNumbers = ticket.selectedNumbers.map(n => Number(n));
      await Lottery.findByIdAndUpdate(ticket.lotteryId, {
        $addToSet: { takenNumbers: { $each: numericNumbers } }
      });
    }

    if (ticket.telegramId) {
      try {
        await bot.api.sendMessage(
          ticket.telegramId,
          `🎉 *Ticket Approved!*\n\nYour order *#${ticket.orderId}* has been confirmed by the admin. Good luck!`
        );
      } catch (e) {
        console.error('Failed to notify customer on Telegram:', e.message);
      }
    }

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Error approving ticket:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch('/api/admin/tickets/:orderId/reject', async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndUpdate(
      { orderId: req.params.orderId },
      { status: 'REJECTED' },
      { returnDocument: 'after' }
    );

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (ticket.telegramId) {
      try {
        await bot.api.sendMessage(
          ticket.telegramId,
          `❌ *Ticket Order Update*\n\nYour order *#${ticket.orderId}* was rejected. Please verify your receipt or contact support.`
        );
      } catch (e) {
        console.error('Failed to notify customer on Telegram:', e.message);
      }
    }

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Error rejecting ticket:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/tickets/order', upload.single('receipt'), async (req, res) => {
  try {
    const { 
      lotteryId, telegramId, fullName, phoneNumber, 
      selectedNumbers, isQuickPick, ticketCount, totalPrice, 
      bankName, senderAccount 
    } = req.body;

    const parsedNumbers = selectedNumbers ? JSON.parse(selectedNumbers) : [];
    const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : null;
    const orderId = 'swCX' + Math.random().toString(36).substring(2, 8) + 'JT';

    const validPhoneNumber = (phoneNumber && phoneNumber.trim() !== '') ? phoneNumber : '+251900000000';

    const newTicket = new Ticket({
      orderId,
      lotteryId,
      telegramId: String(telegramId),
      fullName,
      phoneNumber: validPhoneNumber,
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

    if (lotteryId && mongoose.Types.ObjectId.isValid(lotteryId)) {
      await Lottery.findByIdAndUpdate(lotteryId, { 
        $inc: { soldTickets: Number(ticketCount) } 
      });
    }

    res.status(201).json({ success: true, orderId, ticket: newTicket });
  } catch (error) {
    console.error('Error saving order:', error);
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
    console.error('Error fetching tickets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ FATAL ERROR: MONGO_URI environment variable is missing!');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected successfully');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API running and listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ DB Connection Error:', err);
    process.exit(1);
  });