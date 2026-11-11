/* Suivi des recherches de services (efficacité de la recherche + signaux
   de demande). Additif uniquement. */

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'SERVICE_SEARCH';
