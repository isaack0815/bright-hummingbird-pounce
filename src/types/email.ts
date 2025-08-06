export type EmailAccount = {
  email_address: string;
  imap_username: string;
};

export type EmailAttachment = {
  id: number;
  file_name: string;
  file_path: string;
  file_type: string;
};

export type Email = {
  id: number;
  user_id: string;
  uid: number;
  mailbox: string;
  from_address: string;
  to_address: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  sent_at: string;
  created_at: string;
  attachments: EmailAttachment[];
};