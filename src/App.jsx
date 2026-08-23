import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeJournal } from "./services/analyzeJournal";
import "./App.css";

const BLOOM_TARGET = 5; // water drops needed to reach bloom; also the number of progress dots

const GARDEN_COLS = 9;
const GARDEN_ROWS = 6;

const DAILY_SEEDS = [
  "What made you smile today?",
  "What are you grateful for today?",
  "What surprised you today?",
  "What felt difficult today?",
  "What did you learn today?",
  "Who helped you today?",
  "What are you proud of today?",
  "What would you like to remember about today?",
  "What gave you energy today?",
  "What would you do differently tomorrow?",
  "What small thing went well today?",
  "What has been on your mind lately?",
];

const WEEKDAY_LABELS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const FLOWER_CYCLE = ["🌷", "🌼", "🌸", "🌻", "🌺"];
const TABS = {
  JOURNAL: "journal",
  EXPLORE: "explore",
};

const PUBLIC_GARDENS = [
  {
    id: "aya",
    name: "Aya",
    blooms: 12,
    message: "Morning light on the balcony.",
    tone: "mint",
  },
  {
    id: "mika",
    name: "Mika",
    blooms: 8,
    message: "A slow garden after rain.",
    tone: "cream",
  },
  {
    id: "leo",
    name: "Leo",
    blooms: 4,
    message: "New sprouts near the window.",
    tone: "yellow",
  },
  {
    id: "hana",
    name: "Hana",
    blooms: 10,
    message: "Tiny blooms, gentle breeze.",
    tone: "pink",
  },
  {
    id: "sora",
    name: "Sora",
    blooms: 6,
    message: "Quiet greens this week.",
    tone: "mint",
  },
  {
    id: "nina",
    name: "Nina",
    blooms: 9,
    message: "Soft colors in the afternoon.",
    tone: "cream",
  },
  {
    id: "rui",
    name: "Rui",
    blooms: 7,
    message: "A tiny corner keeps growing.",
    tone: "pink",
  },
];

function getDailySeed() {
  const now = new Date();
  const dayIndex =
    now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return DAILY_SEEDS[dayIndex % DAILY_SEEDS.length];
}

function hashSeed(seed) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function seededShuffle(items, seed) {
  const next = [...items];
  let state = seed || 1;
  const random = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  return next;
}

function isSoilTile(x, y) {
  // Left bed: cols 1–4, rows 2–4
  if (x >= 1 && x <= 4 && y >= 2 && y <= 4) return true;
  // Right bed: cols 5–7, rows 1–3
  if (x >= 5 && x <= 7 && y >= 1 && y <= 3) return true;
  return false;
}

function getGardenStageFlowerCount(bloomCount) {
  if (bloomCount <= 0) return 0;
  if (bloomCount === 1) return 1;
  if (bloomCount === 2) return 2;
  if (bloomCount === 3) return 4;
  if (bloomCount === 4) return 5;
  if (bloomCount <= 7) return 7;
  return 9;
}

function buildGardenScene({ bloomCount, progress, seed }) {
  const flowerSpots = seededShuffle(
    [
      { x: 2, y: 2 },
      { x: 5, y: 1 },
      { x: 7, y: 2 },
      { x: 3, y: 3 },
      { x: 6, y: 3 },
      { x: 1, y: 3 },
      { x: 4, y: 2 },
      { x: 6, y: 1 },
      { x: 2, y: 4 },
      { x: 5, y: 3 },
    ],
    hashSeed(seed),
  );

  const flowerCount = Math.min(getGardenStageFlowerCount(bloomCount), flowerSpots.length);
  const flowers = flowerSpots.slice(0, flowerCount).map((spot, index) => ({
    ...spot,
    index,
    emoji: FLOWER_CYCLE[index % FLOWER_CYCLE.length],
  }));
  const usedSpots = new Set(flowers.map((spot) => `${spot.x},${spot.y}`));
  const nextSproutSpot = flowerSpots.find((spot) => !usedSpots.has(`${spot.x},${spot.y}`)) || { x: 4, y: 3 };

  const stones = [];
  if (bloomCount >= 2) stones.push({ x: 0, y: 4 });
  if (bloomCount >= 4) stones.push({ x: 8, y: 3 });
  if (bloomCount >= 7) stones.push({ x: 0, y: 2 });

  const pathTiles = bloomCount >= 5
    ? [{ x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }]
    : [];
  const bush = bloomCount >= 8 ? { x: 1, y: 2 } : null;
  const sprout = progress > 0 || bloomCount === 0 ? nextSproutSpot : null;

  return { flowers, stones, pathTiles, bush, sprout };
}

function summarizeGarden({ bloomCount, progress, hasSprout }) {
  const bloomsText = `${bloomCount} bloom${bloomCount === 1 ? "" : "s"}`;
  if (hasSprout) {
    const sproutStage = progress >= 3 ? "a growing sprout" : "a tiny sprout";
    return `Your garden has ${bloomsText} and ${sproutStage}.`;
  }
  return `Your garden has ${bloomsText}.`;
}

function getEmojiSize(y, compact) {
  if (compact) {
    if (y <= 1) return "22px";
    if (y <= 2) return "25px";
    if (y <= 3) return "28px";
    return "30px";
  }
  if (y <= 1) return "28px";
  if (y <= 2) return "32px";
  if (y <= 3) return "36px";
  return "40px";
}

function emojiOffset(x, y, seed, axis) {
  const n = hashSeed(`${x}:${y}:${axis}:${seed}`);
  return (n % 21) - 10; // −10 % to +10 % of the cell
}

function PixelGarden({ bloomCount, progress, seed, compact = false, tone = "mint", highlightFlowerIndex = null }) {
  const scene = useMemo(
    () => buildGardenScene({ bloomCount, progress, seed }),
    [bloomCount, progress, seed],
  );
  const summary = summarizeGarden({
    bloomCount,
    progress,
    hasSprout: Boolean(scene.sprout),
  });

  return (
    <figure
      className={`pixel-garden${compact ? " pixel-garden--compact" : ""} pixel-garden--${tone}`}
      role="img"
      aria-label={summary}
    >
      <div
        className="pixel-garden__grid"
        style={{
          gridTemplateColumns: `repeat(${GARDEN_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GARDEN_ROWS}, 1fr)`,
        }}
        aria-hidden="true"
      >
        {Array.from({ length: GARDEN_COLS * GARDEN_ROWS }, (_, i) => {
          const x = i % GARDEN_COLS;
          const y = Math.floor(i / GARDEN_COLS);
          const isSoil = isSoilTile(x, y);
          const isPath = scene.pathTiles.some((tile) => tile.x === x && tile.y === y);
          const tileClass = isPath ? "tile tile--path" : isSoil ? "tile tile--soil" : "tile tile--grass";

          return <span key={`tile-${x}-${y}`} className={tileClass} />;
        })}
        {scene.stones.map((stone) => (
          <span
            key={`stone-${stone.x}-${stone.y}`}
            className="garden-emoji"
            style={{
              gridColumn: stone.x + 1,
              gridRow: stone.y + 1,
              fontSize: getEmojiSize(stone.y, compact),
              transform: `translate(${emojiOffset(stone.x, stone.y, seed, "x")}%, ${emojiOffset(stone.x, stone.y, seed, "y")}%)`,
            }}
          >
            🪨
          </span>
        ))}
        {scene.flowers.map((flower) => (
          <span
            key={`flower-${flower.x}-${flower.y}`}
            className={`garden-emoji${flower.index === highlightFlowerIndex ? " garden-emoji--new" : ""}`}
            style={{
              gridColumn: flower.x + 1,
              gridRow: flower.y + 1,
              fontSize: getEmojiSize(flower.y, compact),
              transform: `translate(${emojiOffset(flower.x, flower.y, seed, "x")}%, ${emojiOffset(flower.x, flower.y, seed, "y")}%)`,
            }}
          >
            {flower.emoji}
          </span>
        ))}
        {scene.sprout && (
          <span
            className="garden-emoji"
            style={{
              gridColumn: scene.sprout.x + 1,
              gridRow: scene.sprout.y + 1,
              fontSize: getEmojiSize(scene.sprout.y, compact),
              transform: `translate(${emojiOffset(scene.sprout.x, scene.sprout.y, seed, "x")}%, ${emojiOffset(scene.sprout.x, scene.sprout.y, seed, "y")}%)`,
            }}
          >
            🌱
          </span>
        )}
        {scene.bush && (
          <span
            className="garden-emoji"
            style={{
              gridColumn: scene.bush.x + 1,
              gridRow: scene.bush.y + 1,
              fontSize: getEmojiSize(scene.bush.y, compact),
              transform: `translate(${emojiOffset(scene.bush.x, scene.bush.y, seed, "x")}%, ${emojiOffset(scene.bush.x, scene.bush.y, seed, "y")}%)`,
            }}
          >
            🌿
          </span>
        )}
      </div>
    </figure>
  );
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekDays(referenceDate = new Date()) {
  const startOfWeek = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - referenceDate.getDay(),
  );

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return date;
  });
}

function formatTodayDate(referenceDate = new Date()) {
  return referenceDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatJournalDateHeading(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Unknown day";
  const month = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  return `${month} ${date.getDate()}`;
}

function formatJournalTime(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatJournalDateTime(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getWeeklyJournalStatus(entries, referenceDate = new Date()) {
  const weekDays = getWeekDays(referenceDate);
  const todayKey = getLocalDateKey(referenceDate);
  const entryDateKeys = new Set();

  entries.forEach((entry) => {
    const entryDate = new Date(entry.createdAt);
    if (!Number.isNaN(entryDate.getTime())) {
      entryDateKeys.add(getLocalDateKey(entryDate));
    }
  });

  return weekDays.map((date) => {
    const key = getLocalDateKey(date);
    return {
      key,
      label: WEEKDAY_LABELS[date.getDay()],
      filled: entryDateKeys.has(key),
      isToday: key === todayKey,
    };
  });
}

function groupEntriesByDate(entries) {
  const sortedEntries = [...entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const groups = [];
  const groupMap = new Map();

  sortedEntries.forEach((entry) => {
    const date = new Date(entry.createdAt);
    if (Number.isNaN(date.getTime())) return;

    const key = getLocalDateKey(date);
    const existingGroup = groupMap.get(key);
    if (existingGroup) {
      existingGroup.entries.push(entry);
      return;
    }

    const newGroup = {
      key,
      label: formatJournalDateHeading(entry.createdAt),
      entries: [entry],
    };
    groupMap.set(key, newGroup);
    groups.push(newGroup);
  });

  return groups;
}

function ProgressDots({ progress, poppingIndex }) {
  return (
    <div className="progress-dots" aria-label={`${progress} of ${BLOOM_TARGET} drops`}>
      {Array.from({ length: BLOOM_TARGET }, (_, i) => (
        <span
          key={i}
          className={`dot${i < progress ? " dot--filled" : ""}${i === poppingIndex ? " dot--pop" : ""}`}
        />
      ))}
    </div>
  );
}

function GardenHero({ water, newBloomIndex, poppingDotIndex }) {
  const bloomCount = Math.floor(water / BLOOM_TARGET);
  const progress = water % BLOOM_TARGET;
  const justBloomed = water > 0 && progress === 0;
  const dropsUntilBloom = justBloomed ? 0 : BLOOM_TARGET - progress;

  return (
    <section className="hero-section">
      <div className="hero-dots" aria-hidden="true">
        <span className="hero-dot hero-dot--1" />
        <span className="hero-dot hero-dot--2" />
        <span className="hero-dot hero-dot--3" />
        <span className="hero-dot hero-dot--4" />
        <span className="hero-dot hero-dot--5" />
      </div>
      <PixelGarden
        bloomCount={bloomCount}
        progress={progress}
        seed="journal-garden"
        highlightFlowerIndex={newBloomIndex}
      />
      <ProgressDots progress={progress} poppingIndex={poppingDotIndex} />
      <p className="bloom-message">
        {dropsUntilBloom > 0
          ? `${dropsUntilBloom} drop${dropsUntilBloom === 1 ? "" : "s"} until it blooms`
          : "🌷 Your flower is blooming!"}
      </p>
    </section>
  );
}

function AnalysisCard({ analysis, visible }) {
  if (!analysis || !visible) return null;

  const getMessage = () => {
    if (analysis.error) return "🌙 Your reflection is safely planted.";
    if (analysis.water <= 0) return "🌙 Your reflection is safely planted.";

    if (analysis.gratitude > 0) return "🌼 Gratitude showed up in your reflection.";
    if (analysis.kindness > 0) return "🌿 A little kindness found its way into today.";
    if (analysis.reflection > 0) return "🌱 You took a moment to look inward.";
    if (analysis.growth > 0) return "🌷 There is a little growth in these words.";
    return "💧 Your words gave water to the garden.";
  };

  return (
    <div className={`analysis-card ${visible ? "analysis-card--visible" : ""}`}>
      {getMessage()}
    </div>
  );
}

function TodaySeed() {
  const seed = getDailySeed();
  return (
    <div className="today-seed">
      <span className="today-seed__date">{formatTodayDate()}</span>
      <span className="today-seed__label dot-label dot-label--seed">Today&apos;s seed</span>
      <p className="today-seed__prompt">{seed}</p>
    </div>
  );
}

function WeeklyJournalDots({ entries }) {
  const weeklyStatus = getWeeklyJournalStatus(entries);

  return (
    <section className="weekly-journal" aria-label="This week's journal entries">
      <p className="weekly-journal__label dot-label dot-label--week">This week</p>
      <div className="weekly-journal__row">
        {weeklyStatus.map((day) => (
          <div
            key={day.key}
            className={`weekly-journal__day${day.isToday ? " weekly-journal__day--today" : ""}`}
            aria-label={`${day.label}: ${day.filled ? "recorded" : "not recorded"}${day.isToday ? ", today" : ""}`}
          >
            <span className="weekly-journal__day-label">{day.label}</span>
            <span
              className={`weekly-journal__dot${day.filled ? " weekly-journal__dot--filled" : ""}${
                day.isToday ? " weekly-journal__dot--today" : ""
              }`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function JournalEntry({ entry, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const dateTimeLabel = formatJournalDateTime(entry.createdAt);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <article className="journal-card">
      <div className="journal-card__header">
        <span
          className="journal-card__time"
          title={dateTimeLabel}
          aria-label={dateTimeLabel}
        >
          {formatJournalTime(entry.createdAt)}
        </span>
        <div className="journal-card__menu-wrap" ref={menuRef}>
          <button
            className="menu-trigger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Entry options"
          >
            •••
          </button>
          {menuOpen && (
            <div className="menu-dropdown">
              <button
                className="menu-item menu-item--danger"
                onClick={() => { onDelete(entry.id); setMenuOpen(false); }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="journal-card__text">{entry.text}</p>
    </article>
  );
}

function WaterDrop({ animating }) {
  if (!animating) return null;
  return <span className="water-drop-anim">💧</span>;
}

function ExploreGardenCard({ garden }) {
  return (
    <article
      className={`public-garden-card public-garden-card--${garden.tone}`}
      aria-label={`${garden.name}'s Garden, ${garden.blooms} blooms`}
    >
      <h3 className="public-garden-card__title">{garden.name}&apos;s Garden</h3>
      <div className="public-garden-card__scene">
        <PixelGarden
          bloomCount={garden.blooms}
          progress={0}
          seed={`explore-${garden.id}`}
          compact
          tone={garden.tone}
        />
      </div>
      {garden.message && <p className="public-garden-card__message">{garden.message}</p>}
      <p className="public-garden-card__meta">
        {garden.blooms} blooms
      </p>
    </article>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState(TABS.JOURNAL);
  const [text, setText] = useState(() => sessionStorage.getItem("journalDraft") || "");
  const [entries, setEntries] = useState(() => {
    const saved = localStorage.getItem("journalEntries");
    return saved ? JSON.parse(saved) : [];
  });
  const [water, setWater] = useState(() => {
    const saved = localStorage.getItem("water");
    return saved ? Number(saved) : 0;
  });
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newBloomIndex, setNewBloomIndex] = useState(null);
  const [showBloomToast, setShowBloomToast] = useState(false);

  useEffect(() => { sessionStorage.setItem("journalDraft", text); }, [text]);
  useEffect(() => { localStorage.setItem("journalEntries", JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem("water", water); }, [water]);

  useEffect(() => {
    if (newBloomIndex === null) return;
    const timer = setTimeout(() => {
      setNewBloomIndex(null);
      setShowBloomToast(false);
    }, 2400);
    return () => clearTimeout(timer);
  }, [newBloomIndex]);

  const currentProgress = water % BLOOM_TARGET;
  const groupedEntries = useMemo(() => groupEntriesByDate(entries), [entries]);
  const poppingDotIndex = isAnimating && water > 0
    ? (currentProgress === 0 ? BLOOM_TARGET - 1 : currentProgress - 1)
    : -1;

  const handleSave = async () => {
    if (!text.trim() || isSaving) return;
    setIsSaving(true);
    setIsAnimating(true);
    setShowAnalysis(false);

    const analysis = await analyzeJournal(text);

    const newEntry = {
      id: Date.now(),
      text: text.trim(),
      createdAt: new Date().toISOString(),
      analysis,
    };

    setEntries((current) => [newEntry, ...current]);

    if (analysis.water > 0) {
      setWater((current) => {
        const prevBloomCount = Math.floor(current / BLOOM_TARGET);
        const nextWater = current + analysis.water;
        const nextBloomCount = Math.floor(nextWater / BLOOM_TARGET);
        if (nextBloomCount > prevBloomCount) {
          setNewBloomIndex(nextBloomCount - 1);
          setShowBloomToast(true);
        }
        return nextWater;
      });
    }

    setText("");
    sessionStorage.removeItem("journalDraft");
    setLastAnalysis(analysis);

    setTimeout(() => {
      setIsAnimating(false);
      setShowAnalysis(true);
      setIsSaving(false);
      setTimeout(() => setShowAnalysis(false), 4000);
    }, 800);
  };

  const handleDelete = (id) => {
    setEntries((current) => current.filter((e) => e.id !== id));
  };

  return (
    <main>
      <header>
        <h1>Garden Journal</h1>
        <p>Write. Reflect. Grow.</p>
      </header>

      <div className="tab-nav" role="tablist" aria-label="Views">
        <button
          id="tab-journal"
          type="button"
          role="tab"
          aria-controls="panel-journal"
          aria-selected={activeTab === TABS.JOURNAL}
          className={`tab-nav__button${activeTab === TABS.JOURNAL ? " tab-nav__button--active" : ""}`}
          onClick={() => setActiveTab(TABS.JOURNAL)}
        >
          Journal
        </button>
        <button
          id="tab-explore"
          type="button"
          role="tab"
          aria-controls="panel-explore"
          aria-selected={activeTab === TABS.EXPLORE}
          className={`tab-nav__button${activeTab === TABS.EXPLORE ? " tab-nav__button--active" : ""}`}
          onClick={() => setActiveTab(TABS.EXPLORE)}
        >
          Explore
        </button>
      </div>

      <section
        id="panel-journal"
        role="tabpanel"
        aria-labelledby="tab-journal"
        hidden={activeTab !== TABS.JOURNAL}
      >
        <h2 className="sr-only">Journal</h2>
        <GardenHero
          water={water}
          newBloomIndex={newBloomIndex}
          poppingDotIndex={poppingDotIndex}
        />

        {showBloomToast && (
          <p className="bloom-toast">A new flower bloomed! 🌸</p>
        )}

        <section className="write-section">
          <TodaySeed />
          <WeeklyJournalDots entries={entries} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
          />
          <div className="water-btn-wrap">
            <WaterDrop animating={isAnimating} />
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={isSaving || !text.trim()}
            >
              Water the garden 💧
            </button>
          </div>
          <AnalysisCard analysis={lastAnalysis} visible={showAnalysis} />
        </section>

        {entries.length > 0 && (
          <section className="journal-section">
            <h2 className="section-label dot-label">Past reflections</h2>
            <div className="journal-groups">
              {groupedEntries.map((group) => (
                <section key={group.key} className="journal-day-group">
                  <h3 className="journal-day-heading">{group.label}</h3>
                  <div className="cards-grid">
                    {group.entries.map((entry) => (
                      <JournalEntry key={entry.id} entry={entry} onDelete={handleDelete} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        )}
      </section>

      <section
        id="panel-explore"
        role="tabpanel"
        aria-labelledby="tab-explore"
        className="explore-section"
        hidden={activeTab !== TABS.EXPLORE}
      >
        <header className="explore-header">
          <h2>Explore gardens</h2>
          <p>A quiet collection of growing gardens.</p>
          <p className="explore-header__privacy">
            Only gardens are visible here — journal entries stay private.
          </p>
        </header>
        <div className="public-gardens-grid">
          {PUBLIC_GARDENS.map((garden) => (
            <ExploreGardenCard key={garden.id} garden={garden} />
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
