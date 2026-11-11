import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';

/**
 * Mini routeur par vrais chemins (History API) — SEO : chaque page a une URL
 * réelle indexable, plus de fragment #/….
 *   /            -> Accueil
 *   /services    -> Univers Services
 *   /univers/:s  -> Univers
 *   /service/:s  -> Fiche service
 *   /demande     -> Décrire un besoin
 *   /admin       -> Tableau de bord
 *
 * Les ancres de section sont portées par le hash APRÈS le chemin
 * (`/services#faq`) : une seule source de vérité, donc pas de course entre
 * « scroll vers l'ancre » et « scroll en haut » au changement de page.
 *
 * Compatibilité : les anciennes URLs du routeur par hash (`/#/services`,
 * `/#service/x#faq`) sont normalisées au chargement vers le chemin réel
 * (replaceState) — les backlinks et favoris existants continuent de
 * fonctionner, sans redirection serveur.
 */

export interface Route {
  path: string;
  anchor?: string;
}

/** Évènement interne : navigation pushState (popstate ne couvre qu'arrière/avant). */
const ROUTE_EVENT = 'fika:route';

/**
 * `parseRoute('/service/x', '#faq')`        -> { path: '/service/x', anchor: 'faq' }
 * `parseRoute('/', '#/services')` (héritage) -> { path: '/services }
 * `parseRoute('/', '#faq')` (ancre héritée)  -> { path: '/', anchor: 'faq' }
 */
export function parseRoute(rawPath: string, rawHash = ''): Route {
  let path = rawPath || '/';
  let hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;

  // Héritage routeur par hash : « / » + « #/services » désignait /services.
  if (path === '/' && hash.startsWith('/')) {
    const [hashPath, hashAnchor] = hash.split('#');
    if (hashPath && hashPath !== '/') path = hashPath;
    hash = hashAnchor ?? '';
  }

  const [pathOnly, inlineAnchor] = path.split('#');
  let clean = pathOnly.split('?')[0] || '/';
  if (clean.endsWith('/index.html')) clean = clean.slice(0, -'/index.html'.length) || '/';
  if (clean.length > 1) clean = clean.replace(/\/+$/, '');
  const anchor = (inlineAnchor || hash).split('?')[0] || undefined;
  return anchor ? { path: clean, anchor } : { path: clean };
}

/** URL canonique d'une destination : chemin + ancre optionnelle. */
function toUrl(path: string, anchor?: string): string {
  const clean = path === '' ? '/' : path;
  return `${clean}${anchor ? `#${anchor}` : ''}`;
}

/** Normalise toutes les écritures acceptées : '/', '/demande', '#faq', '/services#faq'. */
function resolveTarget(to: string, currentPath: string): Route {
  // Ancre seule (« #faq ») : on reste sur la page courante.
  if (to.startsWith('#')) return { path: currentPath, anchor: to.slice(1) };

  const [rawPath, rawAnchor] = to.split('#');
  const path = !rawPath || rawPath === '/' ? '/' : rawPath.replace(/\/+$/, '');
  return rawAnchor ? { path, anchor: rawAnchor } : { path };
}

function scrollToTarget(anchor?: string) {
  // La section peut n'être rendue qu'un instant après le changement de page :
  // on réessaie pendant 600 ms au lieu de défiler trop tôt vers le haut.
  const start = performance.now();
  const attempt = () => {
    if (!anchor) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (performance.now() - start < 600) {
      requestAnimationFrame(attempt);
      return;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  requestAnimationFrame(attempt);
}

function currentRoute(): Route {
  return parseRoute(window.location.pathname, window.location.hash);
}

export function navigate(to: string) {
  const current = currentRoute();
  const target = resolveTarget(to, current.path);
  const url = toUrl(target.path, target.anchor);

  const currentUrl = window.location.pathname + window.location.search + window.location.hash;
  if (currentUrl === url) {
    // Même destination : on rejoue seulement le défilement.
    scrollToTarget(target.anchor);
    return;
  }

  history.pushState(null, '', url);
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

/** Normalise une ancienne URL « /#/chemin » vers le chemin réel, sans rechargement. */
function normalizeLegacyHash() {
  if (window.location.pathname === '/' && window.location.hash.startsWith('#/')) {
    const target = currentRoute();
    history.replaceState(null, '', toUrl(target.path, target.anchor));
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    normalizeLegacyHash();
    setRoute(currentRoute());
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('popstate', onChange);
    window.addEventListener(ROUTE_EVENT, onChange);
    // hashchange : navigation fragment seul (ancien lien, test goto) — le
    // document n'est pas rechargé, on résout et normalise comme au démarrage.
    window.addEventListener('hashchange', () => {
      normalizeLegacyHash();
      onChange();
    });
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener(ROUTE_EVENT, onChange);
    };
  }, []);

  // Le défilement suit TOUJOURS le rendu de la route (ancre ou haut de page).
  useEffect(() => {
    scrollToTarget(route.anchor);
  }, [route.path, route.anchor]);

  return route;
}

interface LinkProps {
  to: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  'aria-label'?: string;
  title?: string;
  rel?: string;
}

export function Link({ to, className, children, onClick, ...rest }: LinkProps) {
  const current = typeof window !== 'undefined'
    ? currentRoute().path
    : '/';
  const target = resolveTarget(to, current);
  const href = toUrl(target.path, target.anchor);

  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    // Respecte ctrl/cmd/clic milieu (ouverture dans un nouvel onglet).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
    onClick?.();
  };

  return (
    <a href={href} onClick={handle} className={className} {...rest}>
      {children}
    </a>
  );
}
