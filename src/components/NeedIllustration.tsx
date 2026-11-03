import { Sparkles, ArrowDownLeft } from 'lucide-react';
import './need-illustration.css';

/**
 * Illustration du parcours, jamais un témoignage ou une commande réelle.
 *
 * Deux compositions :
 *  - complète (défaut) : la demande (panneau sombre, point focal, entièrement
 *    visible) puis, dans une bande dédiée sous elle — jamais en surimpression —
 *    le message éditorial « Vous n'avez pas besoin de savoir qui appeler. ».
 *    Réservée aux espaces d'au moins ~340 px (héros de /services).
 *  - visuelle (`withAnswer={false}`) : la demande seule, pour les espaces
 *    compacts (carte d'entrée) où le message éditorial vit dans la copie
 *    de la carte elle-même.
 */
export function NeedIllustration({ withAnswer = true }: { withAnswer?: boolean }) {
  return (
    <figure
      className={`need-illustration${withAnswer ? '' : ' need-illustration--visual'}`}
      aria-label="Un exemple de besoin : mon robinet fuit. Fika aide à trouver et coordonner la personne adaptée."
    >
      <div className="need-illustration__canvas" aria-hidden="true" />
      <div className="need-illustration__seal" aria-hidden="true">Local<br />et humain</div>
      <span className="need-illustration__dot" aria-hidden="true" />
      <div className="need-illustration__request">
        <span className="need-illustration__eyebrow">Un besoin, par exemple</span>
        <p>« Mon robinet fuit<br />depuis ce matin. »</p>
        <span className="need-illustration__relay"><ArrowDownLeft size={13} aria-hidden="true" /> Fika prend le relais</span>
      </div>
      {withAnswer && (
        <figcaption className="need-illustration__answer">
          <Sparkles size={20} className="need-illustration__spark" aria-hidden="true" />
          <p>Vous n&rsquo;avez pas besoin<br />de savoir qui appeler.</p>
          <span>C&rsquo;est précisément le rôle de Fika&nbsp;: comprendre, trouver, coordonner.</span>
        </figcaption>
      )}
    </figure>
  );
}
