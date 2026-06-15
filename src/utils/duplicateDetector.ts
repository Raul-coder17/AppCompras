/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShoppingItem, ServicePayment, Income, MonthlyHistoryRecord } from '../types';

export interface DuplicateIndexEntry {
  name: string;
  normalizedName: string;
  amount: number;
  dateStr: string; // YYYY-MM-DD
  source: string; // e.g. "Compra: Manzanas ($45.00)"
  externalId?: string;
}

/**
 * Normalizes text for comparison (lowercase, removes accents/diacritics and special characters)
 */
export const normalizeText = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
};

/**
 * Parses date to standard YYYY-MM-DD format
 */
export const toDateStr = (dateVal: string | Date | undefined): string => {
  if (!dateVal) return '';
  const str = typeof dateVal === 'string' ? dateVal : dateVal.toISOString();
  return str.slice(0, 10);
};

/**
 * Builds a unified index of all existing transactions in the application
 */
export const buildDuplicateIndex = (
  items: ShoppingItem[],
  servicePayments: ServicePayment[],
  incomes: Income[] = [],
  monthlyHistory: MonthlyHistoryRecord[] = []
): DuplicateIndexEntry[] => {
  const index: DuplicateIndexEntry[] = [];

  // Active items
  items.forEach(i => {
    const total = i.price * i.quantity;
    index.push({
      name: i.name,
      normalizedName: normalizeText(i.name),
      amount: total,
      dateStr: toDateStr(i.createdAt),
      source: `Compra: ${i.name} ($${total.toFixed(2)})`,
      externalId: i.externalId
    });
  });

  // Active service payments
  servicePayments.forEach(s => {
    index.push({
      name: s.service,
      normalizedName: normalizeText(s.service),
      amount: s.amount,
      dateStr: toDateStr(s.createdAt),
      source: `Servicio: ${s.service} ($${s.amount.toFixed(2)})`,
      externalId: s.externalId
    });
  });

  // Active incomes
  incomes.forEach(inc => {
    index.push({
      name: inc.name,
      normalizedName: normalizeText(inc.name),
      amount: inc.amount,
      dateStr: toDateStr(inc.createdAt),
      source: `Ingreso: ${inc.name} ($${inc.amount.toFixed(2)})`,
      externalId: inc.externalId
    });
  });

  // History records (trans-month duplicates prevention)
  monthlyHistory.forEach(h => {
    h.items.forEach(i => {
      const total = i.price * i.quantity;
      index.push({
        name: i.name,
        normalizedName: normalizeText(i.name),
        amount: total,
        dateStr: toDateStr(i.createdAt),
        source: `Historial - Compra: ${i.name} ($${total.toFixed(2)})`,
        externalId: i.externalId
      });
    });

    h.servicePayments.forEach(s => {
      index.push({
        name: s.service,
        normalizedName: normalizeText(s.service),
        amount: s.amount,
        dateStr: toDateStr(s.createdAt),
        source: `Historial - Servicio: ${s.service} ($${s.amount.toFixed(2)})`,
        externalId: s.externalId
      });
    });

    h.incomes.forEach(inc => {
      index.push({
        name: inc.name,
        normalizedName: normalizeText(inc.name),
        amount: inc.amount,
        dateStr: toDateStr(inc.createdAt),
        source: `Historial - Ingreso: ${inc.name} ($${inc.amount.toFixed(2)})`,
        externalId: inc.externalId
      });
    });
  });

  return index;
};

export interface DuplicateCheckResult {
  type: 'exact' | 'fuzzy';
  details: string;
}

/**
 * Checks if a given transaction is a duplicate (exact or fuzzy) against the built index
 */
export const checkDuplicateTransaction = (
  params: {
    name: string;
    amount: number;
    date: string | Date;
    externalId?: string;
  },
  index: DuplicateIndexEntry[]
): DuplicateCheckResult | null => {
  const targetExternalId = params.externalId;
  const targetAmount = Math.abs(params.amount);
  const targetDateStr = toDateStr(params.date);
  const targetNorm = normalizeText(params.name);

  // 1. Exact match check (if externalId is present)
  if (targetExternalId) {
    const exactMatch = index.find(entry => entry.externalId === targetExternalId);
    if (exactMatch) {
      return {
        type: 'exact',
        details: `Transacción exacta coincidente con ID: ${targetExternalId}`
      };
    }
  }

  // 2. Fuzzy match check
  const targetWords = targetNorm.split(/\s+/).filter(w => w.length >= 3);

  for (const entry of index) {
    // A. Must be the same calendar day
    if (entry.dateStr !== targetDateStr) continue;

    // B. Check amount difference (2% tolerance with $0.50 floor to handle bank commission rounding)
    const amountDiff = Math.abs(entry.amount - targetAmount);
    const tolerance = Math.max(targetAmount * 0.02, 0.50);
    const isAmountWithinTolerance = amountDiff <= tolerance;
    if (!isAmountWithinTolerance) continue;

    // C. Check concept/name similarity to avoid false positives
    const entryWords = entry.normalizedName.split(/\s+/).filter(w => w.length >= 3);

    // Exact word match only — substring matching caused false positives with generic words like "pago", "uber"
    const hasCommonWord = targetWords.some(tw => entryWords.includes(tw));

    // If description is identical OR there is a significant word overlap, it's a fuzzy duplicate
    // Note: We no longer auto-exclude exact amounts on the same day if descriptions have ZERO connection,
    // which prevents blocking separate distinct purchases of the same price.
    const isNameSimilar = targetNorm === entry.normalizedName || hasCommonWord;
    
    if (isNameSimilar) {
      return {
        type: 'fuzzy',
        details: entry.source
      };
    }
  }

  return null;
};
