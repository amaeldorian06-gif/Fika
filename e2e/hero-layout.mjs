/**
 * Vérification layout du redesign NeedIllustration — assertions géométriques
 * réelles (boîtes englobantes) aux viewports desktop / tablette / mobile,
 * pour /services (héros, composition complète) et / (choix des deux univers).
 * Captures générées pour revue visuelle.
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
  await p.goto(BASE + '/services', { waitUntil: 'load' });
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

  /* ---------- / : présentation directe des deux univers ---------- */
  await p.goto(BASE + '/', { waitUntil: 'load' });
  await p.waitForSelector('section[aria-labelledby="entry-market"]', { timeout: 15000 });
  await p.waitForSelector('section[aria-labelledby="entry-services"]', { timeout: 15000 });
  await p.waitForTimeout(300);

  const entry = await p.evaluate(() => {
    const cards = [...document.querySelectorAll('section[aria-labelledby^="entry-"]')];
    const rects = cards.map((c) => c.getBoundingClientRect());
    const desktop = window.matchMedia('(min-width: 1024px)').matches;
    return {
      count: cards.length,
      equalHeights: !desktop || (rects.length === 2 && Math.abs(rects[0].height - rects[1].height) < 2),
      sideBySide: !desktop || (rects.length === 2 && Math.abs(rects[0].top - rects[1].top) < 2),
      servicesLink: !!document.querySelector('a[aria-label="Découvrir les services"]'),
      marketLink: !!document.querySelector('a[aria-label="Explorer la boutique"]'),
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  ok(`[${vp.name}] entrée : exactement deux univers affichés`, entry.count === 2, `${entry.count} cartes`);
  ok(`[${vp.name}] entrée : cartes équilibrées sur desktop`, entry.equalHeights);
  ok(`[${vp.name}] entrée : cartes côte à côte sur desktop`, entry.sideBySide);
  ok(`[${vp.name}] entrée : accès direct aux deux univers`, entry.servicesLink && entry.marketLink);
  ok(`[${vp.name}] entrée : aucun débordement horizontal`, entry.noHorizontalOverflow);

  if (vp.name === 'desktop-1440' || vp.name === 'tablette-768' || vp.name === 'mobile-390') {
    await p.screenshot({ path: `/home/user/captures-phase1/refine-entree-${vp.name}.png` });
  }

  /* ---------- mobile : le contact reste accessible sans masquer le CTA ---------- */
  if (vp.width <= 400) {
    const homeContact = await p.getByRole('link', { name: 'Contacter Fika sur WhatsApp' }).isVisible();
    ok(`[${vp.name}] mobile : contact WhatsApp accessible sur l'accueil`, homeContact);

    await p.goto(BASE + '/services', { waitUntil: 'load' });
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
