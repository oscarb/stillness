import NodeCache from '@cacheable/node-cache';
import { fetchImageUrls } from 'google-photos-album-image-url-fetch';

// Cache URLs for 1 hour (3600 seconds)
const urlCache = new NodeCache({ stdTTL: 3600 });
const CACHE_KEY = 'album_urls';

export async function getAlbumImages(albumUrl) {
  const cachedUrls = urlCache.get(CACHE_KEY);
  if (cachedUrls) {
    console.log(`Using cached URLs (${cachedUrls.length})`);
    return cachedUrls;
  }

  console.log('Fetching new URLs from album...');
  try {
    const images = await fetchImageUrls(albumUrl);

    if (!images || images.length === 0) {
      throw new Error('No images found in album');
    }
    
    const validUrls = images 
      // Skip portrait and square images    
      .filter(image => image.width && image.height && image.height < image.width)
      .map(image => image.url);
    
    console.log(`Found ${validUrls.length} valid images out of ${images.length} total images`);
    urlCache.set(CACHE_KEY, validUrls);
    return validUrls;
  } catch (error) {
    console.error('Error fetching album URLs:', error);
    throw error;
  }
}