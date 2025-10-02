#!/bin/bash
# Beendet das Skript sofort, wenn ein Befehl fehlschlägt.
set -e

echo "Starte Anwendungs-Update..."

# 1. Neueste Änderungen von Git holen
echo "Lade neueste Änderungen von Git..."
git pull

# 2. Abhängigkeiten installieren/aktualisieren
echo "Installiere/aktualisiere npm-Abhängigkeiten..."
npm install

# 3. Anwendung bauen
echo "Baue die Anwendung..."
npm run build

echo "Update abgeschlossen! Bitte starten Sie den Anwendungs-Server bei Bedarf neu."