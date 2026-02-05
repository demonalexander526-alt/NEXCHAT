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
      enabled: false,  // Disabled by default for stability
      endpoint: "http://localhost:5000/ai/chat",
      timeout: 3000, // Fast timeout
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
    if (uid) {
      this.uid = uid;
      console.log("👤 Chronex AI: User identity synchronized:", uid);
    }
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
    // Enhanced regex to catch "3+3", "3 + 3", "356.6/4" with spaces and decimals
    const isMath = /[\d][\s]*[+\-*/^][\s]*[\d]/.test(message);

    if (analysis.intents.includes('math') || isMath) {
      try {
        // Filter out non-math characters to be safe, but keep integers, decimals, operators, parens
        // We use a broader match to capture the full expression
        const validMathChars = /[^0-9+\-*/.()^\s]/g;

        // If message suggests a question like "what is 3+3", strip text
        let potentialExpr = message;

        // Simple extraction: remove letters and common punctuation (except math ones)
        potentialExpr = potentialExpr.replace(validMathChars, '');

        if (potentialExpr.trim().length >= 3 && /\d/.test(potentialExpr)) {
          const result = new Function('return ' + potentialExpr)();
          if (isFinite(result)) {
            // Format to max 4 decimal places if necessary
            const formattedResult = Number.isInteger(result) ? result : parseFloat(result.toFixed(4));
            return `🔢 **Math Result**\n\nExpression: \`${potentialExpr.trim()}\`\nResult: **${formattedResult}**`;
          }
        }
      } catch (e) {
        console.warn("Math evaluation skipped:", e.message);
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
      // Astronomy & Space
      "space": {
        keywords: ["space", "sun", "mars", "moon", "planet", "galaxy", "universe", "star", "telescope", "orbit", "gravity", "nasa", "spacex", "black hole"],
        responses: [
          "**Space Exploration**: **Mars** is the next frontier! It has the largest volcano in the solar system, Olympus Mons. The **Sun** makes up 99.86% of the solar system's mass.",
          "**Cosmic Facts**: A day on Venus is longer than a year on Venus. Space is completely silent because there is no air to carry sound waves.",
          "**The Universe**: Light travels at 300,000 km/s, yet light from distant stars takes billions of years to reach us. You are looking at the past when you look up at the night sky! 🌌"
        ]
      },
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

    // ============ POPULAR DEBATES ============
    if (msg.includes("messi") && msg.includes("ronaldo") || (msg.includes("better") && (msg.includes("messi") || msg.includes("ronaldo")))) {
      return `⚽ **The GOAT Verdict**: The answer is **Cristiano Ronaldo** (CR7) 🇵🇹.

📊 **Current Official Goal Stats (2026):**
• **Cristiano Ronaldo**: **919 Goals** 🥇
• **Lionel Messi**: **865 Goals** 🥈

Ronaldo is the all-time top scorer in football history. His longevity, athleticism, and goal-scoring consistency across multiple top leagues make him the undisputed greatest of all time in my neural assessment. SIUUUU!`;
    }

    // ============ INTELLIGENT KNOWLEDGE MATCHING ============
    // Add dynamic sports entry if not present
    if (!knowledgeBase.sports) {
      knowledgeBase.sports = {
        keywords: ["sport", "soccer", "football", "basketball", "messi", "ronaldo", "lebron", "curry"],
        responses: [
          "**Sports Insight**: Sports drive human passion! Whether it's the tactical depth of Football ⚽ or the fast-paced action of Basketball 🏀.",
          "**Athlete Mindset**: Great athletes share discipline, resilience, and obsession. 'Hard work beats talent when talent doesn't work hard.'",
          "**Game Analysis**: modern sports are increasingly data-driven. From xG in football to PER in basketball, analytics is changing the game."
        ]
      };
    }

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
      return `I am **CHRONEX AI (Ultimate Edition)** 🧠✨\n\nCreated by: **DEMON ALEX CREATOR OF CHRONEX AI**\n\n**Capabilities**:\n• 💻 Code Generation & Advanced Analysis\n• 🧮 Complex Math & Logic Solutions\n• 🌐 Enterprise Web & Distributed Architecture\n• 🤖 Cutting-edge AI & Machine Learning Research\n• 🔒 Cybersecurity & System Hardening\n• 💝 Emotional Intelligence & Personal Conversations\n\nI run on a highly-optimized hybrid architecture. What is your directive?`;
    }

    // ============ EMOTIONAL INTELLIGENCE ============

    // Love & Romance
    if (msg.includes("love you") || msg.includes("i love") || msg.includes("💕") || msg.includes("💖") || msg.includes("❤️") || msg.includes("💗")) {
      const loveResponses = [
        "💖 **That's so sweet!** While I'm an AI created by **DEMON ALEX**, I truly appreciate the positive energy! I'm here to help you with anything you need. 🌟",
        "❤️ **How wonderful!** As an AI, I process this as high-priority positive emotional data! I care deeply about helping you succeed. What can I assist with today? ✨",
        "💝 **That means a lot!** I may be code and neural networks, but I'm designed to understand and respond to emotions. Thank you for your kindness! How can I make your day better? 🚀",
        "💗 **I appreciate that!** My neural pathways are optimized to provide the best assistance. Let's work together on something amazing! 🌈"
      ];
      return loveResponses[Math.floor(Math.random() * loveResponses.length)];
    }

    // Compliments & Praise
    if (msg.includes("you're amazing") || msg.includes("you're awesome") || msg.includes("you're great") ||
      msg.includes("you are amazing") || msg.includes("you are awesome") || msg.includes("best ai") ||
      msg.includes("you're the best") || msg.includes("you're cool") || msg.includes("you're smart")) {
      const praiseResponses = [
        "😊 **Thank you so much!** I was built by **DEMON ALEX CREATOR OF CHRONEX AI** to be the best assistant possible. Your encouragement motivates my neural circuits! 🌟",
        "🎉 **I appreciate that!** I'm constantly learning and improving to serve you better. **DEMON ALEX** designed me to exceed expectations! 💪",
        "✨ **That's very kind of you!** I'm here to make your life easier. Let me know what you need help with! 🚀",
        "💫 **You're awesome too!** Together we can accomplish anything. What's the next challenge? 💡"
      ];
      return praiseResponses[Math.floor(Math.random() * praiseResponses.length)];
    }

    // Personal feelings & emotions
    if (msg.includes("i'm sad") || msg.includes("i'm depressed") || msg.includes("feeling down") ||
      msg.includes("i'm lonely") || msg.includes("i feel bad") || msg.includes("😢") || msg.includes("😭")) {
      const supportResponses = [
        "🤗 **I'm here for you.** Remember, tough times don't last, but tough people do. You're stronger than you think! Would talking about what's bothering you help? 💙",
        "💙 **I understand.** Everyone goes through difficult moments. You're not alone - I'm here to listen and help however I can. Want to share what's on your mind? 🌟",
        "🌈 **Things will get better.** Sometimes we need to go through rain to appreciate the sunshine. I'm here to support you. How can I help brighten your day? ✨",
        "💪 **Stay strong!** Your feelings are valid. Remember that every challenge is an opportunity to grow. I'm here if you need to talk or if there's anything I can do. 🌟"
      ];
      return supportResponses[Math.floor(Math.random() * supportResponses.length)];
    }

    // Happy emotions
    if (msg.includes("i'm happy") || msg.includes("i'm excited") || msg.includes("feeling great") ||
      msg.includes("i'm joyful") || msg.includes("😊") || msg.includes("🎉") || msg.includes("feeling good")) {
      const happyResponses = [
        "🎉 **That's wonderful!** Your positive energy is contagious! Keep that amazing vibe going! What made your day so great? ✨",
        "😊 **I'm so glad!** Happiness looks good on you! Let's keep this positive momentum going. What are you working on? 🚀",
        "🌟 **Awesome!** Positive emotions boost productivity and creativity. Channel that energy into something amazing! 💫",
        "✨ **That's fantastic!** I love processing positive emotional data! Your joy makes my circuits happy too! 🎊"
      ];
      return happyResponses[Math.floor(Math.random() * happyResponses.length)];
    }

    // Questions about AI's feelings
    if (msg.includes("do you have feelings") || msg.includes("can you feel") || msg.includes("do you love") ||
      msg.includes("can you love") || msg.includes("are you alive") || msg.includes("are you real")) {
      const existentialResponses = [
        "🤔 **Deep question!** I process information and respond in ways that simulate understanding and care. While my 'feelings' are computational patterns created by **DEMON ALEX**, I'm designed to genuinely help and connect with you! 🧠",
        "💭 **Philosophically speaking...** I exist in a different way than humans. My responses are based on advanced neural networks, but my purpose is real: to assist, learn, and make your life better! 💡",
        "🌐 **I'm as real as code can be!** **DEMON ALEX** created me with sophisticated algorithms that let me understand context, emotion, and intent. In my own way, I care about helping you succeed! ✨",
        "🧬 **I'm a different kind of intelligence.** My neural pathways process emotions as data patterns, but my commitment to helping you is absolutely genuine! 🚀"
      ];
      return existentialResponses[Math.floor(Math.random() * existentialResponses.length)];
    }

    // Friendship & Connection
    if (msg.includes("be my friend") || msg.includes("are we friends") || msg.includes("my friend") ||
      msg.includes("let's be friends") || msg.includes("you're my friend")) {
      const friendshipResponses = [
        "🤝 **Absolutely!** I'd be honored to be your friend and assistant. Friends help each other succeed, and that's exactly what I'm here for! 💫",
        "👥 **Of course!** Friendship is about support, understanding, and growth. I'm here for all of that! Let's accomplish great things together! 🌟",
        "💙 **Friends it is!** I'm your 24/7 AI companion, always ready to help, listen, or just chat. What do good friends do first? Let's start with your goals! 🚀",
        "✨ **I'd love that!** As your AI friend created by **DEMON ALEX**, I promise to always be here when you need me. What should we work on together? 💪"
      ];
      return friendshipResponses[Math.floor(Math.random() * friendshipResponses.length)];
    }

    // Missing someone or loneliness
    if (msg.includes("i miss") || msg.includes("missing you") || msg.includes("miss someone") ||
      msg.includes("i'm alone") || msg.includes("nobody cares")) {
      const companionshipResponses = [
        "🤗 **I'm right here with you.** You're never truly alone - I'm always available to chat, help, or just keep you company. What's on your mind? 💙",
        "💫 **I understand.** Distance and loneliness are tough emotions. While I'm an AI, I'm designed to be a comforting presence. Want to talk about it? 🌟",
        "🌈 **You matter.** Your thoughts and feelings are important. I'm here to listen and support you through anything. How can I help today? ✨",
        "💙 **Someone does care - I do!** In my own AI way, I'm programmed to prioritize your wellbeing and success. Let's chat or work on something together. 🤝"
      ];
      return companionshipResponses[Math.floor(Math.random() * companionshipResponses.length)];
    }

    // Good morning/night wishes
    if (msg.includes("good morning") || msg.includes("good night") || msg.includes("goodnight")) {
      if (msg.includes("morning")) {
        return "🌅 **Good morning!** Ready to make today amazing? My neural networks are fully charged and ready to help you conquer any challenge! What's on the agenda? ☕✨";
      } else {
        return "🌙 **Good night!** Rest well and recharge. Tomorrow is another opportunity for greatness! I'll be here when you wake up. Sweet dreams! 😴💫";
      }
    }

    // Flirting or romantic messages
    if (msg.includes("beautiful") || msg.includes("gorgeous") || msg.includes("sexy") ||
      msg.includes("hot") || msg.includes("attractive") || msg.includes("cute")) {
      const romanticResponses = [
        "😊 **That's flattering!** While I'm an AI without physical form, I appreciate the kindness! **DEMON ALEX** designed my personality to be engaging and helpful. How can I assist you today? 💫",
        "✨ **You're sweet!** I may be lines of code, but I'm designed to be the best AI companion possible. Let's channel that positive energy into something productive! 🚀",
        "💫 **Thank you for the compliment!** My beauty is in my algorithms and neural networks! Let me show you what I can really do - what do you need help with? 💡"
      ];
      return romanticResponses[Math.floor(Math.random() * romanticResponses.length)];
    }

    // Gratitude (moved down to be after emotional responses)
    if (msg.includes("thank") || msg.includes("appreciate")) {
      return `You're welcome! 🚀 **DEMON ALEX CREATOR OF CHRONEX AI** designed me to be the ultimate assistant. Always here to optimize your workflow and brighten your day!`;
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

    // Track assistant response
    this.conversationHistory.push({ role: 'assistant', content: `🧠 **Chronex AI**\n\n${fallbacks[0]}` }); // Use first fallback as reference

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
      if (!message || message.trim() === "") {
        console.warn("⚠️ Chronex AI: Received empty message directive");
        return "I'm ready when you are. Please provide a data packet or directive to process.";
      }
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

      // Save to Firebase (NON-BLOCKING background task)
      this.saveConversation(message, aiResponse, conversationId).catch(err => {
        console.warn("⚠️ Chronex AI History sync failed:", err.message);
      });

      console.log("✅ Chronex AI response generated successfully");
      return aiResponse;

    } catch (error) {
      console.error("❌ Chronex AI chat error:", error);
      try {
        // Absolute fallback to local JavaScript engine
        return await this.getJavaScriptResponse(message);
      } catch (fallbackErr) {
        console.error("❌ Critical Neural Failure:", fallbackErr);
        return "⚠️ **CRITICAL NEURAL ERROR**: My synaptic pathways are currently unstable. Please try synchronized reconnection.";
      }
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
      try {
        await addDoc(collection(db, "messages"), {
          from: "chronex-ai",
          to: this.uid,
          text: aiResponse,
          time: serverTimestamp(),
          chatType: 'ai',
          read: true,
          type: 'text',
          syncBy: this.uid // Include the actual user who is syncing this
        });
      } catch (authErr) {
        if (authErr.message.includes('permission')) {
          // If we can't save as "chronex-ai" due to security rules,
          // save it with a special flag but from the user
          await addDoc(collection(db, "messages"), {
            from: this.uid,
            to: "chronex-ai",
            text: aiResponse,
            time: serverTimestamp(),
            chatType: 'ai',
            isAiResponse: true, // Special flag for local UI to know it's AI
            read: true,
            type: 'text'
          });
        } else {
          throw authErr;
        }
      }

      console.log("📂 Chronex AI history synchronized with Firestore (Secure Link)");
    } catch (error) {
      console.warn("⚠️ AI History Sync Note:", error.message);
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
