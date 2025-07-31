import { useEffect } from 'react';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { ArrowUpCircle } from 'lucide-react';

// WICHTIG: Bitte ersetzen Sie dies durch Ihren GitHub-Benutzernamen und Repository-Namen.
const GITHUB_REPO_URL = 'https://github.com/isaack0815/bright-hummingbird-pounce';

export const UpdateNotifier = () => {
  const updateAvailable = useUpdateCheck();
  const { hasPermission } = useAuth();

  useEffect(() => {
    if (updateAvailable && hasPermission('settings.manage')) {
      toast.info('Ein neues Update ist verfügbar!', {
        description: 'Eine neue Version der Anwendung wurde auf GitHub bereitgestellt.',
        duration: Infinity, // Bleibt sichtbar, bis sie geschlossen wird
        action: (
          <Button asChild size="sm">
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Ansehen
            </a>
          </Button>
        ),
      });
    }
  }, [updateAvailable, hasPermission]);

  return null; // Diese Komponente rendert keine sichtbare UI, sie löst nur eine Benachrichtigung aus.
};