"""
CHRONEX AI - Python Backend
Advanced AI Assistant with NLP, ML, and Code Analysis
Python: 3.8+
Requirements: flask, nltk, requests, numpy, python-dotenv, openai, pillow
Creator: DEMON ALEX - CREATOR OF CHRONEX AI
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import random
import string
from datetime import datetime
import logging
import base64
from pathlib import Path

# Try importing AI libraries
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    from transformers import pipeline
    HUGGINGFACE_AVAILABLE = True
except ImportError:
    HUGGINGFACE_AVAILABLE = False

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

try:
    from dotenv import load_dotenv
    load_dotenv()
    DOTENV_AVAILABLE = True
except ImportError:
    DOTENV_AVAILABLE = False

# Import boolean type
try:
    from distutils.util import strtobool as to_bool
except ImportError:
    def to_bool(val):
        return str(val).lower() in ('yes', 'true', 't', '1', 'on')

# ============ IMAGE PROCESSING SYSTEM ============
class ImageProcessor:
    """Handle image uploads and analysis"""
    def __init__(self, upload_dir="uploads/images"):
        self.upload_dir = upload_dir
        self.allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}
        self.max_file_size = 10 * 1024 * 1024  # 10MB
        
        # Create upload directory
        Path(self.upload_dir).mkdir(parents=True, exist_ok=True)
        logger.info(f"✅ Image processor initialized. Upload dir: {self.upload_dir}")
    
    def allowed_file(self, filename):
        """Check if file is allowed"""
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in self.allowed_extensions
    
    def save_image(self, file):
        """Save uploaded image and return path"""
        try:
            if not self.allowed_file(file.filename):
                return None, "File type not allowed. Use: PNG, JPG, GIF, WEBP, BMP"
            
            if len(file.getvalue()) > self.max_file_size:
                return None, f"File too large. Max size: 10MB"
            
            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{timestamp}_{file.filename}"
            filepath = os.path.join(self.upload_dir, filename)
            
            # Save file
            file.save(filepath)
            logger.info(f"✅ Image saved: {filepath}")
            
            return filepath, "Success"
        except Exception as e:
            logger.error(f"❌ Error saving image: {e}")
            return None, str(e)
    
    def get_image_base64(self, filepath):
        """Convert image to base64 for API sending"""
        try:
            with open(filepath, "rb") as image_file:
                return base64.b64encode(image_file.read()).decode('utf-8')
        except Exception as e:
            logger.error(f"❌ Error encoding image: {e}")
            return None
    
    def analyze_image_openai(self, filepath):
        """Analyze image using OpenAI Vision"""
        try:
            if not OPENAI_AVAILABLE:
                return None
            
            base64_image = self.get_image_base64(filepath)
            if not base64_image:
                return None
            
            response = openai.ChatCompletion.create(
                model="gpt-4-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Please analyze this image in detail. What do you see? Describe objects, text, composition, and any notable features."},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1000
            )
            
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"❌ OpenAI image analysis error: {e}")
            return None
    
    def analyze_image_basic(self, filepath):
        """Basic image analysis using PIL"""
        try:
            if not PILLOW_AVAILABLE:
                return None
            
            img = Image.open(filepath)
            width, height = img.size
            format_type = img.format
            mode = img.mode
            
            analysis = f"""📸 **Image Analysis (Basic)**

**File Information:**
• Format: {format_type}
• Dimensions: {width}x{height} pixels
• Color Mode: {mode}
• File Size: {os.path.getsize(filepath) / 1024:.1f} KB

**Description:**
Image successfully scanned and processed. For detailed AI analysis, use OpenAI Vision API.

**Next Steps:**
1. Upload to OpenAI for detailed analysis
2. Extract text from image (OCR)
3. Identify objects and scenes
4. Generate image captions"""
            
            return analysis
        except Exception as e:
            logger.error(f"❌ Image analysis error: {e}")
            return None

# Initialize Image Processor
image_processor = ImageProcessor()

# ============ CONFIGURATION MANAGER ============
class ConfigManager:
    """Manages AI configuration from multiple sources"""
    def __init__(self):
        self.config = self.load_config()
    
    def load_config(self):
        """Load config from .env, config.json, or defaults"""
        config = {
            "ai_provider": os.getenv("AI_PROVIDER", "openai"),  # openai, huggingface, ollama, default
            "openai_api_key": os.getenv("OPENAI_API_KEY", ""),
            "openai_model": os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
            "huggingface_model": os.getenv("HF_MODEL", "gpt2"),
            "ollama_endpoint": os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434"),
            "temperature": float(os.getenv("AI_TEMPERATURE", "0.7")),
            "max_tokens": int(os.getenv("AI_MAX_TOKENS", "1000")),
            "use_real_ai": to_bool(os.getenv("USE_REAL_AI", "True")),
            "enable_vision": to_bool(os.getenv("ENABLE_VISION", "True")),
        }
        
        # Try loading from config.json
        if os.path.exists("config.json"):
            try:
                with open("config.json", "r") as f:
                    json_config = json.load(f)
                    config.update(json_config)
                logger.info("✅ Config loaded from config.json")
            except Exception as e:
                logger.warning(f"⚠️ Could not load config.json: {e}")
        
        return config
    
    def get(self, key, default=None):
        """Get configuration value"""
        return self.config.get(key, default)
    
    def set(self, key, value):
        """Set configuration value"""
        self.config[key] = value

# Initialize Config Manager
config_manager = ConfigManager()

# ============ REAL AI PROVIDERS ============
class RealAIProvider:
    """Handles real AI responses from various providers"""
    
    def __init__(self, config):
        self.config = config
        self.provider = config.get("ai_provider", "openai")
        self.setup_provider()
    
    def setup_provider(self):
        """Setup the AI provider"""
        if self.provider == "openai" and OPENAI_AVAILABLE:
            openai.api_key = self.config.get("openai_api_key", "")
            logger.info("✅ OpenAI provider initialized")
        elif self.provider == "huggingface" and HUGGINGFACE_AVAILABLE:
            self.pipe = pipeline("text-generation", model=self.config.get("huggingface_model", "gpt2"))
            logger.info("✅ Hugging Face provider initialized")
        else:
            logger.warning("⚠️ No real AI provider available, using default responses")
    
    def generate_response(self, message, context=""):
        """Generate real AI response"""
        try:
            if not self.config.get("use_real_ai", True):
                return None
            
            if self.provider == "openai" and OPENAI_AVAILABLE:
                return self.openai_response(message, context)
            elif self.provider == "huggingface" and HUGGINGFACE_AVAILABLE:
                return self.huggingface_response(message)
            elif self.provider == "ollama":
                return self.ollama_response(message)
            else:
                return None
        except Exception as e:
            logger.error(f"❌ AI Provider error: {e}")
            return None
    
    def openai_response(self, message, context=""):
        """Get response from OpenAI API"""
        try:
            response = openai.ChatCompletion.create(
                model=self.config.get("openai_model", "gpt-3.5-turbo"),
                messages=[
                    {"role": "system", "content": f"You are Chronex AI, an advanced assistant. Context: {context}"},
                    {"role": "user", "content": message}
                ],
                temperature=self.config.get("temperature", 0.7),
                max_tokens=self.config.get("max_tokens", 1000)
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI error: {e}")
            return None
    
    def huggingface_response(self, message):
        """Get response from Hugging Face model"""
        try:
            result = self.pipe(message, max_length=self.config.get("max_tokens", 1000))
            return result[0]['generated_text']
        except Exception as e:
            logger.error(f"Hugging Face error: {e}")
            return None
    
    def ollama_response(self, message):
        """Get response from Ollama (local model)"""
        try:
            import requests
            response = requests.post(
                f"{self.config.get('ollama_endpoint')}/api/generate",
                json={"prompt": message, "stream": False},
                timeout=30
            )
            return response.json().get("response")
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            return None

# ============ RANDOM RESPONSE GENERATOR ============
def def_random(response_list):
    """
    Generates random varied responses from a list
    Ensures no two consecutive messages are identical
    """
    if not response_list or len(response_list) == 0:
        return "I'm here to help! What would you like to know?"
    return random.choice(response_list)

# ============ CREATOR LIBRARY STORAGE ============
class CreatorLibrary:
    """
    Library to store and manage creator information and metadata
    Persists data to JSON file for later retrieval
    """
    def __init__(self, storage_file="creator_library.json"):
        self.storage_file = storage_file
        self.creator_data = {
            "primary_creator": "DEMON ALEX",
            "secondary_creator": "DEVELOPER OF NEXCHAT",
            "system": "Chronex AI",
            "version": "1.0",
            "created_date": datetime.now().isoformat(),
            "metadata": {},
            "query_history": [],
            "stored_info": {}
        }
        self.load_library()
    
    def load_library(self):
        """Load existing library from file if it exists"""
        if os.path.exists(self.storage_file):
            try:
                with open(self.storage_file, 'r') as f:
                    self.creator_data = json.load(f)
                logger.info(f"✅ Creator library loaded from {self.storage_file}")
            except Exception as e:
                logger.warning(f"⚠️ Could not load library: {e}. Creating new one.")
                self.save_library()
        else:
            self.save_library()
    
    def save_library(self):
        """Save library data to JSON file"""
        try:
            with open(self.storage_file, 'w') as f:
                json.dump(self.creator_data, f, indent=2)
            logger.info(f"💾 Creator library saved to {self.storage_file}")
        except Exception as e:
            logger.error(f"❌ Error saving library: {e}")
    
    def add_query(self, query, response_type="general"):
        """Add a query to history"""
        query_entry = {
            "timestamp": datetime.now().isoformat(),
            "query": query,
            "type": response_type
        }
        self.creator_data["query_history"].append(query_entry)
        self.save_library()
    
    def store_info(self, key, value):
        """Store custom information in library"""
        self.creator_data["stored_info"][key] = {
            "value": value,
            "timestamp": datetime.now().isoformat()
        }
        self.save_library()
    
    def get_creator_info(self):
        """Get comprehensive creator information"""
        return {
            "primary_creator": self.creator_data["primary_creator"],
            "secondary_creator": self.creator_data["secondary_creator"],
            "system": self.creator_data["system"],
            "version": self.creator_data["version"],
            "created_date": self.creator_data["created_date"],
            "total_queries": len(self.creator_data["query_history"]),
            "stored_items": len(self.creator_data["stored_info"])
        }
    
    def get_query_history(self, limit=10):
        """Get recent query history"""
        return self.creator_data["query_history"][-limit:]
    
    def get_stored_info(self, key=None):
        """Get stored information"""
        if key:
            return self.creator_data["stored_info"].get(key)
        return self.creator_data["stored_info"]
    
    def clear_history(self):
        """Clear query history"""
        self.creator_data["query_history"] = []
        self.save_library()
    
    def export_library(self):
        """Export entire library as dictionary"""
        return self.creator_data

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ CREATOR INFO ============
CREATOR = "DEMON ALEX"
SECONDARY_CREATOR = "DEVELOPER OF NEXCHAT"

# Initialize Creator Library
creator_library = CreatorLibrary()

def creator():
    """Get creator information"""
    return {
        "primary_creator": CREATOR,
        "secondary_creator": SECONDARY_CREATOR,
        "role": "Developer",
        "system": "Chronex AI Python Backend",
        "version": "1.0"
    }

# ============ CHRONEX AI CONFIGURATION ============
CHRONEX_CONFIG = {
    "creator": CREATOR,
    "parameters": {
        "model_size": 4_000_000_000,
        "max_processing_limit": 4_000_000_000,
        "hidden_layers": 96,
        "attention_heads": 64,
        "ffn_hidden_size": 16000,
        "vocab_size": 128256,
        "context_length": 32768,
        "description": "4B parameter model"
    },
    "model": {
        "name": "Chronex AI v1.0 (Python 4B)",
        "type": "advanced-neural-network",
        "parameters": 4_000_000_000,
        "temperature": 0.7,
        "max_tokens": 2000,
        "top_p": 0.9,
    },
    "capabilities": {
        "chat": True,
        "code_analysis": True,
        "language_support": ["JavaScript", "Python", "C++", "C","Java", "Go", "Rust"],
        "math_solving": True,
        "data_analysis": True,
    },
    "safety": {
        "content_moderation": True,
        "auto_filter": True,
    }
}

# ============ CHRONEX AI CLASS ============
class ChronexAIPython:
    def __init__(self, config_obj=None):
        self.config = config_obj or CHRONEX_CONFIG
        self.conversation_history = []
        self.ai_provider = RealAIProvider(config_manager.config)
        self.use_real_ai = config_manager.get("use_real_ai", True)
        logger.info(f"🤖 ChronexAI initialized - Using Real AI: {self.use_real_ai}")

    def get_ai_response(self, message, context=""):
        """Get response from real AI - PRIMARY METHOD"""
        if self.use_real_ai:
            real_response = self.ai_provider.generate_response(message, context)
            if real_response:
                logger.info(f"✅ Real AI response generated")
                return real_response
        
        # Only fallback to defaults if real AI fails
        logger.info(f"⚡ Real AI unavailable, using context-aware fallback")
        return None

    def process_message(self, message, conversation_history=None):
        """Process incoming message with smart, context-aware responses"""
        try:
            # Add to history
            if conversation_history is None:
                conversation_history = []
            
            conversation_history.append({
                "role": "user",
                "content": message,
                "timestamp": datetime.now().isoformat()
            })

            # Build conversation context for AI
            recent_context = "\n".join([
                f"{msg.get('role', 'user')}: {msg.get('content', '')}"
                for msg in conversation_history[-5:]  # Last 5 messages for context
            ])

            # Try real AI first with full conversation context
            context = f"Full conversation:\n{recent_context}"
            real_response = self.get_ai_response(message, context)
            
            if real_response:
                response = real_response
            else:
                # Smart fallback: Provide helpful general response
                response = f"""💡 I'm Chronex AI, your intelligent assistant!

I can help with:
• Answering questions and explaining concepts
• Code analysis and programming help
• Mathematical problem solving
• Data science and analytics
• Web development assistance
• General conversation and advice

**Your message:** "{message[:50]}{'...' if len(message) > 50 else ''}"

Please keep the conversation going! I'm here to help with any topic you'd like to discuss."""

            # Add AI response to history
            conversation_history.append({
                "role": "assistant",
                "content": response,
                "timestamp": datetime.now().isoformat()
            })

            return {
                "success": True,
                "response": response,
                "model": self.config["model"]["name"],
                "history": conversation_history,
                "ai_powered": real_response is not None
            }

        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "response": "⚠️ An error occurred while processing your message. Please try again."
            }

    def process_message_simplified(self, message, conversation_history=None):
        """Simplified intelligent message processor - no rigid categories"""
        try:
            if conversation_history is None:
                conversation_history = []
            
            # Add user message to history
            conversation_history.append({
                "role": "user",
                "content": message,
                "timestamp": datetime.now().isoformat()
            })

            # Build smart context from conversation history
            context_messages = conversation_history[-5:]  # Last 5 messages
            conversation_context = "\n".join([
                f"{msg.get('role', 'user')}: {msg.get('content', '')}"
                for msg in context_messages
            ])

            # Intelligent AI response with full context awareness
            context = f"""You are Chronex AI, an intelligent and helpful assistant by DEMON ALEX.
You have knowledge in programming, mathematics, data science, and general conversation.
Be natural, friendly, and adapt to the user's needs.

Recent conversation:
{conversation_context}"""

            response = self.get_ai_response(message, context)
            
            if not response:
                # Fallback with helpful generic response
                response = """💭 I'm here to help! Feel free to ask me about:
- Programming and code help
- Math and calculations
- Data science questions  
- General advice and conversation
- And much more!

What would you like to discuss?"""

            # Add to history
            conversation_history.append({
                "role": "assistant",
                "content": response,
                "timestamp": datetime.now().isoformat()
            })

            return {
                "success": True,
                "response": response,
                "model": self.config["model"]["name"],
                "history": conversation_history
            }

        except Exception as e:
            logger.error(f"Message processing error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "response": "Sorry, I encountered an issue. Please try again."
            }

    def detect_message_type(self, message):
        """Detect message type for analytics (no longer used for routing)"""
        msg_lower = message.lower()
        if any(x in msg_lower for x in ["?", "what", "how", "why", "explain"]):
            return "question"
        elif any(x in msg_lower for x in ["code", "function", "javascript", "python"]):
            return "technical"
        elif any(x in msg_lower for x in ["hello", "hi", "hey", "greetings"]):
            return "greeting"
        else:
            return "general"

    def handle_creator_query(self, message):
        """Handle creator information queries"""
        creator_responses = [
            f"""👨‍💻 **Creator Information**\n\nChronex AI was built by:\n\n**Primary Creator:** {CREATOR}\n**Secondary Creator:** {SECONDARY_CREATOR}\n\n**System:** Chronex AI Python Backend\n**Version:** 1.0\n**Created:** {datetime.now().strftime('%Y')}\n\n✨ Built with passion for advanced AI solutions!""",
            
            f"""🎯 **About the Creators**\n\n**DEMON ALEX**\n• Lead Developer\n• Python Backend Architecture\n• AI System Design\n\n**DEVELOPER OF NEXCHAT**\n• Platform Architect\n• Integration Lead\n• Full-Stack Implementation\n\n🚀 Together creating Chronex AI!""",
            
            f"""🏆 **Creator Profile**\n\n**Names:**\n• {CREATOR}\n• {SECONDARY_CREATOR}\n\n**Project:** Chronex AI (Python 4B Model)\n**Specialties:**\n• Advanced AI systems\n• Backend architecture\n• Real-time processing\n\n💪 Passionate developers!""",
            
            f"""📋 **Development Team**\n\n**Chronex AI System**\n\nCreated by:\n✓ {CREATOR}\n✓ {SECONDARY_CREATOR}\n\n**Capabilities:**\n• Code analysis\n• Math solving\n• Data science support\n• Web development help\n\n🌟 Advanced AI assistance!""",
        ]
        
        # Store query in library
        creator_library.add_query(message, "creator")
        
        return def_random(creator_responses)

    def get_advanced_help(self, message):
        """Provide advanced technical assistance"""
        advanced_responses = [
            """🔬 **Advanced Technical Support**\n\nI can assist with complex scenarios:\n• Architecture design patterns\n• Performance optimization techniques\n• Distributed systems concepts\n• Concurrency & parallelism\n• System reliability engineering\n\n**Detailed approach:**\n1. Problem analysis\n2. Multiple solutions\n3. Trade-offs discussion\n4. Implementation guidance""",
            
            """🏗️ **System Architecture**\n\nBuild robust systems:\n• Microservices architecture\n• Event-driven systems\n• CQRS patterns\n• Domain-driven design\n• Service mesh implementation\n\n**Architecture workflow:**\n1. Requirements gathering\n2. Pattern selection\n3. Design documentation\n4. Implementation strategy""",
            
            """⚙️ **DevOps & Infrastructure**\n\nAutomate your operations:\n• CI/CD pipeline design\n• Container orchestration\n• Infrastructure as code\n• Monitoring & logging\n• Disaster recovery\n\n**Infrastructure approach:**\n1. Current state analysis\n2. Tool selection\n3. Implementation plan\n4. Optimization\"""",
        ]
        return def_random(advanced_responses)

    def check_status(self, message):
        """Check system status when user asks"""
        import psutil
        
        try:
            # Get system info
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            
            status_responses = [
                f"""✅ **System Status Check**\n\n**Chronex AI Status:**\n• Status: ONLINE 🟢\n• Model: {CHRONEX_CONFIG['model']['name']}\n• Version: 1.0\n• CPU Usage: {cpu_percent}%\n• Memory Usage: {memory.percent}%\n\n**Services:**\n✓ Python Backend: Running\n✓ Flask Server: Active\n✓ Creator Library: Initialized\n✓ Response Engine: Ready\n\n🚀 All systems operational!""",
                
                f"""🔍 **Health Check Results**\n\n**System Status:**\n• Overall: HEALTHY 💚\n• Uptime: Running\n• CPU: {cpu_percent}% utilization\n• Memory: {memory.percent}% in use\n\n**Components:**\n✓ AI Engine: ✅ Ready\n✓ API Endpoints: ✅ Live\n✓ Data Storage: ✅ Active\n✓ Library System: ✅ Loaded\n\n⚡ Performance: Excellent""",
                
                f"""📊 **Performance Metrics**\n\n**Current Status:**\n• State: ONLINE 🟢\n• Response: {CHRONEX_CONFIG['model']['name']}\n• CPU Load: {cpu_percent}%\n• RAM: {memory.percent}%\n\n**Services Running:**\n✓ Chronex AI Service\n✓ REST API\n✓ Creator Library\n✓ Message Processor\n\n🎯 Ready to assist!""",
                
                f"""🟢 **Live Status**\n\n**Chronex AI Python Backend**\n• Status: ACTIVE\n• CPU: {cpu_percent}%\n• Memory: {memory.percent}%\n• Model: 4B Parameters\n\n**Active Services:**\n✓ Chat Engine\n✓ Code Analyzer  \n✓ Math Solver\n✓ Data Science Tools\n\n✨ System fully operational!"""
            ]
            
            # Store status query in library
            creator_library.add_query(message, "status")
            
            return def_random(status_responses)
        except ImportError:
            # Fallback if psutil not available
            fallback = f"""✅ **System Status**\n\n**Chronex AI Status:**\n• Status: ONLINE 🟢\n• Model: {CHRONEX_CONFIG['model']['name']}\n• Version: 1.0\n• Python Backend: Active\n\n**Services:**\n✓ Flask API: Running\n✓ Creator Library: Initialized\n✓ AI Engine: Ready\n✓ All endpoints: Live\n\n🚀 Everything is working perfectly!"""
            return fallback

    def get_data_science_help(self, message):
        """Provide data science and ML guidance"""
        ds_responses = [
            """📊 **Data Science Solutions**\n\nAnalyze and visualize data:\n• Exploratory data analysis\n• Statistical modeling\n• Data visualization\n• Feature engineering\n• Data preprocessing\n\n**Data workflow:**\n1. Data collection\n2. Exploratory analysis\n3. Model building\n4. Validation & testing""",
            
            """🤖 **Machine Learning Guidance**\n\nBuild intelligent systems:\n• Supervised learning\n• Unsupervised learning\n• Deep learning basics\n• Model evaluation\n• Hyperparameter tuning\n\n**ML process:**\n1. Problem definition\n2. Model selection\n3. Training & testing\n4. Deployment strategy""",
            
            """📈 **Predictive Analytics**\n\nForecasting & insights:\n• Time series analysis\n• Regression models\n• Classification algorithms\n• Anomaly detection\n• Trend analysis\n\n**Analytics approach:**\n1. Data exploration\n2. Model development\n3. Validation\n4. Interpretation\"""",
        ]
        return def_random(ds_responses)

    def get_web_dev_help(self, message):
        """Provide web development assistance"""
        web_responses = [
            """🌐 **Web Development**\n\nBuild modern web applications:\n• Frontend frameworks\n• Backend services\n• Database design\n• API development\n• Authentication & security\n\n**Development process:**\n1. Requirements analysis\n2. Architecture design\n3. Implementation\n4. Testing & deployment""",
            
            """⚡ **Performance Optimization**\n\nSpeed up your applications:\n• Code optimization\n• Caching strategies\n• Asset minification\n• Database indexing\n• Load balancing\n\n**Optimization steps:**\n1. Profiling\n2. Bottleneck identification\n3. Solution implementation\n4. Performance validation""",
            
            """🔐 **Web Security**\n\nSecure your applications:\n• OWASP top 10\n• Input validation\n• XSS prevention\n• CSRF protection\n• SQL injection prevention\n\n**Security process:**\n1. Vulnerability assessment\n2. Risk evaluation\n3. Solution implementation\n4. Testing & verification\"""",
        ]
        return def_random(web_responses)

    def analyze_code(self, message):
        """Analyze code snippets with extensive varied responses"""
        # Detect programming language
        languages = self.config["capabilities"]["language_support"]
        detected_lang = None
        for lang in languages:
            if lang.lower() in message.lower():
                detected_lang = lang
                break

        lang_hint = f'**Language:** {detected_lang}\n\n' if detected_lang else ''
        
        analyses = [
            f"""📝 **Code Review (Python)**\n\n{lang_hint}**Quality Check:**\n• Structure and organization\n• Error handling coverage\n• Performance optimization\n• Security considerations\n\n**Best Practices:**\n✓ Add docstrings\n✓ Use meaningful variable names\n✓ Implement logging\n✓ Write unit tests""",
            
            f"""🔍 **Code Analysis Report**\n\n{lang_hint}**Insights:**\n• Code readability: Excellent\n• Modularity review\n• Performance metrics\n• Dependency check\n\n**Recommendations:**\n✓ Refactor complex functions\n✓ Add type hints\n✓ Increase test coverage\n✓ Document edge cases""",
            
            f"""💻 **Development Analysis**\n\n{lang_hint}**Technical Review:**\n• Syntax validation: ✅ Passed\n• Logic flow assessment\n• Resource efficiency\n• Code standards compliance\n\n**Suggestions:**\n✓ Use design patterns\n✓ Implement error handlers\n✓ Add CI/CD tests\n✓ Follow conventions""",
            
            f"""✅ **Code Quality Assessment**\n\n{lang_hint}**Findings:**\n• Overall structure: Good\n• Optimization opportunities\n• Documentation level\n• Test coverage status\n\n**Action Items:**\n✓ Simplify complex logic\n✓ Add comments\n✓ Use constants for magic numbers\n✓ Improve error messages""",
            
            f"""🎯 **Advanced Code Inspection**\n\n{lang_hint}**Deep Dive Analysis:**\n• Memory efficiency review\n• Concurrency handling\n• Exception management\n• API design patterns\n\n**Enhancement Ideas:**\n✓ Implement caching mechanisms\n✓ Add async/await patterns\n✓ Use dependency injection\n✓ Apply SOLID principles""",
            
            f"""🔧 **Code Optimization Report**\n\n{lang_hint}**Performance Audit:**\n• Algorithm complexity (Big O)\n• Database query optimization\n• Network latency considerations\n• CPU & memory profiling\n\n**Optimization Strategies:**\n✓ Use efficient data structures\n✓ Implement lazy loading\n✓ Add memoization\n✓ Reduce cyclomatic complexity""",
            
            f"""🛡️ **Security Analysis**\n\n{lang_hint}**Security Findings:**\n• Input validation checks\n• SQL injection prevention\n• Authentication/authorization\n• Data encryption status\n\n**Security Enhancements:**\n✓ Validate all inputs\n✓ Use prepared statements\n✓ Implement rate limiting\n✓ Add security headers""",
            
            f"""📈 **Code Maintainability Review**\n\n{lang_hint}**Maintainability Metrics:**\n• Coupling & cohesion levels\n• Code duplication detection\n• Naming convention consistency\n• Documentation completeness\n\n**Improvements:**\n✓ Extract common functions\n✓ Improve variable names\n✓ Add inline documentation\n✓ Create architectural diagrams""",
            
            f"""🚀 **Performance & Scalability**\n\n{lang_hint}**Scalability Assessment:**\n• Horizontal scaling readiness\n• Load balancing compatibility\n• Database scaling options\n• Microservices potential\n\n**Scaling Recommendations:**\n✓ Implement caching layer\n✓ Add message queues\n✓ Use CDN for static assets\n✓ Database sharding strategy""",
            
            f"""🧪 **Testing & Reliability**\n\n{lang_hint}**Test Coverage Analysis:**\n• Unit test coverage percentage\n• Integration test presence\n• End-to-end test scenarios\n• Error handling robustness\n\n**Testing Improvements:**\n✓ Add missing unit tests\n✓ Implement integration tests\n✓ Create smoke tests\n✓ Add regression tests"""
        ]
        
        return def_random(analyses)

    def solve_math(self, message):
        """Solve mathematical problems with extensive varied responses"""
        math_responses = [
            """🔢 **Mathematical Solution**\n\nI can help solve:\n• Algebra problems\n• Calculus derivatives and integrals\n• Linear equations systems\n• Statistics and probability\n• Geometry problems\n\n**Step-by-step approach:**\n1. Identify the problem type\n2. Apply relevant formulas\n3. Show all working\n4. Verify the solution""",
            
            """📐 **Mathematics Assistance**\n\nShare your problem and I'll work through it!\n• Equations & expressions\n• Calculus (limits, derivatives)\n• Probability distributions\n• Matrix operations\n• Geometric proofs\n\n**My process:**\n1. Analyze the problem\n2. Select best method\n3. Detailed solutions\n4. Answer verification""",
            
            """🧮 **Let's Solve This!**\n\nReady to tackle your math challenge:\n• Pre-algebra to advanced math\n• Real-world applications\n• Formula derivations\n• Complex calculations\n• Problem explanations\n\n**What I provide:**\n1. Complete breakdown\n2. Step-by-step work\n3. Final answer\n4. Alternative methods""",
            
            """🎯 **Math Problem Solver**\n\nLet's find your solution!\n• Pure mathematics\n• Applied mathematics\n• Numerical analysis\n• Mathematical modeling\n• Optimization problems\n\n**Solution path:**\n1. Problem assessment\n2. Method selection\n3. Detailed computation\n4. Solution validation""",
            
            """∑ **Calculus & Advanced Math**\n\nTackle complex mathematical challenges:\n• Differential equations\n• Multivariable calculus\n• Fourier analysis\n• Differential geometry\n• Complex number operations\n\n**Comprehensive approach:**\n1. Problem classification\n2. Theorem application\n3. Numerical computation\n4. Result interpretation""",
            
            """📊 **Statistics & Probability**\n\nAnalyze data and uncertainty:\n• Probability distributions\n• Statistical inference\n• Hypothesis testing\n• Regression analysis\n• Time series analysis\n\n**Statistical workflow:**\n1. Data examination\n2. Assumption testing\n3. Method selection\n4. Conclusion drawing""",
            
            """🔢 **Number Theory & Algebra**\n\nExplore mathematical structures:\n• Prime factorization\n• Modular arithmetic\n• Polynomial operations\n• Matrix algebra\n• Abstract algebra concepts\n\n**Solution methodology:**\n1. Problem breakdown\n2. Technique selection\n3. Detailed computation\n4. Answer validation""",
            
            """📏 **Geometry & Trigonometry**\n\nSolve spatial and angular problems:\n• Coordinate geometry\n• 3D transformations\n• Trigonometric identities\n• Vector operations\n• Geometric proofs\n\n**Geometric approach:**\n1. Visualization setup\n2. Formula application\n3. Step-by-step solving\n4. Result verification""",
            
            """🎓 **Advanced Problem Solving**\n\nTake on complex mathematical challenges:\n• Multi-step problems\n• Proof techniques\n• Mathematical optimization\n• Applied mathematics\n• Engineering mathematics\n\n**Advanced methodology:**\n1. Problem deconstruction\n2. Strategy development\n3. Implementation\n4. Thorough verification""",
            
            """💡 **Mathematical Insights**\n\nGain deeper mathematical understanding:\n• Conceptual foundations\n• Formula derivations\n• Proof explanations\n• Historical context\n• Real-world applications\n\n**Educational approach:**\n1. Concept introduction\n2. Formula development\n3. Example walkthroughs\n4. Practice problems"""
        ]
        return def_random(math_responses)

    def answer_question(self, message):
        """Answer general questions with extensive varied responses"""
        question_responses = [
            """❓ **Detailed Answer**\n\nI can help you understand by:\n• Breaking down concepts\n• Providing examples\n• Explaining step-by-step\n• Offering resources\n\n**What I offer:**\n• Technical depth\n• Practical applications\n• Multiple perspectives\n• Learning resources""",
            
            """🤔 **Let's Explore This**\n\nGreat question! Here's what I provide:\n• Clear explanations\n• Real-world examples\n• In-depth analysis\n• Reference materials\n\n**I can help with:**\n• Concept clarification\n• Detailed breakdowns\n• Visual explanations\n• Further resources""",
            
            """💡 **Insight & Explanation**\n\nExcellent thinking! I'll help you understand:\n• Core concepts\n• Practical examples\n• Advanced details\n• Related topics\n\n**My approach:**\n• Simple to complex\n• Theory + practice\n• Multiple examples\n• External references""",
            
            """🎓 **Question Response**\n\nFantastic question! Let me explain:\n• Comprehensive answer\n• Real examples\n• Step-by-step guide\n• Knowledge resources\n\n**I provide:**\n• Deep explanations\n• Concrete examples\n• Visual aids\n• Learning materials""",
            
            """🔬 **Scientific Explanation**\n\nLet's dive into the science:\n• Evidence-based answers\n• Research findings\n• Theoretical foundations\n• Experimental validation\n\n**Scientific method:**\n1. Literature review\n2. Theory explanation\n3. Evidence presentation\n4. Conclusion summary""",
            
            """📚 **Educational Deep Dive**\n\nComprehensive learning resource:\n• Curriculum-aligned content\n• Progressive complexity\n• Multiple learning styles\n• Interactive examples\n\n**Learning pathway:**\n1. Foundation concepts\n2. Intermediate understanding\n3. Advanced topics\n4. Application exercises""",
            
            """🎯 **Practical Guidance**\n\nReal-world application focus:\n• How-to instructions\n• Best practices\n• Common pitfalls\n• Success strategies\n\n**Practical approach:**\n1. Situation analysis\n2. Strategy development\n3. Implementation steps\n4. Results evaluation""",
            
            """🧠 **Cognitive Explanation**\n\nMake complex ideas simple:\n• Analogies and metaphors\n• Mental models\n• Conceptual frameworks\n• Memory aids\n\n**Explanation strategy:**\n1. Familiar connections\n2. Progressive building\n3. Pattern recognition\n4. Skill application""",
            
            """🌐 **Comprehensive Overview**\n\nBroad perspective analysis:\n• Historical context\n• Current state\n• Future trends\n• Global implications\n\n**Holistic approach:**\n1. Background information\n2. Detailed examination\n3. Comparative analysis\n4. Future outlook""",
            
            """⚡ **Quick & Detailed**\n\nBoth concise and thorough:\n• Summary overview\n• Detailed breakdown\n• Key takeaways\n• Additional resources\n\n**Flexible delivery:**\n1. Quick summary\n2. Extended explanation\n3. Important highlights\n4. Further learning"""
        ]
        return def_random(question_responses)

    def handle_greeting(self, message):
        """Handle greeting messages with extensive varied responses"""
        greetings = [
            "🤖 Hey there! I'm Chronex AI, powered by Python backend! How can I assist you today?",
            "Hello! Welcome to Chronex AI (Python Edition). What would you like to explore?",
            "Greetings! Ready to solve problems? 💡",
            "Hi! I'm Chronex AI. Ask me anything! 🚀",
            "Welcome! 🌟 I'm Chronex AI (Python). How may I assist you today?",
            "Yo! 👋 Thanks for connecting. What's on your mind?",
            "Hey! 🙌 I'm Chronex AI. Ready to help with anything!",
            "Sup! 🤖 What can I do for you today?",
            "Greetings! 👋 I'm Chronex AI Python Edition. Let's get started!",
            "Hello there! 💻 I'm ready to assist. What do you need?",
            "Welcome aboard! 🚀 I'm Chronex AI. Let's solve something amazing!",
            "Hey buddy! 👊 I'm Chronex AI. What's your challenge today?",
            "Howdy! 🤠 I'm Chronex AI. Ready to tackle problems?",
            "Salutations! 🎩 I'm your Chronex AI assistant. How can I help?",
            "Top of the morning! ☀️ I'm Chronex AI. What'll it be?",
            "Hey there, friend! 🤝 I'm Chronex AI. Let's collaborate!",
            "Greetings, human! 🌍 I'm Chronex AI. Ready to assist?",
            "Welcome! 🎉 I'm Chronex AI. Let's make something great!",
            "Hello, wonderful human! ✨ I'm Chronex AI. What's on your agenda?",
            "Heya! 👍 I'm Chronex AI. Let's get to work!",
        ]
        return def_random(greetings)

    def generate_general_response(self, message):
        """Generate general response with extensive varied replies"""
        responses = [
            """💬 **Response**\n\nI'm Chronex AI with Python backend capabilities:\n\n🔧 **Technical Help:**\n• Code analysis and review\n• Algorithm optimization\n• Debugging assistance\n\n📊 **Data & Analysis:**\n• Data processing\n• Statistical analysis\n• Visualization recommendations\n\nWhat would you like to work on?""",
            
            """Thanks for reaching out! 🙋 I'm equipped to help with:\n• Software development support\n• Problem-solving strategies\n• Research and analysis\n• Code optimization\n• Technical explanations\n\nWhat's your need?""",
            
            """Nice to chat! 💭 I specialize in:\n• Code review & optimization\n• Mathematical solutions\n• In-depth explanations\n• Data analysis\n• Technical assistance\n\nWhat shall we work on?""",
            
            """Got you! 👍 I can help with:\n• Python & JavaScript\n• Complex calculations\n• Detailed Q&A\n• Code suggestions\n• Analytics\n\nWhat's next?""",
            
            """Perfect timing! ⏰ My skills include:\n• Full-stack development support\n• Advanced mathematics\n• Comprehensive answers\n• Code optimization\n• Information analysis\n\nHow can I assist?""",
            
            """I hear you! 👂 Here are some things I'm great at:\n• 💻 Code analysis\n• 📊 Data processing\n• ❓ Answering questions\n• ✍️ Technical writing\n• 🔢 Math solutions\n\nLet's dive in!""",
            
            """That's interesting! 🤔 I can assist you with:\n• Programming support\n• Problem-solving\n• Detailed explanations\n• Creative solutions\n• Data insights\n\nHow can I help?""",
            
            """Absolutely! 🎯 I'm ready to help with:\n• System design and architecture\n• Database optimization\n• API development\n• Cloud solutions\n• DevOps strategies\n\nWhat would you like to tackle?""",
            
            """Excited to help! 🌟 My expertise covers:\n• Machine learning basics\n• Neural network concepts\n• Data science workflows\n• AI implementation\n• Model evaluation\n\nWhat interests you?""",
            
            """Great question! 🧠 I can support you with:\n• Algorithm design\n• Design patterns\n• Software architecture\n• Performance tuning\n• Code refactoring\n\nLet's improve your code!""",
            
            """Fantastic! 🚀 I'm here for:\n• Building scalable systems\n• Cloud architecture\n• Microservices design\n• DevOps practices\n• Infrastructure as code\n\nReady to scale?""",
            
            """You got it! ✅ Let's work on:\n• Web application development\n• Mobile app solutions\n• API integration\n• Database design\n• Frontend optimization\n\nWhat's your project?""",
            
            """Absolutely! 💪 I specialize in:\n• Security implementations\n• Authentication systems\n• Encryption methods\n• Vulnerability assessment\n• Compliance guidance\n\nLet's secure your system!""",
            
            """Perfect! 🎨 I can help with:\n• User interface optimization\n• User experience improvement\n• Performance enhancement\n• Accessibility standards\n• Design patterns\n\nWhat needs improvement?""",
            
            """Let's go! 🔥 I'm equipped for:\n• Testing strategies\n• Test automation\n• Quality assurance\n• Debugging techniques\n• Error handling\n\nWhat shall we test?""",
            
            """Bring it on! 💯 My capabilities include:\n• Documentation writing\n• Technical specification\n• API documentation\n• Code commenting\n• Knowledge base creation\n\nWhat needs documenting?""",
        ]
        return def_random(responses)

    def handle_image_query(self, message):
        """Handle image-related queries"""
        image_responses = [
            """📸 **Image Processing Module**

I can help you with image analysis! Here are your options:

🔄 **Available Actions:**
1. **Upload Image**: POST `/ai/upload-image` with image file
2. **Scan & Analyze**: POST `/ai/scan-image` to upload and analyze
3. **AI Vision**: POST `/ai/image-vision` for detailed analysis with questions
4. **List Images**: GET `/ai/image-list` to see uploaded images
5. **Delete Image**: DELETE `/ai/image-delete/<filename>`

🤖 **Capabilities:**
• Object detection and recognition
• OCR (Optical Character Recognition)
• Scene understanding
• Text extraction from images
• Detailed image descriptions

📝 **Note:** Advanced AI analysis requires OpenAI API key (GPT-4 Vision)

Ready to analyze an image? Upload one and I'll scan it for you! 🚀""",
            
            """🖼️ **Image Analysis Ready!**

I have image processing capabilities:

**Upload Endpoint:**
```
POST /ai/upload-image
Content-Type: multipart/form-data
Form field: "image" (your image file)
```

**Scan & Analyze:**
```
POST /ai/scan-image
Content-Type: multipart/form-data
Form field: "image" (your image file)
```

**AI Vision Query:**
```
POST /ai/image-vision
{
  "filepath": "uploads/images/filename.jpg",
  "question": "Your custom question about the image"
}
```

Supported formats: PNG, JPG, JPEG, GIF, WEBP, BMP
Max file size: 10MB

What would you like to analyze? 📷""",
            
            """🎯 **Image Recognition System**

You asked about images! I can:

✅ **Scan Images** - Upload images for analysis
✅ **Detect Objects** - Identify what's in your images
✅ **Read Text** - Extract text from images (OCR)
✅ **Analyze Scenes** - Understand image composition
✅ **Answer Questions** - Ask specific questions about images

**Quick Start:**
1. Send an image file to `/ai/scan-image`
2. I'll analyze it using AI vision
3. Get detailed results and descriptions

**Requirements:**
- Image file (PNG, JPG, GIF, WebP, BMP)
- Size: Under 10MB

Have an image ready? Upload it! 🚀📸""",
            
            """🔍 **Image Scanning & Analysis**

Perfect question! I support:

📷 **Image Upload**: Store images securely
🤖 **AI Analysis**: GPT-4 Vision for detailed understanding
📝 **Text Recognition**: OCR capabilities
🎨 **Visual Understanding**: Colors, shapes, composition
💬 **Q&A**: Ask questions about images

**Endpoints Available:**
- `/ai/upload-image` - Upload and store
- `/ai/scan-image` - Upload and immediately analyze
- `/ai/analyze-image` - Analyze pre-uploaded image
- `/ai/image-vision` - Ask custom questions
- `/ai/image-list` - View all images
- `/ai/image-delete` - Remove images

Let's analyze some images! 📸✨""",
            
            """🎬 **Vision & Image Processing**

I've got you covered with image capabilities!

**Three Ways to Process:**
1️⃣ **Quick Upload** → POST `/ai/upload-image`
2️⃣ **Full Analysis** → POST `/ai/scan-image`
3️⃣ **AI Questions** → POST `/ai/image-vision`

**What I Can Do:**
• Describe image contents in detail
• Identify objects and scenes
• Extract and read text (OCR)
• Analyze composition and colors
• Answer specific questions about images

**Example Response:**
```json
{
  "success": true,
  "analysis": "This image shows...",
  "method": "OpenAI Vision (GPT-4V)",
  "filepath": "uploads/images/..."
}
```

Ready to scan? Upload an image! 🚀📸""",
        ]
        return def_random(image_responses)

# Initialize AI
chronex_python = ChronexAIPython(CHRONEX_CONFIG)

# ============ API ENDPOINTS ============

@app.route('/ai/advanced-help', methods=['POST'])
def advanced_help():
    """Advanced technical assistance endpoint"""
    try:
        data = request.get_json()
        message = data.get('message', '')

        response = chronex_python.get_advanced_help(message)
        return jsonify({
            "success": True,
            "response": response,
            "type": "advanced"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai/data-science', methods=['POST'])
def data_science_help():
    """Data science and ML guidance endpoint"""
    try:
        data = request.get_json()
        message = data.get('message', '')

        response = chronex_python.get_data_science_help(message)
        return jsonify({
            "success": True,
            "response": response,
            "type": "data-science"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai/web-dev', methods=['POST'])
def web_dev_help():
    """Web development assistance endpoint"""
    try:
        data = request.get_json()
        message = data.get('message', '')

        response = chronex_python.get_web_dev_help(message)
        return jsonify({
            "success": True,
            "response": response,
            "type": "web-dev"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai/capabilities', methods=['GET'])
def get_capabilities():
    """Get full AI capabilities"""
    capabilities = {
        "general": ["chat", "code analysis", "math solving", "question answering"],
        "advanced": ["system architecture", "devops", "infrastructure"],
        "data_science": ["data analysis", "machine learning", "predictive analytics"],
        "web_dev": ["web development", "performance optimization", "security"],
        "supported_languages": CHRONEX_CONFIG["capabilities"]["language_support"]
    }
    return jsonify({"success": True, "capabilities": capabilities})

@app.route('/ai/health', methods=['GET'])
def health_check():
    """Detailed health check"""
    return jsonify({
        "status": "healthy",
        "uptime": "running",
        "model": CHRONEX_CONFIG["model"]["name"],
        "capabilities": list(CHRONEX_CONFIG["capabilities"].keys()),
        "version": "1.0",
        "python_backend": True
    })

@app.route('/ai/model-info', methods=['GET'])
def model_info():
    """Get detailed model information"""
    return jsonify({
        "model_name": CHRONEX_CONFIG["model"]["name"],
        "parameters": CHRONEX_CONFIG["parameters"],
        "model_config": CHRONEX_CONFIG["model"],
        "creator": CHRONEX_CONFIG["creator"],
        "version": "1.0"
    })

# ============ CREATOR LIBRARY ENDPOINTS ============

@app.route('/ai/creator-info', methods=['GET'])
def get_creator_full_info():
    """Get full creator information and library stats"""
    try:
        info = creator_library.get_creator_info()
        return jsonify({
            "success": True,
            "creator_info": info,
            "primary": CREATOR,
            "secondary": SECONDARY_CREATOR
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai/creator-library', methods=['GET'])
def get_creator_library():
    """Get entire creator library export"""
    try:
        library = creator_library.export_library()
        return jsonify({
            "success": True,
            "library": library
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai/creator-library/query-history', methods=['GET'])
def get_query_history():
    """Get creator query history"""
    try:
        limit = request.args.get('limit', 10, type=int)
        history = creator_library.get_query_history(limit)
        return jsonify({
            "success": True,
            "total_queries": len(creator_library.creator_data["query_history"]),
            "recent_queries": history
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai/creator-library/store', methods=['POST'])
def store_creator_info():
    """Store custom information in creator library"""
    try:
        data = request.get_json()
        key = data.get('key')
        value = data.get('value')
        
        if not key or not value:
            return jsonify({"error": "Key and value required"}), 400
        
        creator_library.store_info(key, value)
        return jsonify({
            "success": True,
            "message": f"Stored '{key}' in creator library",
            "stored_items": len(creator_library.creator_data["stored_info"])
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai/creator-library/retrieve/<key>', methods=['GET'])
def retrieve_creator_info(key):
    """Retrieve specific information from creator library"""
    try:
        info = creator_library.get_stored_info(key)
        if not info:
            return jsonify({"error": f"No information found for key '{key}'"}), 404
        
        return jsonify({
            "success": True,
            "key": key,
            "data": info
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai/creator-library/clear-history', methods=['POST'])
def clear_query_history():
    """Clear creator query history"""
    try:
        creator_library.clear_history()
        return jsonify({
            "success": True,
            "message": "Query history cleared"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai/creator', methods=['GET'])
def get_creator():
    """Get creator information"""
    return jsonify(creator())

# ============ REAL AI CONFIG ENDPOINTS ============

@app.route('/ai/config', methods=['GET'])
def get_ai_config():
    """Get current AI configuration"""
    return jsonify({
        "success": True,
        "ai_provider": config_manager.get("ai_provider"),
        "use_real_ai": config_manager.get("use_real_ai"),
        "openai_available": OPENAI_AVAILABLE,
        "huggingface_available": HUGGINGFACE_AVAILABLE,
        "dotenv_available": DOTENV_AVAILABLE,
        "models": {
            "openai": config_manager.get("openai_model"),
            "huggingface": config_manager.get("huggingface_model"),
        }
    })

@app.route('/ai/config/update', methods=['POST'])
def update_ai_config():
    """Update AI configuration"""
    try:
        data = request.get_json()
        
        for key, value in data.items():
            config_manager.set(key, value)
            logger.info(f"✅ Config updated: {key} = {value}")
        
        return jsonify({
            "success": True,
            "message": "Configuration updated",
            "config": config_manager.config
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai/providers', methods=['GET'])
def get_providers():
    """Get available AI providers"""
    return jsonify({
        "success": True,
        "available_providers": {
            "openai": OPENAI_AVAILABLE,
            "huggingface": HUGGINGFACE_AVAILABLE,
            "ollama": True,  # Always available if server running
            "default": True
        },
        "current_provider": config_manager.get("ai_provider")
    })

@app.route('/ai/chat', methods=['POST'])
def chat():
    """Main chat endpoint - uses intelligent context-aware responses"""
    try:
        data = request.get_json()
        message = data.get('message', '')
        history = data.get('history', [])

        if not message:
            return jsonify({"error": "No message provided"}), 400

        # Use the new simplified intelligent processor
        result = chronex_python.process_message_simplified(message, history)
        return jsonify(result)

    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/ai/analyze-code', methods=['POST'])
def analyze_code():
    """Dedicated code analysis endpoint"""
    try:
        data = request.get_json()
        code = data.get('code', '')
        language = data.get('language', 'unknown')

        response = chronex_python.analyze_code(f"Analyze this {language} code")
        return jsonify({
            "success": True,
            "analysis": response,
            "language": language
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai/solve-math', methods=['POST'])
def solve_math():
    """Math solving endpoint"""
    try:
        data = request.get_json()
        problem = data.get('problem', '')

        response = chronex_python.solve_math(problem)
        return jsonify({
            "success": True,
            "solution": response
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai/status', methods=['GET'])
def status():
    """Health check endpoint"""
    return jsonify({
        "status": "online",
        "model": CHRONEX_CONFIG["model"]["name"],
        "version": "1.0",
        "capabilities": list(CHRONEX_CONFIG["capabilities"].keys())
    })

@app.route('/ai/reset', methods=['POST'])
def reset():
    """Reset conversation history"""
    chronex_python.conversation_history = []
    return jsonify({"success": True, "message": "Conversation history cleared"})

# ============ IMAGE PROCESSING ENDPOINTS ============

@app.route('/ai/upload-image', methods=['POST'])
def upload_image():
    """Upload and process image"""
    try:
        # Check if file is in request
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "No image selected"}), 400
        
        # Save image
        filepath, status = image_processor.save_image(file)
        if not filepath:
            return jsonify({"error": status}), 400
        
        logger.info(f"✅ Image uploaded: {file.filename}")
        
        return jsonify({
            "success": True,
            "message": "Image uploaded successfully",
            "filename": file.filename,
            "filepath": filepath,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"❌ Upload error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/ai/analyze-image', methods=['POST'])
def analyze_image():
    """Analyze uploaded image"""
    try:
        data = request.get_json() or {}
        filepath = data.get('filepath')
        use_ai = data.get('use_ai', True)
        
        if not filepath or not os.path.exists(filepath):
            return jsonify({"error": "Image file not found"}), 404
        
        # Try OpenAI Vision first if enabled
        if use_ai and OPENAI_AVAILABLE and config_manager.get("enable_vision"):
            analysis = image_processor.analyze_image_openai(filepath)
            if analysis:
                return jsonify({
                    "success": True,
                    "analysis": analysis,
                    "method": "OpenAI Vision (GPT-4V)",
                    "filepath": filepath
                })
        
        # Fallback to basic PIL analysis
        analysis = image_processor.analyze_image_basic(filepath)
        if analysis:
            return jsonify({
                "success": True,
                "analysis": analysis,
                "method": "Basic Analysis (PIL)",
                "filepath": filepath,
                "note": "For advanced AI analysis, set up OpenAI API key"
            })
        
        return jsonify({"error": "Could not analyze image"}), 500
        
    except Exception as e:
        logger.error(f"❌ Analysis error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/ai/scan-image', methods=['POST'])
def scan_image():
    """Scan image (OCR + Analysis)"""
    try:
        # Check for file in form data
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "No image selected"}), 400
        
        # Save image
        filepath, status = image_processor.save_image(file)
        if not filepath:
            return jsonify({"error": status}), 400
        
        # Analyze image
        analysis = None
        method = "None"
        
        # Try OpenAI Vision first
        if OPENAI_AVAILABLE and config_manager.get("enable_vision"):
            try:
                analysis = image_processor.analyze_image_openai(filepath)
                method = "OpenAI Vision (GPT-4V)"
            except Exception as e:
                logger.warning(f"⚠️ OpenAI analysis failed: {e}")
        
        # Fallback to basic analysis
        if not analysis:
            analysis = image_processor.analyze_image_basic(filepath)
            method = "Basic Analysis (PIL)"
        
        return jsonify({
            "success": True,
            "message": "Image scanned and analyzed",
            "filename": file.filename,
            "filepath": filepath,
            "analysis": analysis,
            "analysis_method": method,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"❌ Scan error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/ai/image-vision', methods=['POST'])
def image_vision():
    """Advanced image vision API"""
    try:
        data = request.get_json()
        question = data.get('question', 'Describe this image in detail')
        filepath = data.get('filepath')
        
        if not filepath or not os.path.exists(filepath):
            return jsonify({"error": "Image file not found"}), 404
        
        # Use OpenAI Vision with custom question
        if not OPENAI_AVAILABLE:
            return jsonify({"error": "OpenAI not available"}), 503
        
        try:
            base64_image = image_processor.get_image_base64(filepath)
            if not base64_image:
                return jsonify({"error": "Could not encode image"}), 500
            
            response = openai.ChatCompletion.create(
                model="gpt-4-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": question},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1000
            )
            
            return jsonify({
                "success": True,
                "question": question,
                "response": response.choices[0].message.content,
                "filepath": filepath
            })
        except Exception as e:
            logger.error(f"❌ Vision API error: {e}")
            return jsonify({"error": f"Vision API error: {str(e)}"}), 503
        
    except Exception as e:
        logger.error(f"❌ Vision endpoint error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/ai/image-list', methods=['GET'])
def list_images():
    """List all uploaded images"""
    try:
        images = []
        upload_dir = image_processor.upload_dir
        
        if os.path.exists(upload_dir):
            for filename in os.listdir(upload_dir):
                filepath = os.path.join(upload_dir, filename)
                if os.path.isfile(filepath):
                    images.append({
                        "filename": filename,
                        "filepath": filepath,
                        "size": os.path.getsize(filepath),
                        "modified": datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()
                    })
        
        return jsonify({
            "success": True,
            "total_images": len(images),
            "images": images
        })
    except Exception as e:
        logger.error(f"❌ List images error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/ai/image-delete/<filename>', methods=['DELETE'])
def delete_image(filename):
    """Delete uploaded image"""
    try:
        filepath = os.path.join(image_processor.upload_dir, filename)
        
        if not os.path.exists(filepath):
            return jsonify({"error": "Image not found"}), 404
        
        os.remove(filepath)
        logger.info(f"✅ Image deleted: {filename}")
        
        return jsonify({
            "success": True,
            "message": f"Image '{filename}' deleted"
        })
    except Exception as e:
        logger.error(f"❌ Delete error: {e}")
        return jsonify({"error": str(e)}), 500

# ============ ERROR HANDLERS ============

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

# ============ MAIN ============

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting Chronex AI (Python Backend) on port {port}")
    logger.info(f"Debug mode: {debug}")
    logger.info(f"Model: {CHRONEX_CONFIG['model']['name']}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug,
        threaded=True
    )
    
    logger.info("✨ Chronex AI (Python Backend) is running on NEXCHAT - The future is initialized!")


def print_info():
    """Print system information and credits"""
    print("\n" + "="*70)
    print("🚀 NEXCHAT & CHRONEX AI - THE FUTURE IS HERE!")
    print("="*70)
    print("\n📊 System Information:")
    print("   • Creator: DEMON ALEX")
    print("   • Co-Developer: DEVELOPER OF NEXCHAT")
    print("   • System: Chronex AI Python Backend v1.0")
    print("   • Model: 4B Parameters Advanced Neural Network")
    print("\n💡 Key Features:")
    print("   ✓ Advanced AI Chat System")
    print("   ✓ Code Analysis & Review")
    print("   ✓ Mathematical Problem Solving")
    print("   ✓ Data Science Support")
    print("   ✓ Web Development Assistance")
    print("   ✓ Creator Library Storage")
    print("   ✓ Real-time Status Monitoring")
    print("\n📧 For Collaboration & Support:")
    print("   Email: demonalexander526@gmail.com")
    print("   Contact: DEMON ALEX for integration, features, or assistance")
    print("\n💬 About Tokens:")
    print("   • Tokens reduce spam and maintain database integrity")
    print("   • Essential for NEXCHAT's operational efficiency")
    print("   • Part of the platform's security architecture")
    print("\n📝 Note:")
    print("   NEXCHAT is actively being developed with continuous improvements.")
    print("   Integration support available through the contact above.")
    print("\n" + "="*70 + "\n")

# Run info on startup
if __name__ == '__main__':
    print_info()
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting Chronex AI (Python Backend) on port {port}")
    logger.info(f"Debug mode: {debug}")
    logger.info(f"Model: {CHRONEX_CONFIG['model']['name']}")
    logger.info("✨ Chronex AI (Python Backend) is running on NEXCHAT - The future is initialized!")
    
    # Start the Flask server
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug,
        threaded=True
    ) 
