const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');

// --- Configuration ---

// Grid & Text Settings
const fontSize = 16;
const charSpacing = fontSize * 0.8;
const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-=_+[]{}|;':\",./<>?";
const colors = [
    'rgba(0, 255, 255, 0.2)', // Faded cyan
    'rgba(0, 200, 200, 0.2)',
    'rgba(0, 255, 255, 0.1)',
    'rgba(0, 150, 150, 0.1)'
];

// Word Settings
const words = [
    "Tomass Sander", "Sander", "Tomass",
    "School project", "Employee Time Tracking", "Empower your workforce"
];
const wordColor = 'rgba(173, 216, 230, 0.8)';
const wordGlowColor = 'rgba(173, 216, 230, 1)';
const wordFadeInDuration = 8;
const wordDisplayDuration = 60;
const wordFadeOutDuration = 8;
const wordDisplayInterval = 30;
const maxActiveWords = 5;
const wordWaveAmplitude = 5;       // Amplitude of the word wave
const wordWaveFrequency = 0.5;       // Frequency of the word wave across the word
const wordWaveSpeed = 0.1;           // Speed at which the wave moves

// Ring Settings
const rings = [
    { baseRadius: 200, pulsationAmplitude: 50, thickness: 30, rotationSpeed: 0.01, rotationAngle: 0 },
    { baseRadius: 350, pulsationAmplitude: 30, thickness: 20, rotationSpeed: 0.015, rotationAngle: 0 },
    { baseRadius: 500, pulsationAmplitude: 40, thickness: 25, rotationSpeed: 0.02, rotationAngle: 0 },
    { baseRadius: 100, pulsationAmplitude: 20, thickness: 15, rotationSpeed: 0.008, rotationAngle: 0 }
];
const ringColor = 'rgba(173, 216, 230, 0.8)';
const ringGlowColor = 'rgba(173, 216, 230, 1)';
const sineAmplitude = 10;
const sineFrequency = 0.02;

// Mouse settings
const mouseInfluenceRadius = 80;
const dragInfluenceRadius = 100;
const dragFactor = 0.07;
const clickAnimationDuration = 20;

// Glitch Effect Settings
const glitchProbability = 0.0001; // ~0.01% chance per cell per frame

// --- Global Data ---
let grid = [];
let wordPlacements = [];
let frameCount = 0;
let columns, rows;
let mouseX = -1000, mouseY = -1000;
let clickAnimations = [];
let highlightedChar = null;  // Store the currently highlighted character
let highlightDuration = 10; // Frames to keep the character highlighted
let highlightFrame = 0;     // Frame count when highlighting started

// --- Utility Functions ---
let textWidthCache = {};

function getTextWidth(text, font) {
    if (!textWidthCache[text]) {
        ctx.font = font;
        textWidthCache[text] = ctx.measureText(text).width;
    }
    return textWidthCache[text];
}

function calculateWordPlacements() {
    wordPlacements = [];
    const font = `${fontSize}px monospace`;

    for (const word of words) {
        let placed = false;
        let attempts = 0;
        const wordWidth = getTextWidth(word, font);
        const maxStartCol = Math.floor((canvas.width - wordWidth) / charSpacing);

        if (maxStartCol < 0) {
            console.warn(`Word "${word}" is too long for the canvas width.`);
            continue;
        }

        while (!placed && attempts < 100) {
            attempts++;
            const startRow = Math.floor(Math.random() * (rows - 2));
            const startCol = Math.floor(Math.random() * (maxStartCol + 1));

            let overlap = false;
            for (const p of wordPlacements) {
                if (startRow >= p.row - 1 && startRow <= p.row + 1 &&
                    startCol + word.length >= p.col && startCol <= p.col + p.word.length) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                wordPlacements.push({
                    word: word,
                    row: startRow,
                    col: startCol,
                    displayStartFrame: -1,
                    state: 'idle',
                    waveOffset: 0,
                });
                placed = true;
            }
        }
    }
}

function updateWordPlacements() {
    if (frameCount % wordDisplayInterval === 0) {
        let activeCount = 0;
        for (const p of wordPlacements) {
            if (p.displayStartFrame !== -1) {
                activeCount++;
            }
        }

        if (activeCount < maxActiveWords) {
            const available = wordPlacements.filter(p => p.displayStartFrame === -1);
            if (available.length > 0) {
                const randomIndex = Math.floor(Math.random() * available.length);
                available[randomIndex].displayStartFrame = frameCount;
                available[randomIndex].state = 'fadeIn';
            }
        }

        if (activeCount < maxActiveWords / 2 && Math.random() < 0.4) {
            calculateWordPlacements();
        }
    }

    for (const placement of wordPlacements) {
        if (placement.displayStartFrame !== -1) {
            const elapsed = frameCount - placement.displayStartFrame;

            switch (placement.state) {
                case 'fadeIn':
                    if (elapsed >= wordFadeInDuration) {
                        placement.state = 'visible';
                        placement.displayStartFrame = frameCount;
                    }
                    break;
                case 'visible':
                    if (elapsed >= wordDisplayDuration) {
                        placement.state = 'fadeOut';
                        placement.displayStartFrame = frameCount;
                        placement.waveOffset = 0; // Reset on fade out
                    }
                    break;
                case 'fadeOut':
                    if (elapsed >= wordFadeOutDuration) {
                        placement.state = 'idle';
                        placement.displayStartFrame = -1;
                    }
                    break;
            }

            if (placement.state === 'visible') {
                placement.waveOffset += wordWaveSpeed;
            }
        }
    }
}

// --- Initialization ---
function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    columns = Math.floor(window.innerWidth / charSpacing);
    rows = Math.floor(window.innerHeight / fontSize);
    frameCount = 0;

    grid = [];
    for (let i = 0; i < rows; i++) {
        grid[i] = [];
        for (let j = 0; j < columns; j++) {
            grid[i][j] = {
                char: chars[Math.floor(Math.random() * chars.length)],
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 0,
                fadeSpeed: 0.01 + Math.random() * 0.03,
                fadingIn: false,
                glow: false,
                glowIntensity: 0,
                originalColor: colors[Math.floor(Math.random() * colors.length)],
                isWord: false,
            };
        }
    }

    calculateWordPlacements();
}

// --- Main Drawing Function ---
function draw() {
    ctx.fillStyle = 'rgba(10, 15, 30, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${fontSize}px monospace`;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Update ring positions and rotations
    for (const ring of rings) {
        ring.rotationAngle += ring.rotationSpeed;
        ring.currentRadius = ring.baseRadius + ring.pulsationAmplitude * Math.sin(frameCount * 0.02);
    }

    updateWordPlacements();

    // Check if the highlight should fade
    if (highlightedChar && frameCount - highlightFrame > highlightDuration) {
        highlightedChar = null;
    }

    // Draw each cell in the grid
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < columns; j++) {
            const cell = grid[i][j];
            let x = j * charSpacing;
            let y = i * fontSize;

            // Mouse Distortion
            const originalDistX = x - mouseX;
            const originalDistY = y - mouseY;
            const originalDistSq = originalDistX * originalDistX + originalDistY * originalDistY;

            if (originalDistSq < dragInfluenceRadius * dragInfluenceRadius) {
                const influence = 1 - Math.sqrt(originalDistSq) / dragInfluenceRadius;
                x += (mouseX - centerX) * dragFactor * influence;
                y += (mouseY - centerY) * dragFactor * influence;
            }

            // Ring and Sine Wave Offsets
            const dx = x - centerX;
            const dy = y - centerY;
            const distSquared = dx * dx + dy * dy;
            const angle = Math.atan2(dy, dx);
            let totalOffsetX = 0;
            let totalOffsetY = 0;
            let maxInfluence = 0;

            for (const ring of rings) {
                const diff = Math.abs(Math.sqrt(distSquared) - ring.currentRadius);
                if (diff < ring.thickness) {
                    const influence = Math.pow(1 - diff / ring.thickness, 2);
                    const offset = influence * 10;
                    totalOffsetX += offset * Math.cos(angle + ring.rotationAngle);
                    totalOffsetY += offset * Math.sin(angle + ring.rotationAngle);
                    maxInfluence = Math.max(maxInfluence, influence);
                }
            }

            const sineOffsetX = sineAmplitude * Math.sin((y * sineFrequency) + frameCount * 0.05);
            const sineOffsetY = sineAmplitude * 0.5 * Math.sin((x * sineFrequency) + frameCount * 0.05);
            let finalOffsetX = totalOffsetX + sineOffsetX;
            let finalOffsetY = totalOffsetY + sineOffsetY;

            let cellScreenX = x + finalOffsetX;
            let cellScreenY = y + finalOffsetY;

            // Word Placement Logic
            cell.isWord = false;
            let isWordCell = false;
            let wordCellAlpha = 0;
            let waveEffect = 0; // Initialize waveEffect

            for (const placement of wordPlacements) {
                if (placement && placement.displayStartFrame !== -1) {
                    if (i >= placement.row && i < placement.row + 2 && j >= placement.col && j < placement.col + placement.word.length) {
                        const charIndex = j - placement.col;
                        if (i === placement.row + 1 && charIndex < placement.word.length) {

                            if (placement.state === 'visible') {
                                // Calculate wave effect *before* checking fadeIn/fadeOut
                                waveEffect = Math.sin(charIndex * wordWaveFrequency + placement.waveOffset) * wordWaveAmplitude;
                            }

                            if (placement.state === 'fadeIn') {
                                const elapsed = frameCount - placement.displayStartFrame;
                                wordCellAlpha = Math.min(1, elapsed / wordFadeInDuration);
                                isWordCell = true;
                            } else if (placement.state === 'visible') {
                                wordCellAlpha = 1;
                                isWordCell = true;
                                // Apply wave effect
                                finalOffsetY += waveEffect;
                                cellScreenY += waveEffect;
                            } else if (placement.state === 'fadeOut') {
                                const elapsed = frameCount - placement.displayStartFrame;
                                wordCellAlpha = 1 - Math.min(1, elapsed / wordFadeOutDuration);
                                isWordCell = true;
                            }
                            if (isWordCell) {
                                cell.char = placement.word[charIndex];
                                cell.isWord = true;
                                break;
                            }
                        }
                    }
                }
            }

            const distMouseSquared = (cellScreenX - mouseX) ** 2 + (cellScreenY - mouseY) ** 2;

            // Cell Appearance (Apply wave effect to mouse-influenced cells too)
            if (isWordCell) {
                cell.color = wordColor;
                cell.glow = true;
                cell.glowIntensity = 1;
                cell.alpha = wordCellAlpha;
            } else if (distMouseSquared < mouseInfluenceRadius * mouseInfluenceRadius) {
                const factor = (mouseInfluenceRadius - Math.sqrt(distMouseSquared)) / mouseInfluenceRadius;
                cell.color = ringColor;
                cell.glow = true;
                cell.glowIntensity = factor;
                cell.alpha = 0.2 + factor * 0.4;

                // Apply a *subtle* wave effect if it's a word cell that's *also* mouse-influenced.
                if (isWordCell) {
                    cellScreenX += (Math.random() * 2 - 1) + waveEffect * 0.2; // Reduced wave effect
                    cellScreenY += (Math.random() * 2 - 1) + waveEffect * 0.2;
                } else {
                    cellScreenX += (Math.random() * 2 - 1);
                    cellScreenY += (Math.random() * 2 - 1);
                }
            } else if (maxInfluence > 0) {
                cell.color = ringColor;
                cell.glow = true;
                cell.glowIntensity = maxInfluence;
                cell.alpha = 0.6 + maxInfluence * 0.4;
            } else {
                cell.color = cell.originalColor;
                cell.glow = false;
            }

            // Fading effect for non-word cells
            if (!cell.isWord) {
                if (cell.fadingIn) {
                    cell.alpha += cell.fadeSpeed;
                    if (cell.alpha >= 0.3) {
                        cell.alpha = 0.3;
                        cell.fadingIn = false;
                    }
                } else {
                    cell.alpha -= cell.fadeSpeed;
                    if (cell.alpha <= 0) {
                        cell.alpha = 0;
                        cell.fadingIn = true;
                        cell.char = chars[Math.floor(Math.random() * chars.length)];
                        cell.originalColor = colors[Math.floor(Math.random() * colors.length)];
                    }
                }
            }

             // --- Key Press Highlighting ---
            if (highlightedChar && cell.char === highlightedChar) {
                // Override color and glow for highlighted characters
                cell.color = 'white';  // Brighter color
                cell.glow = true;
                cell.glowIntensity = 1; // Maximum glow
                cell.alpha = 1;          // Full opacity
            }


            // --- Glitch Effect ---
            if (Math.random() < glitchProbability) {
                const glitchChar = chars[Math.floor(Math.random() * chars.length)];
                const glitchOffsetX = (Math.random() * 6) - 3;
                const glitchOffsetY = (Math.random() * 6) - 3;
                ctx.fillStyle = 'rgba(255, 0, 0, 0.9)'; // Red tint for glitch
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(255, 255, 255, 1)';
                ctx.fillText(glitchChar, cellScreenX + glitchOffsetX, cellScreenY + glitchOffsetY);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
                continue; // Skip the normal drawing for this cell
            }

            // --- Drawing the Cell ---
            ctx.fillStyle = cell.color;
            ctx.globalAlpha = cell.alpha;
            ctx.shadowBlur = cell.glow ? 8 * cell.glowIntensity : 0;
            ctx.shadowColor = cell.isWord ? wordGlowColor : ringGlowColor;
            if (highlightedChar && cell.char === highlightedChar) {
                ctx.shadowColor = 'white'; // Match highlight color
            }
            ctx.fillText(cell.char, cellScreenX, cellScreenY);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }

    // --- Jittered circle around the cursor ---
    if (mouseX > 0 && mouseY > 0) {
        const numPoints = 32;
        const jitterAmplitude = 2;
        const jitteredPath = new Path2D();
        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            const jitter = (Math.random() * 2 - 1) * jitterAmplitude;
            const radius = mouseInfluenceRadius + jitter;
            const x = mouseX + radius * Math.cos(angle);
            const y = mouseY + radius * Math.sin(angle);
            if (i === 0) {
                jitteredPath.moveTo(x, y);
            } else {
                jitteredPath.lineTo(x, y);
            }
        }
        jitteredPath.closePath();
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = ringGlowColor;
        ctx.stroke(jitteredPath);
        ctx.shadowBlur = 0;
    }

    // --- Click Animations ---
    for (let i = clickAnimations.length - 1; i >= 0; i--) {
        const animation = clickAnimations[i];
        const elapsed = frameCount - animation.startFrame;

        if (elapsed > clickAnimationDuration) {
            clickAnimations.splice(i, 1);
            continue;
        }

        const progress = elapsed / clickAnimationDuration;
        const radius = mouseInfluenceRadius * (1 + progress * 2);
        const alpha = 1 - progress;

        ctx.beginPath();
        ctx.arc(animation.x, animation.y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(173, 216, 230, ${alpha})`;
        ctx.lineWidth = 3 * (1 - progress);
        ctx.stroke();
    }

    frameCount++;
}

// --- Animation Loop ---
function animate() {
    draw();
    requestAnimationFrame(animate);
}

// --- Event Listeners ---
let resizeTimeout;

function debouncedInit() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(init, 100);
}

function handleClick(event) {
    clickAnimations.push({
        x: event.clientX,
        y: event.clientY,
        startFrame: frameCount,
    });
}

function handleKeyPress(event) {
    highlightedChar = event.key;
    highlightFrame = frameCount;
}

init();
animate();

window.addEventListener('resize', debouncedInit);
document.addEventListener('mousemove', (event) => { mouseX = event.clientX; mouseY = event.clientY; });
document.addEventListener('mouseout', () => { mouseX = -1000; mouseY = -1000; });
document.addEventListener('mouseleave', () => { mouseX = -1000; mouseY = -1000; });
document.addEventListener('click', handleClick);
document.addEventListener('keydown', handleKeyPress); // Add keydown event listener