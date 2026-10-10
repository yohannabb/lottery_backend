require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Bot, InlineKeyboard, Keyboard } = require('grammy');

// Mongoose Models
const User = require('./models/User');
const Ticket = require('./models/Ticket');

// Updated Lottery Schema with Expiration / Countdown support
const lotterySchema = new mongoose.Schema({
  title: { type: String, required: true },
  color: { type: String, required: true },
  imageUrl: { type: String, required: true },
  ticketPrice: { type: Number, required: true },
  totalTickets: { type: Number, required: true },
  soldTickets: { type: Number, default: 0 },
  remainingTickets: { type: Number },
  endDate: { type: Date, required: true },
  takenNumbers: { type: [Number], default: [] },
  isFeatured: { type: Boolean, default: true }
}, { timestamps: true });

const Lottery = mongoose.models.Lottery || mongoose.model('Lottery', lotterySchema);

// Initialize Express App
const app = express();
app.use(cors());
app.use(express.json());

// Create Uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads/receipts');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ------------------------------------------------------------------
// Telegram Bot Token Validation & Initialization
// ------------------------------------------------------------------
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;

if (!BOT_TOKEN || BOT_TOKEN === 'your_telegram_bot_token_here') {
  console.error('\n❌ ERROR: Please configure your real Telegram Bot Token in Railway Variables!');
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://gechocarekub.netlify.app';

bot.catch((err) => {
  console.error(`❌ Bot Error (${err.ctx.update.update_id}):`, err.error);
});

// ------------------------------------------------------------------
// 1. Telegram Bot Handlers
// ------------------------------------------------------------------

bot.command('start', async (ctx) => {
  try {
    const telegramId = String(ctx.from.id);

    let user = await User.findOne({ telegramId });
    if (!user) {
      user = await User.create({
        telegramId,
        firstName: ctx.from.first_name,
        username: ctx.from.username
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

    await User.findOneAndUpdate({ telegramId }, { language: selectedLang });
    await ctx.answerCallbackQuery();

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

    await ctx.reply(prompts[selectedLang], {
      reply_markup: contactKeyboard
    });
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
      { returnDocument: 'after' }
    );

    const lang = user ? user.language : 'en';

    const confirmMsgs = {
      or: '✅ Lakkoofsi bilbilaa mirkanaa\'eera.',
      am: '✅ ስልክ ቁጥር ተረጋገጠ።',
      en: '✅ Phone number confirmed.'
    };

    const appMsgs = {
      or: '👇 Appichaa banachuuf gadi bu\'aa.',
      am: '👇 መተግበሪያውን ለመክፈት ከታች ይጫኑ።',
      en: '👇 Tap below to open the app.'
    };

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

    await ctx.reply(confirmMsgs[lang], {
      reply_markup: { remove_keyboard: true }
    });

    const botUsername = ctx.me.username;
    const inviteLink = `https://t.me/share/url?url=https://t.me/${botUsername}?start=ref_${telegramId}&text=Join%20our%20Car%20Lottery!`;

    const inlineKeyboard = new InlineKeyboard()
      .webApp(appBtnTexts[lang], MINI_APP_URL).row()
      .url(inviteBtnTexts[lang], inviteLink);

    await ctx.reply(appMsgs[lang], {
      reply_markup: inlineKeyboard
    });
  } catch (error) {
    console.error('Error in contact handler:', error);
  }
});

// ------------------------------------------------------------------
// 2. Express API Routes
// ------------------------------------------------------------------

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 }, storage });

// --- USER PROFILE ENDPOINT ---
app.get('/api/users/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- LOTTERY MANAGEMENT ENDPOINTS ---

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
      title,
      color,
      imageUrl,
      ticketPrice: Number(ticketPrice),
      totalTickets: Number(totalTickets),
      remainingTickets: Number(totalTickets),
      soldTickets: 0,
      takenNumbers: [],
      endDate,
      isFeatured: isFeatured ?? true
    });

    await newLottery.save();
    res.status(201).json({ success: true, lottery: newLottery });
  } catch (error) {
    console.error('Error creating lottery:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- ADMIN ORDER MANAGEMENT ENDPOINTS ---

app.get('/api/admin/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
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

// --- TICKET & ORDER SUBMISSION ENDPOINTS ---

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

    const newTicket = new Ticket({
      orderId,
      lotteryId: lotteryId && mongoose.Types.ObjectId.isValid(lotteryId) ? lotteryId : new mongoose.Types.ObjectId(),
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

    if (lotteryId && mongoose.Types.ObjectId.isValid(lotteryId)) {
      await Lottery.findByIdAndUpdate(lotteryId, { 
        $inc: { soldTickets: Number(ticketCount), remainingTickets: -Number(ticketCount) },
        $push: { takenNumbers: {$each: parsedNumbers } }
      });
    }

    if (process.env.ADMIN_CHAT_ID && process.env.ADMIN_CHAT_ID !== 'your_admin_chat_id_here') {
      const adminMsg = 
        `🚨 *New Ticket Order Submitted*\n\n` +
        `👤 *Name:* ${fullName}\n` +
        `📞 *Phone:* ${phoneNumber}\n` +
        `🎫 *Ticket Numbers:* ${parsedNumbers.join(', ') || 'Random'}\n` +
        `💰 *Total:* ${totalPrice} Birr\n` +
        `🆔 *Order ID:* #${orderId}`;

      await bot.api.sendMessage(process.env.ADMIN_CHAT_ID, adminMsg, { parse_mode: 'Markdown' });
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
    if (telegramId) query.telegramId = telegramId;

    const tickets = await Ticket.find(query).sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ------------------------------------------------------------------
// 3. Server Startup & Database Connection
// ------------------------------------------------------------------
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ FATAL ERROR: MONGO_URI environment variable is missing!');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    
    // Bind explicitly to '0.0.0.0' for Railway routing
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API running and listening on port ${PORT}`);
    });

    // Start bot safely with conflict catching
    bot.start().catch(err => {
      console.warn('⚠️ Telegram Bot polling notice:', err.message);
    });
    console.log('🤖 Telegram Bot process initialized...');
  })
  .catch(err => {
    console.error('❌ DB Connection Error:', err);
    process.exit(1);
  });