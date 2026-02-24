import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 图标尺寸配置
const iconSizes = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' }
];

// iOS特定图标尺寸
const iosIconSizes = [
  { size: 120, name: 'apple-touch-icon-120x120.png' }, // iPhone 2x
  { size: 180, name: 'apple-touch-icon-180x180.png' }, // iPhone 3x
  { size: 167, name: 'apple-touch-icon-167x167.png' }  // iPad Pro
];

async function generateIcons() {
  const inputPath = path.join(__dirname, '../assets/logo.jpg');
  const outputDir = path.join(__dirname, '../public/icons');
  
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('开始生成PWA图标...');
  
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    const size = Math.min(metadata.width, metadata.height);
    const top = Math.round((metadata.height - size) / 2);
    const left = Math.round((metadata.width - size) / 2);

    const croppedImage = image.extract({ top: top, left: left, width: size, height: size });

    // 生成标准PWA图标
    for (const icon of iconSizes) {
      const outputPath = path.join(outputDir, icon.name);
      
      await croppedImage
        .clone()
        .resize(icon.size, icon.size)
        .png()
        .toFile(outputPath);
      
      console.log(`✓ 生成 ${icon.name} (${icon.size}x${icon.size})`);
    }
    
    // 生成iOS特定图标
    for (const icon of iosIconSizes) {
      const outputPath = path.join(outputDir, icon.name);
      
      await croppedImage
        .clone()
        .resize(icon.size, icon.size)
        .png()
        .toFile(outputPath);
      
      console.log(`✓ 生成 ${icon.name} (${icon.size}x${icon.size})`);
    }
    
    console.log('图标生成完成！');
    
  } catch (error) {
    console.error('生成图标时出错:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  generateIcons();
}

export { generateIcons };