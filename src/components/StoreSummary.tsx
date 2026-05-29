/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Store, ChevronRight, CheckCircle2, Clock, Landmark } from 'lucide-react';
import { ShoppingItem } from '../types';

interface StoreSummaryProps {
  items: ShoppingItem[];
  selectedStoreFilter: string | null;
  onSelectStoreFilter: (store: string | null) => void;
}

export default function StoreSummary({ items, selectedStoreFilter, onSelectStoreFilter }: StoreSummaryProps) {
  // Aggregate accounts per Store/Lugar
  const storeMap: Record<string, {
    name: string;
    itemsCount: number;
    completedCount: number;
    spent: number;
    planned: number;
    total: number;
  }> = {};

  items.forEach(item => {
    const key = item.place.trim() || 'Cualquier lugar';
    const subTotal = item.price * item.quantity;

    if (!storeMap[key]) {
      storeMap[key] = {
        name: key,
        itemsCount: 0,
        completedCount: 0,
        spent: 0,
        planned: 0,
        total: 0
      };
    }

    const storeData = storeMap[key];
    storeData.itemsCount += 1;
    if (item.bought) {
      storeData.completedCount += 1;
      storeData.spent += subTotal;
    } else {
      storeData.planned += subTotal;
    }
    storeData.total += subTotal;
  });

  const stores = Object.values(storeMap).sort((a, b) => b.total - a.total);
  const totalStoresGasto = stores.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="glass-card rounded-3xl p-6 md:p-8 flex flex-col h-full" id="store-summary-container">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Landmark className="w-5.5 h-5.5 text-slate-900" />
            Cuentas por Lugar
          </h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">Distribución de tu capital por establecimiento</p>
        </div>
        {selectedStoreFilter && (
          <button 
            onClick={() => onSelectStoreFilter(null)}
            className="text-xs text-slate-900 hover:text-slate-700 hover:underline font-extrabold cursor-pointer"
            id="clear-store-filter"
          >
            Ver todos
          </button>
        )}
      </div>

      {stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center flex-grow bg-slate-100/60 rounded-2xl border border-dashed border-slate-300 p-6">
          <Store className="w-8 h-8 text-slate-300 stroke-[1.5] mb-2" />
          <p className="text-xs text-slate-500 font-medium">No hay compras registradas</p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
            Agrega productos y especifica un lugar para ver el desglose financiero por tienda.
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1 shrink-0 scrollbar-thin" id="store-list-container">
          {stores.map((store) => {
            const isSelected = selectedStoreFilter === store.name;
            const percentageOfTotal = totalStoresGasto > 0 ? Math.round((store.total / totalStoresGasto) * 100) : 0;
            const progressPercentage = store.total > 0 ? Math.round((store.spent / store.total) * 100) : 0;

            return (
              <div 
                key={store.name} 
                onClick={() => onSelectStoreFilter(isSelected ? null : store.name)}
                className={`p-4 rounded-2xl border transition duration-200 cursor-pointer group text-left ${
                  isSelected 
                    ? 'bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10' 
                    : 'bg-slate-50/60 hover:bg-slate-50 border-slate-100 hover:border-slate-200 text-slate-800'
                }`}
                id={`store-card-${store.name.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl transition ${
                      isSelected ? 'bg-white/10 text-slate-100' : 'bg-white text-slate-600 shadow-sm'
                    }`}>
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold tracking-tight line-clamp-1">{store.name}</h4>
                      <p className={`text-[10px] mt-0.5 flex items-center gap-1.5 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        <span>{store.itemsCount} {store.itemsCount === 1 ? 'producto' : 'productos'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          {store.completedCount}
                        </span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm font-extrabold">
                      ${store.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                      {percentageOfTotal}% del total
                    </span>
                  </div>
                </div>

                {/* Spent vs Planned mini summary */}
                <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t text-[11px]" 
                     style={{ borderColor: isSelected ? 'rgba(255,255,255,0.1)' : '#F1F5F9' }}>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                      Comprado: <strong className={isSelected ? 'text-white' : 'text-slate-700'}>${store.spent.toFixed(1)}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                    <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                      Planificado: <strong className={isSelected ? 'text-white' : 'text-slate-700'}>${store.planned.toFixed(1)}</strong>
                    </span>
                  </div>
                </div>

                {/* Progress bar representing shopping complete ratio */}
                <div className="mt-3.5">
                  <div className="flex justify-between items-center text-[10px] mb-1">
                    <span className={isSelected ? 'text-slate-400' : 'text-slate-400'}>Completado</span>
                    <span className="font-semibold">{progressPercentage}%</span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${isSelected ? 'bg-white/10' : 'bg-slate-200/80'}`}>
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* General helper footer */}
      <div className="mt-auto pt-6 text-[11px] text-slate-400/80 bg-slate-100/60 p-4 rounded-2xl border border-slate-200/70 shrink-0 flex items-start gap-1.5" id="store-stats-help text">
        <span className="text-slate-400 shrink-0">💡</span>
        <span>Haz clic en una tienda para filtrar la lista de compras y ver únicamente sus productos correspondientes.</span>
      </div>
    </div>
  );
}
