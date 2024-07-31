import express, { Request, Response } from 'express';
import ytdl from 'ytdl-core';
import TelegramBot from 'node-telegram-bot-api';
import axios, { AxiosResponse } from 'axios';

// Create the Express app
const app = express();
const port = process.env.PORT || 3000;

// Replace with your actual bot token
const token = 'YOUR_TELEGRAM_BOT_TOKEN_HERE';

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

// Define types for the song data
interface Song {
    name: string;
    primaryArtists?: string;
    image: Array<{ link: string }>;
    downloadUrl: Array<{ link: string }>;
}

// Welcome message for new users
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name || 'User';
    const welcomeMessage = `
    Hello👋 ${firstName} 🥰babu

    WELCOME🙏TO VIVEKFY🎧AI BOT!🤖
    
    Please enter a🎧song name 
     `;
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Handle song search queries
async function searchSongs(query: string): Promise<Song[]> {
    try {
        const response: AxiosResponse = await axios.get(`https://svn-vivekfy.vercel.app/search/songs?query=${encodeURIComponent(query)}`);
        return response.data?.data?.results || [];
    } catch (error) {
        console.error('Error fetching song data:', error);
        return [];
    }
}

// Get audio stream
async function getStream(url: string): Promise<NodeJS.ReadableStream> {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    });
    return response.data;
}

// Handle regular messages (not commands)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const text = msg.text?.trim() || '';

    // Ignore messages that are commands (start with '/')
    if (text.startsWith('/')) return;

    // Check if the text is a URL
    const urlRegex = /https?:\/\/[^\s]+/;
    if (urlRegex.test(text)) {
        // Handle URL logic here (e.g., download or fetch details)
        bot.sendMessage(chatId, 'Processing your URL...');

        // Example: Send the URL as a response
        bot.sendMessage(chatId, `Here is your URL: ${text}`);
        return;
    }

    // Delete the user's query message
    await bot.deleteMessage(chatId, messageId);

    // Otherwise, treat it as a song search query
    const songs = await searchSongs(text);
    if (songs.length > 0) {
        const foundMessage = await bot.sendMessage(chatId, `Found ${songs.length} songs. Sending the list...`);

        for (const song of songs) {
            const songUrl = song.downloadUrl[1]?.link;

            if (songUrl) {
                const songMessage = `
*${song.name}*
_${song.primaryArtists || 'Unknown Artist'}_
`;

                // Get audio stream
                const audioStream = await getStream(songUrl);

                // Send the poster with caption
                await bot.sendPhoto(chatId, song.image[2]?.link, {
                    caption: songMessage,
                    parse_mode: 'Markdown'
                });

                // Send the audio stream
                await bot.sendAudio(chatId, audioStream, {
                    title: song.name,
                    performer: song.primaryArtists || 'Unknown Artist'
                });

            } else {
                bot.sendMessage(chatId, `Sorry, no downloadable URL found for the song: ${song.name}`);
            }
        }

        // Delete the "Found X songs. Sending the list..." message
        await bot.deleteMessage(chatId, foundMessage.message_id);
    } else {
        bot.sendMessage(chatId, 'No songs found for your query.');
    }
});

// Express route handlers
app.get('/audio/:url', async (req: Request, res: Response) => {
    const urlParam = req.params.url;
    const url = `https://www.youtube.com/watch?v=${urlParam}`;
    try {
        const info = await ytdl.getInfo(url);
        const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
        const audioUrl = audioFormat.url;
        res.redirect(audioUrl);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get audio URL!' });
    }
});

app.get('/video/:url', async (req: Request, res: Response) => {
    const urlParam = req.params.url;
    const url = `https://www.youtube.com/watch?v=${urlParam}`;
    try {
        const info = await ytdl.getInfo(url);
        const videoFormat = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'videoandaudio' });
        const videoUrl = videoFormat.url;
        res.redirect(videoUrl);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get video URL!' });
    }
});

app.get('/videoinfo/:url', async (req: Request, res: Response) => {
    try {
        const urlParam = req.params.url;
        const url = `https://www.youtube.com/watch?v=${urlParam}`;
        const info = await ytdl.getInfo(url);
        res.json({
            author: info.videoDetails.author,
            title: info.videoDetails.title,
            views: info.videoDetails.viewCount,
            thumbnail: info.videoDetails.thumbnails
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch video information' });
    }
});

app.get('/', (req: Request, res: Response) => {
    res.json({ query: 'None' });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
