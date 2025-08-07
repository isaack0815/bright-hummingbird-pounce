import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { EventEmitter } from 'events';

// Typdefinitionen
export interface EmailAccount {
  id: string;
  user_id: string;
  email: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  username: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export interface EmailMessage {
  id?: string;
  account_id: string;
  user_id: string;
  message_id: string;
  subject: string;
  from_address: string;
  to_address: string;
  cc_address?: string;
  bcc_address?: string;
  body_text?: string;
  body_html?: string;
  date_received: string;
  is_read: boolean;
  has_attachments: boolean;
  folder: string;
  raw_headers: any;
  created_at?: string;
}

export interface EmailAttachment {
  id?: string;
  message_id: string;
  filename: string;
  content_type: string;
  size: number;
  content: Buffer;
  created_at?: string;
}

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

// Hauptklasse für E-Mail-Service
export class EmailService extends EventEmitter {
  private supabase: SupabaseClient;
  private activeConnections: Map<string, Imap> = new Map();

  constructor(supabaseUrl: string, supabaseKey: string) {
    super();
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // E-Mail-Konto hinzufügen
  async addEmailAccount(
    userId: string,
    email: string,
    imapHost: string,
    imapPort: number,
    imapSecure: boolean,
    username: string,
    password: string
  ): Promise<EmailAccount> {
    try {
      // Verbindung testen
      await this.testImapConnection({
        host: imapHost,
        port: imapPort,
        secure: imapSecure,
        user: username,
        password: password
      });

      const { data, error } = await this.supabase
        .from('email_accounts')
        .insert({
          user_id: userId,
          email: email,
          imap_host: imapHost,
          imap_port: imapPort,
          imap_secure: imapSecure,
          username: username,
          password: password
        })
        .select()
        .single();

      if (error) throw error;
      
      this.emit('accountAdded', data);
      return data;
    } catch (error) {
      console.error('Fehler beim Hinzufügen des E-Mail-Kontos:', error);
      throw error;
    }
  }

  // IMAP-Verbindung testen
  private testImapConnection(config: ImapConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        host: config.host,
        port: config.port,
        tls: config.secure,
        user: config.user,
        password: config.password
      });

      imap.once('ready', () => {
        imap.end();
        resolve();
      });

      imap.once('error', (err) => {
        reject(err);
      });

      imap.connect();
    });
  }

  // E-Mails für ein Konto abrufen
  async fetchEmailsForAccount(accountId: string, folder: string = 'INBOX'): Promise<EmailMessage[]> {
    try {
      const { data: account, error } = await this.supabase
        .from('email_accounts')
        .select('*')
        .eq('id', accountId)
        .single();

      if (error || !account) throw new Error('E-Mail-Konto nicht gefunden');

      const emails = await this.fetchEmailsFromImap(account, folder);
      
      // E-Mails in Supabase speichern
      for (const email of emails) {
        await this.saveEmailToDatabase(email);
      }

      this.emit('emailsFetched', { accountId, count: emails.length });
      return emails;
    } catch (error) {
      console.error('Fehler beim Abrufen der E-Mails:', error);
      throw error;
    }
  }

  // E-Mails von IMAP-Server abrufen
  private fetchEmailsFromImap(account: EmailAccount, folder: string): Promise<EmailMessage[]> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        host: account.imap_host,
        port: account.imap_port,
        tls: account.imap_secure,
        user: account.username,
        password: account.password
      });

      const emails: EmailMessage[] = [];

      imap.once('ready', () => {
        imap.openBox(folder, false, (err, box) => {
          if (err) {
            reject(err);
            return;
          }

          // Die letzten 50 E-Mails abrufen
          const fetch = imap.seq.fetch(`${Math.max(1, box.messages.total - 49)}:*`, {
            bodies: '',
            struct: true
          });

          fetch.on('message', (msg, seqno) => {
            let buffer = '';
            let attributes: any;

            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString();
              });
            });

            msg.once('attributes', (attrs) => {
              attributes = attrs;
            });

            msg.once('end', async () => {
              try {
                const parsed = await simpleParser(buffer);
                
                const emailMessage: EmailMessage = {
                  account_id: account.id,
                  user_id: account.user_id,
                  message_id: parsed.messageId || `${seqno}-${Date.now()}`,
                  subject: parsed.subject || '(Kein Betreff)',
                  from_address: this.extractEmail(parsed.from),
                  to_address: this.extractEmail(parsed.to),
                  cc_address: this.extractEmail(parsed.cc),
                  bcc_address: this.extractEmail(parsed.bcc),
                  body_text: parsed.text,
                  body_html: parsed.html,
                  date_received: parsed.date?.toISOString() || new Date().toISOString(),
                  is_read: attributes.flags.includes('\\Seen'),
                  has_attachments: (parsed.attachments?.length || 0) > 0,
                  folder: folder,
                  raw_headers: parsed.headers
                };

                emails.push(emailMessage);

                // Anhänge verarbeiten
                if (parsed.attachments && parsed.attachments.length > 0) {
                  for (const attachment of parsed.attachments) {
                    await this.saveAttachmentToDatabase(emailMessage.message_id, attachment);
                  }
                }
              } catch (parseError) {
                console.error('Fehler beim Parsen der E-Mail:', parseError);
              }
            });
          });

          fetch.once('error', (err) => {
            reject(err);
          });

          fetch.once('end', () => {
            imap.end();
            resolve(emails);
          });
        });
      });

      imap.once('error', (err) => {
        reject(err);
      });

      imap.connect();
    });
  }

  // E-Mail in Datenbank speichern
  private async saveEmailToDatabase(email: EmailMessage): Promise<void> {
    try {
      // Prüfen, ob E-Mail bereits existiert
      const { data: existing } = await this.supabase
        .from('email_messages')
        .select('id')
        .eq('message_id', email.message_id)
        .eq('account_id', email.account_id)
        .single();

      if (!existing) {
        const { error } = await this.supabase
          .from('email_messages')
          .insert(email);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Fehler beim Speichern der E-Mail:', error);
    }
  }

  // Anhang in Datenbank speichern
  private async saveAttachmentToDatabase(messageId: string, attachment: any): Promise<void> {
    try {
      const attachmentData: EmailAttachment = {
        message_id: messageId,
        filename: attachment.filename || 'unknown',
        content_type: attachment.contentType || 'application/octet-stream',
        size: attachment.size || 0,
        content: attachment.content
      };

      const { error } = await this.supabase
        .from('email_attachments')
        .insert(attachmentData);

      if (error) throw error;
    } catch (error) {
      console.error('Fehler beim Speichern des Anhangs:', error);
    }
  }

  // E-Mail-Adresse aus Objekten extrahieren
  private extractEmail(addressObject: any): string {
    if (!addressObject) return '';
    
    if (Array.isArray(addressObject)) {
      return addressObject.map(addr => `${addr.name || ''} <${addr.address}>`).join(', ');
    }
    
    if (addressObject.address) {
      return `${addressObject.name || ''} <${addressObject.address}>`;
    }
    
    return addressObject.toString();
  }

  // E-Mails für einen Benutzer abrufen
  async getEmailsForUser(userId: string, limit: number = 50, offset: number = 0): Promise<EmailMessage[]> {
    try {
      const { data, error } = await this.supabase
        .from('email_messages')
        .select(`
          *,
          email_accounts!inner(email)
        `)
        .eq('user_id', userId)
        .order('date_received', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Fehler beim Abrufen der Benutzer-E-Mails:', error);
      throw error;
    }
  }

  // E-Mail als gelesen markieren
  async markEmailAsRead(messageId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('email_messages')
        .update({ is_read: true })
        .eq('message_id', messageId)
        .eq('user_id', userId);

      if (error) throw error;
      
      this.emit('emailMarkedAsRead', { messageId, userId });
    } catch (error) {
      console.error('Fehler beim Markieren der E-Mail als gelesen:', error);
      throw error;
    }
  }

  // E-Mail-Konten für einen Benutzer abrufen
  async getEmailAccountsForUser(userId: string): Promise<EmailAccount[]> {
    try {
      const { data, error } = await this.supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Fehler beim Abrufen der E-Mail-Konten:', error);
      throw error;
    }
  }

  // E-Mail-Konto löschen
  async deleteEmailAccount(accountId: string, userId: string): Promise<void> {
    try {
      // Erst alle E-Mails löschen
      await this.supabase
        .from('email_messages')
        .delete()
        .eq('account_id', accountId)
        .eq('user_id', userId);

      // Dann das Konto löschen
      const { error } = await this.supabase
        .from('email_accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', userId);

      if (error) throw error;
      
      this.emit('accountDeleted', { accountId, userId });
    } catch (error) {
      console.error('Fehler beim Löschen des E-Mail-Kontos:', error);
      throw error;
    }
  }

  // Live-Synchronisation für ein Konto starten
  async startLiveSync(accountId: string): Promise<void> {
    try {
      const { data: account, error } = await this.supabase
        .from('email_accounts')
        .select('*')
        .eq('id', accountId)
        .single();

      if (error || !account) throw new Error('E-Mail-Konto nicht gefunden');

      const imap = new Imap({
        host: account.imap_host,
        port: account.imap_port,
        tls: account.imap_secure,
        user: account.username,
        password: account.password
      });

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err) => {
          if (err) {
            console.error('Fehler beim Öffnen der INBOX:', err);
            return;
          }

          imap.on('mail', async (numNewMsgs) => {
            console.log(`${numNewMsgs} neue E-Mails empfangen für Konto ${accountId}`);
            await this.fetchEmailsForAccount(accountId);
          });
        });
      });

      imap.once('error', (err) => {
        console.error('IMAP-Verbindungsfehler:', err);
        this.emit('connectionError', { accountId, error: err });
      });

      imap.connect();
      this.activeConnections.set(accountId, imap);
      
      this.emit('liveSyncStarted', { accountId });
    } catch (error) {
      console.error('Fehler beim Starten der Live-Synchronisation:', error);
      throw error;
    }
  }

  // Live-Synchronisation stoppen
  stopLiveSync(accountId: string): void {
    const imap = this.activeConnections.get(accountId);
    if (imap) {
      imap.end();
      this.activeConnections.delete(accountId);
      this.emit('liveSyncStopped', { accountId });
    }
  }

  // Alle Verbindungen schließen
  disconnect(): void {
    for (const [accountId, imap] of this.activeConnections) {
      imap.end();
    }
    this.activeConnections.clear();
  }
}

// Utility-Klasse für E-Mail-Verwaltung
export class EmailManager {
  private emailService: EmailService;

  constructor(emailService: EmailService) {
    this.emailService = emailService;
  }

  // Öffentliche Supabase-Instanz für externe Zugriffe
  get supabase(): SupabaseClient {
    return this.emailService['supabase'];
  }

  // Benutzer-Dashboard-Daten
  async getDashboardData(userId: string): Promise<{
    totalEmails: number;
    unreadEmails: number;
    accounts: EmailAccount[];
    recentEmails: EmailMessage[];
  }> {
    try {
      const [accounts, recentEmails] = await Promise.all([
        this.emailService.getEmailAccountsForUser(userId),
        this.emailService.getEmailsForUser(userId, 10)
      ]);

      const { count: totalEmails } = await this.supabase
        .from('email_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: unreadEmails } = await this.supabase
        .from('email_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      return {
        totalEmails: totalEmails || 0,
        unreadEmails: unreadEmails || 0,
        accounts,
        recentEmails
      };
    } catch (error) {
      console.error('Fehler beim Abrufen der Dashboard-Daten:', error);
      throw error;
    }
  }

  // E-Mails mit Suchfunktion
  async searchEmails(
    userId: string, 
    searchTerm: string, 
    limit: number = 50
  ): Promise<EmailMessage[]> {
    try {
      const { data, error } = await this.supabase
        .from('email_messages')
        .select('*')
        .eq('user_id', userId)
        .or(`subject.ilike.%${searchTerm}%,from_address.ilike.%${searchTerm}%,body_text.ilike.%${searchTerm}%`)
        .order('date_received', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Fehler bei der E-Mail-Suche:', error);
      throw error;
    }
  }
}

// Export der Hauptklassen
export default EmailService;
