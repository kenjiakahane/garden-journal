import { useEffect, useState } from "react";

function App() {
  const plants = ["🌱", "🌿", "🌷", "🌳"];

  const [text, setText] = useState(() => {
    return sessionStorage.getItem("journalDraft") || "";
  });

  const [stage, setStage] = useState(() => {
    const savedStage = localStorage.getItem("gardenStage");
    return savedStage ? Number(savedStage) : 0;
  });

  const [entries, setEntries] = useState(() => {
    const savedEntries = localStorage.getItem("journalEntries");
    return savedEntries ? JSON.parse(savedEntries) : [];
  });

  // 書きかけの日記をセッション保存
  useEffect(() => {
    sessionStorage.setItem("journalDraft", text);
  }, [text]);

  // 庭の成長状態を保存
  useEffect(() => {
    localStorage.setItem("gardenStage", stage);
  }, [stage]);

  // 日記履歴を保存
  useEffect(() => {
    localStorage.setItem("journalEntries", JSON.stringify(entries));
  }, [entries]);

  const handleSave = () => {
    if (!text.trim()) return;

    const newEntry = {
      id: Date.now(),
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    setEntries((current) => [newEntry, ...current]);

    setStage((current) =>
      Math.min(current + 1, plants.length - 1)
    );

    setText("");
    sessionStorage.removeItem("journalDraft");
  };

  return (
    <main>
      <h1>My Garden</h1>

      <div style={{ fontSize: "80px" }}>
        {plants[stage]}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write about your day..."
      />

      <br />

      <button onClick={handleSave}>
        Save
      </button>

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
          </article>
        ))
      )}
    </main>
  );
}

export default App;