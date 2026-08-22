import { useEffect, useState } from "react";

function App() {
  const plantTypes = ["🌱", "🌿", "🌷", "🌻", "🌳"];

  const [text, setText] = useState(() => {
    return sessionStorage.getItem("journalDraft") || "";
  });

  const [entries, setEntries] = useState(() => {
    const savedEntries = localStorage.getItem("journalEntries");
    return savedEntries ? JSON.parse(savedEntries) : [];
  });

  const [plants, setPlants] = useState(() => {
    const savedPlants = localStorage.getItem("gardenPlants");
    return savedPlants ? JSON.parse(savedPlants) : [];
  });

  useEffect(() => {
    sessionStorage.setItem("journalDraft", text);
  }, [text]);

  useEffect(() => {
    localStorage.setItem("journalEntries", JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem("gardenPlants", JSON.stringify(plants));
  }, [plants]);

  const handleSave = () => {
    if (!text.trim()) return;

    const entryId = Date.now();

    const newEntry = {
      id: entryId,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const randomPlant =
      plantTypes[Math.floor(Math.random() * plantTypes.length)];

    const newPlant = {
      id: entryId,
      type: randomPlant,
    };

    setEntries((current) => [newEntry, ...current]);
    setPlants((current) => [...current, newPlant]);

    setText("");
    sessionStorage.removeItem("journalDraft");
  };

  return (
    <main>
      <h1>My Garden</h1>

      <section>
        <h2>Garden</h2>

        {plants.length === 0 ? (
          <p>Your garden is empty.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 64px)",
              gap: "8px",
              padding: "16px",
              backgroundColor: "#d9f0c7",
              width: "fit-content",
              borderRadius: "12px",
            }}
          >
            {plants.map((plant) => (
              <div
                key={plant.id}
                style={{
                  width: "64px",
                  height: "64px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "40px",
                  backgroundColor: "#b7dc95",
                  borderRadius: "8px",
                }}
              >
                {plant.type}
              </div>
            ))}
          </div>
        )}
      </section>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write about your day..."
      />

      <br />

      <button onClick={handleSave}>Save</button>

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