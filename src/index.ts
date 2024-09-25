const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');

const botToken = process.env.BOT_TOKEN || '7426827982:AAFNLzurDSYX8rEmdI-JxCRyKoZMtszTL7I';
const app = express();
app.use(express.json());  // Parse incoming webhook requests as JSON

const bot = new TelegramBot(botToken, { webHook: true });
const url = process.env.VERCEL_URL || 'https://vivekbot.vercel.app';  // Vercel deployment URL

// Set the Telegram bot webhook to point to Vercel's endpoint
bot.setWebHook(`${url}/api/bot`);

// Function to process audio with watermark (similar to your previous function)
async function processAudioWithWatermark(apiUrl, coverUrl, title, artist, chatId) {
    // Same implementation as before...
}

// Function to fetch audio from your API
async function fetchAudio(chatId, youtubeUrl, title, artist, thumbnail) {
    // Same implementation as before...
}

// Function to search songs using Invidious API
async function searchSongs(query, chatId) {
    // Same implementation as before...
}

// Handle incoming webhook updates from Telegram
app.post('/api/bot', async (req, res) => {
    const update = req.body;

    if (update.message) {
        const chatId = update.message.chat.id;
        const query = update.message.text;

        if (query.startsWith('http')) {
            const videoId = extractVideoId(query);  // Function to extract video ID
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
                    console.error('Error fetching metadata or processing audio:', error);
                    await bot.sendMessage(chatId, 'Error processing the audio.');
                }
            } else {
                await bot.sendMessage(chatId, 'Please send a valid YouTube URL.');
            }
        } else {
            await searchSongs(query, chatId);  // Handle regular song search
        }
    }

    res.sendStatus(200);  // Return a response to Telegram
});

// Helper function to extract video ID from a YouTube URL
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|youtu.be\/|\/v\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
}

module.exports = app;
