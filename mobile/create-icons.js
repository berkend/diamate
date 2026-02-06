const { Jimp } = require('jimp');
const path = require('path');

async function createIcons() {
  const assetsDir = path.join(__dirname, 'assets');
  const purple = 0x667eeaff; // Purple color

  // Create icon (1024x1024)
  const icon = new Jimp({ width: 1024, height: 1024, color: purple });
  await icon.write(path.join(assetsDir, 'icon.png'));
  console.log('Created icon.png');

  // Create adaptive icon (1024x1024)
  const adaptiveIcon = new Jimp({ width: 1024, height: 1024, color: purple });
  await adaptiveIcon.write(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('Created adaptive-icon.png');

  // Create splash (1284x2778 for iPhone)
  const splash = new Jimp({ width: 1284, height: 2778, color: purple });
  await splash.write(path.join(assetsDir, 'splash.png'));
  console.log('Created splash.png');

  // Create favicon (48x48)
  const favicon = new Jimp({ width: 48, height: 48, color: purple });
  await favicon.write(path.join(assetsDir, 'favicon.png'));
  console.log('Created favicon.png');

  console.log('Done!');
}

createIcons().catch(console.error);
