document.addEventListener('DOMContentLoaded', function() {

    // --- Selectors for different elements ---
    const titleElement = document.querySelector('.hero-content .display-3');
    const leadElement = document.querySelector('.hero-content .lead');
    const buttonElement = document.querySelector('.hero-content .btn');

    // --- Animation Parameters (Title - more sway) ---
    const titleGlitchProbability = 0.002;
    const titleWaveAmplitude = 3;
    const titleWaveFrequency = 0.5;
    const titleWaveSpeed = 0.04;

    // --- Animation Parameters (Lead & Button - less sway) ---
    const otherGlitchProbability = 0.002;
    const otherWaveAmplitude = 1;       // Reduced
    const otherWaveFrequency = 0.2;     // Reduced
    const otherWaveSpeed = 0.02;        // Reduced

    // --- Apply effects to the TITLE ---
    function applyTitleEffects() {
        if (titleElement) { // Check if the element exists
            wrapCharacters(titleElement, titleWaveAmplitude, titleWaveFrequency, titleWaveSpeed, titleGlitchProbability);
            animate(titleElement, titleWaveAmplitude, titleWaveFrequency, titleWaveSpeed, titleGlitchProbability);
        }
    }

    // --- Apply effects to the LEAD and BUTTON ---
    function applyOtherEffects() {
        if (leadElement) {
            wrapCharacters(leadElement, otherWaveAmplitude, otherWaveFrequency, otherWaveSpeed, otherGlitchProbability);
            animate(leadElement, otherWaveAmplitude, otherWaveFrequency, otherWaveSpeed, otherGlitchProbability);

        }
        if (buttonElement) {
            wrapCharacters(buttonElement, otherWaveAmplitude, otherWaveFrequency, otherWaveSpeed, otherGlitchProbability);
            animate(buttonElement, otherWaveAmplitude, otherWaveFrequency, otherWaveSpeed, otherGlitchProbability);
        }
    }

    // --- Modified wrapCharacters:  Takes parameters now ---
    function wrapCharacters(element, amplitude, frequency, speed, glitchProb) {
        const originalHTML = element.innerHTML;
        let newHTML = '';

        for (let i = 0; i < originalHTML.length; i++) {
            const char = originalHTML[i];
            if (char === ' ') {
                newHTML += '<span class="space-char"> </span>';
            } else {
                // Add data attributes for animation parameters
                newHTML += `<span class="wave-char" data-original-char="${char}" data-amplitude="${amplitude}" data-frequency="${frequency}" data-speed="${speed}" data-glitch-prob="${glitchProb}">${char}</span>`;
            }
        }
        element.innerHTML = newHTML;
    }
    const style = document.createElement('style');
        style.textContent = `
            .wave-char {
                display: inline-block;
                transition: transform 0.1s ease-out;
            }
            /* Style for space spans - prevent collapsing */
            .space-char {
                display: inline-block; /* Ensure spaces take up space */
                width: 0.3em; /* Adjust as needed for spacing */

            }
              .glitched {
                color: red;
                position: relative;
                display: inline-block;
            }
            .glitched::before,
            .glitched::after {
                content: attr(data-text);
                position: absolute;
                top: 0;
                left: 0;
                color: red;
                clip: rect(0, 0, 0, 0);

            }
            .glitched::before {
                left: -1px;
                text-shadow: 1px 0 blue;
                animation: glitch-anim-before 2s infinite linear alternate-reverse;

            }
            .glitched::after {
                left: 1px;
                text-shadow: -1px 0 lime;
                animation: glitch-anim-after 2s infinite linear alternate-reverse;
            }

            @keyframes glitch-anim-before {
                0% {
                    clip: rect(${Math.random() * 30}px, 9999px, ${Math.random() * 30}px, 0);
                }
                25% {
                    clip: rect(${Math.random() * 30}px, 9999px, ${Math.random() * 30}px, 0);
                }
                50% {
                   clip: rect(${Math.random() * 30}px, 9999px, ${Math.random() * 30}px, 0);
                }
                75% {
                    clip: rect(${Math.random() * 30}px, 9999px, ${Math.random() * 30}px, 0);
                }
                100% {
                  clip: rect(${Math.random() * 30}px, 9999px, ${Math.random() * 30}px, 0);
                }
            }

            @keyframes glitch-anim-after {
                0% {
                   clip: rect(${Math.random() * 30}px, 9999px, ${Math.random() * 30}px, 0);
                }
                25% {
                    clip: rect(${Math.random() * 30}px, 9999px, ${Math.random() * 30}px, 0);
                }
                50% {
                    clip: rect(${Math.random() * 30}px, 9999px, ${Math.random() * 30}px, 0);
                }
                75% {
                    clip: rect(${Math.random() * 30}px, 9999px, ${Math.random() * 30}px, 0);
                }
                100% {
                  clip: rect(${Math.random() * 30}px, 9999px, ${Math.random() * 30}px, 0);
                }
            }
          `;
        document.head.appendChild(style);
    // --- Modified animate:  Also takes parameters ---
    function animate(element, amplitude, frequency, speed, glitchProb) {
        let time = 0;

        function step() { // Inner function for the animation loop
            time += speed;

            const charSpans = element.querySelectorAll('.wave-char'); // Get spans *within* the element
            charSpans.forEach((span, index) => {
                const yOffset = Math.sin(time + index * frequency) * amplitude;
                span.style.transform = `translateY(${yOffset}px)`;

                 if (Math.random() < glitchProb) {
                    glitchSpan(span);
                }
            });

            const allSpans = element.querySelectorAll('.wave-char, .space-char');
            const observer = new MutationObserver(() => {
              if (!document.body.contains(allSpans[0])) {
                style.remove();
                observer.disconnect();
              }
            });
            observer.observe(document.body, { subtree: true, childList: true });

            requestAnimationFrame(step); // Continue the animation loop
        }

        step(); // Start the animation loop
    }

    function glitchSpan(span) {
        if (span.classList.contains('glitched')) return;

        const originalChar = span.dataset.originalChar || ' ';
        const glitchChar = getRandomChar();

        span.innerHTML = glitchChar;
        span.classList.add('glitched');
        span.setAttribute('data-text', glitchChar);

        setTimeout(() => {
            span.innerHTML = originalChar;
            span.classList.remove('glitched');
            span.removeAttribute('data-text');
        }, 50);
    }
    function getRandomChar() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-=_+[]{}|;':\",./<>?";
        return chars[Math.floor(Math.random() * chars.length)];
    }

    // --- Call the apply functions ---
    applyTitleEffects();
    applyOtherEffects();
});