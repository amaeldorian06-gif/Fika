import { createApp } from '../server/app';

// Vercel Node Function: no app.listen(), no Vite, no schema migration at invocation.
// Static assets are served separately from dist by Vercel's Vite integration.
export default createApp();
