import { useEffect, useRef, useState } from "react";
import { analyzeJournal } from "./services/analyzeJournal";
import "./App.css";

const BLOOM_TARGET = 5; // water drops needed to reach bloom; also the number of progress dots

const FLOWER_CYCLE = ["🌷", "🌼", "🌸", "🌻", "🌺", "💐"];

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

function getDailySeed() {
  const now = new Date();
  const dayIndex =
    now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return DAILY_SEEDS[dayIndex % DAILY_SEEDS.length];
}

function getPastFlowers(bloomCount) {
  return Array.from({ length: bloomCount }, (_, i) => FLOWER_CYCLE[i % FLOWER_CYCLE.length]);
}

function ProgressDots({ progress }) {
  return (
    <div className="progress-dots" aria-label={`${progress} of ${BLOOM_TARGET} drops`}>
      {Array.from({ length: BLOOM_TARGET }, (_, i) => (
        <span key={i} className={i < progress ? "dot dot--filled" : "dot"} />
      ))}
    </div>
  );
}

function GardenHero({ water, plant, isAnimating, newBloomIndex }) {
  const bloomCount = Math.floor(water / BLOOM_TARGET);
  const progress = water % BLOOM_TARGET;
  const justBloomed = water > 0 && progress === 0;
  const dropsUntilBloom = justBloomed ? 0 : BLOOM_TARGET - progress;
  const pastFlowers = getPastFlowers(bloomCount);

  return (
    <section className="hero-section">
      {pastFlowers.length > 0 && (
        <div className="past-flowers" aria-label={`${bloomCount} flower${bloomCount === 1 ? "" : "s"} bloomed`}>
          {pastFlowers.map((f, i) => (
            <span
              key={i}
              className={`past-flower${i === newBloomIndex ? " past-flower--new" : ""}`}
            >
              {f}
            </span>
          ))}
        </div>
      )}
      <div className={`plant-emoji ${isAnimating ? "plant-emoji--grow" : ""}`}>
        {plant}
      </div>
      <ProgressDots progress={progress} />
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
      <span className="today-seed__label">Today&apos;s seed</span>
      <p className="today-seed__prompt">{seed}</p>
    </div>
  );
}

function JournalEntry({ entry, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const formattedDate = (() => {
    const d = new Date(entry.createdAt);
    const month = d.toLocaleString("en", { month: "short" }).toUpperCase();
    const day = d.getDate();
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${month} ${day} · ${hours}:${mins}`;
  })();

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
        <span className="journal-card__date">{formattedDate}</span>
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

function App() {
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
  const plant = currentProgress >= 2 ? "🌿" : "🌱";

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

      <GardenHero water={water} plant={plant} isAnimating={isAnimating} newBloomIndex={newBloomIndex} />

      {showBloomToast && (
        <p className="bloom-toast">A new flower bloomed! 🌸</p>
      )}

      <section className="write-section">
        <TodaySeed />
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
          <h2 className="section-label">Past reflections</h2>
          <div className="cards-grid">
            {entries.map((entry) => (
              <JournalEntry key={entry.id} entry={entry} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
