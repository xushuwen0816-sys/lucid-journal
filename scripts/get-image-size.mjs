import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getImageSize() {
  const inputPath = path.join(__dirname, '../assets/logo.jpg');
  try {
    const metadata = await sharp(inputPath).metadata();
    console.log(`图片尺寸: ${metadata.width}x${metadata.height}`);
  } catch (error) {
    console.error('获取图片尺寸时出错:', error);
  }
}

getImageSize();
