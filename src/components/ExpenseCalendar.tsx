/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  X, 
  Receipt, 
  Coins, 
  CreditCard,
  ShoppingBag,
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { ShoppingItem, ServicePayment, PAYMENT_METHODS, PREDEFINED_CATEGORIES } from '../types';

interface ExpenseCalendarProps {
  items: ShoppingItem[];
  servicePayments: ServicePayment[];
}

interface DailyExpenseDetail {
  id: string;
  type: 'compra' | 'servicio';
  name: string;
  placeOrService: string;
  priceOrAmount: number;
  quantity: number;
  category: string;
  paymentMethod: string;
  createdAt: string;
}

export default function ExpenseCalendar({ items, servicePayments }: ExpenseCalendarProps) {
  // Current visible month and year state
  const [currentDate, setCurrentDate] = useState(() => new Date());
  
  // Selected day for detailed popup modal
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  // Format month and year title
  const monthName = currentDate.toLocaleString('es-ES', { month: 'long' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Navigate to previous month
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    setSelectedDayKey(null);
  };

  // Navigate to next month
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    setSelectedDayKey(null);
  };

  // Filter only actually BOUGHT purchases (bought: true) and combine them with service payments
  const allActualExpenses = useMemo(() => {
    const list: DailyExpenseDetail[] = [];

    // Add bought items
    items.forEach((item) => {
      if (!item.bought) return; // ignore planned/pending items
      list.push({
        id: item.id,
        type: 'compra',
        name: item.name,
        placeOrService: item.place,
        priceOrAmount: item.price,
        quantity: item.quantity,
        category: item.category,
        paymentMethod: item.paymentMethod,
        createdAt: item.createdAt
      });
    });

    // Add service payments
    servicePayments.forEach((pay) => {
      list.push({
        id: pay.id,
        type: 'servicio',
        name: pay.service,
        placeOrService: pay.service,
        priceOrAmount: pay.amount,
        quantity: 1,
        category: 'servicios', // special category
        paymentMethod: pay.paymentMethod,
        createdAt: pay.createdAt
      });
    });

    return list;
  }, [items, servicePayments]);

  // Group all expenses of the current visible month by Date string (YYYY-MM-DD)
  const monthlyExpensesGrouped = useMemo(() => {
    const groups: Record<string, DailyExpenseDetail[]> = {};

    // 1. Group actual paid expenses
    allActualExpenses.forEach((exp) => {
      const expDate = new Date(exp.createdAt);
      if (isNaN(expDate.getTime())) return;

      const y = expDate.getFullYear();
      const m = expDate.getMonth();
      
      // Filter only visible month & year
      if (y === currentYear && m === currentMonth) {
        const d = expDate.getDate();
        const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(exp);
      }
    });

    // 2. Identify recurrent services and inject planned ones if not already paid this month
    const recurrentServices = servicePayments.filter(sp => sp.isRecurring);
    
    // Group recurrent services by name to get the latest settings
    const uniqueRecurrents: Record<string, ServicePayment> = {};
    recurrentServices.forEach(sp => {
      if (!uniqueRecurrents[sp.service] || new Date(sp.createdAt) > new Date(uniqueRecurrents[sp.service].createdAt)) {
        uniqueRecurrents[sp.service] = sp;
      }
    });

    Object.values(uniqueRecurrents).forEach(service => {
      const createdDate = new Date(service.createdAt);
      const createdY = createdDate.getFullYear();
      const createdM = createdDate.getMonth();

      // Only plan for months equal to or after the original service registration month
      const isLaterOrEqualMonth = (currentYear > createdY) || (currentYear === createdY && currentMonth >= createdM);
      if (!isLaterOrEqualMonth) return;

      // Check if there is already a paid service recorded for this service name in the visible month
      const alreadyPaid = servicePayments.some(sp => {
        const payDate = new Date(sp.createdAt);
        return sp.service === service.service && 
               payDate.getFullYear() === currentYear && 
               payDate.getMonth() === currentMonth;
      });

      if (!alreadyPaid) {
        // Inject a planned/upcoming service item
        const day = service.recurringDay || 15;
        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }

        // Add to injected list
        groups[dateKey].push({
          id: `planned-recurrence-${service.service}-${dateKey}`,
          type: 'servicio',
          name: `${service.service} (Suscripción Planificada)`,
          placeOrService: service.service,
          priceOrAmount: service.amount,
          quantity: 1,
          category: 'servicios',
          paymentMethod: service.paymentMethod,
          createdAt: new Date(currentYear, currentMonth, day).toISOString()
        });
      }
    });

    return groups;
  }, [allActualExpenses, servicePayments, currentYear, currentMonth]);

  // Total summary for the current month
  const monthlyTotals = useMemo(() => {
    let total = 0;
    let cash = 0;
    let card = 0;

    (Object.values(monthlyExpensesGrouped) as DailyExpenseDetail[][]).forEach((dayList) => {
      dayList.forEach((exp) => {
        const cost = exp.priceOrAmount * exp.quantity;
        total += cost;
        if (exp.paymentMethod === 'efectivo') {
          cash += cost;
        } else {
          card += cost;
        }
      });
    });

    return { total, cash, card };
  }, [monthlyExpensesGrouped]);

  // Generate calendar grid array
  const calendarCells = useMemo(() => {
    const cells: { dateKey: string; dayNumber: number; isCurrentMonth: boolean; totalSpent: number }[] = [];
    
    // First day of current month
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    // Sunday (0) to Saturday (6).
    const startingDayOfWeek = firstDayOfMonth.getDay();
    
    // Number of days in current month
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Number of days in previous month
    const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    // 1. Fill previous month's overlapping days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDay = totalDaysInPrevMonth - i;
      const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYearVal = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateKey = `${prevYearVal}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
      
      cells.push({
        dateKey,
        dayNumber: prevDay,
        isCurrentMonth: false,
        totalSpent: 0
      });
    }

    // 2. Fill current month's days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayExpenses = monthlyExpensesGrouped[dateKey] || [];
      const totalSpent = dayExpenses.reduce((sum, item) => sum + item.priceOrAmount * item.quantity, 0);

      cells.push({
        dateKey,
        dayNumber: day,
        isCurrentMonth: true,
        totalSpent
      });
    }

    // 3. Fill next month's overlapping days to maintain 6-row grid (42 cells total)
    const remainingCells = 42 - cells.length;
    for (let day = 1; day <= remainingCells; day++) {
      const nextMonthIdx = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYearVal = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateKey = `${nextYearVal}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      cells.push({
        dateKey,
        dayNumber: day,
        isCurrentMonth: false,
        totalSpent: 0
      });
    }

    return cells;
  }, [currentYear, currentMonth, monthlyExpensesGrouped]);

  // Retrieve details for the selected day modal
  const selectedDayDetails = useMemo(() => {
    if (!selectedDayKey) return null;
    return monthlyExpensesGrouped[selectedDayKey] || [];
  }, [selectedDayKey, monthlyExpensesGrouped]);

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDayKey) return '';
    const [y, m, d] = selectedDayKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }, [selectedDayKey]);

  return (
    <div className="space-y-6" id="expense-calendar-root">
      
      {/* Monthly Summary & Controls Block */}
      <div className="glass-card rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        
        {/* Navigation Selector */}
        <div className="flex items-center gap-4">
          <button
            onClick={handlePrevMonth}
            className="w-11 h-11 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-center text-slate-700 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
            title="Mes anterior"
          >
            <ChevronLeft className="w-5 h-5 text-slate-800" />
          </button>
          
          <div className="flex items-center gap-2.5 min-w-[160px] justify-center">
            <CalendarIcon className="w-5 h-5 text-slate-800" />
            <span className="text-lg font-black text-slate-900 tracking-tight">
              {capitalizedMonth} {currentYear}
            </span>
          </div>

          <button
            onClick={handleNextMonth}
            className="w-11 h-11 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-center text-slate-700 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
            title="Mes siguiente"
          >
            <ChevronRight className="w-5 h-5 text-slate-800" />
          </button>
        </div>

        {/* Totals Summary */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 min-w-[140px] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Comprado</span>
            <p className="text-xl font-black text-emerald-700 mt-1">
              ${monthlyTotals.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 min-w-[140px] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-slate-500" /> Efectivo
            </span>
            <p className="text-lg font-extrabold text-slate-800 mt-1">
              ${monthlyTotals.cash.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 min-w-[140px] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-500" /> Tarjeta
            </span>
            <p className="text-lg font-extrabold text-slate-800 mt-1">
              ${monthlyTotals.card.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Calendar Grid Wrapper */}
      <div className="glass-card rounded-3xl p-4 md:p-6 overflow-hidden">
        
        {/* Days of Week Headers */}
        <div className="grid grid-cols-7 gap-2 mb-3">
          {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, idx) => {
            const fullNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            return (
              <div key={idx} className="text-center py-2 text-[10px] sm:text-xs font-black text-slate-800 uppercase tracking-wider">
                <span className="inline sm:hidden">{day}</span>
                <span className="hidden sm:inline">{fullNames[idx]}</span>
              </div>
            );
          })}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-2 md:gap-3">
          {calendarCells.map((cell, idx) => {
            const isToday = new Date().toLocaleDateString('es-ES') === new Date(cell.dateKey + 'T00:00:00').toLocaleDateString('es-ES');
            const hasExpenses = cell.totalSpent > 0;
            const isSelected = selectedDayKey === cell.dateKey;

            return (
              <button
                key={`${cell.dateKey}-${idx}`}
                disabled={!cell.isCurrentMonth}
                onClick={() => cell.isCurrentMonth && setSelectedDayKey(cell.dateKey)}
                className={`
                  relative min-h-[60px] sm:min-h-[84px] p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border text-left flex flex-col justify-between transition-all duration-150 group
                  ${cell.isCurrentMonth 
                    ? 'bg-white border-slate-200 hover:border-slate-400 cursor-pointer' 
                    : 'bg-slate-50/50 border-slate-100 text-slate-300 cursor-not-allowed select-none'
                  }
                  ${isToday && cell.isCurrentMonth ? 'ring-2 ring-slate-900 border-transparent shadow-xs' : ''}
                  ${isSelected ? 'border-slate-950 bg-slate-50 shadow-xs' : ''}
                  ${hasExpenses && cell.isCurrentMonth ? 'hover:bg-slate-50/80' : ''}
                `}
              >
                {/* Day number */}
                <div className="flex items-center justify-between w-full">
                  <span className={`
                    text-[10px] sm:text-xs font-bold px-1 sm:px-1.5 py-0.5 rounded-md
                    ${cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-300'}
                    ${isToday ? 'bg-slate-900 text-white font-extrabold' : ''}
                  `}>
                    {cell.dayNumber}
                  </span>
                  
                  {/* Today dot indicator */}
                  {isToday && <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-rose-500 rounded-full" title="Hoy" />}
                </div>

                {/* Day Expense Badge */}
                {cell.isCurrentMonth && hasExpenses && (
                  <div className="mt-1.5 text-right w-full overflow-hidden">
                    <span className="inline-block text-[7px] sm:text-[10px] font-black bg-slate-900 text-emerald-400 px-1 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg shadow-xs group-hover:scale-105 transition duration-150 truncate max-w-full">
                      ${cell.totalSpent.toFixed(0)}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details Section (Slide down / Drawer behavior) */}
      {selectedDayKey && (
        <div 
          className="glass-card rounded-3xl p-6 border-2 border-slate-900 animate-in fade-in slide-in-from-bottom-4 duration-200" 
          id="day-expense-details"
        >
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 mb-5">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Detalle del día</span>
              <h4 className="text-base font-black text-slate-900 capitalize mt-0.5 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-rose-500" />
                {formattedSelectedDate}
              </h4>
            </div>
            
            <button
              onClick={() => setSelectedDayKey(null)}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition active:scale-95 cursor-pointer"
              title="Cerrar detalles"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {selectedDayDetails && selectedDayDetails.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm font-semibold text-slate-500">No se registraron compras o pagos este día.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedDayDetails?.map((exp) => {
                const method = PAYMENT_METHODS.find((m) => m.id === exp.paymentMethod);
                const categoryDef = PREDEFINED_CATEGORIES.find((c) => c.id === exp.category);
                
                return (
                  <div 
                    key={exp.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 bg-white border border-slate-200/80 rounded-2xl hover:border-slate-300 transition shadow-xs"
                  >
                    
                    {/* Item Details */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                        {exp.type === 'compra' ? (
                          <ShoppingBag className="w-5 h-5 text-slate-900" />
                        ) : (
                          <Receipt className="w-5 h-5 text-slate-900" />
                        )}
                      </div>
                      
                      <div>
                        <p className="text-sm font-black text-slate-900">{exp.name}</p>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {/* Place / Platform */}
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {exp.placeOrService}
                          </span>

                          {/* Category badge */}
                          {exp.type === 'compra' && categoryDef && (
                            <span 
                              className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white shadow-xs"
                              style={{ backgroundColor: categoryDef.color }}
                            >
                              {categoryDef.name}
                            </span>
                          )}
                          {exp.type === 'servicio' && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs ${
                              exp.id.startsWith('planned-recurrence-') 
                                ? 'bg-amber-500 text-white animate-pulse' 
                                : 'bg-indigo-600 text-white'
                            }`}>
                              {exp.id.startsWith('planned-recurrence-') ? 'Suscripción Próxima (No Pagada)' : 'Servicio Registrado'}
                            </span>
                          )}

                          {/* Payment method */}
                          {method && (
                            <span className="text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                              {exp.paymentMethod === 'efectivo' ? <Coins className="w-2.5 h-2.5" /> : <CreditCard className="w-2.5 h-2.5" />}
                              {method.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Cost Calculations */}
                    <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                      
                      {/* Unit summary */}
                      {exp.type === 'compra' && exp.quantity > 1 && (
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Precio unitario</p>
                          <p className="text-xs font-bold text-slate-700 mt-0.5">
                            {exp.quantity}x ${exp.priceOrAmount.toFixed(2)}
                          </p>
                        </div>
                      )}

                      {/* Total cost */}
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Costo Total</p>
                        <p className="text-base font-black text-slate-900 mt-0.5">
                          ${(exp.priceOrAmount * exp.quantity).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                    </div>

                  </div>
                );
              })}

              {/* Day grand total detail */}
              <div className="bg-slate-900 text-white rounded-2xl p-4.5 mt-3 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-bold text-slate-300">Total gastado el {formattedSelectedDate}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Compras y pagos consolidados</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-emerald-400">
                    ${selectedDayDetails.reduce((sum, item) => sum + item.priceOrAmount * item.quantity, 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
