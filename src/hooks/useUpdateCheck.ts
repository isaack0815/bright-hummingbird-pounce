import { useState, useEffect } from 'react';

// WICHTIG: Bitte ersetzen Sie dies durch Ihren GitHub-Benutzernamen und Repository-Namen.
const GITHUB_REPO = 'isaack0815/bright-hummingbird-pounce'; 
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Alle 5 Minuten

const currentCommitHash = import.meta.env.VITE_APP_COMMIT_HASH;

export const useUpdateCheck = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!currentCommitHash || GITHUB_REPO === 'YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME') {
      console.warn('Update-Check deaktiviert: VITE_APP_COMMIT_HASH oder GITHUB_REPO nicht konfiguriert.');
      return;
    }

    const checkForUpdates = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/main`);
        if (!response.ok) {
          // GitHub API hat ein Ratenlimit, also nicht als Fehler loggen, wenn es nur das ist.
          if (response.status === 403) {
            console.warn('GitHub API rate limit likely exceeded. Update check skipped.');
          } else {
            throw new Error(`GitHub API request failed with status ${response.status}`);
          }
          return;
        }
        
        const latestCommit = await response.json();
        const latestCommitHash = latestCommit.sha;

        if (latestCommitHash && latestCommitHash !== currentCommitHash) {
          setUpdateAvailable(true);
        }
      } catch (error) {
        console.error('Fehler beim Prüfen auf Updates:', error);
      }
    };

    checkForUpdates(); // Sofort beim Laden prüfen
    const intervalId = setInterval(checkForUpdates, CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  return updateAvailable;
};