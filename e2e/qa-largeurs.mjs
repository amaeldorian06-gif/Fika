// QA responsive : aucun débordement horizontal ni élément clé recouvert par
// la navigation basse, aux largeurs mobiles 320/360/390/430 + tablette/desktop.
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const PAGES = ['/', '/services', '/demande', '/demande-produit', '/boutique', '/boutique/panier', '/service/intervention-plomberie'];
const WIDTHS = [
  { name: '320', w: 320, h: 690 }, { name: '360', w: 360, h: 780 },
  { name: '390', w: 390, h: 844 }, { name: '430', w: 430, h: 932 },
  { name: '768', w: 768, h: 1024 }, { name: '1280', w: 1280, h: 800 },
];

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`); }
};

const browser = await chromium.launch();
try {
  for (const vp of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const p = await ctx.newPage();
    for (const route of PAGES) {
      await p.goto(`${BASE}${route}`, { waitUntil: 'load' });
      await p.waitForTimeout(vp.w >= 768 ? 500 : 700);
      const audit = await p.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Navigation mobile"]')?.getBoundingClientRect();
        // Bouton d'envoi et consentement : visibles et hors de la zone nav quand scrollés
        const submit = [...document.querySelectorAll('button')].find(b => /Envoyer ma demande/.test(b.textContent ?? ''));
        const consent = document.getElementById('consent');
        const visible = (el) => {
          if (!el) return true; // page sans cet élément
          const r = el.getBoundingClientRect();
          return r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
        };
        return {
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
          navH: nav ? Math.round(nav.height) : 0,
          submitRevealed: submit ? visible(submit) : true,
          consentRevealed: consent ? visible(consent) : true,
        };
      });
      ok(audit.overflowX <= 0, `[${vp.name}] ${route} : aucun débordement horizontal`, `scrollWidth+${audit.overflowX}`);
      if (vp.w < 768) {
        ok(audit.navH >= 48 && audit.navH <= 72, `[${vp.name}] navigation basse ~56px`, `${audit.navH}px`);
      }
    }
    // Sur les formulaires : soumettre/consentement remontent au-dessus de la nav une fois scrollés
    for (const route of ['/demande', '/demande-produit']) {
      await p.goto(`${BASE}${route}`, { waitUntil: 'load' });
      await p.waitForTimeout(600);
      const el = route === '/demande' ? await p.locator('#consent') : await p.locator('#consent');
      await el.scrollIntoViewIfNeeded();
      await p.waitForTimeout(400);
      const r = await p.evaluate(() => {
        const navRect = document.querySelector('nav[aria-label="Navigation mobile"]')?.getBoundingClientRect();
        const nav = navRect && navRect.height > 0 ? navRect : null; // display:none => rect nul
        const consent = document.getElementById('consent')?.getBoundingClientRect();
        const submit = [...document.querySelectorAll('button')].find(b => /Envoyer ma demande/.test(b.textContent ?? ''))?.getBoundingClientRect();
        return { consentAboveNav: !nav || !consent || consent.bottom <= nav.top + 1, submitAboveNav: !nav || !submit || submit.bottom <= nav.top + 1 };
      });
      ok(r.consentAboveNav, `[${vp.name}] ${route} : consentement scrollé au-dessus de la nav`);
      ok(r.submitAboveNav, `[${vp.name}] ${route} : bouton d'envoi scrollé au-dessus de la nav`);
    }
    await ctx.close();
    console.log(`  ✓ largeur ${vp.name} vérifiée (${PAGES.length} pages + formulaires)`);
  }
} finally {
  await browser.close();
}
console.log(`===== QA LARGEURS : ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'} =====`);
process.exit(fail === 0 ? 0 : 1);
