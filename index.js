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
