import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 8080;

// ES-Modul-Äquivalent für __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Statische Dateien aus dem 'dist'-Verzeichnis bereitstellen
app.use(express.static(path.join(__dirname, 'dist')));

// Für alle anderen Anfragen die index.html-Datei bereitstellen
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server läuft auf http://localhost:${port}`);
});