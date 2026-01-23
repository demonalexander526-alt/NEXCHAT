const CHRONEX_PARAMETERS = {
  languages: [
    "JavaScript",
    "Python", 
    "C++",
    "C",
    "C#",
    "Java",
    "Go",
    "Rust",
    "TypeScript",
    "Swift",
    "Kotlin",
    "PHP"
  ],

  model: {
    temperature: 0.7,
    maxTokens: 2000,
    topP: 0.9,
    frequencyPenalty: 0.6,
    presencePenalty: 0.6,
  },

  features: {
    codeAnalysis: true,
    mathSolving: true,
    dataAnalysis: true,
    multilanguage: true,
    streaming: true,
    caching: true,
  },

  safety: {
    contentModeration: true,
    contentFilter: true,
    reportThreshold: 0.8,
  },

  cache: {
    enabled: true,
    duration: 3600,
    maxSize: 100,
  },

  timeouts: {
    javascript: 5000,
    python: 30000,
    cpp: 20000,
    csharp: 25000,
  },
};

const USAGE_EXAMPLES = ``;

const API_ENDPOINTS = `
POST /api/chronex/chat
{
  "message": "Your question here",
  "temperature": 0.7,
  "max_tokens": 2000,
  "history": []
}

Response:
{
  "success": true,
  "response": "AI response here",
  "model": "Chronex AI v1.0",
  "type": "code|math|question|greeting|general",
  "history": []
}

---

POST /api/chronex/analyze-code
{
  "code": "function example() {}",
  "language": "JavaScript"
}

---

POST /api/chronex/solve-math
{
  "problem": "Solve x + 5 = 12"
}

---

GET /api/chronex/status
Returns: { status, model, version, capabilities }

---

GET /api/chronex/config
Returns: { model, capabilities, backends }
`;

export { CHRONEX_PARAMETERS };
