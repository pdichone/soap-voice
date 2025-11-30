const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background - blue gradient feel (solid for simplicity)
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // Microphone icon
  const centerX = size / 2;
  const centerY = size / 2;
  const scale = size / 100;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3 * scale;
  ctx.lineCap = 'round';

  // Microphone body (rounded rectangle)
  const micWidth = 24 * scale;
  const micHeight = 36 * scale;
  const micX = centerX - micWidth / 2;
  const micY = centerY - micHeight / 2 - 8 * scale;

  ctx.beginPath();
  ctx.roundRect(micX, micY, micWidth, micHeight, 12 * scale);
  ctx.fill();

  // Microphone stand curve
  ctx.beginPath();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4 * scale;
  const curveY = micY + micHeight + 2 * scale;
  ctx.arc(centerX, curveY, 18 * scale, 0, Math.PI);
  ctx.stroke();

  // Stand line
  ctx.beginPath();
  ctx.moveTo(centerX, curveY + 18 * scale);
  ctx.lineTo(centerX, curveY + 28 * scale);
  ctx.stroke();

  // Stand base
  ctx.beginPath();
  ctx.moveTo(centerX - 12 * scale, curveY + 28 * scale);
  ctx.lineTo(centerX + 12 * scale, curveY + 28 * scale);
  ctx.stroke();

  // Sound waves (right side)
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.arc(centerX + 22 * scale, centerY - 10 * scale, 8 * scale, -Math.PI / 3, Math.PI / 3);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX + 22 * scale, centerY - 10 * scale, 16 * scale, -Math.PI / 3, Math.PI / 3);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

// Generate icons
const publicDir = path.join(__dirname, '..', 'public');

[192, 512].forEach(size => {
  const buffer = generateIcon(size);
  const filename = path.join(publicDir, `icon-${size}.png`);
  fs.writeFileSync(filename, buffer);
  console.log(`Generated ${filename}`);
});

console.log('Icons generated successfully!');
