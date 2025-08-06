export type EmailAccount = {
  email_address: string;
  imap_username: string;
};

export type Email = {
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: Date;
  text: string;
  html: string | false;
  attachments: any[];
};