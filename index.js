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

const uploadDir = path.join(process.cwd(), 'uploads/receipts');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
if (!BOT_TOKEN || BOT_TOKEN === 'your_telegram_bot_token_here') {
  console.error('\n❌ ERROR: Please configure your real Telegram Bot Token!');
  process.exit(1);
}

const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || '8252809538';

const bot = new Bot(BOT_TOKEN);
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://gechocarekub.netlify.app';

bot.catch((err) => {
  console.error(`❌ Bot Error:`, err.error);
});

// 🌐 MULTI-LANGUAGE STRINGS DICTIONARY
const LOCALES = {
  en: {
    welcome: "🚗 *Getachew Fikadu Jirata*\n\nWelcome to our Bot.\nPlease select your language.",
    phonePrompt: "Please share your phone number.",
    shareButton: "📱 Share my phone",
    phoneConfirmed: "✅ Phone number confirmed.",
    tapOpenApp: "👇 Tap below to open the app.",
    appBtn: "🚗 Open App",
    inviteBtn: "✉️ Invite friends",
    welcomeBack: "👋 Welcome back! Open the app below.",
    unauthorized: "❌ Unauthorized: Your ID does not match the configured admin ID.",
    broadcastUsage: "⚠️ *Usage:* Please include the text to broadcast.\n\nExample:\n`/post 🚨 New car added! Open the app to select your numbers.`",
    broadcasting: "⏳ Broadcasting message to all subscribers...",
    broadcastDone: "✅ *Broadcast Completed Successfully!*\n\n📥 *Delivered:* {success}\n❌ *Failed:* {fail}"
  },
  or: {
    welcome: "🚗 *Getachew Fikadu Jirata*\n\nBaga gara Bot keenyaa dhuftan.\nMaaloo Afaan filadhaa.",
    phonePrompt: "Maaloo lakkoofsa bilbilaa keessan ergaa.",
    shareButton: "📱 Lakkoofsa bilbilaa ergi",
    phoneConfirmed: "✅ Lakkoofsi bilbilaa mirkanaa'eera.",
    tapOpenApp: "👇 Appicha banachuuf gadi tuqaa.",
    appBtn: "🚗 App Banadhu",
    inviteBtn: "✉️ Hiriyoota affeeri",
    welcomeBack: "👋 Baga deebitan! Appichaa gaditi banadhaa.",
    unauthorized: "❌ Hayyama hin qabdu: ID keessan admin wajjin wal hin simu.",
    broadcastUsage: "⚠️ *Fayyadamni:* Ergaa dabarsuu barbaaddu barreessaa.\n\nFakkeenyaaf:\n`/post 🚨 Motooriin haaraan dhufeera!`",
    broadcasting: "⏳ Ergaa hundaaf dabarsaa jira...",
    broadcastDone: "✅ *Ergaan milkaa'inaan darbeera!*\n\n📥 *Kan qaqqabe:* {success}\n❌ *Kan kufu:* {fail}"
  },
  am: {
    welcome: "🚗 *ጌታቸው ፋቃዱ ጅራታ*\n\nወደ ቦታችን እንኳን በደህና መጡ።\nእባክዎ ቋንቋ ይምረጡ።",
    phonePrompt: "እባክዎ ስልክ ቁጥርዎን ያካፍሉ።",
    shareButton: "📱 ስልክ ቁጥር ያካፍሉ",
    phoneConfirmed: "✅ ስልክ ቁጥርዎ ተረጋግጧል።",
    tapOpenApp: "👇 መተግበሪያውን ለመክፈት ከታች ያለውን ይጫኑ።",
    appBtn: "🚗 መተግበሪያውን ክፈት",
    inviteBtn: "✉️ ጓደኞችን ይጋብዙ",
    welcomeBack: "👋 እንኳን ደስ ብሎዎት! መተግበሪያውን ከታች ይክፈቱ።",
    unauthorized: "❌ ፈቃድ የለዎትም: መታወቂያዎ ከአድሚን ጋር አይዛመድም።",
    broadcastUsage: "⚠️ *አጠቃቀም:* ለተጠቃሚዎች ማስተላለፍ የሚፈልጉትን ጽሁፍ ያካትቱ።\n\nምሳሌ:\n`/post 🚨 አዲስ መኪና ገብቷል!`",
    broadcasting: "⏳ መልዕክቱ ለሁሉም ተጠቃሚዎች እየተላለፈ ነው...",
    broadcastDone: "✅ *መልዕክት ማስተላለፍ ተጠናቋል!*\n\n📥 *የደረሰው:* {success}\n❌ *ያልደረሰው:* {fail}"
  }
};

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

    const lang = user.language || 'en';
    const text = LOCALES[lang] ? LOCALES[lang].welcome : LOCALES['en'].welcome;

    const keyboard = new InlineKeyboard()
      .text('🇪🇹 Afaan Oromo', 'lang_or').row()
      .text('🇪🇹 አማርኛ', 'lang_am').row()
      .text('🇬🇧 English', 'lang_en');

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Error in /start command:', error);
  }
});

const processedUpdates = new Set();
let isBroadcasting = false;

async function executeBroadcast(imageUrl, broadcastText) {
  const users = await User.find({ telegramId: { $exists: true,$ne: null } });
  let successCount = 0;
  let failCount = 0;

  for (const user of users) {
    const lang = user.language || 'en';
    const appBtnText = LOCALES[lang] ? LOCALES[lang].appBtn : LOCALES['en'].appBtn;
    
    const broadcastKeyboard = new InlineKeyboard()
      .webApp(appBtnText, MINI_APP_URL);

    try {
      if (imageUrl && imageUrl.trim() !== '') {
        await bot.api.sendPhoto(user.telegramId, imageUrl.trim(), {
          caption: broadcastText,
          parse_mode: 'Markdown',
          reply_markup: broadcastKeyboard
        });
      } else {
        await bot.api.sendMessage(user.telegramId, broadcastText, { 
          parse_mode: 'Markdown',
          reply_markup: broadcastKeyboard
        });
      }
      successCount++;
    } catch (err) {
      failCount++;
    }
  }
  return { successCount, failCount };
}

// 📢 FOOLPROOF TEXT LISTENER FOR /post BROADCASTING
bot.on('message:text', async (ctx, next) => {
  const text = ctx.message.text || '';
  
  if (text.toLowerCase().startsWith('/post')) {
    const updateId = ctx.update.update_id;
    const msgId = ctx.message.message_id;
    const lockKey = `${updateId}-${msgId}`;

    if (processedUpdates.has(lockKey) || isBroadcasting) {
      return;
    }

    processedUpdates.add(lockKey);
    setTimeout(() => processedUpdates.delete(lockKey), 120000);

    try {
      const senderId = String(ctx.from.id).trim();
      const adminId = String(ADMIN_TELEGRAM_ID).trim();

      if (senderId !== adminId) {
        await ctx.reply(LOCALES['en'].unauthorized);
        return;
      }

      const broadcastText = text.replace(/^\/post\s*/i, '').trim();

      if (!broadcastText) {
        await ctx.reply(LOCALES['en'].broadcastUsage, { parse_mode: 'Markdown' });
        return;
      }

      isBroadcasting = true;
      await ctx.reply(LOCALES['en'].broadcasting);

      const { successCount, failCount } = await executeBroadcast(null, broadcastText);

      await ctx.reply(
        LOCALES['en'].broadcastDone
          .replace('{success}', successCount)
          .replace('{fail}', failCount),
        { parse_mode: 'Markdown' }
      );
      return;
    } catch (error) {
      console.error('Error handling broadcast text:', error);
      await ctx.reply('❌ An error occurred while sending the broadcast.');
      return;
    } finally {
      isBroadcasting = false;
    }
  }

  return next();
});

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

    const locale = LOCALES[selectedLang] || LOCALES['en'];
    const botUsername = ctx.me.username;
    const inviteLink = `https://t.me/share/url?url=https://t.me/${botUsername}?start=ref_${telegramId}&text=Join%2520our%2520Car%2520Lottery!`;

    if (user && user.phoneNumber && user.phoneNumber.trim() !== '') {
      const inlineKeyboard = new InlineKeyboard()
        .webApp(locale.appBtn, MINI_APP_URL).row()
        .url(locale.inviteBtn, inviteLink);

      await ctx.reply(locale.welcomeBack, { reply_markup: inlineKeyboard });
      return;
    }

    const contactKeyboard = new Keyboard()
      .requestContact(locale.shareButton)
      .resized()
      .oneTime();

    await ctx.reply(locale.phonePrompt, { reply_markup: contactKeyboard });
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
    const locale = LOCALES[lang] || LOCALES['en'];

    await ctx.reply(locale.phoneConfirmed, { reply_markup: { remove_keyboard: true } });

    const botUsername = ctx.me.username;
    const inviteLink = `https://t.me/share/url?url=https://t.me/${botUsername}?start=ref_${telegramId}&text=Join%2520our%2520Car%2520Lottery!`;

    const inlineKeyboard = new InlineKeyboard()
      .webApp(locale.appBtn, MINI_APP_URL).row()
      .url(locale.inviteBtn, inviteLink);

    await ctx.reply(locale.tapOpenApp, { reply_markup: inlineKeyboard });
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

app.get('/api/admin/user-count', async (req, res) => {
  try {
    const count = await User.countDocuments({ isRegistered: true });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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
    const lotteryData = { ...req.body };
    if (lotteryData.durationDays) {
      lotteryData.endDate = new Date(Date.now() + Number(lotteryData.durationDays) * 24 * 60 * 60 * 1000).toISOString();
    }
    const newLottery = new Lottery(lotteryData);
    await newLottery.save();
    res.status(201).json({ success: true, lottery: newLottery });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch('/api/lotteries/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    if (updateData.durationDays) {
      updateData.endDate = new Date(Date.now() + Number(updateData.durationDays) * 24 * 60 * 60 * 1000).toISOString();
    }

    const updatedLottery = await Lottery.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedLottery) {
      return res.status(404).json({ success: false, message: 'Lottery not found' });
    }
    res.json({ success: true, lottery: updatedLottery });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/lotteries/:id', async (req, res) => {
  try {
    const deletedLottery = await Lottery.findByIdAndDelete(req.params.id);
    if (!deletedLottery) {
      return res.status(404).json({ success: false, message: 'Lottery not found' });
    }
    res.json({ success: true, message: 'Lottery deleted successfully' });
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
    const ticket = await Ticket.findOne({ orderId: req.params.orderId });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (ticket.status !== 'APPROVED') {
      ticket.status = 'APPROVED';
      await ticket.save();

      await Lottery.findByIdAndUpdate(ticket.lotteryId, {
        $push: { takenNumbers: { $each: ticket.selectedNumbers } },$inc: { soldTickets: ticket.selectedNumbers.length }
      });
    }

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

app.post('/api/admin/broadcast', async (req, res) => {
  try {
    const { message, imageUrl } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const { successCount, failCount } = await executeBroadcast(imageUrl, message);

    res.json({ 
      success: true, 
      message: `Broadcast complete! Successfully sent: ${successCount}, Failed: ${failCount}` 
    });
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
    const keyQuery = {};
    if (phoneNumber) keyQuery.phoneNumber = phoneNumber;
    if (telegramId) keyQuery.telegramId = String(telegramId);
    const tickets = await Ticket.find(keyQuery).populate('lotteryId').sort({ createdAt: -1 });
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