import express from 'express';
import dotenv from 'dotenv';

import { getAlbumImages } from './scraper.js';
import { processImage } from './processor.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ALBUM_URL = process.env.SHARED_ALBUM_URL;

if (!ALBUM_URL) {
  console.error('Error: SHARED_ALBUM_URL environment variable is not set.');
  process.exit(1);
}

app.get('/image', async (req, res) => {
  try {
    console.log('Request received for /image');
    const urls = await getAlbumImages(ALBUM_URL);
    
    // Pick a random URL and try to process it
    // If processing returns null (e.g. portrait), try another one.
    // Limit retries to avoid infinite loops.
    
    let attempts = 0;
    const maxAttempts = 10;
    let pngBuffer;
    let mimeType;

    while (attempts < maxAttempts) {
      const randomIndex = Math.floor(Math.random() * urls.length);
      const url = urls[randomIndex];
      
      // Process
      console.log(`Processing image (attempt ${attempts + 1}/${maxAttempts})...`);
      let result = await processImage(url);
      
      if (result) {
        pngBuffer = result.data;
        mimeType = result.mimeType;
        break;
      }
      
      attempts++;
    }

    if (!pngBuffer) {
      res.status(500).send(`Failed to process image from ${url}`);
      return;
    }

    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'no-store'); // Don't let the e-ink frame cache old logic, we want random // TODO Look-up 
    res.send(pngBuffer);

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Monitoring album: ${ALBUM_URL}`);
});
