import { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Truck } from 'lucide-react';
import { fetchSuppliers, saveSupplier, type SupplierDto } from '../../lib/admin/api';
import { EmptyState } from './AdminShell';
import { AdminMarketCatalog } from './AdminMarket';
import { Button } from '../ui';
import { Checkbox, Field, Input } from '../forms';

/**
 * Espace Catalogue & partenaires — le catalogue produits Fika Market
 * (source de vérité base de données, réutilise la vue existante) et la
 * gestion des fournisseurs (création / modification réelles via l'API).
 */

interface SupplierDraft {
  id?: string;
  name: string;
  contact: string;
  note: string;
  active: boolean;
}

const EMPTY_DRAFT: SupplierDraft = { name: '', contact: '', note: '', active: true };

function SupplierForm({ draft, onChange, onSubmit, busy }: {
  draft: SupplierDraft;
  onChange: (d: SupplierDraft) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!busy) onSubmit(); }}>
      <fieldset disabled={busy} className="space-y-3">
        <Field label="Nom du fournisseur" htmlFor="supplier-name" required>
          <Input
            id="supplier-name" required maxLength={120} value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="Ex. Grossiste Doual'Market"
          />
        </Field>
        <Field label="Contact (téléphone / e-mail / ville)" htmlFor="supplier-contact">
          <Input
            id="supplier-contact" maxLength={160} value={draft.contact}
            onChange={(e) => onChange({ ...draft, contact: e.target.value })}
            placeholder="Ex. +237 6XX XX XX XX · Douala"
          />
        </Field>
        <Field label="Note interne (conditions, délais…)" htmlFor="supplier-note">
          <Input
            id="supplier-note" maxLength={1000} value={draft.note}
            onChange={(e) => onChange({ ...draft, note: e.target.value })}
            placeholder="Ex. Paiement à la livraison, 30 % de remise dès 10 pièces"
          />
        </Field>
        <Checkbox
          id="supplier-active"
          checked={draft.active}
          onChange={(e) => onChange({ ...draft, active: e.target.checked })}
          label="Fournisseur actif"
        />
        <Button type="submit" variant="primary" className="w-full">
          {busy ? 'Enregistrement…' : draft.id ? 'Enregistrer les modifications' : 'Créer le fournisseur'}
        </Button>
      </fieldset>
    </form>
  );
}

function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<SupplierDto[] | null>(null);
  const [draft, setDraft] = useState<SupplierDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const reload = () => fetchSuppliers()
    .then(setSuppliers)
    .catch(() => setError('La liste des fournisseurs n’a pas pu être chargée.'));

  useEffect(() => { void reload(); }, []);

  const submit = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await saveSupplier({
        id: draft.id,
        name: draft.name.trim(),
        contact: draft.contact.trim() || null,
        note: draft.note.trim() || null,
        active: draft.active,
      });
      setDraft(EMPTY_DRAFT);
      setSaved(true);
      await reload();
    } catch {
      setError('L’enregistrement a échoué. Vérifiez les champs puis réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]" aria-labelledby="suppliers-title">
      <div className="space-y-3">
        <h3 id="suppliers-title" className="font-heading font-bold text-lg text-brand-text">Fournisseurs</h3>
        {!suppliers ? (
          <p className="flex items-center gap-2 text-sm text-brand-text-muted py-4"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Chargement…</p>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Aucun fournisseur enregistré"
            description="Créez vos fournisseurs pour pouvoir les associer aux produits et aux approvisionnements."
          />
        ) : (
          <ul className="grid gap-2">
            {suppliers.map((s) => (
              <li key={s.id} className="bg-brand-surface border border-brand-border rounded-xl p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-brand-text flex items-center gap-2 flex-wrap">
                    {s.name}
                    {!s.active && <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-bg text-brand-text-muted px-2 py-0.5 rounded-full border border-brand-border">Inactif</span>}
                  </p>
                  {s.contact && <p className="text-sm text-brand-text-muted break-words">{s.contact}</p>}
                  {s.note && <p className="text-xs text-brand-text-muted mt-1 break-words">{s.note}</p>}
                </div>
                <Button type="button" variant="secondary" onClick={() => setDraft({ id: s.id, name: s.name, contact: s.contact ?? '', note: s.note ?? '', active: s.active })}>
                  Modifier
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-4 h-fit">
        <h4 className="font-heading font-bold text-brand-text flex items-center gap-2">
          {draft.id ? <Save className="w-4 h-4" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
          {draft.id ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
        </h4>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {saved && !error && <p role="status" className="text-sm text-emerald-700">Fournisseur enregistré.</p>}
        <SupplierForm draft={draft} onChange={setDraft} onSubmit={() => void submit()} busy={busy} />
        {draft.id && (
          <Button type="button" variant="secondary" className="w-full" onClick={() => { setDraft(EMPTY_DRAFT); setSaved(false); }}>
            Annuler la modification
          </Button>
        )}
      </div>
    </section>
  );
}

export function AdminCatalogue() {
  return (
    <div className="space-y-10">
      <section aria-labelledby="catalog-title" className="space-y-1">
        <h2 id="catalog-title" className="font-heading font-bold text-xl text-brand-text">Catalogue & partenaires</h2>
        <p className="text-sm text-brand-text-muted">
          Le catalogue produits Fika Market (source de vérité : base de données) et les partenaires qui approvisionnent Fika.
        </p>
      </section>
      <AdminMarketCatalog />
      <SuppliersPanel />
    </div>
  );
}
