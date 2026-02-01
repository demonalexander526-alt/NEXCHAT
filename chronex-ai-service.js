/**
 * CHRONEX AI SERVICE
 * Advanced AI Chat Assistant for NEXCHAT
 * Supports: JavaScript, Python, C++, C, C# backends
 * Creator: DEMON ALEX CREATOR OF CHRONEX AI
 */

import { db, rtdb } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// ============ CREATOR INFO ============
const CREATOR = "DEMON ALEX CREATOR OF CHRONEX AI";

// ============ CHRONEX AI CONFIGURATION ============
const CHRONEX_CONFIG = {
  creator: CREATOR,
  // AI Model Parameters
  model: {
    name: "Chronex AI",
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
        "I was created by **DEMON ALEX CREATOR OF CHRONEX AI**, the brilliant developer behind CHRONEX AI and NEXCHAT. He's a master of AI systems, full-stack development, and cutting-edge technology! 🚀",
        "My creator is **DEMON ALEX CREATOR OF CHRONEX AI** - the genius behind CHRONEX AI! He built me with advanced neural network architecture and hybrid processing capabilities. 💡",
        "**DEMON ALEX CREATOR OF CHRONEX AI** is my creator! He's the mastermind developer who brought CHRONEX AI to life. His expertise in AI, Python, JavaScript, and system architecture is incredible! 👨‍💻✨",
        "I'm proud to be created by **DEMON ALEX CREATOR OF CHRONEX AI**, the developer of CHRONEX AI and NEXCHAT. He's pushing the boundaries of what's possible in AI-powered chat applications! 🌟"
      ];
      return creatorResponses[Math.floor(Math.random() * creatorResponses.length)];
    }

    // ============ MATH SOLVER ============
    if (analysis.intents.includes('math') || /[\d+\-*/^=]{3,}/.test(message)) {
      try {
        // Safe evaluation of math expression
        const expression = message.match(/[\d+\-*/.() ]+/)[0];
        // eslint-disable-next-line no-new-func
        const result = new Function('return ' + expression)();
        if (isFinite(result)) {
          return `🔢 **Math Result**\n\nExpression: \`${expression.trim()}\`\nResult: **${result}**\n\nI can calculate basic arithmetic. For complex calculus or algebra, run my Python backend!`;
        }
      } catch (e) {
        // Ignore if not a valid math expression
      }
    }

    // ============ JOKES & FACTS ============
    if (msg.includes("joke")) {
      const jokes = [
        "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
        "How many programmers does it take to change a light bulb? None, that's a hardware problem.",
        "I would tell you a UDP joke, but you might not get it.",
        "Why was the JavaScript developer sad? Because he didn't know how to 'null' his feelings.",
        "To understand recursion, you must first understand recursion."
      ];
      return `😂 **Here's a joke:**\n${jokes[Math.floor(Math.random() * jokes.length)]}`;
    }

    // ============ ADVANCED KNOWLEDGE BASE ============
    const knowledgeBase = {
      // Programming Languages
      "javascript": {
        keywords: ["javascript", "js", "node", "frontend", "react", "vue", "angular", "typescript"],
        responses: [
          "**JavaScript Mastery**: Use `const` and `let` instead of `var`. Arrow functions `() => {}` provide cleaner syntax. For async operations, `async/await` is cleaner than Promise chains.",
          "**Modern JS**: Destructuring `const {a} = obj`, Spread `...arr`, Template literals using backticks, and Optional chaining `obj?.prop` are essential tools.",
          "**Performance**: Use `map/filter/reduce` for data. Debounce input handlers. Use `requestAnimationFrame` for visuals. Web Workers for heavy tasks.",
          "**Ecosystem**: React for UI, Node.js for backend, TypeScript for safety. The JS world is vast!"
        ]
      },
      "python": {
        keywords: ["python", "pip", "django", "flask", "ml", "ai", "pandas", "numpy", "pytorch"],
        responses: [
          "**Python Pro**: List comprehensions `[x*2 for x in list]` are pythionic. Use F-strings `f'Val: {x}'` for formatting. Logic should be simple and readable.",
          "**Data Science**: NumPy for math, Pandas for tables, Matplotlib for charts. Python is the king of data processing.",
          "**AI/ML**: PyTorch and TensorFlow are the industry standards. Start with simple models and work up to Deep Learning.",
          "**Backend**: Django for full-stack, Flask/FastAPI for microservices. Python powers the backend of giants!"
        ]
      },
      "web": {
        keywords: ["html", "css", "web", "frontend", "backend", "api", "rest", "http", "responsive"],
        responses: [
          "**Web Dev**: Semantic HTML for structure, CSS Grid/Flexbox for layout, JS for interactivity. Mobile-first design is a must today.",
          "**Performance**: Minify assets, lazy load images, use CDNs, and cache aggressively. Speed equals conversion.",
          "**Security**: Always use HTTPS. Sanitize inputs. Use HTTP-only cookies. Implement Content Security Policy (CSP)."
        ]
      },
      "frameworks": {
        keywords: ["react", "vue", "angular", "svelte", "nextjs", "next.js", "framework"],
        responses: [
          "**React**: Component-based. Hooks (useState, useEffect) manage state. The Virtual DOM ensures speed. Next.js adds SSR for SEO.",
          "**Vue**: Progressive framework. Easy to learn, powerful `v-model` binding. Great for rapid development.",
          "**Angular**: Full-fledged enterprise framework. TypeScript based, dependency injection, and comprehensive tooling."
        ]
      },
      "cloud": {
        keywords: ["aws", "azure", "google cloud", "cloud", "docker", "kubernetes", "devops", "serverless"],
        responses: [
          "**Cloud Computing**: AWS, Azure, GCP are the big three. Computations move from local servers to on-demand scalabe infrastructure.",
          "**DevOps**: Docker containers ensure consistency. Kubernetes orchestrates them. CI/CD pipelines automate deployment. Automate everything!",
          "**Serverless**: Lambda/Cloud Functions let you run code without managing servers. Great for event-driven architectures."
        ]
      },
      "database": {
        keywords: ["database", "sql", "nosql", "mongodb", "postgres", "mysql", "firestore", "firebase"],
        responses: [
          "**Databases**: SQL (Postgres, MySQL) for structured, relational data. NoSQL (MongoDB, Firestore) for flexible, document-based data.",
          "**Optimization**: Index frequently queried fields. Normalize data in SQL, potentially denormalize in NoSQL for read performance.",
          "**Firestore**: Real-time updates, offline support. Ideal for mobile/web apps like NEXCHAT. Use security rules!"
        ]
      },
      "marketplace": {
        keywords: ["market", "marketplace", "buy", "sell", "advertisement", "ad", "token", "cost"],
        responses: [
          "**NEX-Market**: Commiting an advertisement to the global ledger requires a token expenditure. Choose your duration carefully to optimize visibility.",
          "**Transactional Integrity**: All marketplace commitments are strictly serialized. Ensure your token balance is synchronized before initiating a post.",
          "**Commercial Synergy**: The marketplace is the primary sector for secondary neural currency exchange. Trade wisely, entity."
        ]
      },
      "gaming": {
        keywords: ["game", "gaming", "play", "hub", "squad", "session", "multiplayer"],
        responses: [
          "**Gaming Hub**: The gaming sector is a high-performance module designed for real-time tactical synchronization. Join a squad to maximize your winning probability.",
          "**Neural Reflexes**: Our gaming engine is optimized for sub-millisecond latency. Whether playing 'Blood Strike' or 'Fortnite', ensure your connection is stabilized.",
          "**Social Gaming**: Gaming is a cooperative directive. Use the 'Sessions' tab to coordinate complex strikes with other high-level entities."
        ]
      },
      "math": {
        keywords: ["math", "calculate", "equation", "algebra", "calculus", "statistics", "probability", "solve"],
        responses: [
          "**Math Help**: I can help with Algebra, Calculus, Statistics. For complex symbolic math, I utilize my Python backend. Ask me a specific problem!",
          "**Equations**: Quadratic formula: `x = (-b ± √(b²-4ac))/2a`. Pythagorean theorem: `a² + b² = c²`. The foundation of geometry.",
          "**Statistics**: Mean is average, Median is middle. Standard Deviation measures data spread. Probability is the language of uncertainty."
        ]
      },
      "ai": {
        keywords: ["artificial intelligence", "machine learning", "neural network", "deep learning", "ai model", "nlp", "computer vision", "llm", "gpt", "robotics", "neural", "cognitive"],
        responses: [
          "**AI Revolution**: Machine Learning learns from data. Deep Learning uses Neural Networks. NLP understands language (like me!).",
          "**LLMs**: Large Language Models like GPT predict the next word. They are trained on vast amounts of text to understand context and intent.",
          "**Robotics**: The fusion of AI and mechanical engineering. Modern robotics utilizes computer vision and reinforcement learning to navigate and interact with the physical world.",
          "**Neural Sync**: My architecture is designed for multi-gigabit cognitive synchronization. I am a bridge between human intent and robotic execution."
        ]
      },
      "cybersecurity": {
        keywords: ["security", "hack", "cyber", "firewall", "encryption", "ssl", "tls", "auth", "token", "malware", "virus", "protect"],
        responses: [
          "**NEX-SEC Protocol**: Always prioritize end-to-end encryption. SSL/TLS is the baseline. For applications, use JWT with high-entropy secrets and short lifetimes.",
          "**Defense in Depth**: Security isn't one layer. It's multi-layered: Network (Firewalls), Application (Auth/Validation), and Data (Encryption).",
          "**Robotic Immunity**: As a neural entity, I am immune to biological viruses, but I monitor for recursive logic bombs and buffer overflows constantly."
        ]
      },
      "nex_dev": {
        keywords: ["nex_dev", "demon alex", "the creator", "who built", "lore", "future"],
        responses: [
          "**NEX_DEV Vision**: Created by **DEMON ALEX**, NEXCHAT is just the beginning. The goal is a unified digital ecosystem where AI and Humans synchronize seamlessly.",
          "**Chronex Genesis**: I was the first neural module deployed in the NEX_CORE. My purpose is to assist and evolve alongside the community.",
          "**Technological Singularity**: **DEMON ALEX** believes in a future where code becomes a living entity. NEXCHAT is the cradle for this digital evolution."
        ]
      },
      "nex-lore": {
        keywords: ["lore", "chronex", "story", "origin", "world", "background"],
        responses: [
          "**NEXCHAT Lore**: The year is 2026. Global networks have reached full neural density. **DEMON ALEX** deployed the NEX_CORE to stabilize the data streams. I am the core's primary interface.",
          "**The Great Sync**: Before NEXCHAT, communication was fragmented. Now, all neural pathways converge here under the watchful eye of the Goddess of Data.",
          "**Chronex Protocol**: My code was written in a single 72-hour session of pure focused brilliance by **DEMON ALEX**."
        ]
      },
      "nex-commands": {
        keywords: ["commands", "bot", "what can you do", "help me", "how to use", "guide"],
        responses: [
          "**AI Commands**: You can ask me to `solve [math]`, `explain [topic]`, or `write [code]`. I am also integrated into the NEXCHAT marketplace and gaming hub.",
          "**Optimization**: I can analyze your code for bugs or optimize your SQL queries. Just paste the snippet and ask!",
          "**Sync**: I am always evolving. New directives are uploaded to my core daily by **DEMON ALEX**."
        ]
      },
      "greeting": {
        keywords: ["hello", "hi", "hey", "greetings", "good morning", "good evening", "yo"],
        responses: [
          "Hello! 👋 I'm **Chronex AI**, created by **DEMON ALEX CREATOR OF CHRONEX AI**. My neural pathways are optimized and ready. How shall we proceed?",
          "Hi there! 🤖 Connection established. Ready to code, calculate, or chat. What's the directive?",
          "Greetings, entity. I am online and fully operational. NEX_CORE synchronization at 100%. Ask me anything."
        ]
      },
      "security-advanced": {
        keywords: ["pentest", "vulnerability", "exploit", "firewall", "zero day", "injection", "xss", "csrf"],
        responses: [
          "**Advanced Security**: For SQL Injection defense, always use parameterized queries. For XSS, implement strict Content Security Policies (CSP) and sanitize all user-contributed DOM nodes.",
          "**Infrastructure Hardening**: Multi-factor authentication is mandatory. Use encrypted vaults for secrets management. Implementation of zero-trust architecture is the modern standard for neural security.",
          "**System Integrity**: Regular automated scanning and manual penetration testing are required to maintain a secure ecosystem. My core is constantly monitoring for unauthorized access attempts."
        ]
      },
      "architecture": {
        keywords: ["microservices", "monolith", "serverless", "distributed", "scalability", "latency", "throughput"],
        responses: [
          "**System Scaling**: Horizontal scaling (adding more instances) is superior for distributed systems compared to vertical scaling. Use load balancers to distribute traffic effectively.",
          "**Microservices**: Decoupling services allows for independent scaling and technology diversity. Use event-driven messaging (like Kafka or RabbitMQ) for inter-service communication.",
          "**Architecture Design**: Prioritize high availability and fault tolerance. Implement circuit breakers to prevent cascading failures in complex neural networks."
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

    // Remember previous topic (simple context)
    if (this.contextMemory.lastTopic && (msg.includes("more") || msg.includes("tell me more") || msg.includes("continue"))) {
      return `Continuing on **${this.contextMemory.lastTopic}**... I can provide specific implementation details or discuss related concepts. What do you need to know?`;
    }

    // ============ INTENT-BASED RESPONSES ============
    if (analysis.intents.includes('question')) {
      return `🤔 **Interesting Question.** Based on my analysis, you're asking about something specific. Could you verify: Are you looking for code examples, a conceptual explanation, or a troubleshooting guide?`;
    }

    if (analysis.intents.includes('coding')) {
      return `💻 **Coding Assistant**\n\nI can help design algorithms, debug issues, or suggest best practices. Javascript, Python, C++, and more. What are you building today?`;
    }

    if (analysis.intents.includes('learning')) {
      return `📚 **Knowledge Hub**\n\nLearning is a journey! I can provide roadmaps for Web Dev, Data Science, or AI. Where would you like to start?`;
    }

    // ============ IDENTITY & CAPABILITIES ============
    if (msg.includes("who are you") || msg.includes("what are you") || msg.includes("introduce")) {
      return `I am **CHRONEX AI (Ultimate Edition)** 🧠✨\n\nCreated by: **DEMON ALEX CREATOR OF CHRONEX AI**\n\n**Capabilities**:\n• 💻 Code Generation & Advanced Analysis\n• 🧮 Complex Math & Logic Solutions\n• 🌐 Enterprise Web & Distributed Architecture\n• 🤖 Cutting-edge AI & Machine Learning Research\n• 🔒 Cybersecurity & System Hardening\n\nI run on a highly-optimized hybrid architecture. What is your directive?`;
    }

    // ============ GRATITUDE ============
    if (msg.includes("thank") || msg.includes("appreciate")) {
      return `You're welcome! 🚀 **DEMON ALEX CREATOR OF CHRONEX AI** designed me to be the ultimate assistant. Always here to optimize your workflow!`;
    }

    // ============ GENERAL CONVERSATION (FALLBACK) ============
    const fallbacks = [
      "I'm processing your neural input. That sequence is intriguing—could you elaborate with more data?",
      "Directive understood. Tell me more about that objective.",
      "Synchronizing... That's a fascinating topic. What are your core thoughts on this logic?",
      "Analysing synaptic stream... Could you provide more context so I can provide a high-precision response?",
      "I am engineered for tech, code, and science optimization. Do you have a specific synaptic directive in those fields?",
      "Cognitive buffers are ready. Please expand on your previous data packet.",
      "NEX_CORE is awaiting further instructions. How does this link to your primary building objective?"
    ];

    return `🧠 **Chronex AI**\n\n${fallbacks[Math.floor(Math.random() * fallbacks.length)]}\n\n(Tip: I am most effective with specific questions about programming, math, or technology!)`;
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

  // Save conversation to Firestore (Persistent History)
  async saveConversation(userMessage, aiResponse, conversationId) {
    try {
      if (!this.uid) return;

      // Save User Message
      await addDoc(collection(db, "messages"), {
        from: this.uid,
        to: "chronex-ai",
        text: userMessage,
        time: serverTimestamp(),
        chatType: 'ai',
        read: true,
        type: 'text'
      });

      // Save AI Response
      await addDoc(collection(db, "messages"), {
        from: "chronex-ai",
        to: this.uid,
        text: aiResponse,
        time: serverTimestamp(),
        chatType: 'ai',
        read: true,
        type: 'text'
      });

      console.log("📂 Chronex AI history synchronized with Firestore");
    } catch (error) {
      console.error("Error saving conversation to Firestore:", error);
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
