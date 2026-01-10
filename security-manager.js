// ======= SECURITY UTILITIES FOR NEXCHAT =======
// Protections: XSS Prevention, Injection Prevention, Rate Limiting, CSRF Protection

export class SecurityManager {
  constructor() {
    this.requestLimits = new Map();
    this.blockedIPs = new Set();
    this.suspiciousActivity = [];
  }

  // ======= XSS PREVENTION =======
  // Escape HTML to prevent XSS attacks
  static escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
      '/': '&#x2F;'
    };
    return text.replace(/[&<>"'\/]/g, char => map[char]);
  }

  // ======= SQL INJECTION PREVENTION =======
  // Sanitize input to prevent SQL/NoSQL injection
  static sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    // Remove dangerous characters
    const dangerous = /[;'"`\\]/g;
    let sanitized = input.replace(dangerous, '');
    
    // Remove SQL keywords
    const sqlKeywords = /\b(DROP|DELETE|INSERT|UPDATE|SELECT|UNION|ALTER|CREATE)\b/gi;
    sanitized = sanitized.replace(sqlKeywords, '');
    
    return sanitized.trim();
  }

  // ======= INPUT VALIDATION =======
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length < 255;
  }

  static validateUsername(username) {
    // Alphanumeric, underscores, hyphens only
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    return usernameRegex.test(username);
  }

  static validateUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static validateMessageLength(message, maxLength = 500) {
    return message && message.length > 0 && message.length <= maxLength;
  }

  // ======= RATE LIMITING (DDoS PROTECTION) =======
  rateLimit(identifier, limit = 30, window = 60000) {
    const key = identifier;
    const now = Date.now();

    if (!this.requestLimits.has(key)) {
      this.requestLimits.set(key, []);
    }

    let requests = this.requestLimits.get(key);
    requests = requests.filter(time => now - time < window);

    if (requests.length >= limit) {
      this.logSuspiciousActivity(identifier, 'Rate limit exceeded');
      return false;
    }

    requests.push(now);
    this.requestLimits.set(key, requests);
    return true;
  }

  // ======= CSRF TOKEN PROTECTION =======
  generateCSRFToken() {
    const token = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('csrfToken', token);
    return token;
  }

  verifyCSRFToken(token) {
    const storedToken = sessionStorage.getItem('csrfToken');
    return storedToken && storedToken === token;
  }

  // ======= SUSPICIOUS ACTIVITY LOGGING =======
  logSuspiciousActivity(identifier, reason) {
    const log = {
      identifier,
      reason,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
    this.suspiciousActivity.push(log);
    console.warn('🚨 Suspicious Activity:', log);

    // If too many suspicious activities, block IP
    if (this.suspiciousActivity.length > 10) {
      this.blockedIPs.add(identifier);
    }
  }

  // ======= CONTENT SECURITY POLICY HEADERS =======
  static applyCSPHeaders() {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' https://www.gstatic.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' data: https:;
      font-src 'self' https://fonts.gstatic.com;
      frame-ancestors 'none';
      base-uri 'self';
      form-action 'self';
    `;
    document.head.appendChild(meta);
  }

  // ======= SECURE STORAGE =======
  static setSecureStorage(key, value) {
    try {
      const encrypted = btoa(JSON.stringify(value)); // Basic encoding (use crypto in production)
      localStorage.setItem(`secure_${key}`, encrypted);
      return true;
    } catch (err) {
      console.error('Storage error:', err);
      return false;
    }
  }

  static getSecureStorage(key) {
    try {
      const encrypted = localStorage.getItem(`secure_${key}`);
      if (!encrypted) return null;
      return JSON.parse(atob(encrypted));
    } catch (err) {
      console.error('Storage error:', err);
      return null;
    }
  }

  // ======= PREVENT CLICKJACKING =======
  static preventClickjacking() {
    if (window.self !== window.top) {
      window.top.location = window.self.location;
    }

    const meta = document.createElement('meta');
    meta.httpEquiv = 'X-UA-Compatible';
    meta.content = 'IE=edge';
    document.head.appendChild(meta);
  }

  // ======= SECURE MESSAGE HANDLING =======
  static sanitizeMessage(message) {
    if (typeof message !== 'string') return '';
    
    // Remove HTML tags
    let sanitized = message.replace(/<[^>]*>/g, '');
    
    // Escape special characters
    sanitized = this.escapeHtml(sanitized);
    
    // Validate length
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 500);
    }

    return sanitized;
  }

  // ======= MONITOR SESSION =======
  monitorSession(userId) {
    // Check for suspicious patterns
    const sessionStart = Date.now();
    
    window.addEventListener('storage', (e) => {
      if (e.key === 'adminToken' && e.newValue === null) {
        console.log('⚠️ Session cleared');
      }
    });

    // Warn if tab is inactive for too long
    let lastActivity = Date.now();
    
    document.addEventListener('mousemove', () => {
      lastActivity = Date.now();
    });

    document.addEventListener('keypress', () => {
      lastActivity = Date.now();
    });

    setInterval(() => {
      const inactiveTime = Date.now() - lastActivity;
      if (inactiveTime > 30 * 60 * 1000) { // 30 minutes
        console.warn('⚠️ Session inactive for 30 minutes');
      }
    }, 60000);
  }
}

// ======= AUTO-INITIALIZE SECURITY =======
SecurityManager.applyCSPHeaders();
SecurityManager.preventClickjacking();

export default SecurityManager;
