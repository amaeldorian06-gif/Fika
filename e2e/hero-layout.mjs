/**
 * Vérification layout du redesign NeedIllustration — assertions géométriques
 * réelles (boîtes englobantes) aux viewports desktop / tablette / mobile,
 * pour /services (héros, composition complète) et / (carte d'entrée,
 * variante visuelle). Captures générées pour revue visuelle.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'tablette-1024', width: 1024, height: 768 },
  { name: 'tablette-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-360', width: 360, height: 780 },
];
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); if (!cond) console.log('FAIL:', name, extra); };
const overlap = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
const box = (el) => ({ left: el.left, right: el.right, top: el.top, bottom: el.bottom, width: el.width, height: el.height });

const b = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height } });
  const p = await ctx.newPage();

  /* ---------- /services : héros, composition complète ---------- */
  await p.goto(BASE + '/#/services', { waitUntil: 'load' });
  await p.waitForSelector('.need-illustration__answer', { timeout: 15000 });
  await p.waitForTimeout(300);

  const geo = await p.evaluate(() => {
    const r = document.querySelector('.need-illustration__request')?.getBoundingClientRect();
    const a = document.querySelector('.need-illustration__answer')?.getBoundingClientRect();
    const f = document.querySelector('.need-illustration')?.getBoundingClientRect();
    const heading = document.querySelector('.need-illustration__answer p')?.getBoundingClientRect();
    return {
      request: r && { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width },
      answer: a && { left: a.left, right: a.right, top: a.top, bottom: a.bottom, width: a.width },
      figure: f && { left: f.left, right: f.right, top: f.top, bottom: f.bottom, width: f.width, height: f.height },
      headingH: heading?.height ?? 0,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  ok(`[${vp.name}] services : aucun chevauchement demande/message`, !overlap(geo.request, geo.answer), JSON.stringify({ request: geo.request, answer: geo.answer }));
  ok(`[${vp.name}] services : panneau sombre entièrement visible (dans la figure)`, geo.request.left >= geo.figure.left - 1 && geo.request.right <= geo.figure.right + 1 && geo.request.top >= geo.figure.top - 1);
  ok(`[${vp.name}] services : message éditorial largeur de lecture ≥ 200px`, geo.answer.width - 56 >= 200, `texte ≈ ${Math.round(geo.answer.width - 56)}px`);
  ok(`[${vp.name}] services : titre ≤ 3 lignes`, geo.headingH <= 3 * 24 * 1.32 + 2, `${Math.round(geo.headingH)}px`);
  ok(`[${vp.name}] services : aucun débordement horizontal`, geo.overflowX <= 0, `scrollWidth+${geo.overflowX}`);

  if (vp.name === 'desktop-1440' || vp.name === 'tablette-768' || vp.name === 'mobile-390') {
    await p.screenshot({ path: `/home/user/captures-phase1/refine-services-${vp.name}.png`, fullPage: vp.name !== 'desktop-1440' ? false : false });
    await p.screenshot({ path: `/home/user/captures-phase1/refine-services-hero-${vp.name}.png` });
  }

  /* ---------- / : carte d'entrée, variante visuelle ---------- */
  await p.goto(BASE + '/', { waitUntil: 'load' });
  await p.waitForSelector('.need-illustration--visual', { timeout: 15000 });
  await p.waitForTimeout(300);

  const entry = await p.evaluate(() => {
    const cards = [...document.querySelectorAll('section[aria-labelledby^="entry-"]')];
    const heights = cards.map((c) => c.getBoundingClientRect().height);
    const card = cards[0]?.getBoundingClientRect();
    const req = document.querySelector('.need-illustration--visual .need-illustration__request')?.getBoundingClientRect();
    const fig = document.querySelector('.need-illustration--visual')?.getBoundingClientRect();
    const h2 = document.getElementById('entry-services')?.getBoundingClientRect();
    const sideBySide = window.matchMedia('(min-width: 768px)').matches;
    return {
      equalHeights: !sideBySide || Math.abs(heights[0] - heights[1]) < 2,
      heightDelta: Math.round(Math.abs(heights[0] - heights[1])),
      requestInCard: req && card && req.left >= card.left && req.right <= card.right && req.bottom <= card.bottom,
      requestInFigure: req && fig && req.left >= fig.left - 1 && req.right <= fig.right + 1 && req.bottom <= fig.bottom + 1,
      noOverlapHeading: req && h2 && !(req.left < h2.right - 1 && h2.left < req.right - 1 && req.top < h2.bottom - 1 && h2.top < req.bottom - 1),
      figWidth: fig?.width ?? 0,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  ok(`[${vp.name}] entrée : cartes équilibrées (égales si côte à côte)`, entry.equalHeights, `écart ${entry.heightDelta}px`);
  ok(`[${vp.name}] entrée : demande entièrement dans la carte`, entry.requestInCard);
  ok(`[${vp.name}] entrée : demande entièrement dans la figure`, entry.requestInFigure);
  ok(`[${vp.name}] entrée : la demande ne recouvre pas le titre de carte`, entry.noOverlapHeading);
  ok(`[${vp.name}] entrée : illustration ≥ 260px de large`, entry.figWidth >= 260, `${Math.round(entry.figWidth)}px`);
  ok(`[${vp.name}] entrée : aucun débordement horizontal`, entry.overflowX <= 0, `scrollWidth+${entry.overflowX}`);

  if (vp.name === 'desktop-1440' || vp.name === 'tablette-768' || vp.name === 'mobile-390') {
    await p.screenshot({ path: `/home/user/captures-phase1/refine-entree-${vp.name}.png` });
  }

  /* ---------- mobile : le bouton WhatsApp flottant n'obstrue rien ---------- */
  if (vp.width <= 400) {
    const fab = await p.evaluate(() => {
      const el = document.querySelector('aside[aria-label="Contact rapide"] a')?.getBoundingClientRect();
      const cta = [...document.querySelectorAll('main a')].find((a) => a.textContent?.includes('Découvrir les services'))?.getBoundingClientRect();
      const answer = document.querySelector('.need-illustration__answer')?.getBoundingClientRect();
      const inter = (a, c) => a && c && a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1;
      return { fabCta: inter(el, cta), fabAnswer: inter(el, answer) };
    });
    ok(`[${vp.name}] mobile : le WhatsApp flottant ne recouvre pas le CTA principal`, !fab.fabCta);
    // (à la position de scroll initiale le panneau éditorial est plus bas ; le FAB
    // est fixe et passe au-dessus du contenu en défilant — comportement standard,
    // on vérifie qu'il ne bloque aucune zone d'interaction au premier écran)
    await p.goto(BASE + '/#/services', { waitUntil: 'load' });
    await p.waitForSelector('.need-illustration__answer', { timeout: 15000 });
    const fab2 = await p.evaluate(() => {
      const el = document.querySelector('aside[aria-label="Contact rapide"] a')?.getBoundingClientRect();
      const cta = [...document.querySelectorAll('main a')].find((a) => a.textContent?.includes('Décrire mon besoin'))?.getBoundingClientRect();
      return !(el && cta && el.left < cta.right - 1 && cta.left < el.right - 1 && el.top < cta.bottom - 1 && cta.top < el.bottom - 1);
    });
    ok(`[${vp.name}] mobile : le WhatsApp flottant ne recouvre pas le CTA du héros services`, fab2);
  }

  await ctx.close();
}

await b.close();
const fails = results.filter((r) => r[0] === 'FAIL');
console.log(`\n===== LAYOUT REFINEMENT : ${results.length - fails.length}/${results.length} PASS =====`);
if (fails.length) { fails.forEach((f) => console.log(' -', f[1], f[2])); process.exit(1); }
