import { useEffect, useState } from "react";

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

  const analyzeJournal = (journalText) => {
    const positiveWords = [
      "good",
      "happy",
      "thanks",
      "thank you",
      "grateful",
      "helped",
      "enjoyed",
      "great",
    ];

    const lowerText = journalText.toLowerCase();

    return positiveWords.some((word) =>
      lowerText.includes(word)
    );
  };

  const handleSave = () => {
    if (!text.trim()) return;

    const newEntry = {
      id: Date.now(),
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    setEntries((current) => [
      newEntry,
      ...current,
    ]);

    const isPositive = analyzeJournal(text);

    if (isPositive) {
      setWater((current) => current + 1);
    }

    setText("");
    sessionStorage.removeItem("journalDraft");
  };

  const plant =
    water >= 5
      ? "🌷"
      : water >= 2
      ? "🌿"
      : "🌱";

  return (
    <main>
      <h1>My Garden</h1>

      <section>
        <h2>Garden</h2>

        <div style={{ fontSize: "80px" }}>
          {plant}
        </div>

        <p>💧 Water: {water}</p>
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
                {new Date(
                  entry.createdAt
                ).toLocaleString()}
              </small>
              <p>{entry.text}</p>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

export default App;