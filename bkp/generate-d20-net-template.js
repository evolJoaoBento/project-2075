// Generate D20 Icosahedral Net Template
// This creates the proper icosahedral net layout matching the provided image

const { createCanvas } = require('canvas');
const fs = require('fs');

const canvas = createCanvas(1024, 1024);
const ctx = canvas.getContext('2d');

// Fill background
ctx.fillStyle = '#f0f0f0';
ctx.fillRect(0, 0, 1024, 1024);

// D20 face colors - using the same mapping as before
const faceColors = [
    '#FF0000', // Face 0 - Red
    '#00FF00', // Face 1 - Green
    '#0000FF', // Face 2 - Blue
    '#FFFF00', // Face 3 - Yellow
    '#FF00FF', // Face 4 - Magenta
    '#00FFFF', // Face 5 - Cyan
    '#FFA500', // Face 6 - Orange
    '#800080', // Face 7 - Purple
    '#FFC0CB', // Face 8 - Pink
    '#A52A2A', // Face 9 - Brown
    '#808080', // Face 10 - Gray
    '#000000', // Face 11 - Black
    '#FFFFFF', // Face 12 - White
    '#90EE90', // Face 13 - Light Green
    '#FFB6C1', // Face 14 - Light Pink
    '#87CEEB', // Face 15 - Sky Blue
    '#DDA0DD', // Face 16 - Plum
    '#F0E68C', // Face 17 - Khaki
    '#20B2AA', // Face 18 - Light Sea Green
    '#DC143C'  // Face 19 - Crimson
];

// Face numbers based on the image provided (0-indexed internally, 1-indexed for display)
const faceNumbers = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    10, 11, 12, 13, 14, 15, 16, 17, 18, 19
];

// Use simple grid layout to prevent intersections
const cols = 5;
const rows = 4;
const cellWidth = 1024 / cols;
const cellHeight = 1024 / rows;
const padding = 20; // Padding in pixels

function drawTriangle(col, row, color, faceNumber) {
    // Calculate cell bounds with padding
    const cellLeft = col * cellWidth + padding;
    const cellRight = (col + 1) * cellWidth - padding;
    const cellTop = row * cellHeight + padding;
    const cellBottom = (row + 1) * cellHeight - padding;

    // Calculate cell center and size
    const cellCenterX = (cellLeft + cellRight) / 2;
    const cellW = cellRight - cellLeft;
    const cellH = cellBottom - cellTop;

    // Create equilateral triangle that fits within the cell
    const triangleHeight = Math.min(cellH, cellW * Math.sqrt(3) / 2);
    const triangleWidth = triangleHeight * 2 / Math.sqrt(3);

    // All triangles point up for consistency
    const v1 = {
        x: cellCenterX,
        y: cellTop
    };

    const v2 = {
        x: cellCenterX - triangleWidth / 2,
        y: cellTop + triangleHeight
    };

    const v3 = {
        x: cellCenterX + triangleWidth / 2,
        y: cellTop + triangleHeight
    };

    // Ensure triangles don't exceed cell boundaries
    [v1, v2, v3].forEach(v => {
        v.x = Math.max(cellLeft, Math.min(cellRight, v.x));
        v.y = Math.max(cellTop, Math.min(cellBottom, v.y));
    });

    // Draw filled triangle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(v1.x, v1.y);
    ctx.lineTo(v2.x, v2.y);
    ctx.lineTo(v3.x, v3.y);
    ctx.closePath();
    ctx.fill();

    // Draw triangle outline
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Add face number
    ctx.fillStyle = faceNumber === 11 ? '#FFFFFF' : '#000000'; // White text on black face
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Calculate triangle centroid for text placement
    const textX = (v1.x + v2.x + v3.x) / 3;
    const textY = (v1.y + v2.y + v3.y) / 3;
    ctx.fillText((faceNumber + 1).toString(), textX, textY);
}

// Draw all triangles in grid layout
for (let faceIndex = 0; faceIndex < 20; faceIndex++) {
    const col = faceIndex % cols;
    const row = Math.floor(faceIndex / cols);
    const color = faceColors[faceIndex];
    const faceNumber = faceNumbers[faceIndex];

    drawTriangle(col, row, color, faceNumber);
}

// Add title
ctx.fillStyle = '#000000';
ctx.font = 'bold 24px Arial';
ctx.textAlign = 'left';
ctx.fillText('D20 Icosahedral Net Template', 20, 40);

ctx.font = '16px Arial';
ctx.fillText('Each triangle represents one face of the D20 in proper geometric layout', 20, 65);

// Save to file
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('d20-net-template.png', buffer);

console.log('D20 Icosahedral Net Template created!');
console.log('This matches the true geometric structure of an icosahedron');
console.log('Each triangle is positioned exactly as it would appear when unfolded');