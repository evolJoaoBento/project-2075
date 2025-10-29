// Generate D20 UV Mapping Template with Equilateral Triangles
// This creates an image where each face is represented as an equilateral triangle

const { createCanvas } = require('canvas');
const fs = require('fs');

const canvas = createCanvas(1024, 820); // Wider canvas for equilateral triangles
const ctx = canvas.getContext('2d');

// Fill background
ctx.fillStyle = '#333333';
ctx.fillRect(0, 0, 1024, 820);

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

// Create a 5x4 grid of equilateral triangles
const cols = 5;
const rows = 4;
const cellWidth = 1024 / cols;
const cellHeight = 820 / rows;

// Draw grid lines for reference
ctx.strokeStyle = '#555555';
ctx.lineWidth = 1;
ctx.setLineDash([5, 5]);

for (let i = 0; i <= cols; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellWidth, 0);
    ctx.lineTo(i * cellWidth, 820);
    ctx.stroke();
}

for (let i = 0; i <= rows; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * cellHeight);
    ctx.lineTo(1024, i * cellHeight);
    ctx.stroke();
}

ctx.setLineDash([]); // Reset line dash

// Draw equilateral triangles for each face
for (let faceIndex = 0; faceIndex < 20; faceIndex++) {
    const col = faceIndex % cols;
    const row = Math.floor(faceIndex / cols);

    // Calculate cell center
    const cellCenterX = (col + 0.5) * cellWidth;
    const cellCenterY = (row + 0.5) * cellHeight;

    // Scale triangle to fit in cell with padding
    const scale = 0.85;
    const triWidth = cellWidth * scale;
    const triHeight = (triWidth * Math.sqrt(3)) / 2; // Height of equilateral triangle

    // Define triangle vertices (pointing up)
    const v1x = cellCenterX;
    const v1y = cellCenterY - triHeight / 2; // Top

    const v2x = cellCenterX - triWidth / 2;
    const v2y = cellCenterY + triHeight / 2; // Bottom left

    const v3x = cellCenterX + triWidth / 2;
    const v3y = cellCenterY + triHeight / 2; // Bottom right

    // Draw filled triangle
    ctx.fillStyle = faceColors[faceIndex];
    ctx.beginPath();
    ctx.moveTo(v1x, v1y);
    ctx.lineTo(v2x, v2y);
    ctx.lineTo(v3x, v3y);
    ctx.closePath();
    ctx.fill();

    // Draw triangle outline
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Add face number
    ctx.fillStyle = faceIndex === 11 || faceIndex === 12 ? '#FFFFFF' : '#000000'; // White text on dark faces
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((faceIndex + 1).toString(), cellCenterX, cellCenterY);

    // Add small label below the number
    ctx.font = '14px Arial';
    ctx.fillStyle = faceIndex === 11 || faceIndex === 12 ? '#CCCCCC' : '#444444';
    ctx.fillText(`Face ${faceIndex + 1}`, cellCenterX, cellCenterY + 25);
}

// Add title and instructions
ctx.fillStyle = '#FFFFFF';
ctx.font = 'bold 20px Arial';
ctx.textAlign = 'left';
ctx.fillText('D20 UV Template - Equilateral Triangles', 10, 30);

ctx.font = '14px Arial';
ctx.fillText('Each triangle represents one face of the D20', 10, 50);
ctx.fillText('Create your texture with each face in its corresponding triangle', 10, 70);

// Save to file
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('d20-triangles-template.png', buffer);

console.log('D20 Triangle Template created!');
console.log('Image size: 1024x820 pixels');
console.log('Grid: 5 columns × 4 rows');
console.log('Each cell: ~204x205 pixels');
console.log('\nFace Layout:');
console.log('Row 1: Faces 1-5');
console.log('Row 2: Faces 6-10');
console.log('Row 3: Faces 11-15');
console.log('Row 4: Faces 16-20');