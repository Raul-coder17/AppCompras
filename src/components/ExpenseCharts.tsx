/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { 
  BarChart3, 
  PieChart, 
  ShoppingBag, 
  Coins, 
  CreditCard, 
  TrendingDown, 
  TrendingUp, 
  DollarSign,
  Award
} from 'lucide-react';
import { ShoppingItem, ServicePayment, Category, PAYMENT_METHODS } from '../types';

interface ExpenseChartsProps {
  items: ShoppingItem[];
  servicePayments: ServicePayment[];
  categories: Category[];
  cashBudget: number;
  cardBudget: number;
}

export default function ExpenseCharts({
  items,
  servicePayments,
  categories,
  cashBudget,
  cardBudget
}: ExpenseChartsProps) {
  
  // 1. Filter only bought/real expenses
  const boughtItems = useMemo(() => items.filter(item => item.bought), [items]);

  // 2. Total calculations
  const totals = useMemo(() => {
    const itemsSpent = boughtItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const servicesSpent = servicePayments.reduce((sum, sp) => sum + sp.amount, 0);
    const totalSpent = itemsSpent + servicesSpent;
    const totalBudget = cashBudget + cardBudget;
    
    // Payments methods distribution
    const cashItems = boughtItems.filter(i => i.paymentMethod === 'efectivo').reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const cashServices = servicePayments.filter(s => s.paymentMethod === 'efectivo').reduce((sum, s) => sum + s.amount, 0);
    const totalCashSpent = cashItems + cashServices;

    const cardItems = boughtItems.filter(i => i.paymentMethod === 'tarjeta').reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const cardServices = servicePayments.filter(s => s.paymentMethod === 'tarjeta').reduce((sum, s) => sum + s.amount, 0);
    const totalCardSpent = cardItems + cardServices;

    const transItems = boughtItems.filter(i => i.paymentMethod === 'transferencia').reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const transServices = servicePayments.filter(s => s.paymentMethod === 'transferencia').reduce((sum, s) => sum + s.amount, 0);
    const totalTransSpent = transItems + transServices;

    return {
      itemsSpent,
      servicesSpent,
      totalSpent,
      totalBudget,
      remaining: totalBudget - totalSpent,
      cashSpent: totalCashSpent,
      cardSpent: totalCardSpent,
      transSpent: totalTransSpent
    };
  }, [boughtItems, servicePayments, cashBudget, cardBudget]);

  // 3. Category distribution (bought items + services)
  const categoryData = useMemo(() => {
    const dataMap: Record<string, { amount: number; color: string; name: string }> = {};
    
    // Initialize standard categories
    categories.forEach(cat => {
      dataMap[cat.id] = { amount: 0, color: cat.color, name: cat.name };
    });

    // Add items by category
    boughtItems.forEach(item => {
      const catId = item.category || 'otros';
      if (!dataMap[catId]) {
        // Fallback for custom categories
        dataMap[catId] = { amount: 0, color: '#6B7280', name: catId.toUpperCase() };
      }
      dataMap[catId].amount += item.price * item.quantity;
    });

    // Add services (mapped to "Servicios" category, or created dynamically)
    const servicesCategoryName = 'Servicios Fijos';
    const servicesColor = '#6366F1';
    if (!dataMap['servicios']) {
      dataMap['servicios'] = { amount: 0, color: servicesColor, name: servicesCategoryName };
    }
    servicePayments.forEach(sp => {
      dataMap['servicios'].amount += sp.amount;
    });

    // Format list & filter category with amount > 0
    return Object.keys(dataMap)
      .map(key => ({
        id: key,
        name: dataMap[key].name,
        amount: dataMap[key].amount,
        color: dataMap[key].color
      }))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [boughtItems, servicePayments, categories]);

  // 4. Place breakdown
  const placeData = useMemo(() => {
    const placesMap: Record<string, number> = {};
    boughtItems.forEach(item => {
      const place = item.place || 'Supermercado';
      placesMap[place] = (placesMap[place] || 0) + (item.price * item.quantity);
    });

    return Object.keys(placesMap)
      .map(name => ({ name, amount: placesMap[name] }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [boughtItems]);

  // 5. Build SVG Donut Chart parameters
  const donutData = useMemo(() => {
    const totalAmount = categoryData.reduce((sum, c) => sum + c.amount, 0);
    let accumulatedPercent = 0;
    
    return categoryData.map(c => {
      const percent = totalAmount > 0 ? (c.amount / totalAmount) * 100 : 0;
      const startAngle = (accumulatedPercent / 100) * 360;
      accumulatedPercent += percent;
      const endAngle = (accumulatedPercent / 100) * 360;

      // Coordinates for SVG arc path
      const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
        const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
        return {
          x: centerX + radius * Math.cos(angleInRadians),
          y: centerY + radius * Math.sin(angleInRadians)
        };
      };

      const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
        const start = polarToCartesian(x, y, radius, endAngle);
        const end = polarToCartesian(x, y, radius, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
        return [
          'M', start.x, start.y,
          'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
        ].join(' ');
      };

      // Draw path
      const pathData = describeArc(100, 100, 70, startAngle, endAngle === 360 ? 359.99 : endAngle);

      return {
        ...c,
        percent,
        pathData
      };
    });
  }, [categoryData]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Visual Analytics Title Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
            <BarChart3 className="w-6.5 h-6.5 text-slate-900" />
            Gráficos Analíticos
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Visualiza y comprende tus hábitos de gasto e inversión mensual.
          </p>
        </div>

        <div className="flex gap-2">
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-slate-900 text-white shadow-xs">
            Gastado Real: ${totals.totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border ${
            totals.remaining < 0 
              ? 'bg-rose-50 text-rose-700 border-rose-200' 
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            Restante: ${totals.remaining.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Grid: 1. Donut categories. 2. Budget status horizontal visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card Category Donut Chart */}
        <div className="glass-card rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="relative w-48 h-48 shrink-0">
            {donutData.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-350 border-4 border-dashed border-slate-200 rounded-full">
                <PieChart className="w-8 h-8 mb-1" />
                <span className="text-[10px] font-bold uppercase">Sin Datos</span>
              </div>
            ) : (
              <>
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="70" fill="none" stroke="#F1F5F9" strokeWidth="24" />
                  {donutData.map((slice, i) => (
                    <path
                      key={slice.id}
                      d={slice.pathData}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth="24"
                      strokeLinecap="round"
                      className="transition-all duration-500 hover:opacity-90 cursor-pointer"
                      style={{ transformOrigin: 'center' }}
                    />
                  ))}
                </svg>
                {/* Donut Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total de Gastos</span>
                  <span className="text-xl font-black text-slate-900 mt-0.5">
                    ${totals.totalSpent >= 1000 ? `${(totals.totalSpent / 1000).toFixed(1)}k` : totals.totalSpent.toFixed(0)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Donut Chart Legend */}
          <div className="flex-grow space-y-3 w-full">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-slate-400" />
              Gastos por Categoría
            </h4>
            
            {donutData.length === 0 ? (
              <p className="text-xs text-slate-400 font-semibold italic">Registra compras en la lista para ver el gráfico.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto pr-1 space-y-2.5">
                {donutData.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="font-bold text-slate-755 truncate max-w-[120px]">{c.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-900">${c.amount.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</span>
                      <span className="text-[10px] text-slate-400 font-bold ml-1.5">({c.percent.toFixed(0)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card Budget Utilization Horizontal Progress bars */}
        <div className="glass-card rounded-3xl p-6 md:p-8 flex flex-col justify-between gap-6">
          <div>
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-slate-400" />
              Presupuesto Consumido
            </h4>
            <p className="text-2.5xl font-black text-slate-900 tracking-tight">
              ${totals.totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-slate-400 text-xs font-bold block md:inline md:ml-2">
                Consumido de un límite de ${totals.totalBudget.toLocaleString('es-ES')}
              </span>
            </p>
          </div>

          <div className="space-y-4">
            {/* Total Budget progress bar */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-650 mb-1.5">
                <span>Porcentaje de Uso del Presupuesto</span>
                <span>{totals.totalBudget > 0 ? ((totals.totalSpent / totals.totalBudget) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    totals.totalSpent > totals.totalBudget ? 'bg-rose-500' : totals.totalSpent > totals.totalBudget * 0.8 ? 'bg-amber-400' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${totals.totalBudget > 0 ? Math.min(100, (totals.totalSpent / totals.totalBudget) * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Split statistics */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
                <span className="text-[10px] font-bold uppercase text-slate-450 tracking-wide block">Gasto en Artículos</span>
                <span className="text-sm font-extrabold text-slate-800 block mt-1">${totals.itemsSpent.toFixed(2)}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
                <span className="text-[10px] font-bold uppercase text-slate-450 tracking-wide block">Pagos de Servicios</span>
                <span className="text-sm font-extrabold text-slate-800 block mt-1">${totals.servicesSpent.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Grid: 1. Payment Methods breakdown. 2. Principal spending store/places */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Pay methods breakdown Card */}
        <div className="glass-card rounded-3xl p-6 md:p-8 space-y-4">
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-slate-400" />
            Métodos de Pago Utilizados
          </h4>

          <div className="space-y-3.5">
            {/* Cash spent progress */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-700">Efectivo</span>
              </div>
              <span className="font-black text-slate-900">${totals.cashSpent.toFixed(2)}</span>
            </div>
            
            {/* Card spent progress */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="font-bold text-slate-700">Tarjeta</span>
              </div>
              <span className="font-black text-slate-900">${totals.cardSpent.toFixed(2)}</span>
            </div>

            {/* Transfer spent progress */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="font-bold text-slate-700">Transferencia</span>
              </div>
              <span className="font-black text-slate-900">${totals.transSpent.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Favorite Stores/Places Card */}
        <div className="glass-card rounded-3xl p-6 md:p-8 space-y-4">
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4 text-slate-400" />
            Establecimientos más visitados
          </h4>

          {placeData.length === 0 ? (
            <p className="text-xs text-slate-400 font-semibold italic">Registra compras con establecimientos para ver métricas.</p>
          ) : (
            <div className="space-y-3">
              {placeData.map((place, idx) => (
                <div key={place.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center font-black text-slate-500 text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-750">{place.name}</span>
                  </div>
                  <span className="font-extrabold text-slate-900">${place.amount.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
