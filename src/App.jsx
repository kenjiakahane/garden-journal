import { useEffect, useState } from "react";
import { analyzeJournal } from "./services/analyzeJournal";
import "./App.css";

function App() {
  const [text, setText] = useState(() => {
    return sessionStorage.getItem("journalDraft") || "";
  });

  const [entries, setEntries] = useState(() => {
    const savedEntries = localStorage.getItem("journalEntries");
    return savedEntries ? JSON.parse(savedEntries) : [];
  });

  const [water, setWater] = useState(() => {
    const savedWater = localStorage.getItem("water");
    return savedWater ? Number(savedWater) : 0;
  });

  const [lastAnalysis, setLastAnalysis] = useState(null);

  useEffect(() => {
    sessionStorage.setItem("journalDraft", text);
  }, [text]);

  useEffect(() => {
    localStorage.setItem(
      "journalEntries",
      JSON.stringify(entries)
    );
  }, [entries]);

  useEffect(() => {
    localStorage.setItem("water", water);
  }, [water]);

  const handleSave = async () => {
    if (!text.trim()) return;

    const analysis = await analyzeJournal(text);
    setLastAnalysis(analysis);

    const newEntry = {
      id: Date.now(),
      text: text.trim(),
      createdAt: new Date().toISOString(),
      analysis,
    };

    setEntries((current) => [
      newEntry,
      ...current,
    ]);

    if (analysis.water > 0) {
      setWater((current) => current + analysis.water);
    }

    setText("");
    sessionStorage.removeItem("journalDraft");
  };

  const handleDelete = (id) => {
    setEntries((current) =>
      current.filter((entry) => entry.id !== id)
    );
  };

  const handleResetGarden = () => {
    const confirmed = window.confirm(
      "Reset your garden to the beginning?"
    );

    if (!confirmed) return;

    setWater(0);
  };

  const plant =
    water >= 5
      ? "🌷"
      : water >= 2
      ? "🌿"
      : "🌱";

  const nextGrowth =
  water < 2
    ? { target: 2, label: "until your plant grows" }
    : water < 5
    ? { target: 5, label: "until your flower blooms" }
    : null;

const progress =
  nextGrowth
    ? Math.min((water / nextGrowth.target) * 100, 100)
    : 100;

  return (
    <main>
      <header>
        <h1>Garden Journal</h1>
        <p>Write. Reflect. Grow.</p>
      </header>

      <section>
        <section className="garden">
          <h2>Garden</h2>

          <div className="plant">
            {plant}
          </div>

          <p className="water">
            💧 Water: {water}
            {nextGrowth ? (
              <div className="growth-progress">
                <div className="growth-row">
                  <span>
                    💧 {water} / {nextGrowth.target}
                  </span>

                  <span>
                    {nextGrowth.target - water} more
                  </span>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <p className="growth-message">
                  {nextGrowth.target - water} more water {nextGrowth.label}.
                </p>
              </div>
            ) : (
              <p className="growth-message">
                🌷 Your flower is blooming.
              </p>
            )}
          </p>

          <button
            className="secondary"
            onClick={handleResetGarden}
          >
            Reset Garden
          </button>
        </section>
        {lastAnalysis && (
          <div>
            {lastAnalysis.error ? (
              <p>
                🌙 Your entry was saved, but the garden could not analyze it this time.
              </p>
            ) : lastAnalysis.water > 0 ? (
              <>
                <p>💧 Your words gave water to the garden.</p>

                <ul>
                  {lastAnalysis.gratitude > 0 && (
                    <li>🌼 Gratitude was found in your words.</li>
                  )}

                  {lastAnalysis.kindness > 0 && (
                    <li>🤝 Your words showed kindness.</li>
                  )}

                  {lastAnalysis.reflection > 0 && (
                    <li>🌿 You reflected on your experience.</li>
                  )}

                  {lastAnalysis.growth > 0 && (
                    <li>🌱 Your words showed personal growth.</li>
                  )}
                </ul>
              </>
            ) : (
              <p>🌙 Your entry was saved. The garden is resting today.</p>
            )}
          </div>
        )}
      </section>

      <section>
        <h2>Write Journal</h2>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write about your day..."
        />

        <br />

        <button onClick={handleSave}>
          Save
        </button>
      </section>

      <section>
        <h2>Journal</h2>

        {entries.length === 0 ? (
          <p>No entries yet.</p>
        ) : (
          entries.map((entry) => (
            <article key={entry.id}>
              <small>
                {new Date(entry.createdAt).toLocaleString()}
              </small>

              <p>{entry.text}</p>

              <button onClick={() => handleDelete(entry.id)}>
                Delete
              </button>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

export default App;