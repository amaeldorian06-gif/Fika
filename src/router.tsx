import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';

/**
 * Mini routeur par hash.
 *   /            -> Accueil            (#/)
 *   /services    -> Catalogue          (#/services)
 *   /univers/:s  -> Univers            (#/univers/design)
 *   /service/:s  -> Fiche service      (#/service/flyer-pro)
 *   /demande     -> Décrire un besoin  (#/demande)
 *   /admin       -> Tableau de bord    (#/admin)
 *
 * Les ancres de section (#services, #faq…) sont portées par le hash sous la
 * forme `#/chemin#ancre` : une seule source de vérité, donc plus de course
 * entre « scroll vers l'ancre » et « scroll en haut » au changement de page.
 */

export interface Route {
  path: string;
  anchor?: string;
}

/** `#/service/x#faq` -> { path: '/service/x', anchor: 'faq' } */
export function parseRoute(rawHash: string): Route {
  const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  if (!hash || hash === '/') return { path: '/' };

  const [rawPath, rawAnchor] = hash.split('#');
  const path = rawPath && rawPath.startsWith('/')
    ? (rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : '/')
    : '/';

  return rawAnchor ? { path, anchor: rawAnchor } : { path };
}

/** Construit le hash canonique d'une destination. */
function toHash(path: string, anchor?: string): string {
  const clean = path === '' ? '/' : path;
  return `#${clean}${anchor ? `#${anchor}` : ''}`;
}

/** Normalise toutes les écritures acceptées : '/', '/#faq', '#faq', '/demande'. */
function resolveTarget(to: string, currentPath: string): Route {
  // Ancre seule (« #faq ») : on reste sur la page courante.
  if (to.startsWith('#')) return { path: currentPath, anchor: to.slice(1) };

  const [rawPath, rawAnchor] = to.split('#');
  const path = !rawPath || rawPath === '/' ? '/' : rawPath.replace(/\/+$/, '');
  return rawAnchor ? { path, anchor: rawAnchor } : { path };
}

function scrollToTarget(anchor?: string) {
  // Deux frames : laisse React peindre la nouvelle page avant de mesurer.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!anchor) {
        window.scrollTo({ top: 0, behavior: 'auto' });
        return;
      }
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'auto' });
    });
  });
}

export function navigate(to: string) {
  const current = parseRoute(window.location.hash);
  const target = resolveTarget(to, current.path);
  const nextHash = toHash(target.path, target.anchor);

  if (window.location.hash === nextHash) {
    // Même destination : on rejoue seulement le défilement.
    scrollToTarget(target.anchor);
    return;
  }

  // Une seule mutation du hash → un seul évènement → aucun conflit de scroll.
  window.location.hash = nextHash;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
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
    ? parseRoute(window.location.hash).path
    : '/';
  const target = resolveTarget(to, current);
  const href = toHash(target.path, target.anchor);

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
