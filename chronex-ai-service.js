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

// ============ CHRONEX AI CLASS ============
class ChronexAI {
  constructor(config) {
    this.config = config;
    this.cache = new Map();
    this.conversationHistory = [];
    this.lastResponses = [];
    this.uid = null;
    console.log("🧠 Chronex AI Service Initialized");
  }

  setUserId(uid) {
    this.uid = uid;
  }

  // JavaScript implementation (local processing - SUPER ENHANCED)
  async getJavaScriptResponse(message) {
    const msg = message.toLowerCase();

    // Track conversation context
    this.conversationHistory.push({ role: 'user', content: message });

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
          "**JavaScript Mastery**: Use `const` and `let` instead of `var`. Arrow functions `() => {}` provide cleaner syntax and lexical `this` binding. For async operations, `async/await` is more readable than Promise chains.",
          "**Modern JS**: Destructuring `const {name, age} = user` and spread operators `...array` make code cleaner. Template literals \\`${variable}\\` are better than string concatenation.",
          "**Performance**: Use `map()`, `filter()`, `reduce()` for array operations. Avoid nested loops when possible. Debounce expensive operations and use `requestAnimationFrame` for animations.",
          "**Best Practices**: Always use `===` for comparison, handle errors with try-catch, validate user input, and use ESLint for code quality. Modularize your code with ES6 modules."
        ]
      },
      "python": {
        keywords: ["python", "pip", "django", "flask", "ml", "ai", "pandas", "numpy", "pytorch"],
        responses: [
          "**Python Power**: List comprehensions `[x**2 for x in range(10)]` are faster than loops. Use f-strings `f'{variable}'` for string formatting. Virtual environments keep dependencies isolated.",
          "**Data Science**: NumPy for numerical computing, Pandas for data manipulation, Matplotlib/Seaborn for visualization. Use Jupyter notebooks for interactive analysis.",
          "**AI/ML**: PyTorch and TensorFlow for deep learning. Scikit-learn for traditional ML. Use GPU acceleration with CUDA for training neural networks.",
          "**Best Practices**: Follow PEP 8 style guide. Use type hints for better code clarity. Write docstrings for functions. Use `with` statements for file operations."
        ]
      },
      "web": {
        keywords: ["html", "css", "web", "frontend", "backend", "api", "rest", "http"],
        responses: [
          "**Web Development**: Semantic HTML5 improves accessibility. CSS Grid and Flexbox for layouts. Progressive Web Apps (PWAs) work offline and feel native.",
          "**Backend**: RESTful APIs use HTTP methods correctly (GET, POST, PUT, DELETE). Always validate and sanitize user input. Use JWT for authentication.",
          "**Performance**: Minify CSS/JS, optimize images, use CDNs, enable gzip compression, lazy load images, and implement caching strategies.",
          "**Security**: Use HTTPS, implement CORS properly, prevent XSS and SQL injection, use Content Security Policy, and keep dependencies updated."
        ]
      },
      "database": {
        keywords: ["database", "sql", "nosql", "mongodb", "postgres", "mysql", "firestore", "firebase"],
        responses: [
          "**SQL**: Use indexes for faster queries. Normalize data to reduce redundancy. Use prepared statements to prevent SQL injection. JOIN operations combine related data.",
          "**NoSQL**: MongoDB for flexible schemas, Redis for caching, Firebase for real-time data. Choose based on your data structure and access patterns.",
          "**Optimization**: Index frequently queried fields, use pagination for large datasets, implement connection pooling, and monitor query performance.",
          "**Firebase**: Firestore for structured data with real-time sync. Use security rules to protect data. Batch writes for multiple operations. Offline persistence available."
        ]
      },
      "math": {
        keywords: ["math", "calculate", "equation", "algebra", "calculus", "statistics", "probability"],
        responses: [
          "**Mathematics**: I can help with algebra, calculus, statistics, and more! For derivatives: d/dx(x²) = 2x. For integrals: ∫x dx = x²/2 + C. Need a specific calculation?",
          "**Statistics**: Mean (average), median (middle value), mode (most frequent). Standard deviation measures spread. Probability ranges from 0 to 1.",
          "**Algebra**: Solve equations by isolating variables. Factor polynomials. Use quadratic formula: x = (-b ± √(b²-4ac)) / 2a for ax² + bx + c = 0.",
          "**Calculus**: Derivatives show rate of change. Integrals find area under curves. Chain rule: d/dx[f(g(x))] = f'(g(x)) × g'(x)."
        ]
      },
      "science": {
        keywords: ["physics", "chemistry", "biology", "science", "quantum", "atom", "molecule"],
        responses: [
          "**Physics**: F = ma (Newton's 2nd law). E = mc² (Einstein's mass-energy equivalence). Light travels at 299,792,458 m/s in vacuum.",
          "**Chemistry**: Periodic table organizes elements. Chemical bonds: ionic (electron transfer) and covalent (electron sharing). pH measures acidity (0-14).",
          "**Biology**: DNA carries genetic information. Cells are life's basic units. Evolution occurs through natural selection over generations.",
          "**Quantum**: Particles exhibit wave-particle duality. Heisenberg uncertainty principle. Quantum entanglement connects particles across distances."
        ]
      },
      "ai": {
        keywords: ["artificial intelligence", "machine learning", "neural network", "deep learning", "ai model"],
        responses: [
          "**AI Fundamentals**: Machine Learning learns from data. Deep Learning uses neural networks with multiple layers. Supervised learning uses labeled data, unsupervised finds patterns.",
          "**Neural Networks**: Inspired by brain neurons. Input layer → Hidden layers → Output layer. Backpropagation adjusts weights. Activation functions add non-linearity.",
          "**Training**: Split data into train/validation/test sets. Use loss functions to measure error. Optimize with gradient descent. Prevent overfitting with regularization.",
          "**Applications**: Computer vision (image recognition), NLP (language understanding), recommendation systems, autonomous vehicles, and chatbots like me!"
        ]
      },
      "nexchat": {
        keywords: ["nexchat", "this app", "this application", "chat app"],
        responses: [
          "**NEXCHAT**: A powerful Progressive Web App built with Firebase, featuring real-time messaging, group chats, status updates, and me - CHRONEX AI! Created by DEMON ALEX.",
          "**Features**: End-to-end encryption, file sharing, voice messages, polls, status updates, token system, marketplace, gaming hub, and advanced AI assistance.",
          "**Technology**: Built with vanilla JavaScript, Firebase Firestore for data, Firebase Auth for security, and hybrid AI (Python + JavaScript) for intelligence.",
          "**PWA**: Works offline, installable on any device, fast loading, push notifications, and native app-like experience without app stores!"
        ]
      }
    };

    // ============ INTELLIGENT PATTERN MATCHING ============

    // Check comprehensive knowledge base
    for (const [topic, data] of Object.entries(knowledgeBase)) {
      if (data.keywords.some(k => msg.includes(k))) {
        const response = data.responses[Math.floor(Math.random() * data.responses.length)];
        this.lastResponses.push(response);
        return response;
      }
    }

    // ============ IDENTITY & CAPABILITIES ============
    if (msg.includes("who are you") || msg.includes("what are you") || msg.includes("introduce yourself")) {
      return "I am **CHRONEX AI v2.0** - an advanced AI assistant created by **DEMON ALEX**. I run on a hybrid architecture combining Python neural networks with JavaScript processing. I can help with programming, mathematics, science, web development, and much more! 🧠✨";
    }

    if (msg.includes("what can you do") || msg.includes("your capabilities") || msg.includes("help me")) {
      return "**My Capabilities**:\n• 💻 Programming help (JavaScript, Python, C++, Java, etc.)\n• 🧮 Math & calculations\n• 🔬 Science explanations\n• 🌐 Web development guidance\n• 🤖 AI/ML concepts\n• 📊 Data analysis\n• 💡 Problem solving\n• 🎓 Learning assistance\n\nCreated by **DEMON ALEX** to be your intelligent companion!";
    }

    // ============ ADVANCED REASONING ============
    if (msg.includes("why") || msg.includes("because") || msg.includes("reason")) {
      return "Great question! Understanding causality is key to learning. The 'why' helps us grasp underlying principles. Can you provide more context about what you'd like to understand? I'm here to explain! 🤔";
    }

    if (msg.includes("how") || msg.includes("explain")) {
      return "I'd be happy to explain! To give you the best answer, could you be more specific? For example:\n• How does [technology] work?\n• How to solve [problem]?\n• How to implement [feature]?\n\nThe more details you provide, the better I can help! 💡";
    }

    // ============ PROBLEM SOLVING ============
    if (msg.includes("error") || msg.includes("bug") || msg.includes("not working") || msg.includes("broken")) {
      return "**Debugging Mode Activated** 🔧\n\n1. Check console for error messages\n2. Verify syntax and logic\n3. Test with simple inputs first\n4. Use console.log() to trace execution\n5. Check variable types and values\n\nShare the error message or code snippet, and I'll help you fix it!";
    }

    if (msg.includes("best practice") || msg.includes("optimize") || msg.includes("improve")) {
      return "**Optimization Tips**:\n• Write clean, readable code\n• Use meaningful variable names\n• Avoid premature optimization\n• Profile before optimizing\n• Comment complex logic\n• Follow language conventions\n• Test thoroughly\n• Keep it simple (KISS principle)\n\nWhat specific area would you like to optimize?";
    }

    // ============ LEARNING & EDUCATION ============
    if (msg.includes("learn") || msg.includes("tutorial") || msg.includes("teach")) {
      return "**Learning Path** 📚\n\n1. Start with fundamentals\n2. Practice with small projects\n3. Read documentation\n4. Build real applications\n5. Learn from mistakes\n6. Join communities\n7. Keep coding daily\n\nWhat topic would you like to learn? I can guide you through it!";
    }

    // ============ CODE-RELATED QUERIES ============
    if (msg.includes("code") || msg.includes("program") || msg.includes("function") || msg.includes("algorithm")) {
      return "**Coding Assistance** 💻\n\nI can help with:\n• Writing functions and algorithms\n• Code review and optimization\n• Debugging and error fixing\n• Best practices and patterns\n• Language-specific features\n\nShare your code or describe what you're trying to build, and I'll assist you!";
    }

    // ============ GREETINGS ============
    if (msg.includes("hello") || msg.includes("hi ") || msg.includes("hey") || msg.includes("greetings")) {
      const greetings = [
        "Hello! 👋 I'm CHRONEX AI, created by DEMON ALEX. How can I help you today?",
        "Hey there! 🌟 Ready to solve some problems together?",
        "Greetings! 🤖 I'm CHRONEX AI - your intelligent assistant. What's on your mind?",
        "Hi! 💡 Ask me anything about programming, math, science, or technology!"
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    // ============ GRATITUDE ============
    if (msg.includes("thank") || msg.includes("thanks") || msg.includes("appreciate")) {
      return "You're very welcome! 😊 I'm here anytime you need help. Created by DEMON ALEX to assist you! Feel free to ask more questions!";
    }

    // ============ CONTEXT-AWARE FALLBACK ============
    if (this.conversationHistory.length > 2) {
      return "I'm listening and learning from our conversation! 🧠 To unlock my **full potential** with advanced neural processing, make sure `CHRONEX-AI.py` is running. Currently in Enhanced Local Mode.\n\nCreated by **DEMON ALEX** - CREATOR OF CHRONEX AI\n\nCan you provide more details about what you need help with?";
    }

    // ============ DEFAULT INTELLIGENT RESPONSE ============
    return "**CHRONEX AI v2.0** - Created by **DEMON ALEX** 🚀\n\nI'm here to help! I can assist with:\n• Programming & Development\n• Mathematics & Calculations\n• Science & Technology\n• Problem Solving\n• Learning & Education\n\n💡 **Pro Tip**: For even smarter responses with advanced neural processing, run `CHRONEX-AI.py` in your terminal!\n\nWhat would you like to know?";
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
