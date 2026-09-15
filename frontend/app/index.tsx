import { useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";

// Tyylit otsikoille, jotta ne ovat pinkkejä.
// Tämä CSSProperties auttaa varmistamaan, että käytämme oikeita CSS-ominaisuuksia.
const headingStyle: CSSProperties = {
  color: "#ff00ff", // Tämä tekee otsikoista pinkit!
  textTransform: "uppercase",
  letterSpacing: "2px",
  fontFamily: "sans-serif",
};

// Pääkomponentti, joka sisältää sovelluksesi logiikan ja käyttöliittymän.
function App() {
  // useState-hook hallitsee dark mode -tilan päälle/pois päältä.
  const [darkMode, setDarkMode] = useState(false);

  // Koko sivun tyylit, jotka vaihtuvat dark mode -tilan mukaan.
  const pageStyle: CSSProperties = {
    backgroundColor: darkMode ? "#1a1a1a" : "#ffffff", // Tumma tai vaalea tausta
    color: darkMode ? "#f0f0f0" : "#333333",         // Vaalea tai tumma teksti
    minHeight: "100vh", // Varmistaa, että tausta täyttää koko näytön
    margin: 0,
    padding: "2rem",
    textAlign: "center",
    fontFamily: "sans-serif",
    transition: "0.3s", // Pehmeä siirtymä tilojen välillä
  };

  // Painikkeen tyylit
  const buttonStyle: CSSProperties = {
    backgroundColor: "#ff00ff", // Pinkki tausta painikkeelle
    color: "#ffffff",           // Valkoinen teksti
    border: "none",
    padding: "10px 20px",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "16px",
    marginTop: "20px",
  };

  return (
    <div style={pageStyle}>
      <h1 style={headingStyle}>Uusi Päivitys</h1>
      <p>
        Jos näet tämän otsikon pinkkinä, päivitys on onnistunut!
      </p>

      <h2 style={headingStyle}>Alatason otsikko</h2>
      <p>Kokeile vaihtaa tilaa painikkeesta.</p>

      <button style={buttonStyle} onClick={() => setDarkMode(!darkMode)}>
        {darkMode ? "Vaihda päivätilaan" : "Vaihda dark mode"}
      </button>
    </div>
  );
}

// Tämä rivi renderöi App-komponentin sivulle.
// Se etsii HTML-tiedostosta elementin, jonka id on "root".
createRoot(document.getElementById("root")!).render(<App />);
