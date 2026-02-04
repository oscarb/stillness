import sharp from 'sharp';
import { ditherImage, ColorScheme, DitherMode } from '@opendisplay/epaper-dithering';


// target dimensions for 7-inch e-Paper
const WIDTH = 800;
const HEIGHT = 480;

export async function processImage(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    
    // Prepare image for dithering (Resize -> Raw RGBA)
    // The library expects an object with { width, height, data: Uint8ClampedArray }
    // We use 'ensureAlpha' to make sure we have 4 channels (RGBA) which is standard for pngs
    const { data: rawBuffer, info } = await  sharp(inputBuffer)
      .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'center' })
      .ensureAlpha() 
      .raw()
      .toBuffer({ resolveWithObject: true });

    const imageBuffer = {
        width: info.width,
        height: info.height,
        data: new Uint8ClampedArray(rawBuffer)
    };

    // Apply Dithering using the library
    const dithered = ditherImage(imageBuffer, ColorScheme.MONO, DitherMode.FLOYD_STEINBERG);

    // Calculate expected size
    const expectedSize = dithered.width * dithered.height;

    // Guard Clause
    if (dithered.indices.length !== expectedSize) {
        throw new Error(
        `Dither mismatch: Expected ${expectedSize} indices (${dithered.width}x${dithered.height}), ` +
        `but got ${dithered.indices.length}. Check cropping/resize logic.`
    );
}

    // The library returns { width, height, indices, palette } for indexed color schemes like MONO.
    // indices is a Uint8Array where each byte is an index into the palette.
    // For MONO, we expect 0 (Black) and 1 (White).
    // We need to convert this to something Sharp understands.
    // Let's map indices to 0 and 255 for a grayscale image.
    
    // Create a new buffer for the grayscale data
    const grayscaleData = Buffer.alloc(expectedSize);;
    for (let i = 0; i < expectedSize; i++) {
        // Assuming palette[0] is black and palette[1] is white, or similar.
        // Usually index 0 -> 0x00, index 1 -> 0xFF.
        // If the library follows standard conventions, index 1 is 'on' / white, index 0 is 'off' / black.
        // But let's check the palette if we need to be precise. 
        // For now, mapping index != 0 to 255 is safe for binary.
        grayscaleData[i] = dithered.indices[i] === 1 ? 255 : 0;
    }

    const pngBuffer = await sharp(grayscaleData, {
      raw: {
        width: dithered.width,
        height: dithered.height,
        channels: 1
      }
    })
    .png({
      palette: true, 
      bitdepth: 1, 
      colors: 2, 
      effort: 10,
      compressionLevel: 9
    })
    .toBuffer();
    
    return {
      data: pngBuffer,
      mimeType: 'image/png'
    };

  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}
