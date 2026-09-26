import { Sparkles, ArrowDownLeft } from 'lucide-react';
import './need-illustration.css';

/** Illustration du parcours, jamais un témoignage ou une commande réelle. */
export function NeedIllustration() {
  return (
    <figure className="need-illustration" aria-label="Un exemple de besoin : mon robinet fuit. Fika aide à trouver et coordonner la personne adaptée.">
      <div className="need-illustration__canvas" aria-hidden="true" />
      <div className="need-illustration__seal" aria-hidden="true">Local<br />et humain</div>
      <span className="need-illustration__dot" aria-hidden="true" />
      <div className="need-illustration__request">
        <span className="need-illustration__eyebrow">Un besoin, par exemple</span>
        <p>« Mon robinet fuit<br />depuis ce matin. »</p>
        <span className="need-illustration__relay"><ArrowDownLeft size={13} aria-hidden="true" /> Fika prend le relais</span>
      </div>
      <figcaption className="need-illustration__answer">
        <Sparkles size={21} className="need-illustration__spark" aria-hidden="true" />
        <p>Vous n’avez pas besoin de savoir qui appeler.</p>
        <span>C’est précisément le rôle de Fika : comprendre, trouver, coordonner.</span>
      </figcaption>
    </figure>
  );
}
