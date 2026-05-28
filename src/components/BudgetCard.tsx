/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  HandCoins, 
  PiggyBank, 
  Edit2, 
  Check, 
  X 
} from 'lucide-react';
import { BudgetSummary } from '../types';

interface BudgetCardProps {
  summary: BudgetSummary;
  onUpdateBudget: (newBudget: number) => void;
}

export default function BudgetCard({ summary, onUpdateBudget }: BudgetCardProps) {
  const { totalBudget, spent, planned, remaining } = summary;
  const [isEditing, setIsEditing] = useState(false);
  const [tempBudget, setTempBudget] = useState(totalBudget.toString());

  const handleSave = () => {
    const value = parseFloat(tempBudget);
    if (!isNaN(value) && value >= 0) {
      onUpdateBudget(value);
      setIsEditing(false);
    }
  };

  const percentSpent = totalBudget > 0 ? Math.min(100, Math.round((spent / totalBudget) * 100)) : 0;
  const percentPlanned = totalBudget > 0 ? Math.min(100, Math.round((planned / totalBudget) * 100)) : 0;
  const totalAllocated = spent + planned;
  const percentTotal = totalBudget > 0 ? Math.min(100, Math.round((totalAllocated / totalBudget) * 100)) : 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden" id="budget-card-container">
      {/* Header section with interactive Available Capital input */}
      <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-slate-400" />
              Capital Disponible
            </p>
            {isEditing ? (
              <div className="flex items-center gap-2 mt-2" id="editing-budget">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xl">$</span>
                  <input
                    type="number"
                    value={tempBudget}
                    onChange={(e) => setTempBudget(e.target.value)}
                    className="pl-7 pr-3 py-1.5 w-40 bg-white border-2 border-slate-300 rounded-xl focus:border-slate-800 focus:outline-none font-bold text-xl text-slate-800"
                    placeholder="0.00"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave();
                      if (e.key === 'Escape') setIsEditing(false);
                    }}
                  />
                </div>
                <button
                  onClick={handleSave}
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition duration-150 shadow-sm"
                  title="Guardar"
                  id="save-budget-btn"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-2.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl transition duration-150"
                  title="Cancelar"
                  id="cancel-budget-btn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 mt-1.5 group" id="display-budget">
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                  ${totalBudget.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <button
                  onClick={() => {
                    setTempBudget(totalBudget.toString());
                    setIsEditing(true);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition duration-200 cursor-pointer"
                  title="Editar capital de compras"
                  id="edit-budget-btn"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end text-right md:w-auto w-full">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              remaining < 0 
                ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                : remaining === 0 
                ? 'bg-slate-100 text-slate-600 border border-slate-100'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            }`}>
              {remaining < 0 ? 'Límite Excedido' : 'Capital Sano'}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              {percentTotal}% del presupuesto comprometido
            </p>
          </div>
        </div>

        {/* Dynamic Multi-segment progress bar */}
        <div className="mt-6 w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex" id="budget-progress-bar">
          <div 
            className="bg-emerald-500 h-full transition-all duration-500 ease-out" 
            style={{ width: `${percentSpent}%` }}
            title={`Comprado: ${percentSpent}%`}
          />
          <div 
            className="bg-amber-400 h-full transition-all duration-500 ease-out" 
            style={{ width: `${percentPlanned}%` }}
            title={`Planificado: ${percentPlanned}%`}
          />
        </div>
        
        {/* Progress legend */}
        <div className="flex justify-between items-center mt-2.5 text-xs text-slate-500 px-0.5">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              Comprado ({percentSpent}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
              Planificado ({percentPlanned}%)
            </span>
          </div>
          <span>Presupuesto total</span>
        </div>
      </div>

      {/* Grid of calculations */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-white" id="budget-calculations-grid">
        
        {/* Col 1: Gastado */}
        <div className="p-6 flex items-start gap-4" id="stat-spent">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Comprado</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              ${spent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Gastado de forma efectiva</p>
          </div>
        </div>

        {/* Col 2: Planificado / Por Comprar */}
        <div className="p-6 flex items-start gap-4" id="stat-planned">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl">
            <HandCoins className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Por Comprar / Pendiente</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              ${planned.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Reservado en planes</p>
          </div>
        </div>

        {/* Col 3: Disponible / Restante */}
        <div className="p-6 flex items-start gap-4" id="stat-remaining">
          <div className={`p-3 rounded-2xl ${remaining < 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
            <PiggyBank className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Capital Restante</p>
            <h3 className={`text-2xl font-bold mt-1 ${remaining < 0 ? 'text-red-600' : 'text-slate-800'}`}>
              ${remaining.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {remaining < 0 ? '¡Estás sobregirado!' : 'Disponible para gastar'}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
