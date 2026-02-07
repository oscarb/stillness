import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import { getAlbumImages } from './scraper.js';
import { processImage } from './processor.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ALBUM_URL = process.env.SHARED_ALBUM_URL;
const NEXT_IMAGE_PATH = path.join(process.cwd(), 'data', '_next.png');
const TEMP_NEXT_IMAGE_PATH = path.join(process.cwd(), 'data', '_temp_next.png');

if (!ALBUM_URL) {
  console.error('Error: SHARED_ALBUM_URL environment variable is not set.');
  process.exit(1);
}

// Ensure data directory exists
if (!fs.existsSync(path.dirname(NEXT_IMAGE_PATH))) {
    fs.mkdirSync(path.dirname(NEXT_IMAGE_PATH), { recursive: true });
}

async function generateNextImage() {
    console.log('Generating next image...');
    try {
        const urls = await getAlbumImages(ALBUM_URL);
        
        // Pick a random URL and try to process it
        // If processing returns null (e.g. portrait), try another one.
        // Limit retries to avoid infinite loops.
        
        let attempts = 0;
        const maxAttempts = 10;
        let pngBuffer;

        while (attempts < maxAttempts) {
            const randomIndex = Math.floor(Math.random() * urls.length);
            const url = urls[randomIndex];
            
            // Process
            console.log(`Processing image (attempt ${attempts + 1}/${maxAttempts})...`);
            let result = await processImage(url);
            
            if (result) {
                pngBuffer = result.data;
                break;
            }
            
            attempts++;
        }

        if (!pngBuffer) {
            console.error('Failed to generate next image after max attempts.');
            return;
        }

        // Write to temp file then rename for atomic update
        fs.writeFileSync(TEMP_NEXT_IMAGE_PATH, pngBuffer);
        fs.renameSync(TEMP_NEXT_IMAGE_PATH, NEXT_IMAGE_PATH);
        console.log('Next image generated and saved to ' + NEXT_IMAGE_PATH);

    } catch (error) {
        console.error('Error generating next image:', error);
    }
}

app.get('/image', async (req, res) => {
  try {
    console.log('Request received for /image');

    // Check if next image exists
    if (!fs.existsSync(NEXT_IMAGE_PATH)) {
        console.log('Next image not found, generating immediately...');
        await generateNextImage();
    }

    if (fs.existsSync(NEXT_IMAGE_PATH)) {
        const fileContent = fs.readFileSync(NEXT_IMAGE_PATH);
        const stats = fs.statSync(NEXT_IMAGE_PATH);
        const lastModified = stats.mtime.toUTCString();
        const ifModifiedSince = req.headers['if-modified-since'];

        if (lastModified === ifModifiedSince) {
            res.status(304).send();
            return;
        }        
 
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'no-cache');
        res.set('ETag', `"${stats.size}-${stats.mtime.getTime()}"`);
        res.set('Last-Modified', lastModified);

        res.send(fileContent);

        // Trigger background generation for the NEXT request
        // Fire and forget
        generateNextImage(); 
    } else {
        res.status(500).send('Failed to serve image');
    }

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Monitoring album: ${ALBUM_URL}`);

  // Generate initial image on startup if missing
  if (!fs.existsSync(NEXT_IMAGE_PATH)) {
      console.log('Initial image missing, generating...');
      await generateNextImage();
  } else {
      console.log('Initial image already exists.');
  }
});
