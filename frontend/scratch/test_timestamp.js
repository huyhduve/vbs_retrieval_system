const fs = require('fs');
const path = require('path');

// 1. Read video_fps.csv
const fpsText = fs.readFileSync(path.join(__dirname, '../video_fps.csv'), 'utf8');
const fpsMap = new Map();
fpsText.split(/\r?\n/).forEach((line, idx) => {
  if (idx === 0 || !line.trim()) return;
  const [vid, fps] = line.split(',');
  if (vid && fps) fpsMap.set(vid.trim(), parseFloat(fps.trim()));
});

console.log('Sample FPS map entries:');
console.log('L21_V001:', fpsMap.get('L21_V001'));
console.log('L21_V003:', fpsMap.get('L21_V003'));

// 2. Test extractYouTubeVideoId
function extractYouTubeVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// 3. Test media json file
const mediaJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/media/L21_V001.json'), 'utf8'));
console.log('\nMedia JSON for L21_V001:');
console.log('watch_url:', mediaJson.watch_url);
const videoId = extractYouTubeVideoId(mediaJson.watch_url);
console.log('Extracted videoId:', videoId);

// 4. Test frame index calculation
function calculateFrameSeconds(frameNumber, fps) {
  const frameIdx = parseInt(String(frameNumber).replace(/\.\w+$/, ''), 10);
  if (isNaN(frameIdx) || !fps || fps <= 0) return 0;
  return Math.max(0, Math.round(frameIdx / fps));
}

const frameStr = "002859"; // or 2859
const fps = fpsMap.get('L21_V001') || 25;
const sec = calculateFrameSeconds(frameStr, fps);
console.log(`\nFrame ${frameStr} @ ${fps} FPS = ${sec} seconds`);
console.log(`Embed URL: https://www.youtube.com/embed/${videoId}?start=${sec}&autoplay=0`);
console.log(`Watch URL: ${mediaJson.watch_url}&t=${sec}s`);
