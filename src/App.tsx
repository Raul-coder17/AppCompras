/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  RotateCcw, 
  Download, 
  FileText, 
  User, 
  Heart,
  ExternalLink
} from 'lucide-react';
import { ShoppingItem, BudgetSummary } from './types';
import BudgetCard from './components/BudgetCard';
import AddItemForm from './components/AddItemForm';
import StoreSummary from './components/StoreSummary';
import PurchaseList from './components/PurchaseList';

// Initial demo data to showcase calculating capabilities immediately
const DEFAULT_BUDGET = 350.00;
const DEFAULT_ITEMS: ShoppingItem[] = [
  {
    id: 'demo-1',
    name: 'Frutas y Verduras Organicas',
    place: 'Mercadona',
    price: 12.50,
    quantity: 1,
    category: 'comida',
    bought: true,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString() // 1 day ago
  },
  {
    id: 'demo-2',
    name: 'Detergente Concentrado 3L',
    place: 'Mercadona',
    price: 7.80,
    quantity: 2,
    category: 'hogar',
    bought: false,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString() // 12 hours ago
  },
  {
    id: 'demo-3',
    name: 'Audífonos Bluetooth Deportivos',
    place: 'Amazon',
    price: 49.99,
    quantity: 1,
    category: 'tecnologia',
    bought: false,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString() // 5 hours ago
  },
  {
    id: 'demo-4',
    name: 'Camisa de Lino Casual',
    place: 'Zara',
    price: 29.95,
    quantity: 1,
    category: 'ropa',
    bought: true,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
  },
  {
    id: 'demo-5',
    name: 'Suplemento Multivitamínico',
    place: 'Farmacia Sol',
    price: 18.20,
    quantity: 1,
    category: 'salud',
    bought: false,
    createdAt: new Date(Date.now() - 300000).toISOString() // 5 min ago
  }
];

export default function App() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [totalBudget, setTotalBudget] = useState<number>(DEFAULT_BUDGET);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // 1. Initial State Load from LocalStorage
  useEffect(() => {
    try {
      const storedItems = localStorage.getItem('cobuy_shopping_items');
      const storedBudget = localStorage.getItem('cobuy_total_budget');

      if (storedItems) {
        setItems(JSON.parse(storedItems));
      } else {
        setItems(DEFAULT_ITEMS);
      }

      if (storedBudget) {
        setTotalBudget(parseFloat(storedBudget) || DEFAULT_BUDGET);
      } else {
        setTotalBudget(DEFAULT_BUDGET);
      }
    } catch (e) {
      console.warn("No se pudo cargar datos desde localStorage", e);
      setItems(DEFAULT_ITEMS);
      setTotalBudget(DEFAULT_BUDGET);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // 2. Save state adjustments back as variables mutate
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_shopping_items', JSON.stringify(items));
    } catch (e) {
      console.error("Error al guardar artículos en localStorage", e);
    }
  }, [items, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_total_budget', totalBudget.toString());
    } catch (e) {
      console.error("Error al guardar presupuesto en localStorage", e);
    }
  }, [totalBudget, isInitialized]);

  // Core Mutation Actions
  const handleAddItem = (itemData: Omit<ShoppingItem, 'id' | 'createdAt'>) => {
    const newItem: ShoppingItem = {
      ...itemData,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    setItems((prev) => [newItem, ...prev]);
  };

  const handleToggleBought = (id: string) => {
    setItems((prev) => 
      prev.map(item => 
        item.id === id ? { ...item, bought: !item.bought } : item
      )
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, updatedData: Partial<ShoppingItem>) => {
    setItems((prev) => 
      prev.map(item => 
        item.id === id ? { ...item, ...updatedData } : item
      )
    );
  };

  const handleUpdateBudget = (newBudget: number) => {
    setTotalBudget(newBudget);
  };

  // Reset shopping database completely
  const handleResetData = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = () => {
    setItems([]);
    setTotalBudget(0);
    setSelectedStoreFilter(null);
    setIsResetModalOpen(false);
  };

  // Export List functionality
  const handleExportData = () => {
    const keys = ['Producto', 'Lugar', 'Precio Unitario', 'Cantidad', 'Costo Total', 'Categoría', 'Comprado', 'Fecha de Registro'];
    const csvContent = [
      keys.join(','),
      ...items.map(i => [
        `"${i.name.replace(/"/g, '""')}"`,
        `"${i.place.replace(/"/g, '""')}"`,
        i.price.toFixed(2),
        i.quantity,
        (i.price * i.quantity).toFixed(2),
        `"${i.category}"`,
        i.bought ? "SÍ" : "NO",
        new Date(i.createdAt).toLocaleDateString('es-ES')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lista_compras_cuentas_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute stats in real-time (vaya haciendo cuentas de todo)
  const spent = items.reduce((acc, curr) => acc + (curr.bought ? curr.price * curr.quantity : 0), 0);
  const planned = items.reduce((acc, curr) => acc + (!curr.bought ? curr.price * curr.quantity : 0), 0);
  const remaining = totalBudget - spent;

  const budgetSummary: BudgetSummary = {
    totalBudget,
    spent,
    planned,
    remaining
  };

  // Extract unique place strings sorted for smart Autocomplete suggestions
  const existingPlaces: string[] = Array.from(new Set(items.map(item => item.place.trim()))).filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 flex flex-col font-sans" id="app-root-layout">
      
      {/* Upper Navigation / Title Block with Minimal Elements */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo Brand Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white" id="app-logo-bg">
              <ShoppingBag className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight leading-none">Cuentas Compras</h1>
              <p className="text-[10px] text-slate-400 font-medium md:mt-1">Gestión & Control de Presupuestos</p>
            </div>
          </div>

          {/* User profile identifier & Quick reset/csv actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* User chip */}
            <div className="hidden md:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 text-xs text-slate-600 font-medium">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Mi Perfil</span>
            </div>

            {/* Export CSV action button */}
            <button
              onClick={handleExportData}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-350 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Exportar compras completas a Excel / CSV"
              id="export-csv-btn"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>

            {/* Reiniciar demo seed values */}
            <button
              onClick={handleResetData}
              className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl transition cursor-pointer"
              title="Restablecer base de datos"
              id="reset-raw-db"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

          </div>
        </div>
      </header>

      {/* Main Body Grid Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT 2 COLS: Budget Metrics Board & Purchase List */}
          <div className="lg:col-span-2 space-y-8 flex flex-col">
            
            {/* Top metrics with inline customizable budget cap */}
            <BudgetCard 
              summary={budgetSummary} 
              onUpdateBudget={handleUpdateBudget} 
            />

            {/* List with rich actions: edit inline, check toggles, filters, sorts */}
            <div className="flex-grow">
              <PurchaseList 
                items={items}
                selectedStoreFilter={selectedStoreFilter}
                onToggleBought={handleToggleBought}
                onDeleteItem={handleDeleteItem}
                onUpdateItem={handleUpdateItem}
              />
            </div>
            
          </div>

          {/* RIGHT 1 COL: Planning form & Store ledger aggregates */}
          <div className="space-y-8">
            
            {/* Dynamic Interactive Input form */}
            <AddItemForm 
              onAddItem={handleAddItem} 
              existingPlaces={existingPlaces}
            />

            {/* Aggregated store financial sums ("haciendo cuentas por lugar") */}
            <StoreSummary 
              items={items}
              selectedStoreFilter={selectedStoreFilter}
              onSelectStoreFilter={setSelectedStoreFilter}
            />

          </div>

        </div>
      </main>

      {/* Clean Subtle Page Footer */}
      <footer className="mt-auto border-t border-slate-100 bg-white" id="app-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            <p className="font-medium">Gestor de Compras y Presupuesto © 2026</p>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <span>Creado con</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
            <span>para compras eficientes y controladas.</span>
          </div>
        </div>
      </footer>

      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-100 p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-9 w-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Restablecer aplicacion</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Esto eliminara todos los registros de compras y dejara el presupuesto en cero.
                  Esta accion no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-3.5 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition"
              >
                Si, restablecer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
