const TelegramBot = require("node-telegram-bot-api");
const token = "7339008763:AAHU4_ZQ1jKwdmOfSMg6WvN0VLW7MNIRHv0";
const bot = new TelegramBot(token, { polling: true });
const adminChatId = 1032236389;

const guestMultiplier = {
  "До 50": 1,
  "50-75": 1.1,
  "76-100": 1.2,
  "101-150": 1.7,
  "151-200": 2,
  "Более 200": 2.5,
};

const locationExtra = {
  Новосибирск: 0,
  "Пригород (до 30 км)": 5000,
  Другое: 1.5,
};

let userSessions = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Важными факторами успешного праздника является слаженная работа ведущего и DJ, а также наличие хорошего оборудования. Стоимость включает эти позиции.\n\n(Ведущий+DJ+Оборудование)"
  );
});

bot.onText(/\/survey/, (msg) => {
  const chatId = msg.chat.id;
  userSessions[chatId] = { user: msg.from, responses: [] };
  askDate(chatId);
});

function askDate(chatId) {
  bot.sendMessage(chatId, "📅 Введите дату мероприятия:", {
    reply_markup: { force_reply: true },
  });
}

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (!userSessions[chatId]) return;

  const session = userSessions[chatId];
  session.responses.push(`Пользователь: ${msg.text}`);

  if (!session.date) {
    session.date = msg.text;
    askEvent(chatId);
  } else if (!session.event) {
    session.event = msg.text;
    askGuests(chatId);
  } else if (!session.guests) {
    session.guests = msg.text;
    askLocation(chatId);
  } else if (!session.location) {
    session.location = msg.text;
    askHours(chatId);
  } else if (!session.hours) {
    session.hours = parseInt(msg.text);
    askBudget(chatId);
  } else if (!session.budget) {
    session.budget = msg.text;
    askWords(chatId);
  } else if (!session.words) {
    session.words = msg.text;
    sendSummary(chatId);
  }
});

function askEvent(chatId) {
  sendBotResponse(chatId, "🎉 Какое событие?");
  bot.sendMessage(chatId, "🎉 Какое событие?", {
    reply_markup: {
      keyboard: [["Корпоратив", "Свадьба"], ["Выпускной", "День рождения"], ["Обучение/Тимбилдинг", "Другое"]],
      one_time_keyboard: true,
    },
  });
}

function askGuests(chatId) {
  sendBotResponse(chatId, "👥 Количество гостей:");
  bot.sendMessage(chatId, "👥 Количество гостей:", {
    reply_markup: {
      keyboard: [["До 50", "50-75"], ["76-100", "101-150"], ["151-200", "Более 200"]],
      one_time_keyboard: true,
    },
  });
}

function askLocation(chatId) {
  sendBotResponse(chatId, "📍 Где пройдет мероприятие?");
  bot.sendMessage(chatId, "📍 Где пройдет мероприятие?", {
    reply_markup: {
      keyboard: [["Новосибирск"], ["Пригород (до 30 км)"], ["Другое"]],
      one_time_keyboard: true,
    },
  });
}

function askHours(chatId) {
  sendBotResponse(chatId, "⏳ Сколько часов будет мероприятие?");
  bot.sendMessage(chatId, "⏳ Сколько часов будет мероприятие?");
}

function askBudget(chatId) {
  sendBotResponse(chatId, "💰 Какая стоимость кажется адекватной?");
  bot.sendMessage(chatId, "💰 Какая стоимость кажется адекватной?", {
    reply_markup: {
      keyboard: [["30-50", "51-75"], ["76-100", "101-150"], ["151-200", "Более 200"]],
      one_time_keyboard: true,
    },
  });
}

function askWords(chatId) {
  sendBotResponse(chatId, "🔮 Какими 3 словами вы бы хотели запомнить мероприятие?");
  bot.sendMessage(chatId, "🔮 Какими 3 словами вы бы хотели запомнить мероприятие?");
}

function sendSummary(chatId) {
  const session = userSessions[chatId];
  let basePrice = 14000;
  const guestFactor = guestMultiplier[session.guests] || 1;
  const locationFactor = locationExtra[session.location] || 1;
  const totalPrice = basePrice * guestFactor + (locationFactor > 1 ? basePrice * (locationFactor - 1) : locationFactor);

  const summaryMessage = `✅ Ваша ориентировочная стоимость: ${totalPrice.toLocaleString()}₽\n\nЯ старался сэкономить наши время и нервы, поэтому стоимость максимально приближенная, но ориентировочная. Окончательная смета после встречи и согласования программы.`;
  sendBotResponse(chatId, summaryMessage);
  bot.sendMessage(chatId, summaryMessage);

  const adminMessage = `📝 Новый опрос от @${session.user.username || session.user.first_name}:\n\n${session.responses.join("\n")}\n\nЧат с пользователем: [Перейти](tg://user?id=${session.user.id})`;
  bot.sendMessage(adminChatId, adminMessage, { parse_mode: "Markdown" });
  delete userSessions[chatId];
}

function sendBotResponse(chatId, text) {
  if (userSessions[chatId]) {
    userSessions[chatId].responses.push(`Бот: ${text}`);
  }
}
