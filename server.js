const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- API-Routen ---
// Hier definieren Sie die Endpunkte für Ihr Backend.
// Jeder Endpunkt ersetzt eine Supabase-Funktion.
// Beispiel:
app.get('/api/users', (req, res) => {
  // Hier würden Sie Ihre Datenbank abfragen, um Benutzer zu holen.
  // const users = await db.query('SELECT * FROM users');
  // res.json(users);
  console.log('Anfrage an /api/users empfangen');
  res.json({ message: 'Dies ist Ihre Benutzer-API!' });
});

// --- Frontend ausliefern ---
// 1. Sagen Sie Express, dass es alle statischen Dateien (Bilder, CSS, JS)
//    aus dem 'dist'-Ordner bereitstellen soll.
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Eine "Catch-All"-Route. Wenn keine API-Route passt, wird die
//    Haupt-HTML-Datei der React-App gesendet. Das ist entscheidend,
//    damit der React Router die URL-Verwaltung im Browser übernehmen kann.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


// --- Server starten ---
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});