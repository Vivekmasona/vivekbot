const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Function to download audio and add metadata
async function downloadAudioWithMetadata(apiUrl, coverUrl, title, artist, res) {
    try {
        const audioFilePath = 'audio.mp3';
        const coverImagePath = 'cover.jpg';
        const outputFileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_with_metadata.mp3`;

        // Fetch audio stream from your API endpoint and save it to a temporary file
        const audioResponse = await axios.get(apiUrl, { responseType: 'stream' });
        const audioFileStream = fs.createWriteStream(audioFilePath);

        audioResponse.data.pipe(audioFileStream);

        // Listen for the finish event to ensure the audio file is fully downloaded
        audioFileStream.on('finish', async () => {
            console.log('Audio downloaded successfully!');

            try {
                // Download the cover image
                const coverImageResponse = await axios.get(coverUrl, { responseType: 'arraybuffer' });
                fs.writeFileSync(coverImagePath, coverImageResponse.data);

                // Use FFmpeg to add metadata to the audio file
                ffmpeg()
                    .input(audioFilePath)
                    .input(coverImagePath)
                    .outputOptions([
                        '-metadata', `title=${title}`,
                        '-metadata', `artist=${artist}`,
                        '-map', '0:a',
                        '-map', '1:v',
                        '-c:v', 'mjpeg',
                    ])
                    .save(outputFileName)
                    .on('end', () => {
                        console.log('Metadata added successfully!');

                        // Send the modified file to the client
                        res.download(outputFileName, () => {
                            // Clean up files after download
                            cleanUpFiles([audioFilePath, outputFileName, coverImagePath]);
                        });
                    })
                    .on('error', (err) => {
                        console.error('Error adding metadata: ', err);
                        res.status(500).send('Error adding metadata.');
                        cleanUpFiles([audioFilePath, outputFileName, coverImagePath]);
                    });
            } catch (coverError) {
                console.error('Error downloading cover image:', coverError);
                res.status(500).send('Error downloading cover image.');
                cleanUpFiles([audioFilePath]);
            }
        });

        audioFileStream.on('error', (err) => {
            console.error('Error writing audio file:', err);
            res.status(500).send('Error writing audio file.');
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred.');
    }
}

// Utility function to clean up files
function cleanUpFiles(files) {
    files.forEach(file => {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
    });
}

// Endpoint to handle audio download request
app.get('/download', async (req, res) => {
    const youtubeUrl = req.query.url;

    if (!youtubeUrl) {
        return res.status(400).send('Error: YouTube URL is required as a query parameter!');
    }

    // Replace with your API endpoint and dynamically set parameters
    const videoId = extractVideoId(youtubeUrl);
    const metadataApiUrl = `https://vivekfy.vercel.app/yt?videoId=${videoId}`;

    try {
        // Fetch metadata from the JSON API
        const metadataResponse = await axios.get(metadataApiUrl);
        const { title, artist, thumbnail } = metadataResponse.data;
        const coverUrl = thumbnail;

        // Construct the API URL for audio stream
        const apiUrl = `https://vivekfy.vercel.app/vivekfy?url=${encodeURIComponent(youtubeUrl)}`;

        await downloadAudioWithMetadata(apiUrl, coverUrl, title, artist, res);
    } catch (error) {
        console.error('Error fetching metadata: ', error);
        res.status(500).send('Error fetching metadata.');
    }
});

// Utility function to extract video ID from YouTube URL
function extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

