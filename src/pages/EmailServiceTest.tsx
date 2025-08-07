import { EmailService, EmailManager, EmailAccount, EmailMessage } from '@/lib/email-service';

// Beispiel für die Verwendung des E-Mail-Services
export class EmailServiceExample {
  private emailService: EmailService;
  private emailManager: EmailManager;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.emailService = new EmailService(supabaseUrl, supabaseKey);
    this.emailManager = new EmailManager(this.emailService);

    // Event-Listener für verschiedene E-Mail-Events
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.emailService.on('accountAdded', (account: EmailAccount) => {
      console.log(`Neues E-Mail-Konto hinzugefügt: ${account.email}`);
    });

    this.emailService.on('emailsFetched', (data: { accountId: string; count: number }) => {
      console.log(`${data.count} E-Mails für Konto ${data.accountId} abgerufen`);
    });

    this.emailService.on('emailMarkedAsRead', (data: { messageId: string; userId: string }) => {
      console.log(`E-Mail ${data.messageId} als gelesen markiert`);
    });

    this.emailService.on('liveSyncStarted', (data: { accountId: string }) => {
      console.log(`Live-Synchronisation für Konto ${data.accountId} gestartet`);
    });

    this.emailService.on('connectionError', (data: { accountId: string; error: any }) => {
      console.error(`Verbindungsfehler für Konto ${data.accountId}:`, data.error);
    });
  }

  // Beispiel: E-Mail-Konto hinzufügen
  async addGmailAccount(userId: string, email: string, password: string): Promise<EmailAccount> {
    return await this.emailService.addEmailAccount(
      userId,
      email,
      'imap.gmail.com',
      993,
      true,
      email,
      password
    );
  }

  // Beispiel: Outlook-Konto hinzufügen
  async addOutlookAccount(userId: string, email: string, password: string): Promise<EmailAccount> {
    return await this.emailService.addEmailAccount(
      userId,
      email,
      'outlook.office365.com',
      993,
      true,
      email,
      password
    );
  }

  // Beispiel: Yahoo-Konto hinzufügen
  async addYahooAccount(userId: string, email: string, password: string): Promise<EmailAccount> {
    return await this.emailService.addEmailAccount(
      userId,
      email,
      'imap.mail.yahoo.com',
      993,
      true,
      email,
      password
    );
  }

  // Beispiel: Alle E-Mails für einen Benutzer synchronisieren
  async syncAllEmailsForUser(userId: string): Promise<void> {
    try {
      const accounts = await this.emailService.getEmailAccountsForUser(userId);
      
      for (const account of accounts) {
        console.log(`Synchronisiere E-Mails für Konto: ${account.email}`);
        await this.emailService.fetchEmailsForAccount(account.id);
      }
      
      console.log('Synchronisation abgeschlossen');
    } catch (error) {
      console.error('Fehler bei der Synchronisation:', error);
      throw error;
    }
  }

  // Beispiel: Dashboard-Daten abrufen
  async getUserDashboard(userId: string) {
    try {
      return await this.emailManager.getDashboardData(userId);
    } catch (error) {
      console.error('Fehler beim Abrufen der Dashboard-Daten:', error);
      throw error;
    }
  }

  // Beispiel: E-Mails suchen
  async searchUserEmails(userId: string, searchTerm: string): Promise<EmailMessage[]> {
    try {
      return await this.emailManager.searchEmails(userId, searchTerm);
    } catch (error) {
      console.error('Fehler bei der E-Mail-Suche:', error);
      throw error;
    }
  }

  // Beispiel: Live-Synchronisation für alle Konten eines Benutzers starten
  async startLiveSyncForUser(userId: string): Promise<void> {
    try {
      const accounts = await this.emailService.getEmailAccountsForUser(userId);
      
      for (const account of accounts) {
        await this.emailService.startLiveSync(account.id);
        console.log(`Live-Sync gestartet für: ${account.email}`);
      }
    } catch (error) {
      console.error('Fehler beim Starten der Live-Synchronisation:', error);
      throw error;
    }
  }

  // Beispiel: Alle Verbindungen ordnungsgemäß schließen
  cleanup(): void {
    this.emailService.disconnect();
    console.log('Alle E-Mail-Verbindungen geschlossen');
  }
}

// Beispiel für die Initialisierung und Verwendung
export async function initializeEmailService(): Promise<EmailServiceExample> {
  // Supabase-Konfiguration (aus Umgebungsvariablen)
  const supabaseUrl = process.env.SUPABASE_URL || 'your-supabase-url';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

  const emailServiceExample = new EmailServiceExample(supabaseUrl, supabaseKey);

  return emailServiceExample;
}

// Beispiel für Express.js-Route-Handler
export class EmailRouteHandlers {
  constructor(private emailService: EmailService, private emailManager: EmailManager) {}

  // POST /api/email/accounts - E-Mail-Konto hinzufügen
  async addAccount(req: any, res: any): Promise<void> {
    try {
      const { userId, email, imapHost, imapPort, imapSecure, username, password } = req.body;
      
      const account = await this.emailService.addEmailAccount(
        userId,
        email,
        imapHost,
        imapPort,
        imapSecure,
        username,
        password
      );

      res.status(201).json({ success: true, account });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  // GET /api/email/accounts/:userId - E-Mail-Konten abrufen
  async getAccounts(req: any, res: any): Promise<void> {
    try {
      const { userId } = req.params;
      const accounts = await this.emailService.getEmailAccountsForUser(userId);
      
      res.json({ success: true, accounts });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  // GET /api/email/messages/:userId - E-Mails abrufen
  async getEmails(req: any, res: any): Promise<void> {
    try {
      const { userId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      
      const emails = await this.emailService.getEmailsForUser(userId, Number(limit), Number(offset));
      
      res.json({ success: true, emails });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  // POST /api/email/sync/:accountId - E-Mails synchronisieren
  async syncEmails(req: any, res: any): Promise<void> {
    try {
      const { accountId } = req.params;
      const emails = await this.emailService.fetchEmailsForAccount(accountId);
      
      res.json({ success: true, count: emails.length });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  // GET /api/email/dashboard/:userId - Dashboard-Daten
  async getDashboard(req: any, res: any): Promise<void> {
    try {
      const { userId } = req.params;
      const dashboard = await this.emailManager.getDashboardData(userId);
      
      res.json({ success: true, dashboard });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  // GET /api/email/search/:userId - E-Mails suchen
  async searchEmails(req: any, res: any): Promise<void> {
    try {
      const { userId } = req.params;
      const { q: searchTerm, limit = 50 } = req.query;
      
      if (!searchTerm) {
        res.status(400).json({ success: false, error: 'Suchbegriff erforderlich' });
        return;
      }

      const emails = await this.emailManager.searchEmails(userId, searchTerm as string, Number(limit));
      
      res.json({ success: true, emails });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  // PUT /api/email/mark-read/:messageId - E-Mail als gelesen markieren
  async markAsRead(req: any, res: any): Promise<void> {
    try {
      const { messageId } = req.params;
      const { userId } = req.body;
      
      await this.emailService.markEmailAsRead(messageId, userId);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
}

export default EmailServiceExample;