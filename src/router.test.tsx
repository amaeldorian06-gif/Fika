import { describe, it, expect } from 'vitest';
import { parseRoute } from './router';

/**
 * Le parseur d'URL doit rester stable : c'est la colonne vertébrale de la
 * navigation (routes canoniques réelles, ancres de section, compatibilité
 * des anciennes URLs hash #/…).
 */
describe('routeur — parseRoute', () => {
  it('route canonique réelle : /services -> { path: "/services" }', () => {
    expect(parseRoute('/services')).toEqual({ path: '/services' });
    expect(parseRoute('/')).toEqual({ path: '/' });
    expect(parseRoute('')).toEqual({ path: '/' });
    expect(parseRoute('/boutique/produit/x?code=AB-123')).toEqual({ path: '/boutique/produit/x' });
  });

  it('ancre de section portée par le hash après le chemin : /services#faq', () => {
    expect(parseRoute('/services', '#faq')).toEqual({ path: '/services', anchor: 'faq' });
    expect(parseRoute('/service/plomberie', '#tarifs')).toEqual({ path: '/service/plomberie', anchor: 'tarifs' });
    expect(parseRoute('/services#faq')).toEqual({ path: '/services', anchor: 'faq' });
  });

  it('compatibilité héritée : « / » + « #/services » désignait /services', () => {
    expect(parseRoute('/', '#/services')).toEqual({ path: '/services' });
    expect(parseRoute('/', '#/')).toEqual({ path: '/' });
    expect(parseRoute('/', '#/boutique/produit/x?code=AB-123')).toEqual({ path: '/boutique/produit/x' });
    expect(parseRoute('/', '#/services#faq')).toEqual({ path: '/services', anchor: 'faq' });
    expect(parseRoute('/', '#/service/plomberie#tarifs')).toEqual({ path: '/service/plomberie', anchor: 'tarifs' });
  });

  it('ancres héritées de l’ancienne accueil : /#faq -> accueil + ancre (compatibilité)', () => {
    expect(parseRoute('/', '#faq')).toEqual({ path: '/', anchor: 'faq' });
    expect(parseRoute('/', '#services')).toEqual({ path: '/', anchor: 'services' });
    expect(parseRoute('/', '#comment-ca-marche')).toEqual({ path: '/', anchor: 'comment-ca-marche' });
  });

  it('hash sans slash initial retombe sur l’accueil + ancre', () => {
    expect(parseRoute('/', '#nimportequoi')).toEqual({ path: '/', anchor: 'nimportequoi' });
  });

  it('chemins avec doubles slashs finaux normalisés', () => {
    expect(parseRoute('/services//')).toEqual({ path: '/services' });
    expect(parseRoute('/univers/design/')).toEqual({ path: '/univers/design' });
  });

  it('/index.html servi directement -> accueil', () => {
    expect(parseRoute('/index.html')).toEqual({ path: '/' });
  });
});
