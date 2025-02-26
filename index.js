const TelegramBot = require("node-telegram-bot-api");
const token = "YOUR_BOT_TOKEN";
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
let lastSurveyTime = {};

const images = [
  { url: "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_4_vel-e1740539781897.png", caption: "Футуризм" },
  { url: "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_3_vel-e1740539861115.png", caption: "Уют" },
  { url: "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_2_vel-e1740539841526.png", caption: "Природа" },
  { url: "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_1_vel.png", caption: "Роскошь" }
];

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Важными факторами успешного праздника является слаженная работа ведущего и DJ, а также наличие хорошего оборудования. Стоимость включает эти позиции.\n\n(Ведущий+DJ+Оборудование)");
});

bot.onText(/\/survey/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || "Неизвестный";
  const now = Date.now();

  if (lastSurveyTime[userId] && now - lastSurveyTime[userId] < 60000) {
    return bot.sendMessage(chatId, "⛔ Пожалуйста, подождите 1 минуту перед повторным запуском опроса.");
  }

  lastSurveyTime[userId] = now;
  userSessions[chatId] = { userId, username };
  askDate(chatId);
});

function askImageSelection(chatId) {
  bot.sendMediaGroup(chatId, images.map(img => ({ type: "photo", media: img.url, caption: img.caption })));
  bot.sendMessage(chatId, "Выберите картинку по душе:", {
    reply_markup: { keyboard: images.map(img => [img.caption]), one_time_keyboard: true },
  });
}

function askBonusSelection(chatId) {
  bot.sendMessage(chatId, "🎁 Люблю делать подарки. При бронировании даты в течение суток, вы можете выбрать один из бонусов:\n1) Доп. час работы диджея\n2) 1.5 часа работы фотографа\n3) 1.5 часа работы рилсмейкера", {
    reply_markup: { keyboard: [["Доп. час диджея"], ["1.5 часа фотографа"], ["1.5 часа рилсмейкера"]], one_time_keyboard: true },
  });
}

function sendSummary(chatId) {
  const session = userSessions[chatId];
  let basePrice = 14000;
  const guestFactor = guestMultiplier[session.guests] || 1;
  const locationFactor = locationExtra[session.location] || 1;
  const totalPrice = basePrice * guestFactor + (locationFactor > 1 ? basePrice * (locationFactor - 1) : locationFactor);

  session.totalPrice = totalPrice;
  bot.sendMessage(chatId, `✅ Ваша ориентировочная стоимость: ${totalPrice.toLocaleString()}₽`);
  bot.sendMessage(adminChatId, `📩 Новый опрос\n👤 Пользователь: @${session.username}\n📅 Дата: ${session.date}\n🎉 Событие: ${session.event}\n👥 Гости: ${session.guests}\n📍 Локация: ${session.location}\n💵 Итоговая стоимость: ${totalPrice.toLocaleString()}₽`, { parse_mode: "Markdown" });
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
    askImageSelection(chatId);
  } else if (!session.selectedImage) {
    if (!images.some(img => img.caption === text)) return;
    session.selectedImage = text;
    bot.sendMessage(adminChatId, `📩 Пользователь @${session.username} выбрал картинку: ${text}`);
    askBonusSelection(chatId);
  } else if (!session.bonus) {
    if (!["Доп. час диджея", "1.5 часа фотографа", "1.5 часа рилсмейкера"].includes(text)) return;
    session.bonus = text;
    bot.sendMessage(chatId, "✅ Ваш бонус учтен! Рассчитываем стоимость...");
    bot.sendMessage(adminChatId, `📩 Пользователь @${session.username} выбрал бонус: ${text}`);
    sendSummary(chatId);
    delete userSessions[chatId];
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