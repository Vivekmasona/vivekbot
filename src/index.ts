const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Function to download audio and add metadata
async function downloadAudioWithMetadata(audioUrl, coverUrl, title, artist, res) {
    try {
        const audioFilePath = 'audio.mp3';
        const coverImagePath = 'cover.jpg';
        const outputFileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_with_metadata.mp3`;

        // Fetch audio stream and save it to a temporary file
        const audioResponse = await axios.get(audioUrl, { responseType: 'stream' });
        const audioFileStream = fs.createWriteStream(audioFilePath);
        audioResponse.data.pipe(audioFileStream);

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

    // API call to fetch all metadata (audioUrl, thumbnail, title, artist)
    const metadataApiUrl = `https://vivekfy.vercel.app/meta2?url=${encodeURIComponent(youtubeUrl)}`;

    try {
        const metadataResponse = await axios.get(metadataApiUrl);
        console.log('Metadata response:', metadataResponse.data);
        const { audioUrl, thumbnail, title, artist } = metadataResponse.data;

        // Check if the response contains valid data
        if (!audioUrl || !thumbnail || !title || !artist) {
            return res.status(400).send('Error: Invalid metadata received.');
        }

        // Pass audio URL, cover image, title, and artist to the download function
        await downloadAudioWithMetadata(audioUrl, thumbnail, title, artist, res);
    } catch (error) {
        console.error('Error fetching metadata:', error);
        res.status(500).send('Error fetching metadata.');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
