/* CRM clients (phase 3) : tags manuels + notes internes horodatées.
   Additif uniquement — aucune colonne supprimée, aucune donnée transformée.
   Les segments calculés (nouveaux, actifs…) restent du code ; les tags sont
   une saisie administrative manuelle. */

-- Tags manuels sur le client (libres, gérés depuis l'espace Clients)
ALTER TABLE "Customer" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Notes internes : horodatées, attribuées, jamais exposées publiquement
CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "author" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerNote_customerId_idx" ON "CustomerNote"("customerId");

ALTER TABLE "CustomerNote"
  ADD CONSTRAINT "CustomerNote_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
