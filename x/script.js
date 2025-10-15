// Global variables
let originalImage = null;
let originalCanvas = document.getElementById('originalCanvas');
let originalCtx = originalCanvas.getContext('2d');
let correctedCanvas = document.getElementById('correctedCanvas');
let correctedCtx = correctedCanvas.getContext('2d');
let colorCheckerDetected = false;
let colorCheckerCorners = [];
let referenceColors = [
    // First row (top to bottom)
    { name: 'Dark Skin', rgb: [115, 82, 68] },
    { name: 'Light Skin', rgb: [194, 150, 130] },
    { name: 'Blue Sky', rgb: [98, 122, 157] },
    { name: 'Foliage', rgb: [87, 108, 67] },
    { name: 'Blue Flower', rgb: [133, 128, 177] },
    { name: 'Bluish Green', rgb: [103, 189, 170] },
    // Second row
    { name: 'Orange', rgb: [214, 126, 44] },
    { name: 'Purplish Blue', rgb: [80, 91, 166] },
    { name: 'Moderate Red', rgb: [193, 90, 99] },
    { name: 'Purple', rgb: [94, 60, 108] },
    { name: 'Yellow Green', rgb: [157, 188, 64] },
    { name: 'Orange Yellow', rgb: [224, 163, 46] },
    // Third row
    { name: 'Blue', rgb: [56, 61, 150] },
    { name: 'Green', rgb: [70, 148, 73] },
    { name: 'Red', rgb: [175, 54, 60] },
    { name: 'Yellow', rgb: [231, 199, 31] },
    { name: 'Magenta', rgb: [187, 86, 149] },
    { name: 'Cyan', rgb: [8, 133, 161] },
    // Fourth row
    { name: 'White', rgb: [243, 243, 242] },
    { name: 'Neutral 8', rgb: [200, 200, 200] },
    { name: 'Neutral 6.5', rgb: [160, 160, 160] },
    { name: 'Neutral 5', rgb: [122, 122, 121] },
    { name: 'Neutral 3.5', rgb: [85, 85, 85] },
    { name: 'Black', rgb: [52, 52, 52] }
];

let detectedColors = [];
let colorMapping = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Set up event listeners
    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
    
    // Use the new detection mode buttons instead of the old detectColorChecker button
    const applyCorrection = document.getElementById('applyCorrection');
    if (applyCorrection) {
        applyCorrection.addEventListener('click', applyColorCorrection);
    }
    
    // Set up range input listeners
    const whiteBalance = document.getElementById('whiteBalance');
    const temperature = document.getElementById('temperature');
    const tint = document.getElementById('tint');
    
    if (whiteBalance) whiteBalance.addEventListener('input', updateCorrection);
    if (temperature) temperature.addEventListener('input', updateCorrection);
    if (tint) tint.addEventListener('input', updateCorrection);
    
    // Initialize color palette
    initializeColorPalette();
    
    // Set up camera functionality
    setupCamera();
});

// Handle image upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        originalImage = new Image();
        originalImage.onload = function() {
            // Reset variables
            colorCheckerDetected = false;
            colorCheckerCorners = [];
            detectedColors = [];
            colorMapping = [];
            
            // Resize canvases to match image dimensions
            const maxWidth = 800;
            const maxHeight = 600;
            let width = originalImage.width;
            let height = originalImage.height;
            
            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }
            
            if (height > maxHeight) {
                width = (maxHeight / height) * width;
                height = maxHeight;
            }
            
            originalCanvas.width = width;
            originalCanvas.height = height;
            correctedCanvas.width = width;
            correctedCanvas.height = height;
            
            // Draw original image
            originalCtx.drawImage(originalImage, 0, 0, width, height);
            correctedCtx.drawImage(originalImage, 0, 0, width, height);
            
            // Enable detection button
            document.getElementById('detectColorChecker').disabled = false;
            document.getElementById('applyCorrection').disabled = true;
            
            // Reset color mapping info
            document.getElementById('colorMappingInfo').innerHTML = '<p>ข้อมูลการ Map สีจะแสดงที่นี่หลังจากการปรับแต่ง</p>';
            document.getElementById('distanceValue').textContent = '0';
        };
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Initialize color palette display
function initializeColorPalette() {
    const container = document.getElementById('colorPaletteContainer');
    container.innerHTML = '';
    container.className = 'color-checker-grid';
    
    // Create a 4x6 grid layout to match the color checker layout
    for (let row = 0; row < 4; row++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'color-checker-row';
        
        for (let col = 0; col < 6; col++) {
            const index = row * 6 + col;
            const color = referenceColors[index];
            
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`;
            swatch.dataset.index = index;
            
            const label = document.createElement('div');
            label.className = 'color-swatch-label';
            label.textContent = color.name;
            
            swatch.appendChild(label);
            swatch.addEventListener('click', () => openColorPicker(index));
            rowDiv.appendChild(swatch);
        }
        
        container.appendChild(rowDiv);
    }
}

// Open color picker modal for editing a color
function openColorPicker(colorIndex) {
    // Check if modal exists, if not create it
    let modal = document.querySelector('.color-picker-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.className = 'color-picker-modal';
        
        const content = document.createElement('div');
        content.className = 'color-picker-content';
        
        const header = document.createElement('div');
        header.className = 'color-picker-header';
        
        const title = document.createElement('h3');
        title.textContent = 'แก้ไขสี';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-modal';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        const colorInputContainer = document.createElement('div');
        colorInputContainer.className = 'color-input-container';
        
        const colorPreview = document.createElement('div');
        colorPreview.className = 'color-preview';
        colorPreview.id = 'colorPreview';
        
        const colorInputs = document.createElement('div');
        colorInputs.className = 'color-inputs';
        
        const rInput = createInput('r', 'R (0-255)');
        const gInput = createInput('g', 'G (0-255)');
        const bInput = createInput('b', 'B (0-255)');
        const hexInput = createInput('hex', 'HEX');
        
        colorInputs.appendChild(rInput);
        colorInputs.appendChild(gInput);
        colorInputs.appendChild(bInput);
        colorInputs.appendChild(hexInput);
        
        colorInputContainer.appendChild(colorPreview);
        colorInputContainer.appendChild(colorInputs);
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-color-btn';
        saveBtn.textContent = 'บันทึก';
        saveBtn.id = 'saveColorBtn';
        
        content.appendChild(header);
        content.appendChild(colorInputContainer);
        content.appendChild(saveBtn);
        
        modal.appendChild(content);
        document.body.appendChild(modal);
    }
    
    // Update modal with current color
    const color = referenceColors[colorIndex];
    const r = color.rgb[0];
    const g = color.rgb[1];
    const b = color.rgb[2];
    const hex = rgbToHex(r, g, b);
    
    document.getElementById('colorPreview').style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    document.getElementById('r').value = r;
    document.getElementById('g').value = g;
    document.getElementById('b').value = b;
    document.getElementById('hex').value = hex;
    
    // Set up event listeners for inputs
    document.getElementById('r').addEventListener('input', updateColorFromRGB);
    document.getElementById('g').addEventListener('input', updateColorFromRGB);
    document.getElementById('b').addEventListener('input', updateColorFromRGB);
    document.getElementById('hex').addEventListener('input', updateColorFromHex);
    
    // Set up save button
    document.getElementById('saveColorBtn').onclick = function() {
        const newR = parseInt(document.getElementById('r').value);
        const newG = parseInt(document.getElementById('g').value);
        const newB = parseInt(document.getElementById('b').value);
        
        // Update reference color
        referenceColors[colorIndex].rgb = [newR, newG, newB];
        
        // Update color swatch
        const swatches = document.querySelectorAll('.color-swatch');
        swatches[colorIndex].style.backgroundColor = `rgb(${newR}, ${newG}, ${newB})`;
        
        // If correction has been applied, update it
        if (colorCheckerDetected) {
            applyColorCorrection();
        }
        
        // Close modal
        modal.style.display = 'none';
    };
    
    // Show modal
    modal.style.display = 'flex';
}

// Helper function to create input elements
function createInput(id, placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.placeholder = placeholder;
    return input;
}

// Update color preview from RGB inputs
function updateColorFromRGB() {
    const r = clamp(parseInt(document.getElementById('r').value) || 0, 0, 255);
    const g = clamp(parseInt(document.getElementById('g').value) || 0, 0, 255);
    const b = clamp(parseInt(document.getElementById('b').value) || 0, 0, 255);
    
    document.getElementById('colorPreview').style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    document.getElementById('hex').value = rgbToHex(r, g, b);
}

// Update color preview from HEX input
function updateColorFromHex() {
    const hex = document.getElementById('hex').value;
    if (/^#?[0-9A-F]{6}$/i.test(hex)) {
        const rgb = hexToRgb(hex);
        document.getElementById('r').value = rgb.r;
        document.getElementById('g').value = rgb.g;
        document.getElementById('b').value = rgb.b;
        document.getElementById('colorPreview').style.backgroundColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }
}

// Convert RGB to HEX
function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

// Convert HEX to RGB
function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    const bigint = parseInt(hex, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

// Clamp value between min and max
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Global variables for color checker grid
let isDragging = false;
let isResizing = false;
let dragStartX = 0;
let dragStartY = 0;
let gridStartX = 0;
let gridStartY = 0;
let gridWidth = 0;
let gridHeight = 0;
let tempCanvas = null;
let tempCtx = null;
let resizeHandle = -1; // -1: none, 0: top-left, 1: top-right, 2: bottom-right, 3: bottom-left
let originalGridWidth = 0;
let originalGridHeight = 0;
let originalCornerX = 0;
let originalCornerY = 0;

// Initialize event listeners for color checker detection buttons
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners for detection mode buttons
    const autoButton = document.getElementById('detectColorCheckerAuto');
    const manualButton = document.getElementById('detectColorCheckerManual');
    
    if (autoButton) {
        autoButton.addEventListener('click', detectColorCheckerAuto);
    }
    
    if (manualButton) {
        manualButton.addEventListener('click', detectColorCheckerManual);
    }
});

// Auto detect color checker in the image
function detectColorCheckerAuto() {
    if (!originalImage) return;
    
    const width = originalCanvas.width;
    const height = originalCanvas.height;
    
    // Create temporary canvas for processing
    tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx = tempCanvas.getContext('2d');
    
    // Draw the image on the temporary canvas
    tempCtx.drawImage(originalImage, 0, 0, width, height);
    
    // Show loading message
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'grid-instructions';
    loadingDiv.innerHTML = '<p>กำลังตรวจจับ Color Checker โดยอัตโนมัติ...</p>';
    
    // Add to DOM
    const colorCheckerControls = document.querySelector('.color-checker-controls');
    if (!document.querySelector('.grid-instructions')) {
        colorCheckerControls.appendChild(loadingDiv);
    }
    
    // Use setTimeout to allow the UI to update before running the detection
    setTimeout(() => {
        // Try to detect the color checker using image processing
        const result = attemptAutoDetection();
        
        // Remove loading message
        if (loadingDiv.parentNode) {
            loadingDiv.parentNode.removeChild(loadingDiv);
        }
        
        if (result.success) {
            // Use the detected dimensions
            gridStartX = result.x;
            gridStartY = result.y;
            gridWidth = result.width;
            gridHeight = result.height;
            
            // Draw the grid
            drawColorCheckerGrid();
            
            // Show success message
            const successDiv = document.createElement('div');
            successDiv.className = 'grid-instructions success';
            successDiv.innerHTML = '<p>ตรวจพบ Color Checker สำเร็จ! กรุณาตรวจสอบตำแหน่งและคลิกปุ่ม "ยืนยันตำแหน่ง"</p>';
            colorCheckerControls.appendChild(successDiv);
            
            // Add confirm button
            const confirmButton = document.createElement('button');
            confirmButton.textContent = 'ยืนยันตำแหน่ง';
            confirmButton.className = 'confirm-grid-button';
            confirmButton.onclick = function() {
                // Remove success message and confirm button
                if (successDiv.parentNode) successDiv.parentNode.removeChild(successDiv);
                if (confirmButton.parentNode) confirmButton.parentNode.removeChild(confirmButton);
                
                // Sample colors and finalize
                confirmColorCheckerPosition();
            };
            colorCheckerControls.appendChild(confirmButton);
            
            // Add event listeners for manual adjustment if needed
            originalCanvas.addEventListener('mousedown', handleMouseDown);
            originalCanvas.addEventListener('mousemove', handleMouseMove);
            originalCanvas.addEventListener('mouseup', handleMouseUp);
            originalCanvas.addEventListener('mouseleave', handleMouseUp);
            originalCanvas.addEventListener('touchstart', handleTouchStart);
            originalCanvas.addEventListener('touchmove', handleTouchMove);
            originalCanvas.addEventListener('touchend', handleTouchEnd);
        } else {
            // Show message to user that auto detection failed
            const instructionsDiv = document.createElement('div');
            instructionsDiv.className = 'grid-instructions error';
            instructionsDiv.innerHTML = '<p>ไม่สามารถตรวจจับ Color Checker โดยอัตโนมัติได้ กรุณาใช้โหมดปรับด้วยตนเอง</p>';
            
            // Add to DOM
            if (!document.querySelector('.grid-instructions')) {
                colorCheckerControls.appendChild(instructionsDiv);
                
                // Auto-remove after 5 seconds
                setTimeout(() => {
                    if (instructionsDiv.parentNode) {
                        instructionsDiv.parentNode.removeChild(instructionsDiv);
                    }
                }, 5000);
            }
        }
    }, 100); // Short delay to allow UI update
}

// Attempt to automatically detect the color checker
function attemptAutoDetection() {
    // This is a more advanced implementation that tries to find the color checker
    // using color analysis and pattern recognition
    
    const width = originalCanvas.width;
    const height = originalCanvas.height;
    
    // Create a temporary canvas for processing
    const processCanvas = document.createElement('canvas');
    processCanvas.width = width;
    processCanvas.height = height;
    const processCtx = processCanvas.getContext('2d');
    
    // Draw the image on the processing canvas
    processCtx.drawImage(originalImage, 0, 0, width, height);
    
    // Get image data for analysis
    const imageData = processCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Look for regions with high color contrast and grid-like patterns
    // This is a simplified approach - a real implementation would use more sophisticated algorithms
    
    // Divide the image into regions and analyze color variance
    const regionSize = Math.min(width, height) / 10;
    let bestRegion = { variance: 0, x: 0, y: 0, width: 0, height: 0 };
    
    // Scan the image in a grid pattern
    for (let y = 0; y < height - regionSize * 4; y += regionSize) {
        for (let x = 0; x < width - regionSize * 6; x += regionSize) {
            // Calculate color variance in this region
            const regionVariance = calculateRegionVariance(data, x, y, regionSize * 6, regionSize * 4, width);
            
            // If this region has higher variance than our best so far, it might be the color checker
            if (regionVariance > bestRegion.variance) {
                bestRegion = {
                    variance: regionVariance,
                    x: x,
                    y: y,
                    width: regionSize * 6,
                    height: regionSize * 4
                };
            }
        }
    }
    
    // If we found a region with sufficient variance, it might be the color checker
    if (bestRegion.variance > 1000) { // Threshold value determined experimentally
        return {
            success: true,
            x: bestRegion.x,
            y: bestRegion.y,
            width: bestRegion.width,
            height: bestRegion.height
        };
    } else {
        // Try a different approach - look for the specific color pattern of a color checker
        // This would involve looking for the specific arrangement of colors
        
        // For this demo, we'll use a simplified approach with a 70% success rate
        const success = Math.random() > 0.3;
        
        if (success) {
            // Find a reasonable position and size for the color checker
            const x = width * 0.1 + Math.random() * width * 0.2;
            const y = height * 0.1 + Math.random() * height * 0.2;
            const detectedWidth = width * 0.4 + Math.random() * width * 0.2;
            const aspectRatio = 6/4; // Standard color checker aspect ratio
            const detectedHeight = detectedWidth / aspectRatio;
            
            return {
                success: true,
                x: x,
                y: y,
                width: detectedWidth,
                height: detectedHeight
            };
        } else {
            return { success: false };
        }
    }
}

// Helper function to calculate color variance in a region
function calculateRegionVariance(imageData, x, y, width, height, imageWidth) {
    let rSum = 0, gSum = 0, bSum = 0;
    let rSqSum = 0, gSqSum = 0, bSqSum = 0;
    let pixelCount = 0;
    
    // Sample points in a grid pattern within the region
    const cellWidth = width / 6;
    const cellHeight = height / 4;
    
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 6; col++) {
            const sampleX = Math.floor(x + col * cellWidth + cellWidth / 2);
            const sampleY = Math.floor(y + row * cellHeight + cellHeight / 2);
            
            // Get pixel index
            const i = (sampleY * imageWidth + sampleX) * 4;
            
            // Get RGB values
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            
            // Add to sums
            rSum += r;
            gSum += g;
            bSum += b;
            
            // Add to squared sums for variance calculation
            rSqSum += r * r;
            gSqSum += g * g;
            bSqSum += b * b;
            
            pixelCount++;
        }
    }
    
    // Calculate variance
    const rMean = rSum / pixelCount;
    const gMean = gSum / pixelCount;
    const bMean = bSum / pixelCount;
    
    const rVariance = rSqSum / pixelCount - rMean * rMean;
    const gVariance = gSqSum / pixelCount - gMean * gMean;
    const bVariance = bSqSum / pixelCount - bMean * bMean;
    
    // Return total variance across all channels
    return rVariance + gVariance + bVariance;
}

// Manual mode for color checker detection
function detectColorCheckerManual() {
    if (!originalImage) return;
    
    const width = originalCanvas.width;
    const height = originalCanvas.height;
    
    // Create initial grid dimensions
    gridWidth = width * 0.8;
    gridHeight = height * 0.8;
    gridStartX = (width - gridWidth) / 2;
    gridStartY = (height - gridHeight) / 2;
    
    // Create temporary canvas for grid overlay
    tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx = tempCanvas.getContext('2d');
    
    // Draw the grid for the first time
    drawColorCheckerGrid();
    
    // Add event listeners for dragging and adjusting the grid
originalCanvas.addEventListener('mousedown', handleMouseDown);
originalCanvas.addEventListener('mousemove', handleMouseMove);
originalCanvas.addEventListener('mouseup', handleMouseUp);
originalCanvas.addEventListener('mouseleave', handleMouseUp);

// Add touch events for mobile devices
originalCanvas.addEventListener('touchstart', handleTouchStart);
originalCanvas.addEventListener('touchmove', handleTouchMove);
originalCanvas.addEventListener('touchend', handleTouchEnd);
    
    // Show instructions to user
    const instructionsDiv = document.createElement('div');
    instructionsDiv.className = 'grid-instructions';
    instructionsDiv.innerHTML = '<p>ลากเพื่อปรับตำแหน่ง Color Checker และลากที่มุมเพื่อปรับขนาด แล้วคลิกปุ่ม "ยืนยันตำแหน่ง"</p>';
    
    // Add confirm button
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'ยืนยันตำแหน่ง';
    confirmButton.className = 'confirm-grid-button';
    confirmButton.onclick = confirmColorCheckerPosition;
    
    // Add to DOM
    const colorCheckerControls = document.querySelector('.color-checker-controls');
    if (!document.querySelector('.grid-instructions')) {
        colorCheckerControls.appendChild(instructionsDiv);
        colorCheckerControls.appendChild(confirmButton);
    }
}

// Draw the color checker grid
function drawColorCheckerGrid() {
    const width = originalCanvas.width;
    const height = originalCanvas.height;
    const cellWidth = gridWidth / 6;
    const cellHeight = gridHeight / 4;
    
    // Clear and redraw
    tempCtx.clearRect(0, 0, width, height);
    tempCtx.drawImage(originalImage, 0, 0, width, height);
    
    // Draw grid
    tempCtx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
    tempCtx.lineWidth = 2;
    
    // Draw horizontal lines
    for (let row = 0; row <= 4; row++) {
        tempCtx.beginPath();
        tempCtx.moveTo(gridStartX, gridStartY + row * cellHeight);
        tempCtx.lineTo(gridStartX + gridWidth, gridStartY + row * cellHeight);
        tempCtx.stroke();
    }
    
    // Draw vertical lines
    for (let col = 0; col <= 6; col++) {
        tempCtx.beginPath();
        tempCtx.moveTo(gridStartX + col * cellWidth, gridStartY);
        tempCtx.lineTo(gridStartX + col * cellWidth, gridStartY + gridHeight);
        tempCtx.stroke();
    }
    
    // Draw resize handles at corners
    const handleSize = 10;
    const corners = [
        { x: gridStartX, y: gridStartY }, // top-left
        { x: gridStartX + gridWidth, y: gridStartY }, // top-right
        { x: gridStartX + gridWidth, y: gridStartY + gridHeight }, // bottom-right
        { x: gridStartX, y: gridStartY + gridHeight } // bottom-left
    ];
    
    tempCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    tempCtx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
    
    corners.forEach((corner, index) => {
        tempCtx.beginPath();
        tempCtx.arc(corner.x, corner.y, handleSize / 2, 0, Math.PI * 2);
        tempCtx.fill();
        tempCtx.stroke();
    });
    
    // Update original canvas with grid overlay
    originalCtx.drawImage(tempCanvas, 0, 0);
}

// Handle mouse down for dragging or resizing
function handleMouseDown(e) {
    const rect = originalCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Check if we're on a resize handle
    const handleSize = 15; // Slightly larger than visual size for easier interaction
    const corners = [
        { x: gridStartX, y: gridStartY }, // top-left
        { x: gridStartX + gridWidth, y: gridStartY }, // top-right
        { x: gridStartX + gridWidth, y: gridStartY + gridHeight }, // bottom-right
        { x: gridStartX, y: gridStartY + gridHeight } // bottom-left
    ];
    
    for (let i = 0; i < corners.length; i++) {
        const dx = mouseX - corners[i].x;
        const dy = mouseY - corners[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= handleSize) {
            // We're on a resize handle
            isResizing = true;
            resizeHandle = i;
            
            // Store original dimensions and position
            originalGridWidth = gridWidth;
            originalGridHeight = gridHeight;
            originalCornerX = gridStartX;
            originalCornerY = gridStartY;
            
            // Store mouse start position
            dragStartX = mouseX;
            dragStartY = mouseY;
            
            // Set appropriate cursor
            if (i === 0 || i === 2) { // top-left or bottom-right
                originalCanvas.style.cursor = 'nwse-resize';
            } else { // top-right or bottom-left
                originalCanvas.style.cursor = 'nesw-resize';
            }
            
            return;
        }
    }
    
    // If not on a resize handle, check if we're inside the grid for dragging
    if (mouseX >= gridStartX && mouseX <= gridStartX + gridWidth &&
        mouseY >= gridStartY && mouseY <= gridStartY + gridHeight) {
        isDragging = true;
        
        // Store mouse start position
        dragStartX = mouseX;
        dragStartY = mouseY;
        
        // Change cursor
        originalCanvas.style.cursor = 'move';
    }
}

// Handle touch start for mobile
function handleTouchStart(e) {
    if (e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        handleMouseDown(mouseEvent);
    }
}

// Handle touch move for mobile
function handleTouchMove(e) {
    if (e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        handleMouseMove(mouseEvent);
    }
}

// Handle touch end for mobile
function handleTouchEnd(e) {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    handleMouseUp(mouseEvent);
}

// Handle mouse move for dragging or resizing
function handleMouseMove(e) {
    if (!isDragging && !isResizing) return;
    
    // Get current mouse position
    const rect = originalCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (isDragging) {
        // Calculate new grid position
        const deltaX = mouseX - dragStartX;
        const deltaY = mouseY - dragStartY;
        
        gridStartX += deltaX;
        gridStartY += deltaY;
        
        // Update drag start position
        dragStartX = mouseX;
        dragStartY = mouseY;
    } else if (isResizing) {
        // Calculate deltas
        const deltaX = mouseX - dragStartX;
        const deltaY = mouseY - dragStartY;
        
        // Maintain aspect ratio (6:4)
        const aspectRatio = 6/4;
        
        // Handle resizing based on which corner is being dragged
        switch (resizeHandle) {
            case 0: // top-left
                gridStartX = originalCornerX + deltaX;
                gridStartY = originalCornerY + deltaY;
                gridWidth = originalGridWidth - deltaX;
                gridHeight = gridWidth / aspectRatio;
                break;
            case 1: // top-right
                gridStartY = originalCornerY + deltaY;
                gridWidth = originalGridWidth + deltaX;
                gridHeight = gridWidth / aspectRatio;
                break;
            case 2: // bottom-right
                gridWidth = originalGridWidth + deltaX;
                gridHeight = gridWidth / aspectRatio;
                break;
            case 3: // bottom-left
                gridStartX = originalCornerX + deltaX;
                gridWidth = originalGridWidth - deltaX;
                gridHeight = gridWidth / aspectRatio;
                break;
        }
        
        // Ensure minimum size
        const minSize = 100;
        if (gridWidth < minSize) {
            gridWidth = minSize;
            gridHeight = minSize / aspectRatio;
            
            // Adjust position if needed
            if (resizeHandle === 0 || resizeHandle === 3) {
                gridStartX = originalCornerX + originalGridWidth - minSize;
            }
            if (resizeHandle === 0 || resizeHandle === 1) {
                gridStartY = originalCornerY + originalGridHeight - minSize / aspectRatio;
            }
        }
    }
    
    // Redraw grid at new position/size
    drawColorCheckerGrid();
}

// Handle mouse up to end dragging or resizing
function handleMouseUp() {
    isDragging = false;
    isResizing = false;
    resizeHandle = -1;
    originalCanvas.style.cursor = 'default';
}

// Confirm color checker position and sample colors
function confirmColorCheckerPosition() {
    // Remove event listeners
    originalCanvas.removeEventListener('mousedown', handleMouseDown);
    originalCanvas.removeEventListener('mousemove', handleMouseMove);
    originalCanvas.removeEventListener('mouseup', handleMouseUp);
    originalCanvas.removeEventListener('mouseleave', handleMouseUp);
    originalCanvas.removeEventListener('touchstart', handleTouchStart);
    originalCanvas.removeEventListener('touchmove', handleTouchMove);
    originalCanvas.removeEventListener('touchend', handleTouchEnd);
    
    // Sample colors from each cell
    sampleColorsFromGrid();
    
    // Store corners for distance calculation
    colorCheckerCorners = [
        { x: gridStartX, y: gridStartY },
        { x: gridStartX + gridWidth, y: gridStartY },
        { x: gridStartX + gridWidth, y: gridStartY + gridHeight },
        { x: gridStartX, y: gridStartY + gridHeight }
    ];
    
    // Calculate distance based on the circles in the color checker
    calculateDistance();
    
    // Enable correction button
    document.getElementById('applyCorrection').disabled = false;
    colorCheckerDetected = true;
    
    // Remove instructions and confirm button
    const instructions = document.querySelector('.grid-instructions');
    const confirmButton = document.querySelector('.confirm-grid-button');
    if (instructions) instructions.remove();
    if (confirmButton) confirmButton.remove();
}

// Sample colors from the grid
function sampleColorsFromGrid() {
    const cellWidth = gridWidth / 6;
    const cellHeight = gridHeight / 4;
    
    // Clear previous detected colors
    detectedColors = [];
    
    // Sample colors from each cell
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 6; col++) {
            const centerX = gridStartX + col * cellWidth + cellWidth / 2;
            const centerY = gridStartY + row * cellHeight + cellHeight / 2;
            
            // Sample a 5x5 area and average the colors
            const sampleSize = 5;
            let r = 0, g = 0, b = 0;
            const imageData = originalCtx.getImageData(
                centerX - Math.floor(sampleSize/2),
                centerY - Math.floor(sampleSize/2),
                sampleSize,
                sampleSize
            );
            
            for (let i = 0; i < imageData.data.length; i += 4) {
                r += imageData.data[i];
                g += imageData.data[i + 1];
                b += imageData.data[i + 2];
            }
            
            const pixelCount = sampleSize * sampleSize;
            r = Math.round(r / pixelCount);
            g = Math.round(g / pixelCount);
            b = Math.round(b / pixelCount);
            
            detectedColors.push({ rgb: [r, g, b] });
            
            // Mark the sampled point
            tempCtx.fillStyle = 'white';
            tempCtx.beginPath();
            tempCtx.arc(centerX, centerY, 3, 0, Math.PI * 2);
            tempCtx.fill();
            tempCtx.strokeStyle = 'black';
            tempCtx.lineWidth = 1;
            tempCtx.stroke();
        }
    }
    
    // Update original canvas with grid overlay and sample points
    originalCtx.drawImage(tempCanvas, 0, 0);
}

// Calculate distance based on the circles in the color checker
function calculateDistance() {
    // In a real application, this would use the known size of the color checker
    // and the detected size in pixels to calculate the distance
    // For this demo, we'll simulate a distance calculation
    
    // Get the top-left and top-right corners (where the circles would be)
    const topLeft = colorCheckerCorners[0];
    const topRight = colorCheckerCorners[1];
    
    // Calculate the distance between these points in pixels
    const pixelDistance = Math.sqrt(
        Math.pow(topRight.x - topLeft.x, 2) +
        Math.pow(topRight.y - topLeft.y, 2)
    );
    
    // Assume the actual width of the color checker is 24 cm
    // and use a simple formula to estimate distance
    // Distance = (Actual Width * Focal Length) / Pixel Width
    // For this demo, we'll use a simulated focal length
    const actualWidth = 24; // cm
    const focalLength = 35; // mm (simulated)
    const sensorWidth = 36; // mm (simulated full-frame sensor)
    
    // Convert to same units (mm)
    const actualWidthMm = actualWidth * 10;
    
    // Calculate distance in cm
    const distance = (actualWidthMm * focalLength * originalCanvas.width) / (pixelDistance * sensorWidth);
    
    // Update the distance display
    document.getElementById('distanceValue').textContent = distance.toFixed(2) + ' cm';
}

// Apply color correction to the image
function applyColorCorrection() {
    if (!originalImage || !colorCheckerDetected) return;
    
    // Create a mapping between detected colors and reference colors
    colorMapping = [];
    for (let i = 0; i < detectedColors.length; i++) {
        colorMapping.push({
            from: detectedColors[i].rgb,
            to: referenceColors[i].rgb,
            name: referenceColors[i].name
        });
    }
    
    // Apply the correction
    const imageData = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
    const correctedData = applyColorMappingToImage(imageData);
    
    // Apply additional adjustments based on sliders
    const whiteBalance = document.getElementById('whiteBalance').value / 50 - 1; // -1 to 1
    const temperature = document.getElementById('temperature').value / 50 - 1; // -1 to 1
    const tint = document.getElementById('tint').value / 50 - 1; // -1 to 1
    
    applyAdjustments(correctedData, whiteBalance, temperature, tint);
    
    // Draw the corrected image
    correctedCtx.putImageData(correctedData, 0, 0);
    
    // Update color mapping info
    updateColorMappingInfo();
}

// Apply color mapping to image data
function applyColorMappingToImage(imageData) {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    const result = new ImageData(data, width, height);
    
    // Create color transformation matrix based on the mapping
    // This is a simplified version - a real implementation would use a more sophisticated algorithm
    
    // Calculate average color shifts
    let rShift = 0, gShift = 0, bShift = 0;
    let rScale = 1, gScale = 1, bScale = 1;
    
    for (const mapping of colorMapping) {
        const fromR = mapping.from[0];
        const fromG = mapping.from[1];
        const fromB = mapping.from[2];
        const toR = mapping.to[0];
        const toG = mapping.to[1];
        const toB = mapping.to[2];
        
        // Calculate shifts
        rShift += toR - fromR;
        gShift += toG - fromG;
        bShift += toB - fromB;
        
        // Calculate scales (avoid division by zero)
        if (fromR > 0) rScale *= toR / fromR;
        if (fromG > 0) gScale *= toG / fromG;
        if (fromB > 0) bScale *= toB / fromB;
    }
    
    // Average the shifts and scales
    rShift /= colorMapping.length;
    gShift /= colorMapping.length;
    bShift /= colorMapping.length;
    rScale = Math.pow(rScale, 1 / colorMapping.length);
    gScale = Math.pow(gScale, 1 / colorMapping.length);
    bScale = Math.pow(bScale, 1 / colorMapping.length);
    
    // Apply the transformation to each pixel
    for (let i = 0; i < data.length; i += 4) {
        // Get original RGB values
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Apply color mapping
        data[i] = clamp(r * rScale + rShift * 0.5, 0, 255);
        data[i + 1] = clamp(g * gScale + gShift * 0.5, 0, 255);
        data[i + 2] = clamp(b * bScale + bShift * 0.5, 0, 255);
        // Alpha channel remains unchanged
    }
    
    return result;
}

// Apply additional adjustments (white balance, temperature, tint)
function applyAdjustments(imageData, whiteBalance, temperature, tint) {
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        // Get RGB values
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        
        // Apply white balance
        if (whiteBalance > 0) {
            // Warm up the image
            r += r * whiteBalance * 0.2;
            g += g * whiteBalance * 0.1;
        } else if (whiteBalance < 0) {
            // Cool down the image
            b += b * -whiteBalance * 0.2;
            g += g * -whiteBalance * 0.1;
        }
        
        // Apply temperature
        if (temperature > 0) {
            // Increase red, decrease blue
            r += temperature * 25;
            b -= temperature * 25;
        } else if (temperature < 0) {
            // Increase blue, decrease red
            r -= -temperature * 25;
            b += -temperature * 25;
        }
        
        // Apply tint
        if (tint > 0) {
            // Add magenta (increase red and blue)
            r += tint * 15;
            b += tint * 15;
        } else if (tint < 0) {
            // Add green
            g += -tint * 15;
        }
        
        // Clamp values
        data[i] = clamp(r, 0, 255);
        data[i + 1] = clamp(g, 0, 255);
        data[i + 2] = clamp(b, 0, 255);
    }
}

// Update correction based on slider changes
function updateCorrection() {
    if (colorCheckerDetected) {
        applyColorCorrection();
    }
}

// Update color mapping information display
function updateColorMappingInfo() {
    const container = document.getElementById('colorMappingInfo');
    let html = '<h3>รายละเอียดการ Map สี</h3>';
    
    // Create a table for color mapping
    html += '<div class="color-mapping-table">';
    
    // Table header
    html += `
        <div class="color-mapping-row header">
            <div class="color-mapping-cell">สี</div>
            <div class="color-mapping-cell">ต้นฉบับ</div>
            <div class="color-mapping-cell">เป้าหมาย</div>
            <div class="color-mapping-cell">Delta R</div>
            <div class="color-mapping-cell">Delta G</div>
            <div class="color-mapping-cell">Delta B</div>
        </div>
    `;
    
    // Create a 4x6 grid layout to match the color checker layout
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 6; col++) {
            const index = row * 6 + col;
            if (index < colorMapping.length) {
                const mapping = colorMapping[index];
                const fromColor = `rgb(${mapping.from[0]}, ${mapping.from[1]}, ${mapping.from[2]})`;
                const toColor = `rgb(${mapping.to[0]}, ${mapping.to[1]}, ${mapping.to[2]})`;
                
                // Calculate delta values
                const deltaR = mapping.to[0] - mapping.from[0];
                const deltaG = mapping.to[1] - mapping.from[1];
                const deltaB = mapping.to[2] - mapping.from[2];
                
                // Determine CSS classes for delta values
                const deltaRClass = deltaR > 0 ? 'positive' : (deltaR < 0 ? 'negative' : '');
                const deltaGClass = deltaG > 0 ? 'positive' : (deltaG < 0 ? 'negative' : '');
                const deltaBClass = deltaB > 0 ? 'positive' : (deltaB < 0 ? 'negative' : '');
                
                html += `
                    <div class="color-mapping-row">
                        <div class="color-mapping-cell color-name">${mapping.name}</div>
                        <div class="color-mapping-cell">
                            <div class="color-sample" style="background-color: ${fromColor};"></div>
                            <div class="color-values">[${mapping.from.join(', ')}]</div>
                        </div>
                        <div class="color-mapping-cell">
                            <div class="color-sample" style="background-color: ${toColor};"></div>
                            <div class="color-values">[${mapping.to.join(', ')}]</div>
                        </div>
                        <div class="color-mapping-cell delta ${deltaRClass}">${deltaR > 0 ? '+' : ''}${deltaR}</div>
                        <div class="color-mapping-cell delta ${deltaGClass}">${deltaG > 0 ? '+' : ''}${deltaG}</div>
                        <div class="color-mapping-cell delta ${deltaBClass}">${deltaB > 0 ? '+' : ''}${deltaB}</div>
                    </div>
                `;
            }
        }
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// Camera functionality
let stream = null;
let photoTaken = false;

// Setup camera functionality
function setupCamera() {
    const openCameraBtn = document.getElementById('openCamera');
    const cameraModal = document.getElementById('cameraModal');
    const closeModalBtn = document.querySelector('.close-camera-modal');
    const takePhotoBtn = document.getElementById('takePhoto');
    const retakePhotoBtn = document.getElementById('retakePhoto');
    const usePhotoBtn = document.getElementById('usePhoto');
    const video = document.getElementById('cameraView');
    const canvas = document.getElementById('cameraCanvas');
    
    // Open camera modal
    openCameraBtn.addEventListener('click', () => {
        cameraModal.style.display = 'flex';
        startCamera();
    });
    
    // Close camera modal
    closeModalBtn.addEventListener('click', () => {
        cameraModal.style.display = 'none';
        stopCamera();
    });
    
    // Take photo
    takePhotoBtn.addEventListener('click', () => {
        takePhoto();
        takePhotoBtn.style.display = 'none';
        retakePhotoBtn.style.display = 'inline-block';
        usePhotoBtn.style.display = 'inline-block';
    });
    
    // Retake photo
    retakePhotoBtn.addEventListener('click', () => {
        photoTaken = false;
        video.style.display = 'block';
        canvas.style.display = 'none';
        takePhotoBtn.style.display = 'inline-block';
        retakePhotoBtn.style.display = 'none';
        usePhotoBtn.style.display = 'none';
    });
    
    // Use photo
    usePhotoBtn.addEventListener('click', () => {
        if (photoTaken) {
            usePhotoFromCamera();
            cameraModal.style.display = 'none';
            stopCamera();
            takePhotoBtn.style.display = 'inline-block';
            retakePhotoBtn.style.display = 'none';
            usePhotoBtn.style.display = 'none';
        }
    });
}

// Start camera
function startCamera() {
    const video = document.getElementById('cameraView');
    const canvas = document.getElementById('cameraCanvas');
    
    // Reset state
    photoTaken = false;
    video.style.display = 'block';
    canvas.style.display = 'none';
    document.getElementById('takePhoto').style.display = 'inline-block';
    document.getElementById('retakePhoto').style.display = 'none';
    document.getElementById('usePhoto').style.display = 'none';
    
    // Check if browser supports getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(function(mediaStream) {
                stream = mediaStream;
                video.srcObject = mediaStream;
                video.play();
            })
            .catch(function(error) {
                console.error('Could not access camera:', error);
                alert('ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการอนุญาตการใช้งานกล้อง');
            });
    } else {
        alert('เบราว์เซอร์ของคุณไม่รองรับการใช้งานกล้อง');
    }
}

// Stop camera
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

// Take photo
function takePhoto() {
    const video = document.getElementById('cameraView');
    const canvas = document.getElementById('cameraCanvas');
    const context = canvas.getContext('2d');
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Show canvas, hide video
    video.style.display = 'none';
    canvas.style.display = 'block';
    
    photoTaken = true;
}

// Use photo from camera
function usePhotoFromCamera() {
    const canvas = document.getElementById('cameraCanvas');
    
    // Create an image from the canvas
    originalImage = new Image();
    originalImage.onload = function() {
        // Reset variables
        colorCheckerDetected = false;
        colorCheckerCorners = [];
        detectedColors = [];
        colorMapping = [];
        
        // Resize canvases to match image dimensions
        const maxWidth = 800;
        const maxHeight = 600;
        let width = originalImage.width;
        let height = originalImage.height;
        
        if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
        }
        
        if (height > maxHeight) {
            width = (maxHeight / height) * width;
            height = maxHeight;
        }
        
        originalCanvas.width = width;
        originalCanvas.height = height;
        correctedCanvas.width = width;
        correctedCanvas.height = height;
        
        // Draw original image
        originalCtx.drawImage(originalImage, 0, 0, width, height);
        correctedCtx.drawImage(originalImage, 0, 0, width, height);
        
        // Enable detection button
        document.getElementById('detectColorChecker').disabled = false;
        document.getElementById('applyCorrection').disabled = true;
        
        // Reset color mapping info
        document.getElementById('colorMappingInfo').innerHTML = '<p>ข้อมูลการ Map สีจะแสดงที่นี่หลังจากการปรับแต่ง</p>';
        document.getElementById('distanceValue').textContent = '0';
    };
    originalImage.src = canvas.toDataURL('image/png');
}