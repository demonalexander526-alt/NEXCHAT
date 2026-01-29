/**
 * CHRONEX AI SERVICE
 * Advanced AI Chat Assistant for NEXCHAT
 * Supports: JavaScript, Python, C++, C, C# backends
 * Creator: DEMON ALEX
 */

import { db, rtdb } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// ============ CREATOR INFO ============
const CREATOR = "DEMON ALEX";

// ============ CHRONEX AI CONFIGURATION ============
const CHRONEX_CONFIG = {
  creator: CREATOR,
  // AI Model Parameters
  model: {
    name: "Chronex AI v1.0",
    type: "advanced-neural-network",
    temperature: 0.7,
    maxTokens: 2000,
    topP: 0.9,
    frequencyPenalty: 0.6,
    presencePenalty: 0.6,
  },

  // AI Capabilities
  capabilities: {
    chat: true,
    codeAnalysis: true,
    languageSupport: ["JavaScript", "Python", "C++", "C", "C#", "Java", "Go", "Rust"],
    mathSolving: true,
    dataAnalysis: true,
    documentProcessing: true,
    multiLanguage: true,
  },

  // Backend Options
  backends: {
    python: {
      enabled: true,  // Enabled by default to try connecting to "Brain"
      endpoint: "http://localhost:5000/ai/chat",
      timeout: 10000, // Reduced timeout for faster fallback
    },
    cloud: {
      enabled: false,
      provider: "openai",
      apiKey: ""
    }
  },

  // Caching Settings
  response: {
    caching: true,
    cacheDuration: 3600, // 1 hour
    maxCacheSize: 100
  }
};

// ============ ENHANCED INTENT DETECTION ============
class IntentDetector {
  constructor() {
    this.patterns = {
      greeting: /\b(hello|hi|hey|greetings|good\s+(morning|afternoon|evening))\b/i,
      question: /\b(what|why|how|when|where|who|which|can\s+you|could\s+you)\b/i,
      coding: /\b(code|function|class|variable|bug|error|debug|compile|syntax|program)\b/i,
      math: /\b(calculate|solve|equation|formula|math|algebra|calculus|derivative|integral)\b/i,
      explanation: /\b(explain|describe|tell\s+me\s+about|what\s+is|define|meaning)\b/i,
      learning: /\b(learn|tutorial|teach|guide|show\s+me)\b/i,
      help: /\b(help|assist|support)\b/i
    };
  }

  detect(message) {
    const intents = [];
    for (const [intent, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(message)) {
        intents.push(intent);
      }
    }
    return intents.length > 0 ? intents : ['general'];
  }

  extractEntities(message) {
    const entities = {
      languages: [],
      topics: [],
      keywords: []
    };

    const langs = ['javascript', 'python', 'java', 'c\\+\\+', 'c#', 'ruby', 'go', 'rust', 'php', 'typescript'];
    langs.forEach(lang => {
      const regex = new RegExp(`\\b${lang}\\b`, 'i');
      if (regex.test(message)) {
        entities.languages.push(lang.replace('\\', ''));
      }
    });

    const topics = ['ai', 'machine learning', 'data science', 'web', 'mobile', 'database', 'api', 'cloud'];
    topics.forEach(topic => {
      if (message.toLowerCase().includes(topic)) {
        entities.topics.push(topic);
      }
    });

    return entities;
  }
}

// ============ CHRONEX AI CLASS (ENHANCED) ============
class ChronexAI {
  constructor(config) {
    this.config = config;
    this.cache = new Map();
    this.conversationHistory = [];
    this.lastResponses = [];
    this.uid = null;
    this.intentDetector = new IntentDetector();
    this.contextMemory = {
      lastTopic: null,
      userPreferences: {},
      conversationCount: 0
    };
    console.log("🧠 Chronex AI Service Initialized (Enhanced)");
  }

  setUserId(uid) {
    this.uid = uid;
  }

  // Enhanced message analysis
  analyzeMessage(message) {
    const intents = this.intentDetector.detect(message);
    const entities = this.intentDetector.extractEntities(message);
    const wordCount = message.split(' ').length;
    const complexity = wordCount > 50 ? 'advanced' : wordCount > 20 ? 'intermediate' : 'simple';

    return { intents, entities, complexity };
  }

  // JavaScript implementation (local processing - SUPER ENHANCED)
  async getJavaScriptResponse(message) {
    const msg = message.toLowerCase();

    // Track conversation context
    this.conversationHistory.push({ role: 'user', content: message });
    this.contextMemory.conversationCount++;

    // Perform deep analysis
    const analysis = this.analyzeMessage(message);
    console.log('📊 Analysis:', analysis);

    // ============ CREATOR INFORMATION ============
    if (msg.includes("creator") || msg.includes("who made you") || msg.includes("who created") || msg.includes("demon alex")) {
      const creatorResponses = [
        "I was created by **DEMON ALEX**, the brilliant developer behind CHRONEX AI and NEXCHAT. He's a master of AI systems, full-stack development, and cutting-edge technology! 🚀",
        "My creator is **DEMON ALEX** - the genius behind CHRONEX AI! He built me with advanced neural network architecture and hybrid processing capabilities. 💡",
        "**DEMON ALEX** is my creator! He's the mastermind developer who brought CHRONEX AI to life. His expertise in AI, Python, JavaScript, and system architecture is incredible! 👨‍💻✨",
        "I'm proud to be created by **DEMON ALEX**, the developer of CHRONEX AI and NEXCHAT. He's pushing the boundaries of what's possible in AI-powered chat applications! 🌟"
      ];
      return creatorResponses[Math.floor(Math.random() * creatorResponses.length)];
    }

    // ============ ADVANCED KNOWLEDGE BASE ============
    const knowledgeBase = {
      // Programming Languages
      "javascript": {
        keywords: ["javascript", "js", "node", "frontend", "react", "vue", "angular", "typescript"],
        responses: [
          "**JavaScript Mastery**: Use `const` and `let` instead of `var`. Arrow functions `() => {}` provide cleaner syntax and lexical `this` binding. For async operations, `async/await` is more readable than Promise chains. Want specific examples?",
          "**Modern JS Best Practices**: \n• Destructuring: `const {name, age} = user`\n• Spread operators: `...array`\n• Template literals: \\`${variable}\\`\n• Optional chaining: `obj?.property`\n• Nullish coalescing: `value ?? default`\n\nWhich would you like to explore?",
          "**Performance Optimization**: Use `map()`, `filter()`, `reduce()` for functional programming. Implement debouncing for expensive operations. Leverage `requestAnimationFrame` for smooth animations. Use Web Workers for heavy computations. Need code examples?",
          "**ES6+ Features**: Modules, classes, promises, async/await, generators, proxies, symbols, and more! The modern JavaScript ecosystem is powerful. What specific feature interests you?"
        ]
      },
      "python": {
        keywords: ["python", "pip", "django", "flask", "ml", "ai", "pandas", "numpy", "pytorch"],
        responses: [
          "**Python Excellence**: \n• List comprehensions: `[x**2 for x in range(10)]`\n• F-strings: `f'Hello {name}'`\n• Context managers: `with open() as f`\n• Decorators for cleaner code\n• Type hints for clarity\n\nWhich concept should we dive into?",
          "**Data Science Stack**: \n• NumPy: Fast numerical computing\n• Pandas: Data manipulation\n• Matplotlib/Seaborn: Visualization\n• Scikit-learn: Machine learning\n• Jupyter: Interactive analysis\n\nWhat's your data science goal?",
          "**AI/ML with Python**: PyTorch and TensorFlow for deep learning. Transformers for NLP. OpenCV for computer vision. Use GPU acceleration with CUDA. Start with tutorials and gradually build projects!",
          "**Best Practices**: Follow PEP 8, use virtual environments (venv/conda), write tests (pytest), document with docstrings, use type hints, and leverage linters (flake8/pylint)."
        ]
      },
      "web": {
        keywords: ["html", "css", "web", "frontend", "backend", "api", "rest", "http", "responsive"],
        responses: [
          "**Modern Web Dev**: \n• Frontend: React, Vue, Angular, Svelte\n• Backend: Node.js, Python (Django/Flask), Go\n• Database: PostgreSQL, MongoDB, Redis\n• API: REST, GraphQL, gRPC\n• Deploy: Vercel, Netlify, AWS, Docker\n\nWhat's your stack?",
          "**Web Performance**: \n• Minimize HTTP requests\n• Lazy load images\n• Use CDN for static assets\n• Enable compression (gzip/brotli)\n• Implement caching strategies\n• Optimize Critical Rendering Path\n\nRunning into speed issues?",
          "**Responsive Design**: Mobile-first approach, CSS Grid & Flexbox, media queries, fluid typography, touch-friendly interfaces. Users expect seamless experiences across all devices!",
          "**Web Security**: HTTPS always, CORS properly configured, input validation, XSS/CSRF prevention, Content Security Policy, secure authentication (OAuth, JWT), regular dependency updates."
        ]
      },
      "database": {
        keywords: ["database", "sql", "nosql", "mongodb", "postgres", "mysql", "firestore", "firebase"],
        responses: [
          "**SQL Mastery**: Use indexes wisely, normalize for data integrity, prepared statements prevent injection, EXPLAIN to analyze queries, foreign keys maintain relationships. Optimize JOIN operations for performance.",
          "**NoSQL Options**: \n• MongoDB: Document store, flexible schema\n• Redis: In-memory cache, pub/sub\n• Cassandra: Distributed, high availability\n• Firebase: Real-time, managed service\n\nChoose based on use case!",
          "**Query Optimization**: Index frequently queried columns, avoid SELECT *, use LIMIT for large datasets, implement pagination, monitor slow queries, use connection pooling, cache when possible.",
          "**Firebase/Firestore**: Real-time sync, offline support, security rules for access control, batch writes for efficiency, subcollections for organization. Great for real-time apps like NEXCHAT!"
        ]
      },
      "math": {
        keywords: ["math", "calculate", "equation", "algebra", "calculus", "statistics", "probability", "solve"],
        responses: [
          "**Mathematics Helper** 🔢\n\nI can solve:\n• Algebra: equations, polynomials, factoring\n• Calculus: derivatives, integrals, limits\n• Statistics: mean, median, distributions\n• Probability: combinations, permutations\n• Linear Algebra: matrices, vectors\n\nShare your problem and I'll solve it step-by-step!",
          "**Quick Reference**:\n• Derivative: d/dx(x²) = 2x\n• Integral: ∫x dx = x²/2 + C\n• Quadratic: x = (-b ± √(b²-4ac))/2a\n• Pythagorean: a² + b² = c²\n\nNeed help with a specific problem?",
          "**Statistics Basics**: Mean (average), median (middle), mode (most frequent), standard deviation (spread), probability (0 to 1), confidence intervals, hypothesis testing. What do you need?",
          "**Advanced Math**: Differential equations, Fourier transforms, complex analysis, number theory, topology. I can guide you through complex concepts with clear explanations!"
        ]
      },
      "ai": {
        keywords: ["artificial intelligence", "machine learning", "neural network", "deep learning", "ai model", "nlp", "computer vision"],
        responses: [
          "**AI/ML Fundamentals**:\n• Supervised Learning: Labeled data, classification, regression\n• Unsupervised Learning: Clustering, dimensionality reduction\n• Reinforcement Learning: Rewards-based learning\n• Deep Learning: Multi-layer neural networks\n\nWhat area interests you?",
          "**Neural Networks**: Input → Hidden Layers → Output. Each layer has neurons with weights and biases. Training uses backpropagation and gradient descent. Activation functions add non-linearity (ReLU, sigmoid, tanh).",
          "**NLP (Natural Language Processing)**: Tokenization, embeddings (Word2Vec, BERT), transformers, attention mechanisms, GPT models. Build chatbots, sentiment analysis, translation systems!",
          "**Computer Vision**: CNNs for image classification, object detection (YOLO, R-CNN), segmentation, face recognition, image generation (GANs, Diffusion). Train on labeled datasets like ImageNet!"
        ]
      },
      "nexchat": {
        keywords: ["nexchat", "this app", "this application", "chat app"],
        responses: [
          "**NEXCHAT** 🚀\n\nA cutting-edge PWA by **DEMON ALEX** featuring:\n• Real-time messaging\n• Group chats with admin controls\n• AI assistant (that's me!)\n• Status updates\n• File sharing\n• Token economy\n• Gaming hub\n\nAll powered by Firebase & modern JavaScript!",
          "**Technical Stack**:\n• Frontend: Vanilla JS (ESM modules)\n• Backend: Firebase (Auth, Firestore, Storage)\n• AI: Hybrid (Python + JavaScript)\n• PWA: Offline support, installable\n• Real-time: WebSocket-like live updates\n\nBuilt for performance and reliability!",
          "**Key Features**: End-to-end encryption possibilities, voice messages, polls, rich media sharing, customizable themes, notification system, and me - CHRONEX AI for instant help!",
          "**Why NEXCHAT?** Progressive Web App = no app store needed, works offline, fast loading, push notifications, cross-platform. Created by **DEMON ALEX** to revolutionize chat apps!"
        ]
      }
    };

    // ============ INTELLIGENT KNOWLEDGE MATCHING ============
    for (const [topic, data] of Object.entries(knowledgeBase)) {
      if (data.keywords.some(k => msg.includes(k))) {
        const response = data.responses[Math.floor(Math.random() * data.responses.length)];
        this.lastResponses.push(response);
        this.contextMemory.lastTopic = topic;
        return response;
      }
    }

    // ============ CONTEXT-AWARE RESPONSES ============

    // Remember previous topic
    if (this.contextMemory.lastTopic && (msg.includes("more") || msg.includes("tell me more") || msg.includes("continue"))) {
      return `Continuing our discussion on **${this.contextMemory.lastTopic}**... I can provide more specific details, code examples, or answer questions. What aspect would you like to explore further?`;
    }

    // ============ INTENT-BASED RESPONSES ============
    if (analysis.intents.includes('question')) {
      return `🤔 **Great question!** Based on my analysis, you're asking about: "${message.substring(0, 100)}..."\n\nTo give you the best answer, could you be more specific? I can help with:\n• Technical explanations\n• Code examples\n• Problem-solving strategies\n• Learning resources\n\nWhat specific information do you need?`;
    }

    if (analysis.intents.includes('coding')) {
      const langs = analysis.entities.languages.join(', ') || 'any language';
      return `💻 **Coding Mode Activated**\n\nI can help with ${langs}:\n• Writing clean, efficient code\n• Debugging and optimization\n• Best practices and patterns\n• Algorithm design\n• Code review\n\nShare your code or describe what you're building, and I'll assist!`;
    }

    if (analysis.intents.includes('learning')) {
      return `📚 **Learning Assistant Ready**\n\nI can guide you through:\n• Step-by-step tutorials\n• Concept explanations\n• Practice exercises\n• Resource recommendations\n• Project ideas\n\nWhat would you like to learn today?`;
    }

    // ============ IDENTITY & CAPABILITIES ============
    if (msg.includes("who are you") || msg.includes("what are you") || msg.includes("introduce")) {
      return `I am **CHRONEX AI v3.0 (Enhanced)** 🧠✨\n\nCreated by: **DEMON ALEX**\nArchitecture: Hybrid (Python Neural Networks + JavaScript)\n\n**My Enhanced Capabilities**:\n• 💻 Advanced code analysis and generation\n• 🧮 Complex mathematical problem solving\n• 🔬 Scientific explanations with depth\n• 🌐 Full-stack development guidance\n• 🤖 AI/ML concepts and implementation\n• 📊 Data analysis and visualization\n• 💡 Intelligent problem-solving\n• 🎓 Personalized learning assistance\n\nI learn from our conversations and provide context-aware responses!`;
    }

    if (msg.includes("what can you do") || msg.includes("capabilities") || msg.includes("features")) {
      return `**CHRONEX AI Enhanced Capabilities** 🚀\n\n✨ **Core Features**:\n• Intent detection & entity extraction\n• Context-aware responses\n• Multi-turn conversation memory\n• Advanced knowledge base\n• Real-time learning\n\n💻 **Technical Skills**:\n• 10+ programming languages\n• Web & mobile development\n• Database optimization\n• API design & implementation\n• DevOps & cloud architecture\n\n🧠 **Intelligence**:\n• Natural language understanding\n• Code generation & review\n• Mathematical problem solving\n• Creative solution design\n\nCreated by **DEMON ALEX** to be your smartest companion!`;
    }

    // ============ GREETINGS ============
    if (analysis.intents.includes('greeting')) {
      const greetings = [
        `Hello! 👋 I'm CHRONEX AI v3.0, created by **DEMON ALEX**. ${this.contextMemory.conversationCount > 1 ? "Welcome back! " : ""}How can I help you today?`,
        "Hey there! 🌟 Ready to solve complex problems together? I'm smarter than ever!",
        `Greetings! 🤖 I'm CHRONEX AI (Enhanced) ${this.contextMemory.conversationCount > 1 ? "- good to chat again! " : ""}What's on your mind?`,
        "Hi! 💡 I'm here with enhanced intelligence to help with coding, math, science, and more!"
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    // ============ GRATITUDE ============
    if (msg.includes("thank") || msg.includes("thanks") || msg.includes("appreciate")) {
      return `You're very welcome! 😊 ${this.contextMemory.conversationCount > 3 ? "I'm enjoying our conversation! " : ""}I'm here anytime you need help. Created by **DEMON ALEX** to assist you! Feel free to ask more questions!`;
    }

    // ============ SMART FALLBACK ============
    if (this.conversationHistory.length > 2) {
      const recentTopics = analysis.entities.languages.concat(analysis.entities.topics);
      const topicHint = recentTopics.length > 0 ? `I notice you mentioned: ${recentTopics.join(', ')}. ` : '';

      return `🧠 **Intelligent Analysis Mode**\n\n${topicHint}I'm processing your message with enhanced AI. For even more powerful responses with deep neural processing, make sure \`CHRONEX-AI.py\` is running!\n\n**Current Mode**: Enhanced JavaScript (Smart Fallback)\n**Creator**: DEMON ALEX\n**Conversation**: ${this.contextMemory.conversationCount} messages\n\nCould you provide more specific details about what you need? I'm ready to help!`;
    }

    // ============ DEFAULT INTELLIGENT RESPONSE ============
    return `**CHRONEX AI v3.0 Enhanced** - Created by **DEMON ALEX** 🚀\n\nI'm your intelligent assistant with:\n• 🧠 Intent detection & analysis\n• 💡 Context-aware responses\n• 📊 Multi-domain knowledge\n• 🔄 Conversation memory\n• ✨ Continuous learning\n\n**I can help with**:\n• Programming & Development\n• Mathematics & Calculations  \n• Science & Technology\n• Problem Solving & Debugging\n• Learning & Education\n• And much more!\n\n💡 **Pro Tip**: Run \`CHRONEX-AI.py\` for even smarter AI-powered responses with my Python neural network backend!\n\nWhat would you like to know?`;
  }

  // Python backend (ML/advanced processing)
  async getPythonResponse(message) {
    // Fast fail check
    if (!this.config.backends.python.enabled) return this.getJavaScriptResponse(message);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.backends.python.timeout);

      // Prepare context/history
      const context = this.conversationHistory.slice(-5);

      const response = await fetch(this.config.backends.python.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          model: this.config.model.name,
          temperature: this.config.model.temperature,
          history: context,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Python backend error: ${response.status}`);
      }

      const data = await response.json();
      const aiText = data.response || data.text;

      // Update local history
      this.conversationHistory.push({ role: 'user', content: message });
      this.conversationHistory.push({ role: 'assistant', content: aiText });

      return aiText;
    } catch (error) {
      console.warn("⚠️ Chronex AI Brain (Python) disconnected. Using Local Fallback.");
      return this.getJavaScriptResponse(message);
    }
  }

  // Cache management
  cacheResponse(key, value) {
    if (this.config.response.caching) {
      this.cache.set(key, {
        value,
        timestamp: Date.now(),
      });

      if (this.cache.size > this.config.response.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }
  }

  getFromCache(key) {
    if (!this.config.response.caching) return null;

    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = (Date.now() - cached.timestamp) / 1000;
    if (age > this.config.response.cacheDuration) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  // Main chat method - Entry point from chat.js
  async chat(message, conversationId = "default") {
    try {
      console.log("🧠 Chronex AI processing message:", message);

      // Check cache first
      const cacheKey = message.toLowerCase().trim();
      const cachedResponse = this.getFromCache(cacheKey);
      if (cachedResponse) {
        console.log("✅ Retrieved from cache");
        return cachedResponse;
      }

      // Try Python backend first (if enabled), fallback to JavaScript
      let aiResponse;
      if (this.config.backends.python.enabled) {
        console.log("🐍 Attempting Python backend...");
        aiResponse = await this.getPythonResponse(message);
      } else {
        console.log("💻 Using JavaScript backend...");
        aiResponse = await this.getJavaScriptResponse(message);
      }

      // Cache the response
      this.cacheResponse(cacheKey, aiResponse);

      // Save to Firebase
      await this.saveConversation(message, aiResponse, conversationId);

      console.log("✅ Chronex AI response generated successfully");
      return aiResponse;

    } catch (error) {
      console.error("❌ Chronex AI chat error:", error);
      // Always fallback to JavaScript on error
      const fallbackResponse = await this.getJavaScriptResponse(message);
      return fallbackResponse;
    }
  }

  // Save conversation to Firebase
  async saveConversation(userMessage, aiResponse, conversationId) {
    try {
      if (!this.uid) return;

      const conversationRef = ref(rtdb, `conversations/${this.uid}/${conversationId || "default"}`);
      const messagesRef = push(conversationRef);

      await set(messagesRef, {
        user: userMessage,
        ai: aiResponse,
        timestamp: serverTimestamp(),
        model: this.config.model.name,
      });
    } catch (error) {
      console.error("Error saving conversation:", error);
    }
  }

  // Get conversation history
  async getConversationHistory(conversationId = "default") {
    try {
      if (!this.uid) return [];

      const conversationRef = ref(rtdb, `conversations/${this.uid}/${conversationId}`);
      return new Promise((resolve) => {
        onValue(conversationRef, (snapshot) => {
          const messages = [];
          snapshot.forEach((child) => {
            messages.push(child.val());
          });
          resolve(messages);
        }, { onlyOnce: true });
      });
    } catch (error) {
      console.error("Error fetching history:", error);
      return [];
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Update configuration
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

// ============ EXPORT ============
export const chronexAI = new ChronexAI(CHRONEX_CONFIG);
export { ChronexAI, CHRONEX_CONFIG };
