// Gaming Hub JavaScript - Game Management & UI Logic

// Online Hardcore Multiplayer Games Database
const GAMES_DATABASE = [
  {
    id: 1,
    name: "Blood Strike",
    emoji: "🩸",
    category: "action",
    description: "Intense multiplayer tactical shooter. Fast-paced combat with various game modes. Free-to-play FPS action!",
    playersNow: 456789,
    avgScore: 18500,
    avgTime: 12,
    rating: 4.8,
    badges: "HOT",
    gameUrl: "https://play.bloodstrike.com",
    type: "shooter"
  },
  {
    id: 2,
    name: "Call of Duty Mobile",
    emoji: "🔫",
    category: "action",
    description: "COD Mobile - Legendary FPS on mobile! Multiplayer battles, Zombies, Campaign. True COD experience.",
    playersNow: 2345678,
    avgScore: 24500,
    avgTime: 15,
    rating: 4.9,
    badges: "TOP",
    gameUrl: "https://www.callofduty.com/mobile",
    type: "shooter"
  },
  {
    id: 3,
    name: "PUBG Mobile",
    emoji: "🎯",
    category: "action",
    description: "PUBG Mobile - Battle royale legend! 100 players drop, loot, and fight. Survive to win!",
    playersNow: 3456789,
    avgScore: 45000,
    avgTime: 20,
    rating: 4.8,
    badges: "TRENDING",
    gameUrl: "https://www.pubgmobile.com",
    type: "battle-royale"
  },
  {
    id: 4,
    name: "FireLite",
    emoji: "🔥",
    category: "action",
    description: "Fast-paced online shooter! Competitive matches with squad-based gameplay. Download and dominate!",
    playersNow: 234567,
    avgScore: 16200,
    avgTime: 10,
    rating: 4.7,
    badges: null,
    gameUrl: "https://firelite.com",
    type: "shooter"
  },
  {
    id: 5,
    name: "Fortnite",
    emoji: "⚡",
    category: "action",
    description: "Epic battle royale! 100 players compete with building mechanics. Free-to-play with seasons & events.",
    playersNow: 5678901,
    avgScore: 55000,
    avgTime: 18,
    rating: 4.9,
    badges: "TOP",
    gameUrl: "https://www.fortnite.com",
    type: "battle-royale"
  },
  {
    id: 6,
    name: "Valorant",
    emoji: "🎪",
    category: "action",
    description: "Tactical 5v5 competitive shooter! Agent-based abilities with round-based economy system.",
    playersNow: 1234567,
    avgScore: 28000,
    avgTime: 35,
    rating: 4.9,
    badges: "HOT",
    gameUrl: "https://playvalorant.com",
    type: "shooter"
  },
  {
    id: 7,
    name: "Counter-Strike 2",
    emoji: "💥",
    category: "action",
    description: "CS2 - The legendary competitive FPS! Terrorist vs Counter-Terrorist. Pure tactical gameplay.",
    playersNow: 2789012,
    avgScore: 32000,
    avgTime: 40,
    rating: 4.8,
    badges: null,
    gameUrl: "https://www.counter-strike.net/cs2",
    type: "shooter"
  },
  {
    id: 8,
    name: "Apex Legends",
    emoji: "🎮",
    category: "action",
    description: "Hero-based battle royale! 3v3 teams with unique legends. Ping system for teamwork.",
    playersNow: 1890234,
    avgScore: 38000,
    avgTime: 20,
    rating: 4.8,
    badges: "TRENDING",
    gameUrl: "https://www.ea.com/games/apex",
    type: "battle-royale"
  },
  {
    id: 9,
    name: "Warzone 2.0",
    emoji: "⚔️",
    category: "action",
    description: "Call of Duty Warzone - Massive 150-player battle royale. Squads, Solos, Duos modes.",
    playersNow: 3567890,
    avgScore: 52000,
    avgTime: 25,
    rating: 4.7,
    badges: "HOT",
    gameUrl: "https://www.callofduty.com/warzone",
    type: "battle-royale"
  },
  {
    id: 10,
    name: "Rainbow Six Siege",
    emoji: "🛡️",
    category: "strategy",
    description: "Tactical team-based shooter! 5v5 with destructible environments. Attack & defend objectives.",
    playersNow: 987654,
    avgScore: 25000,
    avgTime: 40,
    rating: 4.7,
    badges: null,
    gameUrl: "https://www.ubisoft.com/en-us/game/rainbow-six/siege",
    type: "shooter"
  },
  {
    id: 11,
    name: "Overwatch 2",
    emoji: "🎯",
    category: "multiplayer",
    description: "Hero shooter 5v5! Team-based gameplay with diverse character abilities. Free-to-play.",
    playersNow: 2345678,
    avgScore: 35000,
    avgTime: 25,
    rating: 4.8,
    badges: "TOP",
    gameUrl: "https://overwatch.blizzard.com",
    type: "hero-shooter"
  },
  {
    id: 12,
    name: "Lost Ark",
    emoji: "⚔️",
    category: "multiplayer",
    description: "MMO action RPG! Hardcore PvE raids and PvP combat. Rich story with dungeons and guilds.",
    playersNow: 456789,
    avgScore: 45000,
    avgTime: 120,
    rating: 4.6,
    badges: null,
    gameUrl: "https://www.lostarkmmo.com",
    type: "mmo"
  },
  {
    id: 13,
    name: "New World",
    emoji: "🗡️",
    category: "multiplayer",
    description: "MMO with large-scale PvP! Territory wars between factions. Crafting, dungeons, raids.",
    playersNow: 234567,
    avgScore: 40000,
    avgTime: 90,
    rating: 4.5,
    badges: null,
    gameUrl: "https://www.newworld.com",
    type: "mmo"
  },
  {
    id: 14,
    name: "Destiny 2",
    emoji: "🌙",
    category: "action",
    description: "Sci-fi shooter MMO! PvE strikes & raids. Competitive PvP Crucible matches.",
    playersNow: 1234567,
    avgScore: 48000,
    avgTime: 60,
    rating: 4.8,
    badges: "TRENDING",
    gameUrl: "https://www.bungie.net/7/en/Destiny/NewLight",
    type: "shooter-mmo"
  },
  {
    id: 15,
    name: "PLAYERUNKNOWN'S BATTLEGROUNDS",
    emoji: "🏆",
    category: "action",
    description: "Original battle royale! 100 players, massive map, intense combat. The game that started it all!",
    playersNow: 2567890,
    avgScore: 50000,
    avgTime: 25,
    rating: 4.7,
    badges: "HOT",
    gameUrl: "https://www.pubg.com",
    type: "battle-royale"
  }
];

// State management
let allGames = [...GAMES_DATABASE].sort((a, b) => b.playersNow - a.playersNow);
let currentCategory = "all";
let currentSearchQuery = "";
let selectedGame = null;
let darkMode = true;

// Initialize gaming hub
document.addEventListener("DOMContentLoaded", () => {
  initializeDarkMode();
  loadGames();
  setupEventListeners();
  setupMainNavigation();

  // Initialize Firebase connection management
  initializeFirebaseConnection();

  console.log("🎮 Gaming Hub fully initialized!");
});

// Setup all event listeners
function setupEventListeners() {
  // Back button
  document.getElementById("back-to-chat-btn")?.addEventListener("click", () => {
    window.location.href = "chat.html";
  });

  // Search input
  document.getElementById("game-search-input")?.addEventListener("input", (e) => {
    currentSearchQuery = e.target.value.toLowerCase();
    filterAndDisplayGames();
  });

  // Category tabs
  document.querySelectorAll(".category-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".category-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentCategory = tab.dataset.category;
      filterAndDisplayGames();
    });
  });

  // Close modal
  document.getElementById("close-game-modal-btn")?.addEventListener("click", closeGameModal);

  // Modal background click
  document.getElementById("game-detail-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "game-detail-modal") {
      closeGameModal();
    }
  });

  // Play button
  document.getElementById("play-game-btn")?.addEventListener("click", () => {
    if (selectedGame) {
      playGame(selectedGame);
    }
  });

  // Share button
  document.getElementById("share-game-btn")?.addEventListener("click", () => {
    if (selectedGame) {
      shareGame(selectedGame);
    }
  });
}

// Dark mode management
function initializeDarkMode() {
  const savedDarkMode = localStorage.getItem("darkMode");
  darkMode = savedDarkMode !== "false";

  if (!darkMode) {
    document.body.classList.add("light-mode");
  } else {
    document.body.classList.remove("light-mode");
  }
}

// Load and display games
function loadGames() {
  displayLoadingState(true);

  // Simulate loading delay
  setTimeout(() => {
    displayLoadingState(false);
    filterAndDisplayGames();
  }, 300);
}

// Filter games based on category and search
function filterAndDisplayGames() {
  let filtered = allGames;

  // Filter by category
  if (currentCategory !== "all") {
    filtered = filtered.filter((game) => game.category === currentCategory);
  }

  // Filter by search query
  if (currentSearchQuery) {
    filtered = filtered.filter((game) =>
      game.name.toLowerCase().includes(currentSearchQuery) ||
      game.description.toLowerCase().includes(currentSearchQuery)
    );
  }

  displayGames(filtered);
}

// Display games in grid
function displayGames(games) {
  const grid = document.getElementById("games-grid");
  const emptyState = document.getElementById("empty-state");

  if (!grid) return;

  if (games.length === 0) {
    grid.style.display = "none";
    emptyState.style.display = "flex";
    return;
  }

  grid.style.display = "grid";
  emptyState.style.display = "none";
  grid.innerHTML = games
    .map(
      (game) => `
    <div class="game-card" onclick="viewGameDetail(${game.id})">
      <div class="game-card-image">
        <span>${game.emoji}</span>
        ${game.badges ? `<div class="game-card-badge">${game.badges}</div>` : ""}
      </div>
      <div class="game-card-info">
        <h3 class="game-card-name">${game.name}</h3>
        <p class="game-card-category">${game.category}</p>
        <div class="game-card-stats">
          <span class="stat">👥 ${formatNumber(game.playersNow)}</span>
          <span class="stat">⭐ ${game.rating}</span>
        </div>
        <div class="game-card-rating">
          ${Array(Math.round(game.rating))
          .fill("⭐")
          .join("")}
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

// View game detail modal
function viewGameDetail(gameId) {
  selectedGame = allGames.find((g) => g.id === gameId);
  if (!selectedGame) return;

  const modal = document.getElementById("game-detail-modal");
  document.getElementById("game-detail-image").innerHTML = selectedGame.emoji;
  document.getElementById("game-detail-name").textContent = selectedGame.name;
  document.getElementById("game-detail-category").textContent =
    selectedGame.category.charAt(0).toUpperCase() + selectedGame.category.slice(1);
  document.getElementById("game-detail-players").textContent = formatNumber(selectedGame.playersNow);
  document.getElementById("game-detail-rating").textContent = `${selectedGame.rating} ⭐`;
  document.getElementById("game-detail-description").textContent = selectedGame.description;
  document.getElementById("game-detail-playing").textContent = formatNumber(selectedGame.playersNow);
  document.getElementById("game-detail-score").textContent = formatNumber(selectedGame.avgScore);
  document.getElementById("game-detail-time").textContent = `${selectedGame.avgTime}min`;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

// Close game modal
function closeGameModal() {
  const modal = document.getElementById("game-detail-modal");
  modal.style.display = "none";
  document.body.style.overflow = "auto";
  selectedGame = null;
}

// Play game - Open online game in new tab
function playGame(game) {
  if (!game.gameUrl) {
    showNotification(`Game ${game.name} not yet available`, "error");
    return;
  }

  showNotification(`🎮 Launching ${game.name}...`, "success");

  // Log game play event
  console.log(`▶️ Playing online game: ${game.name} | URL: ${game.gameUrl}`);

  // Open game in new tab after a short delay
  setTimeout(() => {
    window.open(game.gameUrl, "_blank");
    showNotification(`🎮 ${game.name} opened in new tab!`, "success", 2000);
    closeGameModal();
  }, 500);
}

// Share game
function shareGame(game) {
  const shareText = `🎮 Check out ${game.name}! ${game.emoji}\n\n${game.description}\n\nRate: ${game.rating}⭐`;

  if (navigator.share) {
    navigator.share({
      title: game.name,
      text: shareText,
      url: window.location.href
    });
  } else {
    // Fallback for non-supporting browsers
    const textArea = document.createElement("textarea");
    textArea.value = shareText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    showNotification("📋 Game info copied to clipboard!", "success");
  }
}

// Display loading state
function displayLoadingState(show) {
  const loadingState = document.getElementById("loading-state");
  if (loadingState) {
    loadingState.style.display = show ? "flex" : "none";
  }
}

// Format number for display (1000 -> 1K)
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

// Notification system
function showNotification(message, type = "info", duration = 2000) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 16px;
    left: 16px;
    right: 16px;
    background: ${type === "success" ? "#00ff66" : type === "error" ? "#ff4444" : "#00ccff"};
    color: ${type === "success" ? "#000" : "#fff"};
    padding: 14px 16px;
    border-radius: 12px;
    font-weight: 600;
    z-index: 1001;
    animation: slideDown 0.3s ease-out;
    box-shadow: 0 4px 16px ${type === "success" ? "rgba(0, 255, 102, 0.3)" : "rgba(0, 204, 255, 0.3)"};
    max-width: 320px;
  `;

  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideUp 0.3s ease-out";
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, duration);
}

// Add animation styles
const style = document.createElement("style");
style.textContent = `
  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(-100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Haptic feedback for interactions
function hapticFeedback(type = "light") {
  if (navigator.vibrate) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 50,
      success: [10, 20, 10]
    };
    navigator.vibrate(patterns[type] || 10);
  }
}

// Handle keyboard navigation
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeGameModal();
  }
});

// Responsive check
window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    filterAndDisplayGames();
  }, 100);
});

console.log("🎮 Gaming Hub initialized successfully!");

// ============================================
// EXPANDED GAMING HUB - SOCIAL FEATURES
// ============================================

// Mock Gamers Database
const GAMERS_DATABASE = [
  {
    id: 1,
    username: "ShadowNinja",
    avatar: "🥷",
    level: 45,
    skill: "advanced",
    mainGame: "Valorant",
    hoursPlayed: 2340,
    wins: 1240,
    rating: 4.9,
    bio: "Competitive FPS player | Team Captain",
    status: "online",
    games: ["Valorant", "CS2", "Fortnite"],
    region: "North America"
  },
  {
    id: 2,
    username: "PhantomGamer",
    avatar: "👻",
    level: 38,
    skill: "intermediate",
    mainGame: "PUBG Mobile",
    hoursPlayed: 1856,
    wins: 856,
    rating: 4.7,
    bio: "Battle royale enthusiast | Always seeking squad",
    status: "online",
    games: ["PUBG Mobile", "Fortnite", "Apex Legends"],
    region: "Europe"
  },
  {
    id: 3,
    username: "IceQueen",
    avatar: "❄️",
    level: 52,
    skill: "pro",
    mainGame: "Overwatch 2",
    hoursPlayed: 3120,
    wins: 2100,
    rating: 4.95,
    bio: "Pro esports player | Esports org: TitanGaming",
    status: "offline",
    games: ["Overwatch 2", "Valorant"],
    region: "Asia"
  },
  {
    id: 4,
    username: "NovaStrike",
    avatar: "⚡",
    level: 28,
    skill: "beginner",
    mainGame: "Call of Duty Mobile",
    hoursPlayed: 420,
    wins: 85,
    rating: 4.3,
    bio: "New to competitive gaming, learning fast!",
    status: "online",
    games: ["Call of Duty Mobile", "Fortnite"],
    region: "South America"
  },
  {
    id: 5,
    username: "VortexKing",
    avatar: "👑",
    level: 41,
    skill: "advanced",
    mainGame: "Destiny 2",
    hoursPlayed: 2650,
    wins: 450,
    rating: 4.6,
    bio: "Raid master | Mythic+ player",
    status: "online",
    games: ["Destiny 2", "Lost Ark"],
    region: "Europe"
  }
];

// Mock Squads Database
const SQUADS_DATABASE = [
  {
    id: 1,
    name: "Apex Predators",
    emoji: "🦁",
    game: "Apex Legends",
    leader: "ShadowNinja",
    members: 8,
    maxMembers: 20,
    joinRequests: 3,
    skill: "advanced",
    description: "Competitive Apex Legends team. Scrimmages daily.",
    founded: "2024-06-15",
    wins: 245
  },
  {
    id: 2,
    name: "Night Hunters",
    emoji: "🌙",
    game: "PUBG Mobile",
    leader: "PhantomGamer",
    members: 5,
    maxMembers: 20,
    joinRequests: 1,
    skill: "intermediate",
    description: "Casual to competitive PUBG squad",
    founded: "2024-08-20",
    wins: 128
  },
  {
    id: 3,
    name: "valorant grinders",
    emoji: "🔫",
    game: "Valorant",
    leader: "IceQueen",
    members: 15,
    maxMembers: 30,
    joinRequests: 12,
    skill: "pro",
    description: "Pro-level Valorant team. Ranked grinding.",
    founded: "2024-01-10",
    wins: 890
  }
];

// Mock Gaming Sessions Database
const SESSIONS_DATABASE = [
  {
    id: 1,
    game: "Valorant",
    createdBy: "ShadowNinja",
    participants: 4,
    maxParticipants: 5,
    skillLevel: "advanced",
    startTime: "2024-01-21 19:00",
    duration: "120 mins",
    objective: "Competitive Ranked Push",
    status: "active"
  },
  {
    id: 2,
    game: "PUBG Mobile",
    createdBy: "PhantomGamer",
    participants: 2,
    maxParticipants: 4,
    skillLevel: "intermediate",
    startTime: "2024-01-21 18:30",
    duration: "60 mins",
    objective: "Team Deathmatch Practice",
    status: "active"
  },
  {
    id: 3,
    game: "Apex Legends",
    createdBy: "VortexKing",
    participants: 3,
    maxParticipants: 3,
    skillLevel: "advanced",
    startTime: "2024-01-21 20:00",
    duration: "90 mins",
    objective: "Squad Scrimmage",
    status: "upcoming"
  }
];

// Setup main navigation tabs
function setupMainNavigation() {
  const navTabs = document.querySelectorAll(".nav-tab");

  navTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const section = tab.dataset.section;

      // Update active tab
      document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      // Hide all sections
      const gamesSection = document.getElementById("gamesSection");
      const gamersSection = document.getElementById("gamersSection");
      const squadsSection = document.getElementById("squadsSection");
      const sessionsSection = document.getElementById("sessionsSection");

      // Headers to toggle
      const gameSearchArea = document.querySelector(".gaming-search-area");
      const categoryTabs = document.querySelector(".category-tabs");
      const gamingTitle = document.querySelector(".gaming-title");

      // Handle visibility based on section
      // DEFAULT: Hide everything first
      if (gamesSection) gamesSection.style.display = "none";
      if (gamersSection) gamersSection.style.display = "none";
      if (squadsSection) squadsSection.style.display = "none";
      if (sessionsSection) sessionsSection.style.display = "none";

      if (section === "games") {
        if (gamesSection) gamesSection.style.display = "block";

        // Show games specific header items
        if (gameSearchArea) gameSearchArea.style.display = "block";
        if (categoryTabs) categoryTabs.style.display = "flex";
        if (gamingTitle) gamingTitle.textContent = "🎮 Gaming Hub";
      }
      else if (section === "gamers") {
        if (gamersSection) gamersSection.style.display = "block";

        // Hide games specific header items
        if (gameSearchArea) gameSearchArea.style.display = "none";
        if (categoryTabs) categoryTabs.style.display = "none";
        if (gamingTitle) gamingTitle.textContent = "👾 Gamers";

        loadGamers();
      }
      else if (section === "squads") {
        if (squadsSection) squadsSection.style.display = "block";

        // Hide games specific header items
        if (gameSearchArea) gameSearchArea.style.display = "none";
        if (categoryTabs) categoryTabs.style.display = "none";
        if (gamingTitle) gamingTitle.textContent = "🎖️ Squads";

        loadSquads();
      }
      else if (section === "sessions") {
        if (sessionsSection) sessionsSection.style.display = "block";

        // Hide games specific header items
        if (gameSearchArea) gameSearchArea.style.display = "none";
        if (categoryTabs) categoryTabs.style.display = "none";
        if (gamingTitle) gamingTitle.textContent = "🎮 Sessions";

        loadSessions();
      }
    });
  });

  // Ensure games section is visible on load
  const gamesSection = document.getElementById("gamesSection");
  if (gamesSection) {
    gamesSection.style.display = "block";
  }
}

// Load and display gamers
function loadGamers() {
  const gamersList = document.getElementById("gamersList");

  // Setup dropdown filters
  const usernameFilter = document.getElementById("usernameFilter");
  const gameFilter = document.getElementById("gameFilter");
  const skillFilter = document.getElementById("skillFilter");
  const statusFilter = document.getElementById("statusFilter");

  const filterGamers = () => {
    let filtered = GAMERS_DATABASE;

    if (usernameFilter && usernameFilter.value) {
      filtered = filtered.filter(g => g.username.toLowerCase().includes(usernameFilter.value.toLowerCase()));
    }

    if (gameFilter && gameFilter.value) {
      filtered = filtered.filter(g => g.games.includes(gameFilter.value));
    }

    if (skillFilter && skillFilter.value) {
      filtered = filtered.filter(g => g.skill === skillFilter.value);
    }

    if (statusFilter && statusFilter.value) {
      filtered = filtered.filter(g => g.status === statusFilter.value);
    }

    displayGamers(filtered);
  };

  // Add event listeners to dropdowns
  if (usernameFilter) usernameFilter.addEventListener("change", filterGamers);
  if (gameFilter) gameFilter.addEventListener("change", filterGamers);
  if (skillFilter) skillFilter.addEventListener("change", filterGamers);
  if (statusFilter) statusFilter.addEventListener("change", filterGamers);

  // Initial display
  filterGamers();
}

// Display gamers helper function
function displayGamers(gamers) {
  const gamersList = document.getElementById("gamersList");
  gamersList.innerHTML = gamers.map(gamer => `
    <div class="gamer-card" onclick="viewGamerProfile(${gamer.id})">
      <div class="gamer-header">
        <div class="gamer-avatar">${gamer.avatar}</div>
        <div class="gamer-status" style="background: ${gamer.status === 'online' ? '#00ff66' : '#999'};"></div>
      </div>
      <h3 class="gamer-name">${gamer.username}</h3>
      <p class="gamer-level">Level ${gamer.level} | ${gamer.skill}</p>
      <p class="gamer-game">🎮 ${gamer.mainGame}</p>
      <div class="gamer-stats">
        <span>⭐ ${gamer.rating}</span>
        <span>🏆 ${gamer.wins} wins</span>
      </div>
      <button class="gamer-action-btn" onclick="event.stopPropagation();">➕ Add Friend</button>
    </div>
  `).join("");
}

// View gamer profile
function viewGamerProfile(gamerId) {
  const gamer = GAMERS_DATABASE.find(g => g.id === gamerId);
  if (!gamer) return;

  const profileHTML = `
    <div class="gamer-profile-modal">
      <button class="close-modal" onclick="closeGamerProfile()">✕</button>
      <div class="profile-header" style="background: linear-gradient(135deg, #00ff66, #00ccff);">
        <div class="profile-avatar-large">${gamer.avatar}</div>
        <div class="profile-status">${gamer.status === 'online' ? '🟢 Online' : '⚫ Offline'}</div>
      </div>
      <div class="profile-body">
        <h2>${gamer.username}</h2>
        <p class="profile-bio">${gamer.bio}</p>
        
        <div class="profile-stats">
          <div class="stat">
            <span class="stat-label">Level</span>
            <span class="stat-value">${gamer.level}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Rating</span>
            <span class="stat-value">${gamer.rating} ⭐</span>
          </div>
          <div class="stat">
            <span class="stat-label">Wins</span>
            <span class="stat-value">${gamer.wins}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Hours</span>
            <span class="stat-value">${gamer.hoursPlayed}</span>
          </div>
        </div>

        <div class="profile-section">
          <h4>Favorite Games</h4>
          <div class="games-list">
            ${gamer.games.map(game => `<span class="game-tag">${game}</span>`).join('')}
          </div>
        </div>

        <div class="profile-section">
          <h4>Region</h4>
          <p>${gamer.region}</p>
        </div>

        <div class="profile-actions">
          <button class="action-btn primary" onclick="addFriend(${gamer.id})">👥 Add Friend</button>
          <button class="action-btn secondary" onclick="inviteToSquad(${gamer.id})">🎖️ Invite to Squad</button>
          <button class="action-btn secondary" onclick="startSession(${gamer.id})">🎮 Play Together</button>
        </div>
      </div>
    </div>
  `;

  // Create modal overlay
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = profileHTML;
  overlay.onclick = (e) => {
    if (e.target === overlay) closeGamerProfile();
  };

  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add("active"), 10);
}

// Close gamer profile
function closeGamerProfile() {
  const overlay = document.querySelector(".modal-overlay");
  if (overlay) {
    overlay.classList.remove("active");
    setTimeout(() => overlay.remove(), 300);
  }
}

// Load squads
function loadSquads() {
  const suggestedList = document.getElementById("suggestedSquadsList");
  suggestedList.innerHTML = SQUADS_DATABASE.map(squad => `
    <div class="squad-card" onclick="viewSquad(${squad.id})">
      <div class="squad-header">
        <span class="squad-emoji">${squad.emoji}</span>
        <span class="squad-skill-badge">${squad.skill.toUpperCase()}</span>
      </div>
      <h3>${squad.name}</h3>
      <p class="squad-game">🎮 ${squad.game}</p>
      <p class="squad-description">${squad.description}</p>
      <div class="squad-stats">
        <span>👥 ${squad.members}/${squad.maxMembers}</span>
        <span>🏆 ${squad.wins} wins</span>
      </div>
      <button class="squad-action-btn" onclick="event.stopPropagation();">➕ Join</button>
    </div>
  `).join("");
}

// Load sessions
function loadSessions() {
  const sessionsList = document.getElementById("activeSessionsList");
  sessionsList.innerHTML = SESSIONS_DATABASE.filter(s => s.status === "active").map(session => `
    <div class="session-card">
      <div class="session-header">
        <h4>🎮 ${session.game}</h4>
        <span class="session-status">LIVE</span>
      </div>
      <p><strong>Created by:</strong> ${session.createdBy}</p>
      <p><strong>Objective:</strong> ${session.objective}</p>
      <div class="session-info">
        <span>👥 ${session.participants}/${session.maxParticipants} Players</span>
        <span>⏱️ ${session.duration}</span>
        <span>📊 ${session.skillLevel}</span>
      </div>
      <button class="session-join-btn" onclick="joinSession(${session.id})">Join Session</button>
    </div>
  `).join("");
}

// Add friend
function addFriend(gamerId) {
  const gamer = GAMERS_DATABASE.find(g => g.id === gamerId);
  showNotification(`✅ Friend request sent to ${gamer.username}!`, "success");
}

// Invite to squad
function inviteToSquad(gamerId) {
  showNotification("🎖️ Squad invite sent!", "success");
}

// Start session
function startSession(gamerId) {
  showNotification("🎮 Gaming session started!", "success");
}

// Join session
function joinSession(sessionId) {
  const session = SESSIONS_DATABASE.find(s => s.id === sessionId);
  showNotification(`✅ Joined ${session.game} session! Launching game...`, "success");
  setTimeout(() => {
    window.open("https://www.google.com", "_blank");
  }, 1000);
}

// View squad details
function viewSquad(squadId) {
  const squad = SQUADS_DATABASE.find(s => s.id === squadId);
  showNotification(`🎖️ Squad: ${squad.name}`, "info");
}

// ============================================
// FIREBASE CONNECTION MANAGEMENT
// ============================================

let firebaseConnectionTimeout;
let isFirebaseConnected = true;
let connectionCheckInterval;

function initializeFirebaseConnection() {
  // Monitor Firebase connection status
  try {
    // Heartbeat - check connection every 30 seconds
    connectionCheckInterval = setInterval(checkFirebaseConnection, 30000);

    // Immediate check
    checkFirebaseConnection();

    console.log("✅ Firebase connection monitor started");
  } catch (error) {
    console.warn("⚠️ Firebase initialization warning:", error.message);
  }
}

function checkFirebaseConnection() {
  try {
    if (typeof db !== 'undefined' || typeof auth !== 'undefined') {
      console.log("✅ Firebase connection is active");
      isFirebaseConnected = true;

      // Clear any existing timeout
      if (firebaseConnectionTimeout) {
        clearTimeout(firebaseConnectionTimeout);
      }
    }
  } catch (error) {
    console.warn("⚠️ Firebase connection check warning:", error.message);
    isFirebaseConnected = false;
  }
}

// Reconnect function
function reconnectFirebase() {
  try {
    if (typeof auth !== 'undefined') {
      console.log("🔄 Firebase connection recheck...");
      checkFirebaseConnection();
      return true;
    }
  } catch (error) {
    console.error("❌ Firebase recheck warning:", error.message);
    return false;
  }
}

// Auto-reconnect on network change
window.addEventListener("online", () => {
  console.log("🌐 Network restored");
  reconnectFirebase();
});

window.addEventListener("offline", () => {
  console.log("❌ Network disconnected - Gaming Hub will work offline");
  isFirebaseConnected = false;
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
  }
  if (firebaseConnectionTimeout) {
    clearTimeout(firebaseConnectionTimeout);
  }
});

console.log("🎮 Gaming Hub Firebase connection management loaded!");

// Initialize expanded features on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  setupMainNavigation();

  // Create Squad Button Listener
  document.getElementById("createSquadBtn")?.addEventListener("click", () => {
    showCreateSquadModal();
  });
});

// Show Create Squad Modal
function showCreateSquadModal() {
  const modalHTML = `
    <div class="squad-modal-overlay">
      <div class="squad-modal">
        <div class="squad-modal-header">
          <h2>🛡️ Register New Clan</h2>
          <button class="close-modal-btn" onclick="closeSquadModal()">✕</button>
        </div>
        <form id="createSquadForm" onsubmit="handleSquadCreation(event)">
          <div class="form-group">
            <label>Clan Name</label>
            <input type="text" id="clanName" placeholder="Enter clan name..." required>
          </div>
          <div class="form-group">
            <label>Clan Tag (e.g. [FAZE])</label>
            <input type="text" id="clanTag" placeholder="[TAG]" maxlength="6" required>
          </div>
          <div class="form-group">
            <label>Main Game</label>
            <select id="clanGame" required>
              <option value="PUBG Mobile">PUBG Mobile</option>
              <option value="Call of Duty Mobile">CODM</option>
              <option value="Free Fire">Free Fire</option>
              <option value="Valorant">Valorant</option>
            </select>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="clanDescription" placeholder="Describe your clan..." rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Clan Logo (Emoji)</label>
            <input type="text" id="clanLogo" placeholder="🦁" maxlength="2" value="🛡️">
          </div>
          <button type="submit" class="create-btn">🚀 Register Clan</button>
        </form>
      </div>
    </div>
  `;

  // Add modal to body
  const existingModal = document.querySelector('.squad-modal-overlay');
  if (existingModal) existingModal.remove();

  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer.firstElementChild);

  // Add styles dynamically if not present
  if (!document.getElementById('squad-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'squad-modal-styles';
    style.textContent = `
      .squad-modal-overlay {
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex; justify-content: center; align-items: center;
        z-index: 2000;
        backdrop-filter: blur(5px);
      }
      .squad-modal {
        background: #1a1a1a;
        width: 90%; max-width: 400px;
        border-radius: 16px;
        border: 1px solid #00ff66;
        padding: 20px;
        box-shadow: 0 0 20px rgba(0,255,102,0.2);
      }
      .squad-modal-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 20px;
        border-bottom: 1px solid #333;
        padding-bottom: 10px;
      }
      .squad-modal-header h2 { color: #00ff66; margin: 0; }
      .form-group { margin-bottom: 15px; }
      .form-group label { display: block; color: #888; margin-bottom: 5px; font-size: 12px; }
      .form-group input, .form-group select, .form-group textarea {
        width: 100%; padding: 10px;
        background: #0a0a0a; border: 1px solid #333;
        border-radius: 8px; color: #fff;
        outline: none;
      }
      .form-group input:focus { border-color: #00ff66; }
      .create-btn {
        width: 100%; padding: 12px;
        background: #00ff66; color: #000;
        border: none; border-radius: 8px;
        font-weight: bold; font-size: 16px;
        margin-top: 10px;
      }
    `;
    document.head.appendChild(style);
  }
}

// Close Squad Modal
window.closeSquadModal = function () {
  const modal = document.querySelector('.squad-modal-overlay');
  if (modal) modal.remove();
};

// Handle Squad Creation
window.handleSquadCreation = function (e) {
  e.preventDefault();
  const name = document.getElementById('clanName').value;
  const tag = document.getElementById('clanTag').value;

  showNotification(`✅ Clan "${name}" [${tag}] Registered Successfully!`, "success");
  closeSquadModal();

  // Optimistically add to list
  const squadsList = document.getElementById("mySquadsList");
  if (squadsList) {
    const emptyText = squadsList.querySelector('.empty-text');
    if (emptyText) emptyText.remove();

    squadsList.innerHTML += `
      <div class="squad-card" style="border-left: 4px solid #00ff66;">
        <div class="squad-header">
          <span class="squad-emoji">${document.getElementById('clanLogo').value}</span>
          <span class="squad-skill-badge">LEADER</span>
        </div>
        <h3>${name} <span style="color:#888;font-size:12px;">${tag}</span></h3>
        <p class="squad-game">🎮 ${document.getElementById('clanGame').value}</p>
        <div class="squad-stats">
          <span>👥 1/20</span>
          <span>🏆 0 wins</span>
        </div>
      </div>
    `;
  }
};

