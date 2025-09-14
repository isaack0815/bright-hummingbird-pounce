console.log("--- Starting server.js (ESM Version vom 24.07.2024) ---");

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT;

if (!port) {
  console.error("FATAL ERROR: The PORT environment variable is not set. The server cannot start.");
  process.exit(1);
}

// ES-Modul-Äquivalent für __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, 'dist');

// Logging-Middleware, um jede Anfrage zu protokollieren
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Request received for: ${req.path}`);
  next();
});

// Statische Dateien aus dem 'dist'-Verzeichnis bereitstellen
app.use(express.static(distPath));

// Für alle anderen Anfragen die index.html-Datei bereitstellen (SPA-Fallback)
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.dev.html');
  console.log(`[FALLBACK] Path "${req.path}" not found in static assets. Serving: ${indexPath}`);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error(`Error sending file ${indexPath}:`, err);
      res.status(500).send('Error serving the application.');
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Serving static files from: ${distPath}`);
});