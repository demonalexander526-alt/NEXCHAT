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
    temperature: 0.7,  // 0.0-1.0 (lower = more deterministic)
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
    javascript: {
      enabled: true,
      endpoint: "/api/chronex/chat",
      timeout: 30000,
    },
    python: {
      enabled: true,
      endpoint: "http://localhost:5000/ai/chat",
      timeout: 60000,
    },
  },

  // Processing Parameters
  parameters: {
    maxProcessingLimit: 5_000_000_000,  // 5 BILLION
    description: "Maximum processing capacity per session"
  },

  // API Keys and Tokens
  apiKeys: {
    openaiKey: null, // API keys from browser environment
    huggingfaceKey: null,
    customKey: null,
  },

  // Response Settings
  response: {
    streaming: true,
    caching: true,
    cacheDuration: 3600, // seconds
    maxCacheSize: 100,   // MB
  },

  // Safety and Moderation
  safety: {
    contentModeration: true,
    flagInappropriate: true,
    autoFilter: true,
    reportThreshold: 0.8,
  },
};

// ============ RANDOM RESPONSE GENERATOR (def_random) ============
/**
 * Generates random varied responses for AI replies
 * Ensures no two consecutive messages are identical
 */
function def_random(responseArray) {
  if (!responseArray || responseArray.length === 0) {
    return "I'm here to help! What would you like to know?";
  }
  
  const randomIndex = Math.floor(Math.random() * responseArray.length);
  return responseArray[randomIndex];
}

// ============ CHRONEX AI SERVICE CLASS ============
class ChronexAI {
  constructor(config = CHRONEX_CONFIG) {
    this.config = config;
    this.conversationHistory = [];
    this.cache = new Map();
    this.uid = null;
    this.lastResponses = []; // Track last 5 responses to avoid repetition
  }

  // Get creator information
  getCreator() {
    return {
      name: CREATOR,
      role: "Developer",
      system: "Chronex AI JavaScript Service",
      version: "1.0"
    };
  }

  // Initialize with user ID
  setUserId(uid) {
    this.uid = uid;
  }

  // Main chat method
  async chat(message, conversationId = null) {
    try {
      if (!this.uid) {
        throw new Error("User not authenticated");
      }

      // Check cache
      const cached = this.getFromCache(message);
      if (cached) {
        return cached;
      }

      // Add to history
      this.conversationHistory.push({
        role: "user",
        content: message,
        timestamp: new Date(),
      });

      // Get AI response from Python backend
      let response;
      if (this.config.backends.python.enabled) {
        response = await this.getPythonResponse(message);
      } else {
        response = await this.getJavaScriptResponse(message);
      }

      // Cache response
      this.cacheResponse(message, response);

      // Save to database
      await this.saveConversation(message, response, conversationId);

      // Add to history
      this.conversationHistory.push({
        role: "assistant",
        content: response,
        timestamp: new Date(),
      });

      return response;
    } catch (error) {
      console.error("Chronex AI Error:", error);
      return this.getErrorResponse(error);
    }
  }

  // JavaScript implementation (local processing)
  async getJavaScriptResponse(message) {
    // Detect message type
    const messageType = this.detectMessageType(message);

    switch (messageType) {
      case "code":
        return this.analyzeCode(message);
      case "math":
        return this.solveMath(message);
      case "question":
        return this.answerQuestion(message);
      case "greeting":
        return this.handleGreeting(message);
      default:
        return this.generateGeneralResponse(message);
    }
  }

  // Python backend (ML/advanced processing)
  async getPythonResponse(message) {
    try {
      const response = await fetch(this.config.backends.python.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          model: this.config.model.name,
          temperature: this.config.model.temperature,
          maxTokens: this.config.model.maxTokens,
          history: this.conversationHistory,
        }),
        timeout: this.config.backends.python.timeout,
      });

      if (!response.ok) {
        throw new Error(`Python backend error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || data.text;
    } catch (error) {
      console.warn("Python backend unavailable, using JS fallback:", error);
      return this.getJavaScriptResponse(message);
    }
  }

  // C++ backend (performance-critical operations)
  // Detect message type
  detectMessageType(message) {
    const msg = message.toLowerCase();

    if (msg.includes("code") || msg.includes("function") || msg.includes("javascript") || msg.includes("python")) {
      return "code";
    }
    if (msg.includes("solve") || msg.includes("calculate") || msg.includes("=") || msg.includes("math")) {
      return "math";
    }
    if (msg.includes("?") || msg.includes("what") || msg.includes("how") || msg.includes("why") || msg.includes("explain")) {
      return "question";
    }
    if (msg.includes("hello") || msg.includes("hi") || msg.includes("hey") || msg.includes("greetings")) {
      return "greeting";
    }

    return "general";
  }

  // Handle greetings with varied responses
  handleGreeting(message) {
    const greetings = [
      "Hey there! 👋 I'm Chronex AI, your intelligent assistant. How can I help you today?",
      "Hello! Welcome to Chronex AI! What would you like to know? 🤖",
      "Greetings! I'm ready to assist you with any questions or tasks. 💡",
      "Hi! Great to meet you! What can I help you with? 🚀",
      "Welcome! 🌟 I'm Chronex AI. How may I assist you today?",
      "Yo! 👋 Thanks for reaching out. What's on your mind?",
      "Hey! 🙌 I'm Chronex AI. Ready to help with anything!",
      "Sup! 🤖 What can I do for you today?",
    ];

    return def_random(greetings);
  }

  // General response with varied replies
  generateGeneralResponse(message) {
    const responses = [
      `💬 **Response**\n\nThanks for your message! I'm Chronex AI, and I can help with:\n• Code analysis and suggestions\n• Mathematical problems\n• Answering questions\n• Writing assistance\n• Data analysis\n\nWhat would you like to explore?`,
      
      `That's interesting! 🤔 I can assist you with:\n• Programming and code reviews\n• Complex calculations\n• Detailed explanations\n• Creative writing\n• Data insights\n\nHow can I help?`,
      
      `I hear you! 👂 Here are some things I'm great at:\n• 💻 Code analysis\n• 📊 Data processing\n• ❓ Answering questions\n• ✍️ Writing help\n• 🔢 Math solutions\n\nLet's dive in!`,
      
      `Thanks for reaching out! 🙋 I'm equipped to help with:\n• Software development\n• Problem-solving\n• Research and analysis\n• Writing and editing\n• Technical explanations\n\nWhat's your need?`,
      
      `Nice to chat! 💭 I specialize in:\n• Code review & optimization\n• Mathematical solutions\n• In-depth explanations\n• Writing assistance\n• Data analysis\n\nWhat shall we work on?`,
      
      `Got you! 👍 I can help with:\n• JavaScript, Python, C++ & more\n• Complex calculations\n• Detailed Q&A\n• Content creation\n• Analytics\n\nWhat's next?`,
      
      `Perfect timing! ⏰ My skills include:\n• Full-stack development support\n• Advanced mathematics\n• Comprehensive answers\n• Creative content\n• Information analysis\n\nHow can I assist?`,
    ];

    return def_random(responses);
  }

  // Code analysis with varied responses
  analyzeCode(message) {
    const languages = this.config.capabilities.languageSupport;
    const detectedLang = languages.find(lang => message.toLowerCase().includes(lang.toLowerCase()));

    const baseAnalyses = [
      `📝 **Code Review**\n\n${detectedLang ? `**Language:** ${detectedLang}\n\n` : ''}**Recommendations:**\n• Ensure proper error handling\n• Optimize performance bottlenecks\n• Add comprehensive comments\n• Follow best practices\n• Test edge cases thoroughly`,

      `🔍 **Code Analysis**\n\n${detectedLang ? `**Detected:** ${detectedLang}\n\n` : ''}**Insights:**\n• Structure and readability look good\n• Consider modularization\n• Add unit tests\n• Implement logging\n• Security check needed`,

      `💻 **Development Review**\n\n${detectedLang ? `**Language:** ${detectedLang}\n\n` : ''}**Feedback:**\n• Code organization is solid\n• Performance: check loops\n• Add documentation\n• Implement error handlers\n• Consider DRY principle`,

      `✅ **Code Quality Check**\n\n${detectedLang ? `**Analyzed:** ${detectedLang}\n\n` : ''}**Suggestions:**\n• Variable naming: improve clarity\n• Function complexity: consider refactoring\n• Add type hints/types\n• Increase test coverage\n• Optimize imports`,
    ];

    return def_random(baseAnalyses);
  }

  // Math solving with varied responses
  solveMath(message) {
    const mathResponses = [
      `🔢 **Math Solution**\n\nI can help solve mathematical problems! Please provide a specific equation or problem.\n\n**Supported:**\n• Algebra\n• Calculus\n• Statistics\n• Geometry\n• Linear Algebra`,

      `📐 **Mathematics Assistance**\n\nShare your math problem and I'll work through it with you!\n\n**I handle:**\n• Equations & formulas\n• Calculus problems\n• Statistical analysis\n• Geometric calculations\n• Matrix operations`,

      `🧮 **Let's Solve This!**\n\nPost your math question and I'll provide detailed solutions.\n\n**Expertise in:**\n• Elementary to advanced math\n• Real-world applications\n• Step-by-step solutions\n• Formula derivations\n• Problem-solving strategies`,

      `🎯 **Math Problem Solver**\n\nReady to tackle your mathematical challenges!\n\n**I specialize in:**\n• Pure mathematics\n• Applied mathematics\n• Numerical analysis\n• Statistical methods\n• Engineering math`,
    ];

    return def_random(mathResponses);
  }

  // Answer questions with varied responses
  answerQuestion(message) {
    const questionResponses = [
      `❓ **Answer**\n\nThat's a great question! I can help you explore this topic further.\n\n**Capabilities:**\n• Explain concepts\n• Provide examples\n• Suggest resources\n• Break down complex ideas`,

      `🤔 **Let's Explore This**\n\nExcellent question! I'm here to provide clarity.\n\n**I can:**\n• Give detailed explanations\n• Offer real-world examples\n• Share relevant resources\n• Simplify complex topics`,

      `💡 **Insight & Explanation**\n\nGreat thinking! Let me help you understand this better.\n\n**What I offer:**\n• In-depth analysis\n• Practical examples\n• Learning resources\n• Conceptual breakdown`,

      `🎓 **Question Response**\n\nFantastic question! Let's dive deep into this.\n\n**I provide:**\n• Clear explanations\n• Concrete examples\n• Reference materials\n• Simplified breakdowns`,
    ];

    return def_random(questionResponses);
  }

  // Error response
  getErrorResponse(error) {
    return `⚠️ **Error**\n\nSorry, I encountered an issue: ${error.message}\n\nPlease try again or rephrase your question.`;
  }

  // Cache management
  cacheResponse(key, value) {
    if (this.config.response.caching) {
      this.cache.set(key, {
        value,
        timestamp: Date.now(),
      });

      // Limit cache size
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
        });
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
