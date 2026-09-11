import { handleRecordPayment, handleReviewPayment } from './routes/admin-payments';
import express, { type ErrorRequestHandler, type Response } from 'express';
import { getCurrentAdmin, handleLogin, handleLogout, SESSION_COOKIE } from './routes/auth';
import { handleCreateLead } from './routes/leads';
import { handleWaClick } from './routes/events-waclick';
import { handleLeadView } from './routes/events-leadview';
import { getPublicPortfolio, getPublicTestimonials, handleCreateReview } from './routes/reviews';
import { getCustomers, getExperts, getLeads, getOrder, getOrders, getOverview, getAnalyticsOrders } from './routes/admin-read';
import { getAnalytics, isPeriodKey } from './routes/admin-analytics';
import { handleAddCost, handleCreateQuote, handleUpdateStatus } from './routes/admin-orders';
import { handleConvertLead, handleUpdateLeadStatus } from './routes/admin-leads';
import { handleCreateExpert, handleUpdateExpert } from './routes/admin-experts';
import { handleAssignExpert, handlePublishPortfolio, handleUpdateTask, handleUpsertDelivery } from './routes/admin-execution';

function send(res: Response, result: { status: number; body: unknown; cookie?: string }) {
  if (result.cookie) res.setHeader('Set-Cookie', result.cookie);
  res.status(result.status).json(result.body);
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (Number.isInteger(proxyHops) && proxyHops > 0) app.set('trust proxy', proxyHops);
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  // All mutations require JSON: cross-site forms cannot submit authenticated writes.
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
      res.status(415).json({ ok: false, message: 'Contenu JSON requis.' });
      return;
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('sec-fetch-site') === 'cross-site') {
      res.status(403).json({ ok: false, message: 'Origine refusée.' });
      return;
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.post('/api/auth/login', async (req, res) => send(res, await handleLogin(req.body, req.ip ?? 'unknown')));
  app.post('/api/auth/logout', (_req, res) => send(res, handleLogout()));
  const session = (cookie: string | undefined) => cookie?.split(';').map(p => p.trim()).find(p => p.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  app.get('/api/auth/me', async (req, res) => {
    const admin = await getCurrentAdmin(session(req.headers.cookie));
    res.status(admin ? 200 : 401).json({ ok: !!admin, admin });
  });
  app.post('/api/leads', async (req, res) => send(res, await handleCreateLead(req.body, req.ip ?? 'unknown')));
  app.post('/api/events/waclick', async (req, res) => res.json(await handleWaClick(req.body)));
  app.post('/api/events/leadview', async (req, res) => res.json(await handleLeadView(req.body)));
  app.get('/api/testimonials', async (_req, res) => res.json(await getPublicTestimonials()));
  app.get('/api/portfolio', async (_req, res) => res.json(await getPublicPortfolio()));

  // Reviews are entered by the team, not by anonymous callers knowing an order ID.
  app.use(['/api/admin', '/api/reviews'], async (req, res, next) => {
    const admin = await getCurrentAdmin(session(req.headers.cookie));
    if (!admin) {
      res.status(401).json({ ok: false, message: 'Session expirée. Reconnectez-vous.' });
      return;
    }
    res.locals.admin = admin;
    next();
  });
  const query = (value: unknown) => typeof value === 'string' ? value : undefined;
  app.get('/api/admin/overview', async (_req, res) => res.json(await getOverview()));
  app.get('/api/admin/orders', async (req, res) => res.json(await getOrders(query(req.query.status), query(req.query.q))));
  app.get('/api/admin/orders/:id', async (req, res) => {
    const order = await getOrder(String(req.params.id));
    res.status(order ? 200 : 404).json(order ?? { ok: false, message: 'Commande introuvable.' });
  });
  app.get('/api/admin/leads', async (_req, res) => res.json(await getLeads()));
  app.get('/api/admin/customers', async (_req, res) => res.json(await getCustomers()));
  app.get('/api/admin/experts', async (req, res) => res.json(await getExperts(req.query.assignable === '1')));
  app.get('/api/admin/analytics', async (req, res) => {
    const period = query(req.query.period) ?? 'month';
    if (!isPeriodKey(period)) { res.status(400).json({ ok: false, message: 'Période invalide.' }); return; }
    res.json(await getAnalytics(period));
  });
  app.get('/api/admin/analytics/orders', async (_req, res) => res.json(await getAnalyticsOrders()));

  const mutations = {
    '/api/admin/payments': handleRecordPayment,
    '/api/admin/payments/review': handleReviewPayment,
    '/api/admin/orders/status': handleUpdateStatus,
    '/api/admin/orders/costs': handleAddCost,
    '/api/admin/orders/quotes': handleCreateQuote,
    '/api/admin/leads/convert': handleConvertLead,
    '/api/admin/leads/status': handleUpdateLeadStatus,
    '/api/admin/orders/assign': handleAssignExpert,
    '/api/admin/tasks/status': handleUpdateTask,
    '/api/admin/orders/delivery': handleUpsertDelivery,
    '/api/admin/portfolio': handlePublishPortfolio,
  };
  for (const [route, handler] of Object.entries(mutations)) {
    app.post(route, async (req, res) => send(res, await handler(req.body, res.locals.admin.id)));
  }
  app.post('/api/admin/experts', async (req, res) => {
    const handler = req.body?.expertId ? handleUpdateExpert : handleCreateExpert;
    send(res, await handler(req.body, res.locals.admin.id));
  });
  app.post('/api/reviews', async (req, res) => send(res, await handleCreateReview(req.body)));

  app.use('/api', (_req, res) => res.status(404).json({ ok: false, message: 'Route API introuvable.' }));
  const errors: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = err?.type === 'entity.parse.failed' ? 400 : err?.type === 'entity.too.large' ? 413 : 503;
    // Do not log ORM errors: they can contain connection details or personal data.
    res.status(status).json({ ok: false, message: status === 400 ? 'JSON invalide.' : status === 413 ? 'Requête trop volumineuse.' : 'Service indisponible. Vérifiez la configuration serveur et la base de données.' });
  };
  app.use(errors);
  return app;
}
