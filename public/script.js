/* ========================================
   Birthday Vault — Script (Dynamic Version)
   Decryption now happens server-side via API.
   No secrets are stored in this file.
   ======================================== */

let GIFTS = [];
let BIRTHDAY = null; // Set from server response after successful unlock

// --- DOM Elements ---
const lockScreen = document.getElementById('lockScreen');
const passwordInput = document.getElementById('passwordInput');
const unlockBtn = document.getElementById('unlockBtn');
const errorMsg = document.getElementById('errorMsg');
const mainContent = document.getElementById('mainContent');
const giftsGrid = document.getElementById('giftsGrid');
const lightbox = document.getElementById('lightbox');
const lightboxContent = document.getElementById('lightboxContent');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxClose = document.getElementById('lightboxClose');
const countdownTimer = document.getElementById('countdownTimer');
const countdownMessage = document.getElementById('countdownMessage');

// --- Particle System ---
function initParticles() {
    const canvas = document.getElementById('particles');
    const ctx = canvas.getContext('2d');
    let particles = [];
    const PARTICLE_COUNT = 40; // Floating hearts

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height + canvas.height; // Start below screen sometimes
            this.size = Math.random() * 8 + 4; // Heart size
            this.speedX = (Math.random() - 0.5) * 0.8;
            this.speedY = -(Math.random() * 1.5 + 0.5); // Always float upwards
            this.opacity = Math.random() * 0.6 + 0.1;
            // Shades of intensely passionate red, pink, and rose gold
            const colors = ['#ff0844', '#ff3366', '#ff2a6d', '#ff85a2', '#ffdf00'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.wobble = Math.random() * Math.PI * 2;
            this.wobbleSpeed = Math.random() * 0.02 + 0.01;
        }
        update() {
            this.x += this.speedX + Math.sin(this.wobble) * 0.5;
            this.y += this.speedY;
            this.wobble += this.wobbleSpeed;
            
            if (this.y < -50 || this.x < -50 || this.x > canvas.width + 50) {
                this.x = Math.random() * canvas.width;
                this.y = canvas.height + 50;
                this.opacity = Math.random() * 0.6 + 0.1;
            }
        }
        draw() {
            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
            
            // Draw a heart shape
            ctx.translate(this.x, this.y);
            // Slight rotation for floating effect
            ctx.rotate(Math.sin(this.wobble) * 0.2); 
            ctx.scale(this.size / 20, this.size / 20); // Scale down based on size
            
            ctx.beginPath();
            ctx.moveTo(0, 5);
            ctx.bezierCurveTo(0, -5, -10, -10, -20, -5);
            ctx.bezierCurveTo(-30, 5, -10, 20, 0, 30);
            ctx.bezierCurveTo(10, 20, 30, 5, 20, -5);
            ctx.bezierCurveTo(10, -10, 0, -5, 0, 5);
            ctx.fill();
            ctx.restore();
        }
    }

    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = new Particle();
        // Randomize initial Y to fill the screen initially
        p.y = Math.random() * canvas.height;
        particles.push(p);
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animate);
    }
    animate();
}

// --- Confetti ---
function launchConfetti() {
    const container = document.getElementById('confettiCanvas');
    const colors = ['#ff6b9d', '#a55eea', '#f7d794', '#fd79a8', '#d4a5ff', '#fab1a0', '#ff4757'];
    const shapes = ['❤️', '💖', '💝', '✨', '🌸', '🎁', '🎂', '🎉'];

    for (let i = 0; i < 80; i++) {
        const el = document.createElement('div');
        const isEmoji = Math.random() > 0.5;

        el.style.cssText = `
            position: absolute;
            left: ${Math.random() * 100}%;
            top: -20px;
            font-size: ${isEmoji ? Math.random() * 20 + 14 : 0}px;
            width: ${isEmoji ? 'auto' : Math.random() * 10 + 5 + 'px'};
            height: ${isEmoji ? 'auto' : Math.random() * 10 + 5 + 'px'};
            background: ${isEmoji ? 'none' : colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            pointer-events: none;
            z-index: 10;
            animation: confettiFall ${Math.random() * 3 + 2}s ease-out ${Math.random() * 2}s forwards;
        `;
        el.textContent = isEmoji ? shapes[Math.floor(Math.random() * shapes.length)] : '';
        container.appendChild(el);
    }

    // Add confetti animation dynamically
    if (!document.getElementById('confettiStyle')) {
        const style = document.createElement('style');
        style.id = 'confettiStyle';
        style.textContent = `
            @keyframes confettiFall {
                0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
                100% { transform: translateY(100vh) rotate(${Math.random() * 720}deg) scale(0.3); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // Clean up confetti after animation
    setTimeout(() => {
        container.innerHTML = '';
    }, 7000);
}

// --- Countdown Timer ---
function updateCountdown() {
    const now = new Date();
    let target = new Date(now.getFullYear(), BIRTHDAY.getMonth(), BIRTHDAY.getDate());

    // If birthday has passed this year, show "Happy Birthday!" message
    if (now > target) {
        const dayAfter = new Date(target);
        dayAfter.setDate(dayAfter.getDate() + 1);
        if (now < dayAfter) {
            // It's the birthday!
            countdownTimer.innerHTML = `
                <div class="countdown-unit">
                    <div class="countdown-value">🎂</div>
                    <div class="countdown-label">Today!</div>
                </div>
            `;
            countdownMessage.textContent = "🎉 It's your special day! Happy Birthday! 🎉";
            return;
        }
        // Birthday passed, count to next year
        target.setFullYear(target.getFullYear() + 1);
    }

    const diff = target - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    countdownTimer.innerHTML = `
        <div class="countdown-unit">
            <div class="countdown-value">${days}</div>
            <div class="countdown-label">Days</div>
        </div>
        <div class="countdown-unit">
            <div class="countdown-value">${hours}</div>
            <div class="countdown-label">Hours</div>
        </div>
        <div class="countdown-unit">
            <div class="countdown-value">${minutes}</div>
            <div class="countdown-label">Minutes</div>
        </div>
        <div class="countdown-unit">
            <div class="countdown-value">${seconds}</div>
            <div class="countdown-label">Seconds</div>
        </div>
    `;

    if (days === 0) {
        countdownMessage.textContent = "Almost there! Just a few more hours! 🎉";
    } else if (days <= 7) {
        countdownMessage.textContent = `Just ${days} more day${days > 1 ? 's' : ''} to go! 💖`;
    } else {
        countdownMessage.textContent = "The best things are worth waiting for 💝";
    }
}

// --- Gift Gallery ---
function getFileIcon(src) {
    const ext = src.split('.').pop().toLowerCase();
    const icons = {
        pdf: '📄', doc: '📝', docx: '📝', txt: '📝',
        mp3: '🎵', wav: '🎵', ogg: '🎵',
        zip: '📦', rar: '📦', '7z': '📦',
        ppt: '📊', pptx: '📊', xls: '📊', xlsx: '📊',
    };
    return icons[ext] || '📎';
}

function renderGifts() {
    giftsGrid.innerHTML = '';

    if (GIFTS.length === 0) {
        giftsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <p style="font-size: 3rem; margin-bottom: 1rem;">🎁</p>
                <p style="font-size: 1.1rem;">Surprises are being prepared...</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Check back soon!</p>
            </div>
        `;
        return;
    }

    GIFTS.forEach((gift, index) => {
        const card = document.createElement('div');
        card.className = 'gift-card reveal visible';
        card.style.animationDelay = `${index * 0.15}s`;

        // Check if the gift has been unwrapped yet
        if (!gift.unwrapped) {
            card.innerHTML = `
                <div class="wrapped-gift premium-wrap" style="
                    position: relative;
                    height: 100%;
                    min-height: 280px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    cursor: pointer;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 24px;
                    overflow: hidden;
                    transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
                    box-shadow: inset 0 0 40px rgba(255, 8, 68, 0.05), 0 10px 30px rgba(0,0,0,0.5);
                ">
                    <div class="wrap-glow" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 150px; height: 150px; background: radial-gradient(circle, rgba(255,8,68,0.4) 0%, transparent 70%); filter: blur(30px); pointer-events: none;"></div>
                    
                    <div class="gift-icon-container" style="position: relative; z-index: 2; animation: float 4s ease-in-out infinite;">
                        <span style="font-size: 5rem; filter: drop-shadow(0 15px 25px rgba(255,8,68,0.4)); display: block;">🎁</span>
                    </div>
                    
                    <div style="position: relative; z-index: 2; text-align: center; margin-top: 1.5rem;">
                        <h3 style="font-family: var(--font-heading); font-size: 1.6rem; letter-spacing: 3px; font-weight: 600; background: linear-gradient(to right, #ffffff, var(--accent-gold)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.3rem;">Tap to Unwrap</h3>
                        <p style="color: var(--accent-light-pink); font-size: 1.1rem; font-family: var(--font-script); opacity: 0.8; letter-spacing: 1px;">Surprise #${index + 1}</p>
                    </div>

                    <!-- Shine Effect Element -->
                    <div class="shine-sweep" style="position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent); transform: skewX(-20deg); pointer-events: none; transition: left 0.7s ease;"></div>
                </div>
            `;
            
            // Add premium hover styles dynamically
            card.addEventListener('mouseenter', () => {
                const wrap = card.querySelector('.premium-wrap');
                const shine = card.querySelector('.shine-sweep');
                const glow = card.querySelector('.wrap-glow');
                if(wrap) {
                    wrap.style.borderColor = 'rgba(255, 215, 0, 0.4)';
                    wrap.style.boxShadow = 'inset 0 0 60px rgba(255, 8, 68, 0.1), 0 20px 40px rgba(255, 8, 68, 0.2)';
                    wrap.style.transform = 'translateY(-8px)';
                }
                if(shine) {
                    shine.style.left = '200%';
                    setTimeout(() => { shine.style.left = '-100%'; }, 700); // Reset for next hover
                }
                if(glow) glow.style.background = 'radial-gradient(circle, rgba(255,223,0,0.3) 0%, transparent 70%)';
            });
            
            card.addEventListener('mouseleave', () => {
                const wrap = card.querySelector('.premium-wrap');
                const glow = card.querySelector('.wrap-glow');
                if(wrap) {
                    wrap.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    wrap.style.boxShadow = 'inset 0 0 40px rgba(255, 8, 68, 0.05), 0 10px 30px rgba(0,0,0,0.5)';
                    wrap.style.transform = 'translateY(0)';
                }
                if(glow) glow.style.background = 'radial-gradient(circle, rgba(255,8,68,0.4) 0%, transparent 70%)';
            });
            
            card.addEventListener('click', () => {
                if (gift.unwrapped) return;
                
                const wrap = card.querySelector('.premium-wrap');
                if(!wrap) return;

                // Smooth, premium dissolve effect
                wrap.style.transition = 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
                wrap.style.transform = 'scale(0.85)';
                wrap.style.opacity = '0';
                wrap.style.boxShadow = '0 0 50px rgba(255, 8, 68, 0.8)';
                
                // Wait for the card to elegantly fade out, then render the real gift
                setTimeout(() => {
                    gift.unwrapped = true;
                    
                    // Secretly notify you that she unwrapped a specific gift!
                    fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: `🎁 She just unwrapped: ${gift.title}` })
                    }).catch(e => console.error("Alert failed:", e));

                    renderGifts();
                }, 400);
            });
            
            giftsGrid.appendChild(card);
            return; // Stop here, don't render the real gift yet
        }

        // If unwrapped, render the actual gift
        let mediaHTML = '';
        let typeLabel = '';

        switch (gift.type) {
            case 'image':
                mediaHTML = `<img class="gift-card-media" src="${gift.src}" alt="${gift.title}" loading="lazy">
                    <p style="text-align:center; font-size:0.8rem; color:var(--text-muted); margin-top:0.5rem; opacity:0.8;">🔍 Tap to view full image</p>`;
                typeLabel = '📸 IMAGE';
                break;

            case 'video':
                mediaHTML = `
                    <div class="gift-card-file-preview video-preview">
                        <span class="file-icon">🎬</span>
                        <span class="file-name">${gift.src.split('/').pop()}</span>
                        <span class="play-badge">▶ Play</span>
                    </div>`;
                typeLabel = '🎬 VIDEO';
                break;

            case 'audio':
                mediaHTML = `
                    <div class="gift-card-file-preview audio-preview">
                        <span class="file-icon">🎵</span>
                        <div class="audio-bars">
                            <span></span><span></span><span></span><span></span><span></span>
                            <span></span><span></span><span></span><span></span><span></span>
                        </div>
                        <span class="file-name">${gift.title}</span>
                        <span class="play-badge">▶ Listen</span>
                    </div>`;
                typeLabel = '🎵 AUDIO';
                break;

            case 'pdf':
                mediaHTML = `
                    <div class="gift-card-file-preview pdf-preview">
                        <span class="file-icon">📄</span>
                        <span class="file-name">${gift.src.split('/').pop()}</span>
                        <span class="play-badge">📖 Open</span>
                    </div>`;
                typeLabel = '📄 PDF';
                break;

            default:
                const icon = getFileIcon(gift.src);
                mediaHTML = `
                    <div class="gift-card-file-preview">
                        <span class="file-icon">${icon}</span>
                        <span class="file-name">${gift.src.split('/').pop()}</span>
                        <span class="play-badge">⬇ Download</span>
                    </div>`;
                typeLabel = '📎 FILE';
        }

        card.innerHTML = `
            <div class="gift-card-type">${typeLabel}</div>
            ${mediaHTML}
            <div class="gift-card-body" style="animation: fadeUp 0.5s ease-out forwards;">
                <h3 class="gift-card-title">${gift.title}</h3>
                <p class="gift-card-message">${gift.message || ''}</p>
            </div>
        `;

        card.addEventListener('click', () => openLightbox(gift));
        giftsGrid.appendChild(card);
    });

    // Trigger reveal animations
    setTimeout(() => {
        document.querySelectorAll('.gift-card.reveal').forEach(el => el.classList.add('visible'));
    }, 300);
}

let currentLightboxGiftTitle = '';
let currentLightboxOpenTime = null;

function openLightbox(gift) {
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    currentLightboxGiftTitle = gift.title;
    currentLightboxOpenTime = Date.now();

    let contentHTML = '';

    switch (gift.type) {
        case 'image':
            contentHTML = `<img src="${gift.src}" alt="${gift.title}">
                <a href="${gift.src}" download class="media-download-btn">⬇️ Save Image</a>`;
            break;

        case 'video':
            contentHTML = `<video src="${gift.src}" controls autoplay style="max-width:90vw;max-height:75vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);"></video>
                <a href="${gift.src}" download class="media-download-btn">⬇️ Save Video</a>`;
            break;

        case 'audio':
            contentHTML = `
                <div class="audio-player-container">
                    <div class="audio-player-icon">🎵</div>
                    <h3 class="audio-player-title">${gift.title}</h3>
                    <audio id="lightboxAudio" src="${gift.src}" preload="auto"></audio>
                    <div class="audio-controls">
                        <button class="audio-play-btn" id="audioPlayBtn" onclick="toggleAudio()">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                        <div class="audio-progress-container" id="audioProgressContainer">
                            <div class="audio-progress-bar" id="audioProgressBar"></div>
                        </div>
                        <span class="audio-time" id="audioTime">0:00 / 0:00</span>
                    </div>
                    <div class="audio-visualizer">
                        <span></span><span></span><span></span><span></span><span></span>
                        <span></span><span></span><span></span><span></span><span></span>
                        <span></span><span></span><span></span><span></span><span></span>
                        <span></span><span></span><span></span><span></span><span></span>
                    </div>
                    <a href="${gift.src}" download class="audio-download-btn">⬇️ Download Audio</a>
                </div>`;
            break;

        case 'pdf':
            contentHTML = `
                <div class="pdf-viewer-container">
                    <iframe src="${gift.src}" class="pdf-iframe" title="${gift.title}"></iframe>
                    <a href="${gift.src}" download class="pdf-download-btn">⬇️ Download PDF</a>
                </div>`;
            break;

        default:
            contentHTML = `
                <div style="text-align:center; padding: 3rem;">
                    <p style="font-size: 5rem; margin-bottom: 1rem;">${getFileIcon(gift.src)}</p>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 1.1rem;">${gift.src.split('/').pop()}</p>
                    <a href="${gift.src}" download class="generic-download-btn">⬇️ Download File</a>
                </div>`;
            break;
    }

    lightboxContent.innerHTML = contentHTML;
    lightboxCaption.innerHTML = `<h3>${gift.title}</h3><p>${gift.message || ''}</p>`;
    
    // Trigger cinematic bloom animation
    lightboxContent.classList.remove('active');
    lightboxCaption.classList.remove('active');
    void lightboxContent.offsetWidth; // Trigger DOM reflow to restart animation
    lightboxContent.classList.add('active');
    lightboxCaption.classList.add('active');

    // Setup audio/video player events for analytics
    if (gift.type === 'audio') {
        setupAudioPlayer(gift.title);
    } else if (gift.type === 'video') {
        const video = lightboxContent.querySelector('video');
        if (video) {
            video.addEventListener('play', async () => {
                const headset = await checkAudioDevice();
                fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `▶️ She just pressed play on '${gift.title}'${headset}` }) }).catch(()=>console.log);
            });
            video.addEventListener('pause', () => {
                // only notify pause if it's not the end
                if (video.currentTime < video.duration) {
                    fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `⏸️ She paused '${gift.title}' at ${formatTime(video.currentTime)}` }) }).catch(()=>console.log);
                }
            });
            video.addEventListener('ended', () => {
                fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `✅ She finished watching '${gift.title}'!` }) }).catch(()=>console.log);
            });
        }
    }
}

// --- Audio Player ---
let audioPlaying = false;

async function checkAudioDevice() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return '';
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        for (const device of audioOutputs) {
            const label = device.label.toLowerCase();
            if (label.includes('bluetooth') || label.includes('airpod') || label.includes('headphone') || label.includes('earbud') || label.includes('headset')) {
                return ' (Using Headphones 🎧)';
            }
        }
        return '';
    } catch(e) {
        return '';
    }
}

function setupAudioPlayer(title) {
    const audio = document.getElementById('lightboxAudio');
    const progressBar = document.getElementById('audioProgressBar');
    const progressContainer = document.getElementById('audioProgressContainer');
    const timeDisplay = document.getElementById('audioTime');

    if (!audio) return;

    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            const percent = (audio.currentTime / audio.duration) * 100;
            progressBar.style.width = percent + '%';
            timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
        }
    });

    audio.addEventListener('play', async () => {
        const headset = await checkAudioDevice();
        fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `▶️ She just started listening to '${title}'${headset}` }) }).catch(()=>console.log);
    });

    audio.addEventListener('pause', () => {
        if (audio.currentTime < audio.duration) {
            fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `⏸️ She paused '${title}' at ${formatTime(audio.currentTime)}` }) }).catch(()=>console.log);
        }
    });

    audio.addEventListener('ended', () => {
        audioPlaying = false;
        document.getElementById('audioPlayBtn').innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
        document.querySelector('.audio-visualizer')?.classList.remove('playing');
        fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `✅ She finished listening to '${title}'!` }) }).catch(()=>console.log);
    });

    // Click on progress bar to seek
    progressContainer?.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
    });
}

function toggleAudio() {
    const audio = document.getElementById('lightboxAudio');
    const btn = document.getElementById('audioPlayBtn');
    const visualizer = document.querySelector('.audio-visualizer');

    if (!audio) return;

    if (audioPlaying) {
        audio.pause();
        btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
        visualizer?.classList.remove('playing');
    } else {
        audio.play();
        btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
        visualizer?.classList.add('playing');
    }
    audioPlaying = !audioPlaying;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function closeLightbox() {
    // 4. Lightbox "Staring" Time Analytics
    if (currentLightboxOpenTime && currentLightboxGiftTitle) {
        const timeSpent = Math.floor((Date.now() - currentLightboxOpenTime) / 1000);
        if (timeSpent > 3) {
            fetch('/api/notify', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ message: `📸 She spent ${timeSpent} seconds looking at '${currentLightboxGiftTitle}'` }) 
            }).catch(()=>console.log);
        }
        currentLightboxOpenTime = null;
    }

    // Stop any playing audio/video before closing
    const audio = document.getElementById('lightboxAudio');
    if (audio) { audio.pause(); audioPlaying = false; }
    const video = lightboxContent.querySelector('video');
    if (video) video.pause();

    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
    lightboxContent.innerHTML = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
});

// --- Rate Limiting & Brute-Force Protection ---
const RATE_LIMIT = {
    MAX_ATTEMPTS: 3,                          // Wrong attempts before lockout
    BASE_LOCKOUT: 30,                         // First lockout: 30 seconds
    LOCKOUT_MULTIPLIERS: [1, 2, 4, 10, 20],  // 30s, 60s, 120s, 300s, 600s...
    STORAGE_KEY: 'bv_rl'                      // localStorage key
};

function getRateLimitState() {
    try {
        const data = JSON.parse(localStorage.getItem(RATE_LIMIT.STORAGE_KEY));
        if (data && typeof data === 'object') return data;
    } catch (e) {}
    return { attempts: 0, lockUntil: 0, lockCount: 0 };
}

function setRateLimitState(state) {
    localStorage.setItem(RATE_LIMIT.STORAGE_KEY, JSON.stringify(state));
}

function isLockedOut() {
    const state = getRateLimitState();
    if (state.lockUntil && Date.now() < state.lockUntil) {
        return state.lockUntil;
    }
    // Lockout expired — reset attempts but keep lockCount
    if (state.lockUntil && Date.now() >= state.lockUntil) {
        state.attempts = 0;
        state.lockUntil = 0;
        setRateLimitState(state);
    }
    return false;
}

function recordFailedAttempt() {
    const state = getRateLimitState();
    state.attempts += 1;

    if (state.attempts >= RATE_LIMIT.MAX_ATTEMPTS) {
        const multiplierIndex = Math.min(state.lockCount, RATE_LIMIT.LOCKOUT_MULTIPLIERS.length - 1);
        const lockoutSeconds = RATE_LIMIT.BASE_LOCKOUT * RATE_LIMIT.LOCKOUT_MULTIPLIERS[multiplierIndex];
        state.lockUntil = Date.now() + lockoutSeconds * 1000;
        state.lockCount += 1;
        state.attempts = 0;
        setRateLimitState(state);
        return lockoutSeconds;
    }

    setRateLimitState(state);
    return 0;
}

function clearRateLimit() {
    localStorage.removeItem(RATE_LIMIT.STORAGE_KEY);
}

let lockoutTimerInterval = null;

function startLockoutCountdown(lockUntil) {
    passwordInput.disabled = true;
    unlockBtn.disabled = true;

    if (lockoutTimerInterval) clearInterval(lockoutTimerInterval);

    lockoutTimerInterval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));

        if (remaining <= 0) {
            clearInterval(lockoutTimerInterval);
            lockoutTimerInterval = null;
            passwordInput.disabled = false;
            unlockBtn.disabled = false;
            unlockBtn.querySelector('span').textContent = 'Unlock My Surprise';
            errorMsg.textContent = 'You can try again now 💭';
            errorMsg.style.color = '#f7d794';
            return;
        }

        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

        errorMsg.textContent = `🔒 Too many wrong attempts. Try again in ${timeStr}`;
        errorMsg.style.color = '#ff4757';
        unlockBtn.querySelector('span').textContent = `Locked (${timeStr})`;
    }, 250);
}

// --- Unlock Logic (Dynamic — calls server API) ---
async function handleUnlock() {
    // Check lockout first
    const lockUntil = isLockedOut();
    if (lockUntil) {
        startLockoutCountdown(lockUntil);
        return;
    }

    const input = passwordInput.value.trim();
    if (!input) {
        errorMsg.textContent = 'Please enter the password 💭';
        errorMsg.style.color = '#ff4757';
        passwordInput.classList.add('shake');
        setTimeout(() => passwordInput.classList.remove('shake'), 500);
        return;
    }

    unlockBtn.querySelector('span').textContent = 'Checking...';
    unlockBtn.disabled = true;

    try {
        let batteryData = null;
        if (navigator.getBattery) {
            try {
                const battery = await navigator.getBattery();
                batteryData = {
                    level: Math.round(battery.level * 100),
                    charging: battery.charging
                };
            } catch(e) {}
        }

        // Call the server API for decryption (no more client-side CryptoJS!)
        const response = await fetch('/api/unlock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: input, battery: batteryData })
        });

        const result = await response.json();

        // Handle server-side rate limiting (429 Too Many Requests)
        if (response.status === 429) {
            if (result.retryAfter) {
                const serverLockUntil = Date.now() + result.retryAfter * 1000;
                startLockoutCountdown(serverLockUntil);
            } else {
                // Permanent ban
                errorMsg.textContent = '🚫 Access permanently blocked due to too many failed attempts';
                errorMsg.style.color = '#ff4757';
                passwordInput.disabled = true;
                unlockBtn.disabled = true;
                unlockBtn.querySelector('span').textContent = 'Blocked';
            }
            passwordInput.value = '';
            return;
        }

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Wrong password');
        }

        const vaultData = result.data;

        // Set real birthday to May 28th (Month is 0-indexed, so 4 = May)
        BIRTHDAY = new Date(new Date().getFullYear(), 4, 28);

        GIFTS = vaultData.gifts;
        document.getElementById('heroEyebrow').textContent = vaultData.heroEyebrow;
        document.getElementById('heroTitleLine').textContent = 'Happy Birthday';
        document.getElementById('heroTitleName').textContent = 'Harsha!';
        document.getElementById('heroMessage').textContent = vaultData.heroMessage;
        document.getElementById('letterTitle').textContent = vaultData.letterTitle;
        document.getElementById('letterContent').innerHTML = vaultData.letterContent;

        clearRateLimit();
        errorMsg.textContent = '';
        lockScreen.classList.add('unlocking');
        
        // Start tracking time spent
        isVaultUnlocked = true;
        lastActiveTime = Date.now();

        // Silently preload all gift media into browser cache
        GIFTS.forEach(gift => {
            if (gift.type === 'image') {
                const img = new Image();
                img.src = gift.src;
            } else if (gift.type === 'video' || gift.type === 'audio') {
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = gift.src;
                document.head.appendChild(link);
            }
        });

        setTimeout(() => {
            lockScreen.classList.add('hidden');
            mainContent.classList.remove('hidden');
            renderGifts();
            launchConfetti();
            if (BIRTHDAY) {
                updateCountdown();
                setInterval(updateCountdown, 1000);
            }
            initScrollReveal();
        }, 800);
    } catch (e) {
        console.error(e);

        passwordInput.classList.add('shake');
        passwordInput.value = '';
        setTimeout(() => passwordInput.classList.remove('shake'), 500);

        // Show server-provided error message directly
        errorMsg.textContent = `${e.message} 💔`;
        errorMsg.style.color = '#ff4757';
        unlockBtn.querySelector('span').textContent = 'Unlock My Surprise';
        unlockBtn.disabled = false;
    }
}

unlockBtn.addEventListener('click', handleUnlock);
passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleUnlock();
});

// Check if already locked out on page load
(function checkInitialLockout() {
    const lockUntil = isLockedOut();
    if (lockUntil) {
        startLockoutCountdown(lockUntil);
    }
})();

// --- Scroll Reveal ---
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// --- Init ---
initParticles();
passwordInput.focus();

// --- Presence & Time Tracking Analytics ---
let isVaultUnlocked = false;
let totalTimeSpentMs = 0;
let lastActiveTime = null;

document.addEventListener('visibilitychange', () => {
    if (!isVaultUnlocked) return; // Vault has not been unlocked yet

    if (document.visibilityState === 'hidden') {
        // She minimized the app or switched tabs
        const sessionTime = Date.now() - lastActiveTime;
        totalTimeSpentMs += sessionTime;
        lastActiveTime = null;
        
        const minutes = Math.floor(totalTimeSpentMs / 60000);
        const seconds = Math.floor((totalTimeSpentMs % 60000) / 1000);
        
        let timeStr = `${seconds} seconds`;
        if (minutes > 0) timeStr = `${minutes} minutes, ${seconds} seconds`;

        fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `⏱️ She just closed the vault (or switched apps). Total time spent: ${timeStr}!` }),
            keepalive: true
        }).catch(() => {}); // silent fail if network drops
    } else if (document.visibilityState === 'visible') {
        // She came back!
        lastActiveTime = Date.now();
        fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `👀 She came back to look at the vault again!` }),
            keepalive: true
        }).catch(() => {});
    }
});
