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
const GARDEN_STATE_KEY = "gardenState";
const TABS = {
  JOURNAL: "journal",
  EXPLORE: "explore",
};

const LEGACY_FLOWER_SPOTS = [
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
];

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

function toCellKey(x, y) {
  return `${x},${y}`;
}

function getGardenDecorations(bloomCount) {
  const stones = [];
  if (bloomCount >= 2) stones.push({ x: 0, y: 4 });
  if (bloomCount >= 4) stones.push({ x: 8, y: 3 });
  if (bloomCount >= 7) stones.push({ x: 0, y: 2 });

  const pathTiles = bloomCount >= 5
    ? [{ x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }]
    : [];
  const bush = bloomCount >= 8 ? { x: 1, y: 2 } : null;

  return { stones, pathTiles, bush };
}

function normalizePlant(raw) {
  if (!raw || typeof raw !== "object") return null;
  const cycle = Number(raw.cycle);
  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!Number.isInteger(cycle) || cycle < 0) return null;
  if (!Number.isInteger(x) || x < 0 || x >= GARDEN_COLS) return null;
  if (!Number.isInteger(y) || y < 0 || y >= GARDEN_ROWS) return null;
  const flowerType = typeof raw.flowerType === "string" && raw.flowerType
    ? raw.flowerType
    : FLOWER_CYCLE[cycle % FLOWER_CYCLE.length];
  return {
    id: typeof raw.id === "string" ? raw.id : `plant-${cycle}`,
    cycle,
    x,
    y,
    flowerType,
  };
}

function getDeterministicSpots() {
  const allCells = [];
  for (let y = 0; y < GARDEN_ROWS; y += 1) {
    for (let x = 0; x < GARDEN_COLS; x += 1) {
      const isPathCell = y === 5 && x >= 3 && x <= 5;
      const isStoneCell = (x === 0 && y === 4) || (x === 8 && y === 3) || (x === 0 && y === 2);
      const isBushCell = x === 1 && y === 2;
      if (isPathCell || isStoneCell || isBushCell) continue;
      allCells.push({ x, y });
    }
  }
  return seededShuffle(allCells, hashSeed("journal-garden-default-spots"));
}

function loadOrMigrateGardenState(waterValue) {
  const saved = localStorage.getItem(GARDEN_STATE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const savedPlants = Array.isArray(parsed?.plants)
        ? parsed.plants.map(normalizePlant).filter(Boolean)
        : [];
      const seenCycles = new Set();
      const deduped = savedPlants
        .sort((a, b) => a.cycle - b.cycle)
        .filter((plant) => {
          if (seenCycles.has(plant.cycle)) return false;
          seenCycles.add(plant.cycle);
          return true;
        });
      const pendingSproutCycle = Number.isInteger(parsed?.pendingSproutCycle) && parsed.pendingSproutCycle >= 0
        ? parsed.pendingSproutCycle
        : null;
      return { plants: deduped, pendingSproutCycle };
    } catch {
      // Fall through to migration.
    }
  }

  const bloomCount = Math.floor(waterValue / BLOOM_TARGET);
  const progress = waterValue % BLOOM_TARGET;
  const migratedCycles = bloomCount + (progress > 0 || bloomCount === 0 ? 1 : 0);
  const deterministicSpots = [...LEGACY_FLOWER_SPOTS, ...getDeterministicSpots()];
  const plants = Array.from({ length: migratedCycles }, (_, cycle) => {
    const spot = deterministicSpots[cycle];
    if (!spot) return null;
    return {
      id: `plant-${cycle}`,
      cycle,
      x: spot.x,
      y: spot.y,
      flowerType: FLOWER_CYCLE[cycle % FLOWER_CYCLE.length],
    };
  }).filter(Boolean);
  return { plants, pendingSproutCycle: null };
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

function buildExploreGardenScene({ bloomCount, progress, seed }) {
  const flowerSpots = seededShuffle(
    LEGACY_FLOWER_SPOTS,
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
  const { stones, pathTiles, bush } = getGardenDecorations(bloomCount);
  const sprout = progress > 0 || bloomCount === 0 ? nextSproutSpot : null;

  return { flowers, stones, pathTiles, bush, sprout };
}

function getPlantStage(cycle, bloomCount, progress) {
  if (cycle < bloomCount) return "flower";
  if (cycle > bloomCount) return null;
  return progress >= 3 ? "plant" : "sprout";
}

function summarizeGarden({ bloomCount, progress, hasSprout, plantingMode }) {
  if (plantingMode) return "Planting mode. Choose an empty spot for your new sprout.";
  const bloomsText = `${bloomCount} bloom${bloomCount === 1 ? "" : "s"}`;
  if (hasSprout) {
    const sproutStage = progress >= 3 ? "a growing sprout" : "a tiny sprout";
    return `Your garden has ${bloomsText} and ${sproutStage}.`;
  }
  return `Your garden has ${bloomsText}.`;
}

function buildJournalGardenScene({ bloomCount, progress, plants, pendingSproutCycle }) {
  const stagedPlants = plants
    .map((plant) => {
      const stage = getPlantStage(plant.cycle, bloomCount, progress);
      if (!stage) return null;
      return {
        ...plant,
        stage,
        emoji: stage === "flower" ? plant.flowerType : stage === "plant" ? "🌿" : "🌱",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.cycle - b.cycle);

  const occupiedKeys = new Set(stagedPlants.map((plant) => toCellKey(plant.x, plant.y)));
  const decorations = getGardenDecorations(bloomCount);
  const stones = decorations.stones.filter((stone) => !occupiedKeys.has(toCellKey(stone.x, stone.y)));
  const bush = decorations.bush && !occupiedKeys.has(toCellKey(decorations.bush.x, decorations.bush.y))
    ? decorations.bush
    : null;
  const pathTiles = decorations.pathTiles.filter((tile) => !occupiedKeys.has(toCellKey(tile.x, tile.y)));

  stones.forEach((stone) => occupiedKeys.add(toCellKey(stone.x, stone.y)));
  if (bush) occupiedKeys.add(toCellKey(bush.x, bush.y));

  const pathKeySet = new Set(pathTiles.map((tile) => toCellKey(tile.x, tile.y)));
  const allPlantableCells = [];
  for (let y = 0; y < GARDEN_ROWS; y += 1) {
    for (let x = 0; x < GARDEN_COLS; x += 1) {
      if (pathKeySet.has(toCellKey(x, y))) continue;
      allPlantableCells.push({ x, y });
    }
  }

  const emptyCells = allPlantableCells.filter((cell) => !occupiedKeys.has(toCellKey(cell.x, cell.y)));
  const canPlant = pendingSproutCycle !== null && emptyCells.length > 0;

  return {
    plants: stagedPlants,
    stones,
    bush,
    pathTiles,
    emptyCells,
    canPlant,
  };
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

function PixelGarden({
  bloomCount,
  progress,
  seed,
  compact = false,
  tone = "mint",
  highlightFlowerIndex = null,
  plants = null,
  pendingSproutCycle = null,
  onPlantSprout = null,
  newlyPlantedCycle = null,
}) {
  const gardenSeed = seed || "journal-garden";
  const scene = useMemo(
    () => (plants
      ? buildJournalGardenScene({ bloomCount, progress, plants, pendingSproutCycle })
      : buildExploreGardenScene({ bloomCount, progress, seed: gardenSeed })),
    [bloomCount, progress, plants, pendingSproutCycle, gardenSeed],
  );
  const plantingMode = Boolean(plants && onPlantSprout && scene.canPlant);
  const occupiedCellSet = useMemo(
    () => new Set([
      ...(scene.plants || []).map((plant) => toCellKey(plant.x, plant.y)),
      ...scene.stones.map((stone) => toCellKey(stone.x, stone.y)),
      ...(scene.bush ? [toCellKey(scene.bush.x, scene.bush.y)] : []),
    ]),
    [scene.bush, scene.plants, scene.stones],
  );
  const allCells = useMemo(() => {
    const cells = [];
    for (let y = 0; y < GARDEN_ROWS; y += 1) {
      for (let x = 0; x < GARDEN_COLS; x += 1) {
        cells.push({ x, y });
      }
    }
    return cells;
  }, []);
  const pathCellSet = useMemo(
    () => new Set(scene.pathTiles.map((tile) => toCellKey(tile.x, tile.y))),
    [scene.pathTiles],
  );
  const summary = summarizeGarden({
    bloomCount,
    progress,
    hasSprout: plants ? scene.plants.some((plant) => plant.stage !== "flower") : Boolean(scene.sprout),
    plantingMode,
  });

  return (
    <figure
      className={`pixel-garden${compact ? " pixel-garden--compact" : ""} pixel-garden--${tone}`}
      role={plantingMode ? "group" : "img"}
      aria-label={summary}
    >
      <div
        className="pixel-garden__grid"
        style={{
          gridTemplateColumns: `repeat(${GARDEN_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GARDEN_ROWS}, 1fr)`,
        }}
        aria-hidden={plantingMode ? undefined : "true"}
      >
        {Array.from({ length: GARDEN_COLS * GARDEN_ROWS }, (_, i) => {
          const x = i % GARDEN_COLS;
          const y = Math.floor(i / GARDEN_COLS);
          const isSoil = isSoilTile(x, y);
          const isPath = scene.pathTiles.some((tile) => tile.x === x && tile.y === y);
          const tileClass = isPath ? "tile tile--path" : isSoil ? "tile tile--soil" : "tile tile--grass";

          return <span key={`tile-${x}-${y}`} className={tileClass} aria-hidden="true" />;
        })}
        {scene.stones.map((stone) => (
          <span
            key={`stone-${stone.x}-${stone.y}`}
            className="garden-emoji"
            aria-hidden="true"
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
        {(scene.flowers || []).map((flower) => (
          <span
            key={`flower-${flower.x}-${flower.y}`}
            className={`garden-emoji${flower.index === highlightFlowerIndex ? " garden-emoji--new" : ""}`}
            aria-hidden="true"
            style={{
              gridColumn: flower.x + 1,
              gridRow: flower.y + 1,
              fontSize: getEmojiSize(flower.y, compact),
              transform: `translate(${emojiOffset(flower.x, flower.y, gardenSeed, "x")}%, ${emojiOffset(flower.x, flower.y, gardenSeed, "y")}%)`,
            }}
          >
            {flower.emoji}
          </span>
        ))}
        {scene.sprout && (
          <span
            className="garden-emoji"
            aria-hidden="true"
            style={{
              gridColumn: scene.sprout.x + 1,
              gridRow: scene.sprout.y + 1,
              fontSize: getEmojiSize(scene.sprout.y, compact),
              transform: `translate(${emojiOffset(scene.sprout.x, scene.sprout.y, gardenSeed, "x")}%, ${emojiOffset(scene.sprout.x, scene.sprout.y, gardenSeed, "y")}%)`,
            }}
          >
            🌱
          </span>
        )}
        {scene.plants && scene.plants.map((plant) => (
          <span
            key={`plant-${plant.cycle}`}
            className={`garden-emoji${plant.cycle === newlyPlantedCycle ? " garden-emoji--planted" : ""}`}
            aria-hidden="true"
            style={{
              gridColumn: plant.x + 1,
              gridRow: plant.y + 1,
              fontSize: getEmojiSize(plant.y, compact),
              transform: `translate(${emojiOffset(plant.x, plant.y, gardenSeed, "x")}%, ${emojiOffset(plant.x, plant.y, gardenSeed, "y")}%)`,
            }}
          >
            {plant.emoji}
          </span>
        ))}
        {scene.bush && (
          <span
            className="garden-emoji"
            aria-hidden="true"
            style={{
              gridColumn: scene.bush.x + 1,
              gridRow: scene.bush.y + 1,
              fontSize: getEmojiSize(scene.bush.y, compact),
              transform: `translate(${emojiOffset(scene.bush.x, scene.bush.y, gardenSeed, "x")}%, ${emojiOffset(scene.bush.x, scene.bush.y, gardenSeed, "y")}%)`,
            }}
          >
            🌿
          </span>
        )}
        {plantingMode && (
          <div
            className="garden-planting-layer"
            role="group"
            aria-label="Select where to plant your sprout"
            style={{
              "--garden-cols": GARDEN_COLS,
              "--garden-rows": GARDEN_ROWS,
            }}
          >
            {allCells.map((cell) => {
              const occupied = occupiedCellSet.has(toCellKey(cell.x, cell.y)) || pathCellSet.has(toCellKey(cell.x, cell.y));
              return (
                <button
                  key={`plant-cell-${cell.x}-${cell.y}`}
                  type="button"
                  className={`garden-planting-cell${occupied ? " garden-planting-cell--disabled" : ""}`}
                  onClick={() => {
                    if (occupied) return;
                    onPlantSprout(cell.x, cell.y);
                  }}
                  disabled={occupied}
                  aria-label={`Plant sprout at row ${cell.y + 1}, column ${cell.x + 1}`}
                  style={{
                    gridColumn: cell.x + 1,
                    gridRow: cell.y + 1,
                  }}
                />
              );
            })}
          </div>
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

function GardenHero({
  water,
  newBloomIndex,
  poppingDotIndex,
  plants,
  pendingSproutCycle,
  onPlantSprout,
  newlyPlantedCycle,
  isGardenFull,
}) {
  const bloomCount = Math.floor(water / BLOOM_TARGET);
  const progress = water % BLOOM_TARGET;
  const justBloomed = water > 0 && progress === 0;
  const dropsUntilBloom = justBloomed ? 0 : BLOOM_TARGET - progress;
  const plantingMode = pendingSproutCycle !== null && !isGardenFull;

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
        plants={plants}
        pendingSproutCycle={pendingSproutCycle}
        onPlantSprout={onPlantSprout}
        newlyPlantedCycle={newlyPlantedCycle}
      />
      {plantingMode && (
        <p className="planting-message">Where should this sprout grow?</p>
      )}
      {isGardenFull && (
        <p className="garden-full-message">Your garden is full of life.</p>
      )}
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
    if (analysis.error) return "💧 Your reflection has been planted.";
    if (analysis.safetyConcern) return "🌙 Your reflection has been safely received.";

    if (analysis.gratitude > 0) return "🌼 Gratitude showed up in your reflection.";
    if (analysis.kindness > 0) return "🌿 A little kindness found its way into today.";
    if (analysis.reflection > 0) return "🌱 You took a moment to look inward.";
    if (analysis.growth > 0) return "🌷 There is a little growth in these words.";
    return "💧 Your reflection has been planted.";
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
  const [gardenState, setGardenState] = useState(() => loadOrMigrateGardenState(water));
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newBloomIndex, setNewBloomIndex] = useState(null);
  const [newlyPlantedCycle, setNewlyPlantedCycle] = useState(null);
  const [isGardenFull, setIsGardenFull] = useState(false);
  const [showBloomToast, setShowBloomToast] = useState(false);

  useEffect(() => { sessionStorage.setItem("journalDraft", text); }, [text]);
  useEffect(() => { localStorage.setItem("journalEntries", JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem("water", water); }, [water]);
  useEffect(() => { localStorage.setItem(GARDEN_STATE_KEY, JSON.stringify(gardenState)); }, [gardenState]);

  useEffect(() => {
    if (newBloomIndex === null) return;
    const timer = setTimeout(() => {
      setNewBloomIndex(null);
      setShowBloomToast(false);
    }, 2400);
    return () => clearTimeout(timer);
  }, [newBloomIndex]);

  useEffect(() => {
    if (newlyPlantedCycle === null) return;
    const timer = setTimeout(() => setNewlyPlantedCycle(null), 450);
    return () => clearTimeout(timer);
  }, [newlyPlantedCycle]);

  const currentProgress = water % BLOOM_TARGET;
  const groupedEntries = useMemo(() => groupEntriesByDate(entries), [entries]);
  const poppingDotIndex = isAnimating && water > 0
    ? (currentProgress === 0 ? BLOOM_TARGET - 1 : currentProgress - 1)
    : -1;

  const handlePlantSprout = (x, y) => {
    if (gardenState.pendingSproutCycle === null) return;
    const activeScene = buildJournalGardenScene({
      bloomCount: Math.floor(water / BLOOM_TARGET),
      progress: water % BLOOM_TARGET,
      plants: gardenState.plants,
      pendingSproutCycle: gardenState.pendingSproutCycle,
    });
    const canPlant = activeScene.emptyCells.some((cell) => cell.x === x && cell.y === y);
    if (!canPlant) return;
    const cycle = gardenState.pendingSproutCycle;
    setGardenState({
      plants: [
        ...gardenState.plants,
        {
          id: `plant-${cycle}`,
          cycle,
          x,
          y,
          flowerType: FLOWER_CYCLE[cycle % FLOWER_CYCLE.length],
        },
      ],
      pendingSproutCycle: null,
    });
    setNewlyPlantedCycle(cycle);
    setIsGardenFull(false);
  };

  const handleSave = async () => {
    if (!text.trim() || isSaving) return;
    setIsSaving(true);
    setIsAnimating(false);
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
      setIsAnimating(true);
      const prevBloomCount = Math.floor(water / BLOOM_TARGET);
      const nextWater = water + analysis.water;
      const nextBloomCount = Math.floor(nextWater / BLOOM_TARGET);
      setWater(nextWater);
      if (nextBloomCount > prevBloomCount) {
        setNewBloomIndex(nextBloomCount - 1);
        setShowBloomToast(true);
        if (gardenState.pendingSproutCycle === null) {
          const nextCycle = nextBloomCount;
          if (!gardenState.plants.some((plant) => plant.cycle === nextCycle)) {
            const nextScene = buildJournalGardenScene({
              bloomCount: nextBloomCount,
              progress: nextWater % BLOOM_TARGET,
              plants: gardenState.plants,
              pendingSproutCycle: nextCycle,
            });
            const hasOpenSpot = nextScene.emptyCells.length > 0;
            setIsGardenFull(!hasOpenSpot);
            if (hasOpenSpot) {
              setGardenState((previous) => {
                if (previous.pendingSproutCycle !== null) return previous;
                if (previous.plants.some((plant) => plant.cycle === nextCycle)) return previous;
                return {
                  ...previous,
                  pendingSproutCycle: nextCycle,
                };
              });
            }
          } else {
            setIsGardenFull(false);
          }
        }
      }
    }

    setText("");
    sessionStorage.removeItem("journalDraft");
    setLastAnalysis(analysis);

    const revealDelay = analysis.water > 0 ? 800 : 0;
    setTimeout(() => {
      setIsAnimating(false);
      setShowAnalysis(true);
      setIsSaving(false);
      setTimeout(() => setShowAnalysis(false), 4000);
    }, revealDelay);
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
          plants={gardenState.plants}
          pendingSproutCycle={gardenState.pendingSproutCycle}
          onPlantSprout={handlePlantSprout}
          newlyPlantedCycle={newlyPlantedCycle}
          isGardenFull={isGardenFull}
        />

        {showBloomToast && (
          <p className="bloom-toast">A new flower bloomed! 🌸</p>
        )}

        <section className="write-section">
          <TodaySeed />
          <WeeklyJournalDots entries={entries} />
          <p className="water-rule-copy">Every reflection waters your garden.</p>
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
