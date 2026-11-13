import { parseReportRange } from '../src/lib/report-period';
import { prisma } from '../src/lib/prisma';
import {
  getMarketCatalog, getMarketProduct, createMarketOrder, recordMarketAnalyticEvent,
} from './routes/market';
import {
  listMarketProducts, saveMarketProduct, saveMarketCategory, listMarketSuppliers, saveMarketSupplier,
  listMarketOrders, getMarketOrder, updateMarketOrderStatus, confirmMarketPrice,
  recordMarketPayment, reviewMarketPayment, listMarketBatches, saveMarketBatch,
  updateMarketBatchStatus, assignMarketItem, saveMarketDelivery, getMarketOverview,
  createMarketQuote, respondMarketQuote, recordMarketRefund, saveMarketExpense,
  deleteMarketExpense, getMarketBatchAllocation, applyMarketBatchAllocation, getMarketLedger,
} from './routes/admin-market';
import { handleRecordPayment, handleReviewPayment } from './routes/admin-payments';
import express, { type ErrorRequestHandler, type Response } from 'express';
import { ensureFounderRecord, getCurrentAdmin, handleLogin, handleLogout, SESSION_COOKIE } from './routes/auth';
import { handleCreateLead } from './routes/leads';
import { handleServiceRequestFile, handleProductImageUpload, handleDeliveryProofUpload } from './routes/files';
import { handleWaClick } from './routes/events-waclick';
import { handleLeadView } from './routes/events-leadview';
import { handleServiceSearch } from './routes/events-service-search';
import { handleFunnelEvent } from './routes/events-funnel';
import { getPublicPortfolio, getPublicTestimonials, handleCreateReview } from './routes/reviews';
import { getExperts, getLeads, getOrder, getOrders, getOverview, getAnalyticsOrders } from './routes/admin-read';
import { getAnalytics, isPeriodKey } from './routes/admin-analytics';
import { handleAddCost, handleBuildQuote, handleCreateQuote, handleUpdateStatus } from './routes/admin-orders';
import { handleConvertLead, handleUpdateLeadStatus } from './routes/admin-leads';
import { handleAssignExpert, handlePublishPortfolio, handleUpdateTask, handleUpsertDelivery } from './routes/admin-execution';
import { buildExport, isExportDataset } from './routes/admin-export';

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
  // Exception étroite : les 3 routes de téléversement acceptent le multipart (busboy
  // valide champs/taille/magic bytes) — chemin relatif au montage /api, liste fermée.
  const MULTIPART_UPLOAD_PATHS = new Set(['/files/service-request', '/admin/files/product-image', '/admin/files/delivery-proof']);
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      && !(MULTIPART_UPLOAD_PATHS.has(req.path) && req.is('multipart/form-data'))
      && !req.is('application/json')) {
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
  // Multipart : traité AVANT toute lecture JSON — express.json ignore ce content-type.
  app.post('/api/files/service-request', async (req, res) => send(res, await handleServiceRequestFile(req, req.ip ?? 'unknown')));
  // ----- Fika Market (public) -----
  app.get('/api/market/catalog', async (req, res) => res.json(await getMarketCatalog(typeof req.query.category === 'string' ? req.query.category : undefined)));
  app.get('/api/market/product/:slug', async (req, res) => {
    const product = await getMarketProduct(String(req.params.slug));
    res.status(product ? 200 : 404).json(product ?? { ok: false, message: 'Produit introuvable.' });
  });
  app.post('/api/market/orders', async (req, res) => send(res, await createMarketOrder(req.body, req.ip ?? 'unknown')));
  app.post('/api/market/events', async (req, res) => send(res, await recordMarketAnalyticEvent(req.body, req.ip ?? 'unknown')));


  app.post('/api/events/waclick', async (req, res) => res.json(await handleWaClick(req.body)));
  app.post('/api/events/leadview', async (req, res) => res.json(await handleLeadView(req.body)));
  app.post('/api/events/service-search', async (req, res) => res.json(await handleServiceSearch(req.body)));
  app.post('/api/events/funnel', async (req, res) => res.json(await handleFunnelEvent(req.body)));
  app.get('/api/testimonials', async (_req, res) => res.json(await getPublicTestimonials()));
  app.get('/api/portfolio', async (_req, res) => res.json(await getPublicPortfolio()));

  // Reviews are entered by the team, not by anonymous callers knowing an order ID.
  app.use(['/api/admin', '/api/reviews'], async (req, res, next) => {
    const admin = await getCurrentAdmin(session(req.headers.cookie));
    if (!admin) {
      res.status(401).json({ ok: false, message: 'Session expirée. Reconnectez-vous.' });
      return;
    }
    // Audit foreign keys are created only for operational writes.
    if (req.method !== 'GET') await ensureFounderRecord();
    res.locals.admin = admin;
    next();
  });
  const query = (value: unknown) => typeof value === 'string' ? value : undefined;
  // Téléversements admin (multipart — session vérifiée par le middleware ci-dessus).
  app.post('/api/admin/files/product-image', async (req, res) => send(res, await handleProductImageUpload(req)));
  app.post('/api/admin/files/delivery-proof', async (req, res) => send(res, await handleDeliveryProofUpload(req)));

  app.get('/api/admin/overview', async (_req, res) => res.json(await getOverview()));
  app.get('/api/admin/orders', async (req, res) => res.json(await getOrders(query(req.query.status), query(req.query.q), query(req.query.scope))));
  app.get('/api/admin/orders/:id', async (req, res) => {
    const order = await getOrder(String(req.params.id));
    res.status(order ? 200 : 404).json(order ?? { ok: false, message: 'Commande introuvable.' });
  });
  app.get('/api/admin/leads', async (req, res) => res.json(await getLeads(query(req.query.scope))));
  app.get('/api/admin/experts', async (req, res) => res.json(await getExperts(req.query.assignable === '1')));
  app.get('/api/admin/analytics', async (req, res) => {
    const period = query(req.query.period) ?? 'month';
    if (!isPeriodKey(period)) { res.status(400).json({ ok: false, message: 'Période invalide.' }); return; }
    res.json(await getAnalytics(period));
  });
  app.get('/api/admin/analytics/orders', async (_req, res) => res.json(await getAnalyticsOrders()));
  app.get('/api/admin/export/:dataset', async (req, res) => {
    const dataset = String(req.params.dataset);
    if (!isExportDataset(dataset)) { res.status(404).json({ ok: false, message: 'Export inconnu.' }); return; }
    try { parseReportRange(query(req.query.from), query(req.query.to)); } catch { res.status(400).json({ ok: false, message: 'Période invalide.' }); return; }
    const { filename, csv } = await buildExport(dataset, query(req.query.from), query(req.query.to));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  });

  // ----- Fika Market (admin, session requise) -----
  app.get('/api/admin/market/overview', async (_req, res) => res.json(await getMarketOverview()));
  app.get('/api/admin/market/products', async (_req, res) => res.json(await listMarketProducts()));
  app.get('/api/admin/market/categories', async (_req, res) => res.json(await prisma.marketCategory.findMany({ orderBy: { position: 'asc' } })));
  app.get('/api/admin/market/suppliers', async (_req, res) => res.json(await listMarketSuppliers()));
  app.get('/api/admin/market/orders', async (req, res) => res.json(await listMarketOrders(query(req.query.status), query(req.query.q))));
  app.get('/api/admin/market/ledger', async (_req, res) => send(res, await getMarketLedger()));
  app.get('/api/admin/market/batches', async (_req, res) => res.json(await listMarketBatches()));
  app.get('/api/admin/market/batches/:id/allocation', async (req, res) => {
    const allocation = await getMarketBatchAllocation(String(req.params.id));
    res.status(allocation ? 200 : 404).json(allocation ?? { ok: false, message: 'Lot introuvable.' });
  });
  app.get('/api/admin/market/orders/:id', async (req, res) => {
    const order = await getMarketOrder(String(req.params.id));
    res.status(order ? 200 : 404).json(order ?? { ok: false, message: 'Commande introuvable.' });
  });
  app.post('/api/admin/market/products', async (req, res) => send(res, await saveMarketProduct(req.body)));
  app.post('/api/admin/market/categories', async (req, res) => send(res, await saveMarketCategory(req.body)));
  app.post('/api/admin/market/suppliers', async (req, res) => send(res, await saveMarketSupplier(req.body)));
  app.post('/api/admin/market/orders/status', async (req, res) => send(res, await updateMarketOrderStatus(req.body, res.locals.admin.id)));
  app.post('/api/admin/market/orders/price', async (req, res) => send(res, await confirmMarketPrice(req.body, res.locals.admin.id)));
  app.post('/api/admin/market/payments', async (req, res) => send(res, await recordMarketPayment(req.body, res.locals.admin.id)));
  app.post('/api/admin/market/payments/review', async (req, res) => send(res, await reviewMarketPayment(req.body, res.locals.admin.id)));
  app.post('/api/admin/market/batches', async (req, res) => send(res, await saveMarketBatch(req.body)));
  app.post('/api/admin/market/batches/status', async (req, res) => send(res, await updateMarketBatchStatus(req.body)));
  app.post('/api/admin/market/items/assign', async (req, res) => send(res, await assignMarketItem(req.body)));
  app.post('/api/admin/market/delivery', async (req, res) => send(res, await saveMarketDelivery(req.body, res.locals.admin.id)));
  // ----- Fika Market 2.0 : devis, remboursements, dépenses, allocation -----
  app.post('/api/admin/market/quotes', async (req, res) => send(res, await createMarketQuote(req.body, res.locals.admin.id)));
  app.post('/api/admin/market/quotes/response', async (req, res) => send(res, await respondMarketQuote(req.body, res.locals.admin.id)));
  app.post('/api/admin/market/refunds', async (req, res) => send(res, await recordMarketRefund(req.body, res.locals.admin.id)));
  app.post('/api/admin/market/expenses', async (req, res) => send(res, await saveMarketExpense(req.body, res.locals.admin.id)));
  app.post('/api/admin/market/expenses/delete', async (req, res) => send(res, await deleteMarketExpense(req.body)));
  app.post('/api/admin/market/batches/allocation', async (req, res) => {
    const parsed = String(req.body?.batchId ?? '');
    send(res, await applyMarketBatchAllocation(parsed, res.locals.admin.id));
  });

  const mutations = {
    '/api/admin/payments': handleRecordPayment,
    '/api/admin/payments/review': handleReviewPayment,
    '/api/admin/orders/status': handleUpdateStatus,
    '/api/admin/orders/costs': handleAddCost,
    '/api/admin/orders/quotes': handleCreateQuote,
    '/api/admin/orders/quotes/build': handleBuildQuote,
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
  app.post('/api/reviews', async (req, res) => send(res, await handleCreateReview(req.body)));

  app.use('/api', (_req, res) => res.status(404).json({ ok: false, message: 'Route API introuvable.' }));
  const errors: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = err?.type === 'entity.parse.failed' ? 400 : err?.type === 'entity.too.large' ? 413 : 503;
    // Only allowlisted diagnostic codes; never raw messages/URLs/PII.
    const code = typeof err?.code === 'string' && /^P[0-9]{4}$/.test(err.code) ? err.code : 'SERVER_ERROR';
    console.error('[api]', status, code);
    res.status(status).json({ ok: false, message: status === 400 ? 'JSON invalide.' : status === 413 ? 'Requête trop volumineuse.' : 'Service indisponible. Vérifiez la configuration serveur et la base de données.' });
  };
  app.use(errors);
  return app;
}
