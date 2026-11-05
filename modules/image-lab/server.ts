import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createImageLabApp } from './server-app';

const PORT = Number(process.env.PORT) || 3001;

async function startServer() {
  const app = await createImageLabApp();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Local Batch Image Optimizer server running at http://127.0.0.1:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Image Lab server:', err);
  process.exit(1);
});
