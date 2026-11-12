-- Étape de parcours (funnel) : chemin choisi, formulaire commencé, erreur de
-- validation, demande envoyée. Aucune donnée personnelle : étape + champ en
-- échec (nom du champ uniquement), jamais le contenu.
ALTER TYPE "EventType" ADD VALUE 'FUNNEL_STEP';
