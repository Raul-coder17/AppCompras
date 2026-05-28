/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  place: string;      // En qué lugar (Store/Establishment)
  price: number;      // Precio unitario
  quantity: number;   // Cantidad
  category: string;   // Categoría (Comida, Tecnología, Ropa, etc.)
  bought: boolean;    // Estado (Planificado / Comprado)
  paymentMethod: PaymentMethod; // Metodo de pago
  createdAt: string;  // Fecha de creación
}

export interface ArchivedItem extends ShoppingItem {
  deletedAt: string; // Fecha de archivado en historial
}

export interface BudgetSummary {
  totalBudget: number;      // Capital total disponible
  spent: number;            // Total gastado (artículos comprados)
  planned: number;          // Total planificado (artículos pendientes)
  remaining: number;        // Capital restante (totalBudget - spent)
  cashBudget: number;       // Presupuesto en efectivo
  cardBudget: number;       // Presupuesto en tarjeta/transferencia
  cashSpent: number;        // Gastado en efectivo
  cashPlanned: number;      // Planificado en efectivo
  cardSpent: number;        // Gastado en tarjeta/transferencia
  cardPlanned: number;      // Planificado en tarjeta/transferencia
}

export const PREDEFINED_CATEGORIES: Category[] = [
  { id: 'comida', name: 'Alimentos / Supermercado', color: '#10B981', icon: 'ShoppingBag' },
  { id: 'hogar', name: 'Hogar / Limpieza', color: '#3B82F6', icon: 'Home' },
  { id: 'tecnologia', name: 'Tecnología / Electrónica', color: '#8B5CF6', icon: 'Cpu' },
  { id: 'ropa', name: 'Ropa / Moda', color: '#EC4899', icon: 'Shirt' },
  { id: 'salud', name: 'Salud / Farmacia', color: '#EF4444', icon: 'HeartPulse' },
  { id: 'otros', name: 'Otros / Varios', color: '#6B7280', icon: 'HelpCircle' }
];

export const PAYMENT_METHODS: { id: PaymentMethod; name: string; color: string }[] = [
  { id: 'efectivo', name: 'Efectivo', color: '#10B981' },
  { id: 'tarjeta', name: 'Tarjeta', color: '#6366F1' },
  { id: 'transferencia', name: 'Transferencia', color: '#F59E0B' }
];

export const PREDEFINED_PLACES = [
  'Supermercado',
  'Ferretería',
  'Tienda Online',
  'Centro Comercial',
  'Farmacia',
  'Ropa & Calzado',
  'Otro lugar'
];
