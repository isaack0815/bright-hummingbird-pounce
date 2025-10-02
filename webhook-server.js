import express from 'express';
import { exec } from 'child_process';

const app = express();
const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET;

if (!SECRET) {
  console.error('FATAL ERROR: WEBHOOK_SECRET is not set in the environment.');
  process.exit(1);
}

app.use(express.json());

app.post('/webhook/update', (req, res) => {
  const providedSecret = req.headers['x-update-secret'];

  if (!providedSecret || providedSecret !== SECRET) {
    console.warn('Unauthorized webhook attempt received.');
    return res.status(401).send('Unauthorized');
  }

  console.log('Authorized webhook received. Starting update script...');

  exec('sh ./update.sh', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing update.sh: ${error.message}`);
      // We send a 200 OK response because the webhook itself worked,
      // but we log the script error on the server.
      return res.status(200).json({ status: 'error', message: error.message, stderr });
    }
    if (stderr) {
      console.warn(`Update script stderr: ${stderr}`);
    }
    console.log(`Update script stdout: ${stdout}`);
    res.status(200).json({ status: 'success', message: 'Update process initiated.', stdout });
  });
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});