// Generate D20 UV Mapping Template
// This creates an image where each face of the icosahedron has a unique color

const { createCanvas } = require('canvas');

const canvas = createCanvas(512, 512);
const ctx = canvas.getContext('2d');

// D20 face colors and corresponding numbers
const faceColors = [
    '#FF0000', // Face 1 - Red
    '#00FF00', // Face 2 - Green
    '#0000FF', // Face 3 - Blue
    '#FFFF00', // Face 4 - Yellow
    '#FF00FF', // Face 5 - Magenta
    '#00FFFF', // Face 6 - Cyan
    '#FFA500', // Face 7 - Orange
    '#800080', // Face 8 - Purple
    '#FFC0CB', // Face 9 - Pink
    '#A52A2A', // Face 10 - Brown
    '#808080', // Face 11 - Gray
    '#000000', // Face 12 - Black
    '#FFFFFF', // Face 13 - White
    '#90EE90', // Face 14 - Light Green
    '#FFB6C1', // Face 15 - Light Pink
    '#87CEEB', // Face 16 - Sky Blue
    '#DDA0DD', // Face 17 - Plum
    '#F0E68C', // Face 18 - Khaki
    '#20B2AA', // Face 19 - Light Sea Green
    '#DC143C'  // Face 20 - Crimson
];

// Fill background
ctx.fillStyle = '#000000';
ctx.fillRect(0, 0, 512, 512);

// Create a simple grid layout showing each face color
// This is a simplified representation - the actual UV mapping in Three.js
// will map these colors to the icosahedron faces
const gridCols = 5; // 5x4 grid for 20 faces (more compressed horizontally)
const gridRows = 4;
const cellWidth = 512 / gridCols;  // 102.4 pixels wide (more compressed)
const cellHeight = 512 / gridRows; // 128 pixels tall

for (let i = 0; i < 20; i++) {
    const row = Math.floor(i / gridCols);
    const col = i % gridCols;

    const x = col * cellWidth;
    const y = row * cellHeight;

    // Fill the cell with the face color
    ctx.fillStyle = faceColors[i];
    ctx.fillRect(x, y, cellWidth, cellHeight);

    // Add face number
    ctx.fillStyle = i === 11 ? '#FFFFFF' : '#000000'; // White text on black, black text on others
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((i + 1).toString(), x + cellWidth/2, y + cellHeight/2);
}

// Save to file
const fs = require('fs');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('d20-uv-template.png', buffer);

console.log('D20 Face Color Mapping:');
faceColors.forEach((color, index) => {
    console.log(`Face ${index + 1}: ${color}`);
});