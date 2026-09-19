import { normalizePhoneE164 } from '../lead';

/** Back-office contact links address the selected client, not the public Fika inbox. */
export function getCustomerWALink(phone: string, message: string): string | undefined {
  const normalized = normalizePhoneE164(phone);
  return normalized ? `https://wa.me/${normalized.slice(1)}?text=${encodeURIComponent(message)}` : undefined;
}
