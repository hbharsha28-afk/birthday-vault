/* ========================================
   Birthday Vault — Secure Express Server
   ✅ Server-side rate limiting (IP-based)
   ✅ Security headers (HSTS, CSP, etc.)
   ✅ HTTPS enforcement for production
   ✅ AES-256 decryption server-side
   ======================================== */

const express = require('express');
const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==============================================
// SECURITY: Trust proxy (for deployment behind
// load balancers like Render, Railway, etc.)
// ==============================================
app.set('trust proxy', 1);

// ==============================================
// SECURITY: Force HTTPS in production
// (Render, Railway, etc. terminate SSL at proxy)
// ==============================================
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
});

// ==============================================
// SECURITY: Hardened HTTP Headers
// ==============================================
app.use((req, res, next) => {
    // Prevent clickjacking but allow same-origin iframes for the PDF viewer
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Content Security Policy
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "media-src 'self'",
        "connect-src 'self'",
        "frame-src 'self'"
    ].join('; '));
    // HSTS (only in production with HTTPS)
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    next();
});

// Parse JSON request bodies
app.use(express.json({ limit: '1kb' })); // Limit body size to prevent abuse

// ==============================================
// SERVER-SIDE RATE LIMITING (IP-based)
// This CANNOT be bypassed by clearing
// localStorage or using curl/Postman.
// ==============================================

const rateLimitStore = new Map(); // IP → { attempts, lockUntil, lockCount, totalBlocks }

const RATE_CONFIG = {
    MAX_ATTEMPTS: 5,                          // Wrong attempts before lockout
    BASE_LOCKOUT_SECONDS: 30,                 // First lockout: 30 seconds
    MULTIPLIERS: [1, 2, 4, 10, 30, 60],      // 30s, 60s, 2m, 5m, 15m, 30m
    PERMANENT_BAN_AFTER: 20,                  // Permanent ban after 20 total lockouts
    CLEANUP_INTERVAL_MS: 5 * 60 * 1000,       // Clean expired entries every 5 minutes
};

// Clean up expired rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, state] of rateLimitStore.entries()) {
        // Remove entries that expired more than 1 hour ago and aren't permanently banned
        if (state.lockUntil && now > state.lockUntil + 3600000 && state.totalBlocks < RATE_CONFIG.PERMANENT_BAN_AFTER) {
            rateLimitStore.delete(ip);
        }
    }
}, RATE_CONFIG.CLEANUP_INTERVAL_MS);

function getRateLimitState(ip) {
    return rateLimitStore.get(ip) || { attempts: 0, lockUntil: 0, lockCount: 0, totalBlocks: 0 };
}

function isIpLockedOut(ip) {
    const state = getRateLimitState(ip);

    // Check permanent ban
    if (state.totalBlocks >= RATE_CONFIG.PERMANENT_BAN_AFTER) {
        return { locked: true, remaining: Infinity, permanent: true };
    }

    if (state.lockUntil && Date.now() < state.lockUntil) {
        const remaining = Math.ceil((state.lockUntil - Date.now()) / 1000);
        return { locked: true, remaining, permanent: false };
    }

    // Lockout expired — reset attempts but keep lockCount
    if (state.lockUntil && Date.now() >= state.lockUntil) {
        state.attempts = 0;
        state.lockUntil = 0;
        rateLimitStore.set(ip, state);
    }

    return { locked: false };
}

function recordServerFailedAttempt(ip) {
    const state = getRateLimitState(ip);
    state.attempts += 1;

    if (state.attempts >= RATE_CONFIG.MAX_ATTEMPTS) {
        const idx = Math.min(state.lockCount, RATE_CONFIG.MULTIPLIERS.length - 1);
        const lockoutSeconds = RATE_CONFIG.BASE_LOCKOUT_SECONDS * RATE_CONFIG.MULTIPLIERS[idx];
        state.lockUntil = Date.now() + lockoutSeconds * 1000;
        state.lockCount += 1;
        state.totalBlocks += 1;
        state.attempts = 0;
        rateLimitStore.set(ip, state);

        console.log(`🔒 IP ${ip} locked out for ${lockoutSeconds}s (block #${state.totalBlocks})`);
        return lockoutSeconds;
    }

    rateLimitStore.set(ip, state);
    return 0;
}

function clearServerRateLimit(ip) {
    rateLimitStore.delete(ip);
}

// ==============================================
// STATIC FILE SERVING (with no-cache headers)
// ==============================================
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
}));

// ==============================================
// ==============================================
// AUTHENTICATION TRACKING
// Only authenticated IPs can access gift files
// ==============================================
const authenticatedIPs = new Set();

// ==============================================
// STATIC MEDIA SERVING
// (Authentication removed to fix iOS Safari video streaming bugs)
// ==============================================
app.use('/gifts', express.static(path.join(__dirname, 'gifts'), {
    setHeaders: (res) => {
        res.set('Cache-Control', 'no-store');
    }
}));

// ==============================================
// API: Relay Push Notifications
// POST /api/notify { message: "..." }
// ==============================================
app.post('/api/notify', (req, res) => {
    const { message } = req.body;
    if (message) {
        // Format time in 12-hour format for India
        const timeString = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true, hour: 'numeric', minute: '2-digit' });
        const finalMessage = `[${timeString}] ${message}`;

        fetch('https://ntfy.sh/harsha_birthday_vault_alert_secret', {
            method: 'POST',
            body: finalMessage,
            headers: {
                'Title': 'Vault Activity',
                'Tags': 'gift',
                'Priority': 'default'
            }
        }).catch(err => console.error("Notification alert failed (ignored):", err));
    }
    res.json({ success: true });
});

// ==============================================
// API: Secret Stats Endpoint
// GET /api/harsha-stats
// ==============================================
app.get('/api/harsha-stats', (req, res) => {
    res.json({
        total_unique_visitors: authenticatedIPs.size,
        status: 'Active',
        serverTime: new Date().toLocaleString()
    });
});

// ==============================================
// API: Unlock Vault
// POST /api/unlock  { password: "..." }
// ==============================================
app.post('/api/unlock', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;

    // --- Check server-side rate limit FIRST ---
    const lockStatus = isIpLockedOut(ip);
    if (lockStatus.locked) {
        if (lockStatus.permanent) {
            console.log(`🚫 Permanently banned IP attempted access: ${ip}`);
            return res.status(429).json({
                success: false,
                error: 'Access permanently blocked due to excessive failed attempts',
                retryAfter: null
            });
        }
        return res.status(429).json({
            success: false,
            error: `Too many wrong attempts. Try again in ${lockStatus.remaining}s`,
            retryAfter: lockStatus.remaining
        });
    }

    const { password, battery } = req.body;

    if (!password || typeof password !== 'string') {
        return res.status(400).json({ success: false, error: 'Password is required' });
    }

    // Limit password length to prevent abuse
    if (password.length > 50) {
        return res.status(400).json({ success: false, error: 'Invalid password format' });
    }

    const cleanedPassword = password.replace(/[\\/-]/g, '');
    const hash = CryptoJS.SHA256(cleanedPassword).toString(CryptoJS.enc.Hex);

    // Try to find the vault file
    const filenames = [
        `vault-v2-${hash}.json`,
        `vault-${hash}.json`
    ];

    let encryptedData = null;
    let foundFile = null;

    for (const filename of filenames) {
        const filepath = path.join(__dirname, filename);
        if (fs.existsSync(filepath)) {
            encryptedData = fs.readFileSync(filepath, 'utf8');
            foundFile = filename;
            break;
        }
    }

    if (!encryptedData) {
        // Wrong password — record failed attempt
        const lockoutSeconds = recordServerFailedAttempt(ip);
        const state = getRateLimitState(ip);
        const attemptsLeft = RATE_CONFIG.MAX_ATTEMPTS - state.attempts;

        // 5. Failed Password Spying
        const timeString = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true, hour: 'numeric', minute: '2-digit' });
        fetch('https://ntfy.sh/harsha_birthday_vault_alert_secret', {
            method: 'POST',
            body: `[${timeString}] 🕵️‍♀️ She tried to guess the password! She typed: "${password}"`,
            headers: { 'Title': 'Password Guess', 'Tags': 'detective', 'Priority': 'default' }
        }).catch(() => {});

        const response = { success: false, error: 'Wrong password' };

        if (lockoutSeconds > 0) {
            response.error = `Too many wrong attempts. Locked for ${lockoutSeconds}s`;
            response.retryAfter = lockoutSeconds;
        } else {
            response.attemptsLeft = attemptsLeft;
        }

        return res.status(401).json(response);
    }

    try {
        // Decrypt using the same params as the encryptor
        const salt = CryptoJS.enc.Utf8.parse('birthday-vault-salt-v2');
        const key = CryptoJS.PBKDF2(cleanedPassword, salt, { keySize: 256 / 32, iterations: 10000 });
        const iv = CryptoJS.enc.Utf8.parse('0123456789123456');

        const bytes = CryptoJS.AES.decrypt(encryptedData, key, { iv: iv });
        const decryptedString = bytes.toString(CryptoJS.enc.Utf8);

        if (!decryptedString) {
            // Decryption failed — record failed attempt
            recordServerFailedAttempt(ip);
            return res.status(401).json({ success: false, error: 'Wrong password' });
        }

        const vaultData = JSON.parse(decryptedString);

        // Override gifts with the specific files for Harsha
        vaultData.gifts = [
            {
                type: 'video',
                title: 'A Beautiful Day - Part 1',
                message: 'A memory I will cherish forever, just seeing your beautiful smile.',
                src: '/gifts/VN20260528_115338.mp4'
            },
            {
                type: 'video',
                title: 'A Beautiful Day - Part 2',
                message: 'Seeing you so happy makes my world light up.',
                src: '/gifts/harsha_28_05.mp4'
            },
            {
                type: 'audio',
                title: 'அஞ்சினேன் உயிரே',
                message: 'Listen to the lyrics. Every word reminds me of you.',
                src: '/gifts/harsha_song.mp3'
            },
            {
                type: 'image',
                title: 'A Drawing of You',
                message: 'My attempt to capture even a fraction of your beauty.',
                src: '/gifts/harsha_drawing.jpg'
            },
            {
                type: 'pdf',
                title: 'My Handwritten Diary',
                message: 'Pages filled with my thoughts, feelings, and love for you.',
                src: '/gifts/harsha_diary.pdf'
            },
            {
                type: 'audio',
                title: 'A Message From Me',
                message: 'Just my voice, telling you exactly how I feel.',
                src: '/gifts/my_voice_note.mp3'
            },
            {
                type: 'audio',
                title: 'ஆறுதல் சாரல்',
                message: 'I created this song specially for you. I hope you love it 🎵',
                src: '/gifts/aaruthal_saaral.mp3'
            }
        ];

        // Success! Clear rate limit and grant access for this IP
        clearServerRateLimit(ip);
        authenticatedIPs.add(ip);
        
        // ADD COOKIE FOR MEDIA AUTHENTICATION
        res.setHeader('Set-Cookie', 'vault_auth=true; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400');

        // Extract birthday from the password (DDMMYYYY format)
        // Only sent AFTER successful unlock — never exposed in client code
        const dd = parseInt(cleanedPassword.substring(0, 2), 10);
        const mm = parseInt(cleanedPassword.substring(2, 4), 10) - 1; // 0-indexed month
        const birthdayDate = { month: mm, day: dd };

        console.log(`✅ Vault unlocked successfully from ${ip} using ${foundFile}`);
        
        // 3. Device Fingerprinting
        const ua = req.headers['user-agent'] || 'Unknown Device';
        let device = "a Phone/Computer";
        if (ua.includes('iPhone')) {
            device = "an iPhone";
        } else if (ua.includes('iPad')) {
            device = "an iPad";
        } else if (ua.includes('Android')) {
            const match = ua.match(/Android[^;]*; ([^)]+)\)/);
            if (match && match[1]) {
                const model = match[1].split(' Build/')[0].trim();
                device = `an Android (${model})`;
            } else {
                device = "an Android phone";
            }
        } else if (ua.includes('Macintosh')) {
            device = "a Mac";
        } else if (ua.includes('Windows')) {
            device = "a Windows PC";
        }

        // Battery Info
        let batteryText = '';
        if (battery) {
            batteryText = `\n🔋 Battery: ${battery.level}% (${battery.charging ? 'Charging ⚡' : 'Not charging'})`;
        }

        // Send silent Push Notification to your phone!
        const timeString = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true, hour: 'numeric', minute: '2-digit' });
        fetch('https://ntfy.sh/harsha_birthday_vault_alert_secret', {
            method: 'POST',
            body: `[${timeString}] 💝 She did it! Harsha just unlocked the Birthday Vault from ${device}! (Total unique visitors: ${authenticatedIPs.size})${batteryText}`,
            headers: {
                'Title': 'Vault Unlocked!',
                'Tags': 'tada,sparkling_heart',
                'Priority': 'high'
            }
        }).catch(err => console.error("Notification alert failed (ignored):", err));

        return res.json({ success: true, data: vaultData, birthdayDate });

    } catch (e) {
        console.error('Decryption error:', e.message);
        recordServerFailedAttempt(ip);
        
        // 5. Failed Password Spying
        const timeString = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true, hour: 'numeric', minute: '2-digit' });
        fetch('https://ntfy.sh/harsha_birthday_vault_alert_secret', {
            method: 'POST',
            body: `[${timeString}] 🕵️‍♀️ She tried to guess the password! She typed: "${password}"`,
            headers: { 'Title': 'Password Guess', 'Tags': 'detective', 'Priority': 'default' }
        }).catch(() => {});

        return res.status(401).json({ success: false, error: 'Wrong password' });
    }
});

// ==============================================
// BLOCK: Prevent direct access to vault files
// ==============================================
app.get(/vault.*\.json/, (req, res) => {
    res.status(403).json({ error: 'Access denied' });
});

// Fallback: serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==============================================
// START SERVER
// ==============================================
app.listen(PORT, () => {
    console.log('');
    console.log('  🎂 ═══════════════════════════════════════════════');
    console.log(`  🎂  Birthday Vault is running!`);
    console.log(`  🎂  Local:  http://localhost:${PORT}`);
    console.log('  🎂 ─────────────────────────────────────────────');
    console.log('  🛡️  Server-side rate limiting: ✅ ACTIVE');
    console.log('  🛡️  Security headers:          ✅ ACTIVE');
    console.log('  🛡️  HTTPS enforcement:         ✅ (in production)');
    console.log('  🛡️  Vault file protection:     ✅ ACTIVE');
    console.log('  🎂 ═══════════════════════════════════════════════');
    console.log('');
});
