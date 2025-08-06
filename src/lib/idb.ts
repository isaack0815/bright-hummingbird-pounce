import { openDB, DBSchema } from 'idb';
import type { Email } from '@/types/email';

interface EmailDB extends DBSchema {
  emails: {
    key: number;
    value: Email;
    indexes: { 'by-date': Date };
  };
}

const dbPromise = openDB<EmailDB>('email-client-db', 1, {
  upgrade(db) {
    const store = db.createObjectStore('emails', { keyPath: 'uid' });
    store.createIndex('by-date', 'date');
  },
});

export const addEmailsToDB = async (emails: Email[]) => {
  const db = await dbPromise;
  const tx = db.transaction('emails', 'readwrite');
  await Promise.all(emails.map(email => tx.store.put(email)));
  await tx.done;
};

export const getEmailsFromDB = async (): Promise<Email[]> => {
  const db = await dbPromise;
  const emails = await db.getAllFromIndex('emails', 'by-date');
  return emails.reverse(); // Neueste zuerst
};

export const getLatestEmailUid = async (): Promise<number | undefined> => {
  const db = await dbPromise;
  const cursor = await db.transaction('emails').store.index('by-date').openCursor(null, 'prev');
  return cursor?.value.uid;
};