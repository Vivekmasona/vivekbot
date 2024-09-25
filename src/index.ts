const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const express = require('express');
const app = express();

const botToken = '7426827982:AAFNLzurDSYX8rEmdI-JxCRyKoZMtszTL7I';  // Your bot token
const webhookUrl = 'https://vivekbot.vercel.app/api/webhook'; // Replace with your Vercel app URL

const bot = new TelegramBot(botToken);

// Middleware to parse incoming updates as JSON
app.use(express.json());

// Set webhook for Telegram bot
bot.setWebHook(`${webhookUrl}/bot${botToken}`).then(() => {
  console.log(`Webhook set successfully to ${webhookUrl}/bot${botToken}`);
}).catch(err => {
  console.error('Error setting webhook:', err);
});

// Route to handle Telegram updates
app.post(`/api/webhook/bot${botToken}`, (req, res) => {
  bot.processUpdate(req.body); // Process the incoming update
  res.sendStatus(200);
});

// Your existing bot logic here (message handling, audio processing, etc.)

// Example message handler (you can add the rest of your logic as needed)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const query = msg.text;

  if (query.startsWith('http')) {
    const videoId = extractVideoId(query);  // Helper function to extract video ID
    if (videoId) {
      const metadataApiUrl = `https://vivekfy.vercel.app/vid?id=${videoId}`;
      try {
        await bot.sendMessage(chatId, 'Fetching metadata...');
        const metadataResponse = await axios.get(metadataApiUrl);
        const { title, artist, thumbnail } = metadataResponse.data;

        const filePath = await fetchAudio(chatId, query, title, artist, thumbnail);
        await bot.sendMessage(chatId, 'Processing completed! Sending the processed audio file...');
        await bot.sendAudio(chatId, filePath);
      } catch (error) {
        await bot.sendMessage(chatId, 'Error processing the audio.');
      }
    } else {
      await bot.sendMessage(chatId, 'Please send a valid YouTube URL.');
    }
  } else {
    await searchSongs(query, chatId);  // Search for songs
  }
});

// Function to extract video ID from a YouTube URL
function extractVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|youtu.be\/|\/v\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// Example route to handle other API requests
app.get('/api', (req, res) => {
  res.send('Hello, Vercel!');
});

// Start the server (you won't need this when deployed on Vercel)
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

module.exports = app;
