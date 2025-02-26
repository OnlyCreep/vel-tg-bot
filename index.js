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
let lastSurveyTime = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Важными факторами успешного праздника является слаженная работа ведущего и DJ, а также наличие хорошего оборудования. Стоимость включает эти позиции.\n\n(Ведущий+DJ+Оборудование)"
  );
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

  if (userSessions[chatId]) {
    bot.sendMessage(adminChatId, `⚠️ Пользователь @${username} (ID: ${userId}) перезапустил опрос.`);
  }

  userSessions[chatId] = { userId, username };
  askDate(chatId);
});

function askImageSelection(chatId) {
  bot.sendMessage(chatId, "\uD83D\uDCF8 Выберите картинку по душе. В работе я использую психологию, чтобы лучше понимать людей и их желания. Получается или нет, узнаем на встрече))");

  const imageUrls = [
    "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_4_vel-e1740539781897.png",
    "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_3_vel-e1740539861115.png",
    "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_2_vel-e1740539841526.png",
    "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_1_vel.png"
  ];

  imageUrls.forEach((url, index) => {
    bot.sendPhoto(chatId, url, { caption: `Картинка ${index + 1}` });
  });

  bot.sendMessage(chatId, "Выберите номер картинки:", {
    reply_markup: {
      keyboard: [["1"], ["2"], ["3"], ["4"]],
      one_time_keyboard: true,
    },
  });
}

function askBonusSelection(chatId, session) {
  bot.sendMessage(chatId, "🎁 Люблю делать подарки. При бронировании даты в течение суток, вы можете выбрать один из бонусов:\n1) Доп. час работы диджея\n2) 1.5 часа работы фотографа\n3) 1.5 часа работы рилсмейкера", {
    reply_markup: {
      keyboard: [["1"], ["2"], ["3"]],
      one_time_keyboard: true,
    },
  });
}

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
    askImageSelection(chatId);
  } else if (!session.selectedImage) {
    if (!["1", "2", "3", "4"].includes(text)) return bot.sendMessage(chatId, "⛔ Пожалуйста, выберите номер картинки от 1 до 4.");
    session.selectedImage = text;
    const selectedImageUrl = imageUrls[parseInt(text) - 1];
    bot.sendPhoto(adminChatId, selectedImageUrl, { caption: `Пользователь @${session.username} выбрал картинку ${text}` });
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
  askBonusSelection(chatId, session);

  const adminMessage = `📩 Новый опрос\n👤 Пользователь: @${session.username} (ID: ${session.userId})\n🔗 Чат: [Открыть чат](tg://user?id=${session.userId})\n\n📅 Дата: ${session.date}\n🎉 Событие: ${session.event}\n👥 Гости: ${session.guests}\n📍 Локация: ${session.location}\n⏳ Время: ${session.hours} часов\n💰 Бюджет: ${session.budget}\n🔮 Ключевые слова: ${session.words}\n💵 Итоговая стоимость: ${totalPrice.toLocaleString()}₽`;

  bot.sendMessage(adminChatId, adminMessage, { parse_mode: "Markdown" });
  delete userSessions[chatId];
}