import crypto from 'crypto';

export function createSha256(content: string): string {
  return crypto.createHash('sha256').update(content.trim().toLowerCase()).digest('hex');
}

export function generateIdempotencyKey(niche: string, slot: string, date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const slotClean = slot.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return `${niche}-${slotClean}-${dateStr}`;
}
