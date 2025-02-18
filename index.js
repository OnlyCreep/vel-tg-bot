const TelegramBot = require('node-telegram-bot-api');
const token = '7339008763:AAHU4_ZQ1jKwdmOfSMg6WvN0VLW7MNIRHv0';
const bot = new TelegramBot(token, { polling: true });

const guestMultiplier = {
    "До 50": 1,
    "50-75": 1.1,
    "76-100": 1.2,
    "101-150": 1.7,
    "151-200": 2,
    "Более 200": 2.5
};

const locationExtra = {
    "Новосибирск": 0,
    "Пригород (до 30 км)": 5000,
    "Другое": 1.5
};

let userSessions = {};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userSessions[chatId] = {};
    bot.sendMessage(chatId, "Важными факторами успешного праздника является слаженная работа ведущего и DJ, а также наличие хорошего оборудования. Стоимость включает эти позиции.\n\n(Ведущий+DJ+Оборудование)");
    askDate(chatId);
});

function askDate(chatId) {
    bot.sendMessage(chatId, "📅 Введите дату мероприятия:", { reply_markup: { force_reply: true } });
}

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (!userSessions[chatId]) return;

    const session = userSessions[chatId];
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
    bot.sendMessage(chatId, "🎉 Какое событие?", {
        reply_markup: {
            keyboard: [["Корпоратив", "Свадьба"], ["Выпускной", "День рождения"], ["Обучение/Тимбилдинг", "Другое"]],
            one_time_keyboard: true
        }
    });
}

function askGuests(chatId) {
    bot.sendMessage(chatId, "👥 Количество гостей:", {
        reply_markup: {
            keyboard: [["До 50", "50-75"], ["76-100", "101-150"], ["151-200", "Более 200"]],
            one_time_keyboard: true
        }
    });
}

function askLocation(chatId) {
    bot.sendMessage(chatId, "📍 Где пройдет мероприятие?", {
        reply_markup: {
            keyboard: [["Новосибирск"], ["Пригород (до 30 км)"], ["Другое"]],
            one_time_keyboard: true
        }
    });
}

function askHours(chatId) {
    bot.sendMessage(chatId, "⏳ Сколько часов будет мероприятие?");
}

function askBudget(chatId) {
    bot.sendMessage(chatId, "💰 Какая стоимость кажется адекватной?", {
        reply_markup: {
            keyboard: [["30-50", "51-75"], ["76-100", "101-150"], ["151-200", "Более 200"]],
            one_time_keyboard: true
        }
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

    bot.sendMessage(chatId, "✅ Ваша ориентировочная стоимость: ${totalPrice.toLocaleString()}₽\n\nЯ старался сэкономить наши время и нервы, поэтому стоимость максимально приближенная, но ориентировочная. Окончательная смета после встречи и согласования программы.");
    bot.sendMessage(chatId, "🎁 Люблю делать подарки. При бронировании даты в течение суток, вы можете выбрать один из бонусов:\n1) Доп. час работы диджея\n2) 1.5 часа работы фотографа\n3) 1.5 часа работы рилсмейкера");

    delete userSessions[chatId];
}