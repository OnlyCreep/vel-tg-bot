const TelegramBot = require("node-telegram-bot-api");
const token = "7339008763:AAHU4_ZQ1jKwdmOfSMg6WvN0VLW7MNIRHv0";
const bot = new TelegramBot(token, { polling: true });

const adminChatId = 1032236389;
const surveyCooldown = {};

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
  
  userSessions[chatId] = { userId: msg.from.id, username: msg.from.username || "Неизвестный", responses: [] };
  askDate(chatId);
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (!userSessions[chatId]) return;
  
  if (msg.text.startsWith("/") && msg.text !== "/survey") {
    sendPartialSurvey(chatId);
    return;
  }

  const session = userSessions[chatId];
  
  function validateResponse(validOptions, response) {
    return validOptions.includes(response);
  }

  session.responses.push(msg.text);
  
  if (!session.date) {
    session.date = msg.text;
    askEvent(chatId);
  } else if (!session.event && validateResponse(["Корпоратив", "Свадьба", "Выпускной", "День рождения", "Обучение/Тимбилдинг", "Другое"], msg.text)) {
    session.event = msg.text;
    askGuests(chatId);
  } else if (!session.guests && validateResponse(Object.keys(guestMultiplier), msg.text)) {
    session.guests = msg.text;
    askLocation(chatId);
  } else if (!session.location && validateResponse(Object.keys(locationExtra), msg.text)) {
    session.location = msg.text;
    askHours(chatId);
  } else if (!session.hours && !isNaN(parseInt(msg.text))) {
    session.hours = parseInt(msg.text);
    askBudget(chatId);
  } else if (!session.budget && validateResponse(["30-50", "51-75", "76-100", "101-150", "151-200", "Более 200"], msg.text)) {
    session.budget = msg.text;
    askWords(chatId);
  } else if (!session.words) {
    session.words = msg.text;
    sendSummary(chatId);
  } else {
    bot.sendMessage(chatId, "Пожалуйста, выберите вариант из предложенных.");
  }
});

function sendPartialSurvey(chatId) {
  const session = userSessions[chatId];
  if (!session) return;
  
  const adminMessage = `📩 Частично завершенный опрос\n👤 Пользователь: @${session.username} (ID: ${session.userId})\n🔗 Чат: [Открыть чат](tg://user?id=${session.userId})\n\nОтветы:\n${session.responses.join("\n")}`;
  bot.sendMessage(adminChatId, adminMessage, { parse_mode: "Markdown" });
  delete userSessions[chatId];
}
