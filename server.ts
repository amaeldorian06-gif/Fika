import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createApp } from './server/app';

async function startServer() {
  if (process.env.NODE_ENV === 'production' && (!process.env.DATABASE_URL || (process.env.AUTH_SECRET?.length ?? 0) < 32)) {
    throw new Error('DATABASE_URL et AUTH_SECRET (32 caractères minimum) requis en production.');
  }
  const app = createApp();
  const port = Number(process.env.PORT ?? 3000);
  // Compatibility with documented URLs; canonical navigation uses the hash router.
  app.get(['/admin', '/admin/{*rest}'], (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.redirect(302, `/#${req.path}`);
  });
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Never expose the server bundle/source map as a static download.
    app.use((req, res, next) => {
      if (req.path.endsWith('.cjs') || req.path.endsWith('.map')) { res.sendStatus(404); return; }
      next();
    });
    app.use(express.static(distPath));
    app.get('/{*rest}', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(port, '0.0.0.0', () => console.log(`Fika listening on port ${port}`));
}
startServer().catch(() => {
  console.error('Démarrage impossible : vérifier le port, DATABASE_URL et AUTH_SECRET.');
  process.exitCode = 1;
});
