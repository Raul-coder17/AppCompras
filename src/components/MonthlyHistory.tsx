import React, { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, Coins, ShoppingBag, CreditCard, Clock, Activity, TrendingUp, Sparkles } from 'lucide-react';
import { MonthlyHistoryRecord } from '../types';

interface MonthlyHistoryProps {
  history: MonthlyHistoryRecord[];
}

export default function MonthlyHistory({ history }: MonthlyHistoryProps) {
  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);

  const toggleExpand = (monthId: string) => {
    if (expandedMonthId === monthId) {
      setExpandedMonthId(null);
    } else {
      setExpandedMonthId(monthId);
    }
  };

  if (history.length === 0) {
    return (
      <div className="bg-white border border-slate-100 rounded-3xl p-8 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mx-auto border border-slate-100">
          <Calendar className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-extrabold text-sm text-slate-800">Sin Historial de Meses</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Una vez que finalices tu mes actual utilizando el botón **Cerrar Mes**, tus resúmenes y datos mensuales aparecerán ordenados aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Calendar className="w-4 h-4 text-slate-500" />
        <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest">Historial Mensual</h3>
      </div>

      <div className="space-y-3">
        {history.map((record) => {
          const { summary, items, servicePayments, incomes } = record;
          const isExpanded = expandedMonthId === summary.monthId;

          const totalSpent = summary.totalSpentCash + summary.totalSpentCard + summary.totalSpentServices;
          const totalIncomes = summary.totalIncomesCash + summary.totalIncomesCard;
          const startingBudget = summary.initialCashBudget + summary.initialCardBudget;
          const remainingBudget = summary.remainingCash + summary.remainingCard;

          // Helper to count bought items vs total
          const boughtItemsCount = items.filter(i => i.bought).length;
          const totalItemsCount = items.length;

          return (
            <div
              key={summary.monthId}
              className={`bg-white border rounded-3xl shadow-xs overflow-hidden transition-all duration-300 ${
                isExpanded 
                  ? 'border-emerald-300 ring-4 ring-emerald-500/5' 
                  : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              {/* Card Header Accordion Trigger */}
              <div
                onClick={() => toggleExpand(summary.monthId)}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 select-none transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex flex-col items-center justify-center text-white font-extrabold shadow-sm border border-slate-800 shrink-0">
                    <span className="text-[10px] leading-none uppercase text-slate-400">Mes</span>
                    <span className="text-sm leading-none mt-0.5">{summary.monthId.split('-')[1]}</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800 tracking-tight">{summary.monthName}</h4>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Cerrado el {new Date(summary.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Micro metrics */}
                <div className="grid grid-cols-3 gap-2 md:gap-4 flex-grow max-w-md">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total Gastado</span>
                    <span className="text-xs font-extrabold text-rose-600 mt-0.5">
                      -${totalSpent.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total Ingresos</span>
                    <span className="text-xs font-extrabold text-emerald-600 mt-0.5">
                      +${totalIncomes.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Restante Final</span>
                    <span className="text-xs font-extrabold text-slate-800 mt-0.5">
                      ${remainingBudget.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Expand icon */}
                <div className="flex items-center justify-end shrink-0">
                  <div className={`p-1.5 rounded-lg border transition ${
                    isExpanded 
                      ? 'bg-emerald-50 border-emerald-250 text-emerald-600' 
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Collapsible Details */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/40 p-5 space-y-6 animate-in slide-in-from-top duration-300">
                  
                  {/* Detailed Financial Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    
                    {/* Presupuesto Inicial */}
                    <div className="p-4.5 bg-white border border-slate-100 rounded-2xl flex flex-col justify-between">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-slate-500" /> Presupuesto Inicial
                      </div>
                      <div className="mt-2.5">
                        <span className="text-base font-black text-slate-800">${startingBudget.toFixed(2)}</span>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold mt-1">
                          <span>Efe: ${summary.initialCashBudget}</span>
                          <span>Tar: ${summary.initialCardBudget}</span>
                        </div>
                      </div>
                    </div>

                    {/* Ingresos Recibidos */}
                    <div className="p-4.5 bg-white border border-slate-100 rounded-2xl flex flex-col justify-between">
                      <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-emerald-500" /> Ingresos Totales
                      </div>
                      <div className="mt-2.5">
                        <span className="text-base font-black text-emerald-700">+${totalIncomes.toFixed(2)}</span>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold mt-1">
                          <span>Efe: ${summary.totalIncomesCash}</span>
                          <span>Tar: ${summary.totalIncomesCard}</span>
                        </div>
                      </div>
                    </div>

                    {/* Gastos en Compras */}
                    <div className="p-4.5 bg-white border border-slate-100 rounded-2xl flex flex-col justify-between">
                      <div className="text-[9px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-rose-500" /> Gastado en Compras
                      </div>
                      <div className="mt-2.5">
                        <span className="text-base font-black text-rose-700">-${(summary.totalSpentCash + summary.totalSpentCard).toFixed(2)}</span>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold mt-1">
                          <span>Efe: ${summary.totalSpentCash}</span>
                          <span>Tar: ${summary.totalSpentCard}</span>
                        </div>
                      </div>
                    </div>

                    {/* Gastos en Servicios */}
                    <div className="p-4.5 bg-white border border-slate-100 rounded-2xl flex flex-col justify-between">
                      <div className="text-[9px] font-bold text-indigo-650 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" /> Pago de Servicios
                      </div>
                      <div className="mt-2.5">
                        <span className="text-base font-black text-indigo-700">-${summary.totalSpentServices.toFixed(2)}</span>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold mt-1">
                          <span>Items pagados: {servicePayments.length}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Accordion Tabs for items, services and incomes details */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    
                    {/* Column 1: Purchases (Shopping Items) */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                          🛒 Compras ({boughtItemsCount}/{totalItemsCount})
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">Gastado: ${(summary.totalSpentCash + summary.totalSpentCard).toFixed(0)}</span>
                      </div>
                      
                      {items.length === 0 ? (
                        <p className="text-[10px] text-slate-400 py-4 text-center">Sin artículos de compras registrados.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                          {items.map((i) => (
                            <div key={i.id} className="p-2 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between text-[11px]">
                              <div className="space-y-0.5">
                                <span className={`block font-bold text-slate-700 ${!i.bought ? 'line-through text-slate-400' : ''}`}>
                                  {i.name} {i.quantity > 1 && `(x${i.quantity})`}
                                </span>
                                <span className="block text-[8px] text-slate-400 font-medium">
                                  {i.place} • {i.category}
                                </span>
                              </div>
                              <span className={`font-extrabold ${i.bought ? 'text-slate-800' : 'text-slate-400'}`}>
                                ${i.bought ? (i.price * i.quantity).toFixed(2) : 'Pendiente'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Column 2: Service Payments */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                          ⚡ Servicios ({servicePayments.length})
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">Pagado: ${summary.totalSpentServices.toFixed(0)}</span>
                      </div>

                      {servicePayments.length === 0 ? (
                        <p className="text-[10px] text-slate-400 py-4 text-center">Sin servicios pagados en este mes.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                          {servicePayments.map((p) => (
                            <div key={p.id} className="p-2 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between text-[11px]">
                              <div className="space-y-0.5">
                                <span className="block font-bold text-slate-700">{p.service}</span>
                                <span className="block text-[8px] text-slate-400 font-medium">
                                  Pago: {p.paymentMethod} {p.isRecurring ? '• Recurrente' : ''}
                                </span>
                              </div>
                              <span className="font-extrabold text-indigo-750">
                                -${p.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Column 3: Incomes */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                          💰 Ingresos ({incomes.length})
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">Total: ${totalIncomes.toFixed(0)}</span>
                      </div>

                      {incomes.length === 0 ? (
                        <p className="text-[10px] text-slate-400 py-4 text-center">Sin ingresos registrados en este mes.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                          {incomes.map((inc) => (
                            <div key={inc.id} className="p-2 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between text-[11px]">
                              <div className="space-y-0.5">
                                <span className="block font-bold text-slate-700">{inc.name}</span>
                                <span className="block text-[8px] text-slate-400 font-medium">
                                  Destino: {inc.paymentMethod === 'efectivo' ? '💵 Efectivo' : '💳 Tarjeta'}
                                </span>
                              </div>
                              <span className="font-extrabold text-emerald-700">
                                +${inc.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
