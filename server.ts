import express from 'express';
import { createServer as createViteServer } from 'vite';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // API Route: Run live Python moderation tests in the container
  app.post('/api/run-python-tests', async (_req, res) => {
    try {
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync('python3 -m unittest bot/test_moderation.py', {
        cwd: __dirname,
        timeout: 10000,
      });
      const durationMs = Date.now() - startTime;
      return res.json({
        success: true,
        output: (stdout + '\n' + stderr).trim(),
        durationMs,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message,
        output: (err.stdout + '\n' + err.stderr).trim(),
      });
    }
  });

  // API Route: Retrieve Python bot source files for the Code Explorer & Exporting
  app.get('/api/bot-files', (_req, res) => {
    try {
      const botDir = path.join(__dirname, 'bot');
      const fileNames = [
        'bot.py',
        'moderation.py',
        'config.py',
        'scheduler.py',
        'test_moderation.py',
        'requirements.txt',
        'Dockerfile',
        'render.yaml',
        'Procfile',
        '.env.example',
        'README.md',
      ];

      const files = fileNames.map((name) => {
        const filePath = path.join(botDir, name);
        let content = '';
        if (fs.existsSync(filePath)) {
          content = fs.readFileSync(filePath, 'utf-8');
        }
        return {
          name,
          path: `bot/${name}`,
          content,
          size: Buffer.byteLength(content, 'utf-8'),
        };
      });

      return res.json({ success: true, files });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Safe bot config and health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      botName: 'TurboNex Telegram Moderation Bot',
      version: '1.0.0',
      pythonAvailable: true,
      time: new Date().toISOString(),
    });
  });

  // Mount Vite or serve static dist
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TurboNex Bot Control Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
