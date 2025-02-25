const TelegramBot = require("node-telegram-bot-api");
const token = "7339008763:AAHU4_ZQ1jKwdmOfSMg6WvN0VLW7MNIRHv0";
const bot = new TelegramBot(token, { polling: true });

const adminChatId = 1032236389;

const guestOptions = ["До 50", "50-75", "76-100", "101-150", "151-200", "Более 200"];
const eventOptions = ["Корпоратив", "Свадьба", "Выпускной", "День рождения", "Обучение/Тимбилдинг", "Другое"];
const locationOptions = ["Новосибирск", "Пригород (до 30 км)", "Другое"];
const budgetOptions = ["30-50", "51-75", "76-100", "101-150", "151-200", "Более 200"];

const guestMultiplier = {
  "До 50": 1,
  "50-75": 1.1,
  "76-100": 1.2,
  "101-150": 1.7,
  "151-200": 2,
  "Более 200": 2.5,
};

const locationExtra = {
  "Новосибирск": 0,
  "Пригород (до 30 км)": 5000,
  "Другое": 1.5,
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
  userSessions[chatId] = { userId: msg.from.id, username: msg.from.username || "Неизвестный" };
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
  const text = msg.text;

  if (!session.date) {
    session.date = text;
    askEvent(chatId);
  } else if (!session.event) {
    if (!eventOptions.includes(text)) return askEvent(chatId, true);
    session.event = text;
    askGuests(chatId);
  } else if (!session.guests) {
    if (!guestOptions.includes(text)) return askGuests(chatId, true);
    session.guests = text;
    askLocation(chatId);
  } else if (!session.location) {
    if (!locationOptions.includes(text)) return askLocation(chatId, true);
    session.location = text;
    askHours(chatId);
  } else if (!session.hours) {
    if (isNaN(text) || parseInt(text) <= 0) return bot.sendMessage(chatId, "⛔ Введите корректное количество часов цифрами!");
    session.hours = parseInt(text);
    askBudget(chatId);
  } else if (!session.budget) {
    if (!budgetOptions.includes(text)) return askBudget(chatId, true);
    session.budget = text;
    askWords(chatId);
  } else if (!session.words) {
    session.words = text;
    sendSummary(chatId);
  }
});

function askEvent(chatId, retry = false) {
  bot.sendMessage(chatId, retry ? "⛔ Пожалуйста, выберите вариант из списка!" : "🎉 Какое событие?", {
    reply_markup: {
      keyboard: eventOptions.map(opt => [opt]),
      one_time_keyboard: true,
    },
  });
}

function askGuests(chatId, retry = false) {
  bot.sendMessage(chatId, retry ? "⛔ Пожалуйста, выберите вариант из списка!" : "👥 Количество гостей:", {
    reply_markup: {
      keyboard: guestOptions.map(opt => [opt]),
      one_time_keyboard: true,
    },
  });
}

function askLocation(chatId, retry = false) {
  bot.sendMessage(chatId, retry ? "⛔ Пожалуйста, выберите вариант из списка!" : "📍 Где пройдет мероприятие?", {
    reply_markup: {
      keyboard: locationOptions.map(opt => [opt]),
      one_time_keyboard: true,
    },
  });
}

function askHours(chatId) {
  bot.sendMessage(chatId, "⏳ Сколько часов будет мероприятие?");
}

function askBudget(chatId, retry = false) {
  bot.sendMessage(chatId, retry ? "⛔ Пожалуйста, выберите вариант из списка!" : "💰 Какая стоимость кажется адекватной? (в тысячах рублей)", {
    reply_markup: {
      keyboard: budgetOptions.map(opt => [opt]),
      one_time_keyboard: true,
    },
  });
}

function askWords(chatId) {
  bot.sendMessage(chatId, "🔮 Какими 3 словами вы бы хотели запомнить мероприятие?");
}

function sendSummary(chatId) {
  const session = userSessions[chatId];
  let basePrice = 14000;
  const guestFactor = guestMultiplier[session.guests] || 1;
  const locationFactor = locationExtra[session.location] || 1;
  const totalPrice = basePrice * guestFactor + (locationFactor > 1 ? basePrice * (locationFactor - 1) : locationFactor);

  const summaryMessage = `✅ Ваша ориентировочная стоимость: ${totalPrice.toLocaleString()}₽\n\nЯ старался сэкономить наши время и нервы, поэтому стоимость максимально приближенная, но ориентировочная. Окончательная смета после встречи и согласования программы.`;

  bot.sendMessage(chatId, summaryMessage);
  bot.sendMessage(chatId, `🎁 Люблю делать подарки. При бронировании даты в течение суток, вы можете выбрать один из бонусов:\n1) Доп. час работы диджея\n2) 1.5 часа работы фотографа\n3) 1.5 часа работы рилсмейкера`);

  const adminMessage = `📩 Новый опрос\n👤 Пользователь: @${session.username} (ID: ${session.userId})\n🔗 Чат: [Открыть чат](tg://user?id=${session.userId})\n\n📅 Дата: ${session.date}\n🎉 Событие: ${session.event}\n👥 Гости: ${session.guests}\n📍 Локация: ${session.location}\n⏳ Время: ${session.hours} часов\n💰 Бюджет: ${session.budget}\n🔮 Ключевые слова: ${session.words}\n💵 Итоговая стоимость: ${totalPrice.toLocaleString()}₽`;

  bot.sendMessage(adminChatId, adminMessage, { parse_mode: "Markdown" });
  delete userSessions[chatId];
}
