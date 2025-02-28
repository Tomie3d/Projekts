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
const wordWaveAmplitude = 5;       // Vertical displacement amplitude
const wordWaveFrequency = 0.5;       // Frequency across the word
const wordWaveSpeed = 0.1;           // Wave movement speed

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

// Glitch Effect Settings
const glitchProbability = 0.0001; // ~0.01% chance per cell per frame

// --- Global Data ---
let grid = [];
let wordPlacements = [];
let frameCount = 0;
let columns, rows;
let mouseX = -1000, mouseY = -1000;
let highlightedChar = null;  // Currently highlighted character from key press
const highlightDuration = 10; // Frames to keep highlighted
let highlightFrame = 0;

// Cache for text widths
const textWidthCache = {};
function getTextWidth(text, font) {
  if (!textWidthCache[text]) {
    ctx.font = font;
    textWidthCache[text] = ctx.measureText(text).width;
  }
  return textWidthCache[text];
}

// --- Word Placement Helpers ---
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
      const overlap = wordPlacements.some(p =>
        startRow >= p.row - 1 && startRow <= p.row + 1 &&
        startCol + word.length >= p.col && startCol <= p.col + p.word.length
      );
      if (!overlap) {
        wordPlacements.push({
          word,
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
    const activeCount = wordPlacements.filter(p => p.displayStartFrame !== -1).length;
    if (activeCount < maxActiveWords) {
      const available = wordPlacements.filter(p => p.displayStartFrame === -1);
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        available[randomIndex].displayStartFrame = frameCount;
        available[randomIndex].state = 'fadeIn';
      }
    }
    // Occasionally recalc placements when few words are active
    if (activeCount < maxActiveWords / 2 && Math.random() < 0.4) {
      calculateWordPlacements();
    }
  }
  
  wordPlacements.forEach(placement => {
    if (placement.displayStartFrame !== -1) {
      const elapsed = frameCount - placement.displayStartFrame;
      if (placement.state === 'fadeIn') {
        if (elapsed >= wordFadeInDuration) {
          placement.state = 'visible';
          placement.displayStartFrame = frameCount;
        }
      } else if (placement.state === 'visible') {
        if (elapsed >= wordDisplayDuration) {
          placement.state = 'fadeOut';
          placement.displayStartFrame = frameCount;
          placement.waveOffset = 0;
        } else {
          placement.waveOffset += wordWaveSpeed;
        }
      } else if (placement.state === 'fadeOut') {
        if (elapsed >= wordFadeOutDuration) {
          placement.state = 'idle';
          placement.displayStartFrame = -1;
        }
      }
    }
  });
}

// --- Offset Calculations ---
// Compute offsets from rings and sine waves for a given cell position.
function computeOffsets(x, y, centerX, centerY) {
  const dx = x - centerX, dy = y - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  let totalOffsetX = 0, totalOffsetY = 0, maxInfluence = 0;

  rings.forEach(ring => {
    const diff = Math.abs(dist - ring.currentRadius);
    if (diff < ring.thickness) {
      const influence = Math.pow(1 - diff / ring.thickness, 2);
      const offset = influence * 10;
      totalOffsetX += offset * Math.cos(angle + ring.rotationAngle);
      totalOffsetY += offset * Math.sin(angle + ring.rotationAngle);
      maxInfluence = Math.max(maxInfluence, influence);
    }
  });

  const globalSineFactor = frameCount * 0.05;
  const sineOffsetX = sineAmplitude * Math.sin(y * sineFrequency + globalSineFactor);
  const sineOffsetY = sineAmplitude * 0.5 * Math.sin(x * sineFrequency + globalSineFactor);

  return {
    offsetX: totalOffsetX + sineOffsetX,
    offsetY: totalOffsetY + sineOffsetY,
    maxInfluence
  };
}

// --- Initialization ---
function init() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  columns = Math.floor(canvas.width / charSpacing);
  rows = Math.floor(canvas.height / fontSize);
  frameCount = 0;
  
  grid = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ({
      char: chars[Math.floor(Math.random() * chars.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0,
      fadeSpeed: 0.01 + Math.random() * 0.03,
      fadingIn: false,
      glow: false,
      glowIntensity: 0,
      originalColor: colors[Math.floor(Math.random() * colors.length)],
      isWord: false,
    }))
  );
  
  calculateWordPlacements();
}

// --- Drawing ---
function draw() {
  // Cache canvas dimensions & center
  const { width, height } = canvas;
  const centerX = width / 2;
  const centerY = height / 2;
  const dragRadiusSq = dragInfluenceRadius * dragInfluenceRadius;
  const mouseInfluenceRadiusSq = mouseInfluenceRadius * mouseInfluenceRadius;
  
  // Draw translucent background for trail effect
  ctx.fillStyle = 'rgba(10, 15, 30, 0.15)';
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${fontSize}px monospace`;
  
  // Update rings
  rings.forEach(ring => {
    ring.rotationAngle += ring.rotationSpeed;
    ring.currentRadius = ring.baseRadius + ring.pulsationAmplitude * Math.sin(frameCount * 0.02);
  });
  
  updateWordPlacements();
  
  // Reset key highlight if expired
  if (highlightedChar && frameCount - highlightFrame > highlightDuration) {
    highlightedChar = null;
  }
  
  for (let i = 0; i < rows; i++) {
    const yBase = i * fontSize;
    for (let j = 0; j < columns; j++) {
      const cell = grid[i][j];
      let x = j * charSpacing;
      let y = yBase;
      
      // Apply mouse drag distortion
      const dxMouse = x - mouseX;
      const dyMouse = y - mouseY;
      const mouseDistSq = dxMouse * dxMouse + dyMouse * dyMouse;
      if (mouseDistSq < dragRadiusSq) {
        const influence = 1 - Math.sqrt(mouseDistSq) / dragInfluenceRadius;
        x += (mouseX - centerX) * dragFactor * influence;
        y += (mouseY - centerY) * dragFactor * influence;
      }
      
      // Compute offsets from rings and sine waves
      const { offsetX, offsetY, maxInfluence } = computeOffsets(x, y, centerX, centerY);
      let cellScreenX = x + offsetX;
      let cellScreenY = y + offsetY;
      
      // Word Placement: check if this cell is part of an active word
      cell.isWord = false;
      let isWordCell = false;
      let wordCellAlpha = 0;
      let waveEffect = 0;
      for (const placement of wordPlacements) {
        if (placement.displayStartFrame !== -1 &&
            i >= placement.row && i < placement.row + 2 &&
            j >= placement.col && j < placement.col + placement.word.length) {
          const charIndex = j - placement.col;
          // Word drawn on the second row of placement
          if (i === placement.row + 1 && charIndex < placement.word.length) {
            const elapsed = frameCount - placement.displayStartFrame;
            if (placement.state === 'fadeIn') {
              wordCellAlpha = Math.min(1, elapsed / wordFadeInDuration);
              isWordCell = true;
            } else if (placement.state === 'visible') {
              wordCellAlpha = 1;
              isWordCell = true;
              waveEffect = Math.sin(charIndex * wordWaveFrequency + placement.waveOffset) * wordWaveAmplitude;
              cellScreenY += waveEffect;
            } else if (placement.state === 'fadeOut') {
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
      
      // Mouse influence on cell
      const distMouseSq = (cellScreenX - mouseX) ** 2 + (cellScreenY - mouseY) ** 2;
      if (isWordCell) {
        cell.color = wordColor;
        cell.glow = true;
        cell.glowIntensity = 1;
        cell.alpha = wordCellAlpha;
      } else if (distMouseSq < mouseInfluenceRadiusSq) {
        const factor = (mouseInfluenceRadius - Math.sqrt(distMouseSq)) / mouseInfluenceRadius;
        cell.color = ringColor;
        cell.glow = true;
        cell.glowIntensity = factor;
        cell.alpha = 0.2 + factor * 0.4;
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
      
      // Key press highlighting
      if (highlightedChar && cell.char === highlightedChar) {
        cell.color = 'white';
        cell.glow = true;
        cell.glowIntensity = 1;
        cell.alpha = 1;
      }
      
      // Glitch Effect: draw glitch and skip normal draw if triggered
      if (Math.random() < glitchProbability) {
        const glitchChar = chars[Math.floor(Math.random() * chars.length)];
        const glitchOffsetX = (Math.random() * 6) - 3;
        const glitchOffsetY = (Math.random() * 6) - 3;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(255, 255, 255, 1)';
        ctx.fillText(glitchChar, cellScreenX + glitchOffsetX, cellScreenY + glitchOffsetY);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        continue;
      }
      
      // Draw the cell character
      ctx.fillStyle = cell.color;
      ctx.globalAlpha = cell.alpha;
      ctx.shadowBlur = cell.glow ? 8 * cell.glowIntensity : 0;
      ctx.shadowColor = cell.isWord ? wordGlowColor : ringGlowColor;
      if (highlightedChar && cell.char === highlightedChar) {
        ctx.shadowColor = 'white';
      }
      ctx.fillText(cell.char, cellScreenX, cellScreenY);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }
  
  frameCount++;
}

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
  // Placeholder for click animations if needed
}

function handleKeyPress(event) {
  highlightedChar = event.key;
  highlightFrame = frameCount;
}

init();
animate();

window.addEventListener('resize', debouncedInit);
document.addEventListener('mousemove', (event) => { 
  mouseX = event.clientX; 
  mouseY = event.clientY; 
});
document.addEventListener('mouseout', () => { 
  mouseX = -1000; 
  mouseY = -1000; 
});
document.addEventListener('mouseleave', () => { 
  mouseX = -1000; 
  mouseY = -1000; 
});
document.addEventListener('click', handleClick);
document.addEventListener('keydown', handleKeyPress);
