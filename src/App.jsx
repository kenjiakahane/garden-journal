import { useState } from "react";

function App() {
  const [text, setText] = useState("");
  const [stage, setStage] = useState(0);

  const plants = ["🌱", "🌿", "🌷", "🌳"];

  const handleSave = () => {
    if (!text.trim()) return;

    setStage((current) =>
      Math.min(current + 1, plants.length - 1)
    );

    setText("");
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
    </main>
  );
}

export default App;