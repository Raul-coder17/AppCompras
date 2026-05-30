/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  RotateCcw, 
  Download, 
  FileText, 
  User, 
  Heart,
  ExternalLink,
  Calendar,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { ShoppingItem, ArchivedItem, BudgetSummary, PREDEFINED_CATEGORIES, PAYMENT_METHODS, ServicePayment, PREDEFINED_SERVICES, Income, MonthlySummary, MonthlyHistoryRecord, Apartado } from './types';
import BudgetCard from './components/BudgetCard';
import AddItemForm from './components/AddItemForm';
import StoreSummary from './components/StoreSummary';
import PurchaseList from './components/PurchaseList';
import ServicePayments from './components/ServicePayments';
import ExpenseCalendar from './components/ExpenseCalendar';
import ExpenseCharts from './components/ExpenseCharts';
import AIAssistant from './components/AIAssistant';
import IncomesManager from './components/IncomesManager';
import MonthCloseWizard from './components/MonthCloseWizard';
import MonthlyHistory from './components/MonthlyHistory';

// Initial demo data to showcase calculating capabilities immediately
const DEFAULT_BUDGET = 350.00;
const DEFAULT_PAYMENT_METHOD = 'tarjeta';
const DEFAULT_ITEMS: ShoppingItem[] = [
  {
    id: 'demo-1',
    name: 'Frutas y Verduras Organicas',
    place: 'Mercadona',
    price: 12.50,
    quantity: 1,
    category: 'comida',
    paymentMethod: 'efectivo',
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
    paymentMethod: 'tarjeta',
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
    paymentMethod: 'tarjeta',
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
    paymentMethod: 'efectivo',
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
    paymentMethod: 'transferencia',
    bought: false,
    createdAt: new Date(Date.now() - 300000).toISOString() // 5 min ago
  }
];

export default function App() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([]);
  const [servicePayments, setServicePayments] = useState<ServicePayment[]>([]);
  const [cashBudget, setCashBudget] = useState<number>(0);
  const [cardBudget, setCardBudget] = useState<number>(DEFAULT_BUDGET);
  const [places, setPlaces] = useState<string[]>([]);
  const [serviceOptions, setServiceOptions] = useState<string[]>(PREDEFINED_SERVICES);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [categories, setCategories] = useState(PREDEFINED_CATEGORIES);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar' | 'charts' | 'history'>('list');
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('cobuy_username') || 'Usuario');
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempName, setTempName] = useState(userName);

  // New states for capital management
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyHistoryRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState<string>('');
  const [isCloseWizardOpen, setIsCloseWizardOpen] = useState(false);
  const [showMonthChangeBanner, setShowMonthChangeBanner] = useState(false);
  const [apartados, setApartados] = useState<Apartado[]>([]);

  const handleUpdateUserName = (newName: string) => {
    const trimmed = newName.trim();
    if (trimmed) {
      setUserName(trimmed);
      localStorage.setItem('cobuy_username', trimmed);
    }
  };

  // 1. Initial State Load from LocalStorage
  useEffect(() => {
    try {
      const storedItems = localStorage.getItem('cobuy_shopping_items');
      const storedBudget = localStorage.getItem('cobuy_total_budget');
      const storedCashBudget = localStorage.getItem('cobuy_budget_cash');
      const storedCardBudget = localStorage.getItem('cobuy_budget_card');
      const storedCategories = localStorage.getItem('cobuy_categories');
      const storedArchivedItems = localStorage.getItem('cobuy_archived_items');
      const storedPlaces = localStorage.getItem('cobuy_places');
      const storedServicePayments = localStorage.getItem('cobuy_service_payments');
      const storedServices = localStorage.getItem('cobuy_services');

      if (storedItems) {
        const parsedItems = JSON.parse(storedItems) as ShoppingItem[];
        const normalizedItems = parsedItems.map((item) => ({
          ...item,
          paymentMethod: item.paymentMethod || DEFAULT_PAYMENT_METHOD
        }));
        setItems(normalizedItems);
      } else {
        setItems(DEFAULT_ITEMS);
      }

      if (storedArchivedItems) {
        const parsedArchived = JSON.parse(storedArchivedItems) as ArchivedItem[];
        const normalizedArchived = parsedArchived.map((item) => ({
          ...item,
          paymentMethod: item.paymentMethod || DEFAULT_PAYMENT_METHOD
        }));
        setArchivedItems(normalizedArchived);
      } else {
        setArchivedItems([]);
      }

      if (storedPlaces) {
        setPlaces(JSON.parse(storedPlaces));
      } else {
        setPlaces([]);
      }

      if (storedServicePayments) {
        const parsedPayments = JSON.parse(storedServicePayments) as ServicePayment[];
        const normalizedPayments = parsedPayments.map((payment) => ({
          ...payment,
          paymentMethod: payment.paymentMethod || DEFAULT_PAYMENT_METHOD
        }));
        setServicePayments(normalizedPayments);
      } else {
        setServicePayments([]);
      }

      if (storedServices) {
        setServiceOptions(JSON.parse(storedServices));
      } else {
        setServiceOptions(PREDEFINED_SERVICES);
      }

      if (storedCategories) {
        setCategories(JSON.parse(storedCategories));
      } else {
        setCategories(PREDEFINED_CATEGORIES);
      }

      if (storedCashBudget || storedCardBudget) {
        setCashBudget(parseFloat(storedCashBudget || '0') || 0);
        setCardBudget(parseFloat(storedCardBudget || '0') || 0);
      } else if (storedBudget) {
        setCashBudget(0);
        setCardBudget(parseFloat(storedBudget) || DEFAULT_BUDGET);
      } else {
        setCashBudget(0);
        setCardBudget(DEFAULT_BUDGET);
      }

      // Load new capital management states
      const storedIncomes = localStorage.getItem('cobuy_incomes');
      const storedHistory = localStorage.getItem('cobuy_history_months');
      const storedCurrentMonth = localStorage.getItem('cobuy_current_month');
      const storedApartados = localStorage.getItem('cobuy_apartados');

      if (storedIncomes) {
        setIncomes(JSON.parse(storedIncomes));
      } else {
        setIncomes([]);
      }

      if (storedHistory) {
        setMonthlyHistory(JSON.parse(storedHistory));
      } else {
        setMonthlyHistory([]);
      }

      if (storedApartados) {
        setApartados(JSON.parse(storedApartados));
      } else {
        setApartados([]);
      }

      if (storedCurrentMonth) {
        setCurrentMonth(storedCurrentMonth);
      } else {
        const now = new Date();
        const initialMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        setCurrentMonth(initialMonth);
        localStorage.setItem('cobuy_current_month', initialMonth);
      }
    } catch (e) {
      console.warn("No se pudo cargar datos desde localStorage", e);
      setItems(DEFAULT_ITEMS);
      setArchivedItems([]);
      setCashBudget(0);
      setCardBudget(DEFAULT_BUDGET);
      setCategories(PREDEFINED_CATEGORIES);
      setPlaces([]);
      setServicePayments([]);
      setServiceOptions(PREDEFINED_SERVICES);
      setIncomes([]);
      setMonthlyHistory([]);
      setApartados([]);
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
      localStorage.setItem('cobuy_archived_items', JSON.stringify(archivedItems));
    } catch (e) {
      console.error("Error al guardar historial en localStorage", e);
    }
  }, [archivedItems, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_budget_cash', cashBudget.toString());
      localStorage.setItem('cobuy_budget_card', cardBudget.toString());
    } catch (e) {
      console.error("Error al guardar presupuesto en localStorage", e);
    }
  }, [cashBudget, cardBudget, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_categories', JSON.stringify(categories));
    } catch (e) {
      console.error("Error al guardar categorias en localStorage", e);
    }
  }, [categories, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_places', JSON.stringify(places));
    } catch (e) {
      console.error("Error al guardar lugares en localStorage", e);
    }
  }, [places, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_service_payments', JSON.stringify(servicePayments));
    } catch (e) {
      console.error("Error al guardar pagos de servicios en localStorage", e);
    }
  }, [servicePayments, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_services', JSON.stringify(serviceOptions));
    } catch (e) {
      console.error("Error al guardar servicios en localStorage", e);
    }
  }, [serviceOptions, isInitialized]);

  // Autosaves for capital management
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_incomes', JSON.stringify(incomes));
    } catch (e) {
      console.error("Error al guardar ingresos en localStorage", e);
    }
  }, [incomes, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_history_months', JSON.stringify(monthlyHistory));
    } catch (e) {
      console.error("Error al guardar historial mensual en localStorage", e);
    }
  }, [monthlyHistory, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_current_month', currentMonth);
    } catch (e) {
      console.error("Error al guardar mes activo en localStorage", e);
    }
  }, [currentMonth, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_apartados', JSON.stringify(apartados));
    } catch (e) {
      console.error("Error al guardar apartados en localStorage", e);
    }
  }, [apartados, isInitialized]);


  // Month change detector
  useEffect(() => {
    if (!isInitialized) return;
    const now = new Date();
    const activeYearMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const storedMonth = localStorage.getItem('cobuy_current_month');
    if (storedMonth && storedMonth !== activeYearMonth) {
      setShowMonthChangeBanner(true);
    }
  }, [isInitialized]);

  const currentMonthName = useMemo(() => {
    if (!currentMonth) return '';
    const [year, month] = currentMonth.split('-');
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }, [currentMonth]);

  // Income handlers
  const handleAddIncome = (incomeData: Omit<Income, 'id' | 'createdAt'>) => {
    const newIncome: Income = {
      ...incomeData,
      id: `income-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    setIncomes((prev) => [newIncome, ...prev]);
    if (incomeData.paymentMethod === 'efectivo') {
      setCashBudget((prev) => prev + incomeData.amount);
    } else {
      setCardBudget((prev) => prev + incomeData.amount);
    }
  };

  const handleDeleteIncome = (id: string) => {
    setIncomes((prev) => {
      const target = prev.find(i => i.id === id);
      if (target) {
        if (target.paymentMethod === 'efectivo') {
          setCashBudget((prevCash) => Math.max(0, prevCash - target.amount));
        } else {
          setCardBudget((prevCard) => Math.max(0, prevCard - target.amount));
        }
      }
      return prev.filter(i => i.id !== id);
    });
  };

  // Apartados handlers
  const handleAddApartado = (name: string, amount: number, paymentMethod: 'efectivo' | 'tarjeta') => {
    const trimmedName = name.trim();
    if (!trimmedName || amount <= 0) return;

    // Verify availability
    if (paymentMethod === 'efectivo') {
      if (amount > cashBudget) return;
      setCashBudget((prev) => prev - amount);
    } else {
      if (amount > cardBudget) return;
      setCardBudget((prev) => prev - amount);
    }

    const newApartado: Apartado = {
      id: `apartado-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: trimmedName,
      amount,
      paymentMethod,
      createdAt: new Date().toISOString()
    };

    setApartados((prev) => [...prev, newApartado]);
  };

  const handleDepositToApartado = (id: string, amount: number) => {
    if (amount <= 0) return;
    setApartados((prev) => {
      return prev.map((ap) => {
        if (ap.id === id) {
          // Verify budget availability
          if (ap.paymentMethod === 'efectivo') {
            if (amount > cashBudget) return ap;
            setCashBudget((prevCash) => prevCash - amount);
          } else {
            if (amount > cardBudget) return ap;
            setCardBudget((prevCard) => prevCard - amount);
          }
          return { ...ap, amount: ap.amount + amount };
        }
        return ap;
      });
    });
  };

  const handleWithdrawFromApartado = (id: string, amount: number) => {
    if (amount <= 0) return;
    setApartados((prev) => {
      return prev.map((ap) => {
        if (ap.id === id) {
          const actualWithdraw = Math.min(ap.amount, amount);
          if (ap.paymentMethod === 'efectivo') {
            setCashBudget((prevCash) => prevCash + actualWithdraw);
          } else {
            setCardBudget((prevCard) => prevCard + actualWithdraw);
          }
          return { ...ap, amount: Math.max(0, ap.amount - actualWithdraw) };
        }
        return ap;
      });
    });
  };

  const handleDeleteApartado = (id: string) => {
    setApartados((prev) => {
      const target = prev.find((ap) => ap.id === id);
      if (target) {
        if (target.paymentMethod === 'efectivo') {
          setCashBudget((prevCash) => prevCash + target.amount);
        } else {
          setCardBudget((prevCard) => prevCard + target.amount);
        }
      }
      return prev.filter((ap) => ap.id !== id);
    });
  };

  // Month closing wizard handler
  const handleConfirmCloseMonth = (newCashBudget: number, newCardBudget: number, carryOverPendingItems: boolean) => {
    const boughtItems = items.filter(i => i.bought);
    const pendingItems = items.filter(i => !i.bought);

    const spentCash = boughtItems
      .filter(i => i.paymentMethod === 'efectivo')
      .reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

    const spentCard = boughtItems
      .filter(i => i.paymentMethod === 'tarjeta' || i.paymentMethod === 'transferencia')
      .reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

    const spentServices = servicePayments.reduce((acc, curr) => acc + curr.amount, 0);
    
    const totalIncomesCash = incomes
      .filter(i => i.paymentMethod === 'efectivo')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const totalIncomesCard = incomes
      .filter(i => i.paymentMethod === 'tarjeta')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const remainingCashVal = Math.max(0, cashBudget + totalIncomesCash - spentCash);
    const remainingCardVal = Math.max(0, cardBudget + totalIncomesCard - spentCard - spentServices);

    const [year, month] = currentMonth.split('-');

    const summary: MonthlySummary = {
      monthId: currentMonth,
      monthName: currentMonthName,
      initialCashBudget: Math.max(0, cashBudget - totalIncomesCash),
      initialCardBudget: Math.max(0, cardBudget - totalIncomesCard),
      totalIncomesCash,
      totalIncomesCard,
      totalSpentCash: spentCash,
      totalSpentCard: spentCard,
      totalSpentServices: spentServices,
      remainingCash: remainingCashVal,
      remainingCard: remainingCardVal,
      createdAt: new Date().toISOString()
    };

    const record: MonthlyHistoryRecord = {
      monthId: currentMonth,
      summary,
      items: [...items],
      servicePayments: [...servicePayments],
      incomes: [...incomes]
    };

    // Save to history
    setMonthlyHistory(prev => [record, ...prev]);

    // Setup next month active settings
    const nextMonthDate = new Date(parseInt(year), parseInt(month), 1);
    const nextMonthStr = nextMonthDate.getFullYear() + '-' + String(nextMonthDate.getMonth() + 1).padStart(2, '0');
    
    setCurrentMonth(nextMonthStr);
    setCashBudget(newCashBudget);
    setCardBudget(newCardBudget);
    setIncomes([]);

    // Clear items: carry over pending if requested
    if (carryOverPendingItems) {
      const carriedItems = pendingItems.map(item => ({
        ...item,
        createdAt: new Date().toISOString()
      }));
      setItems(carriedItems);
    } else {
      setItems([]);
    }

    // Preserve recurring service definitions (with their past createdAt)
    const uniqueRecurrents: Record<string, ServicePayment> = {};
    servicePayments.filter(sp => sp.isRecurring).forEach(sp => {
      if (!uniqueRecurrents[sp.service] || new Date(sp.createdAt) > new Date(uniqueRecurrents[sp.service].createdAt)) {
        uniqueRecurrents[sp.service] = sp;
      }
    });
    setServicePayments(Object.values(uniqueRecurrents));

    setIsCloseWizardOpen(false);
  };

  // Core Mutation Actions
  const handleAddItem = (itemData: Omit<ShoppingItem, 'id' | 'createdAt'>) => {
    const newItem: ShoppingItem = {
      ...itemData,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    setItems((prev) => [newItem, ...prev]);
    if (itemData.place && !places.some((place) => place.toLowerCase() === itemData.place.toLowerCase())) {
      setPlaces((prev) => [itemData.place, ...prev]);
    }
  };

  const handleToggleBought = (id: string) => {
    setItems((prev) => 
      prev.map(item => 
        item.id === id ? { ...item, bought: !item.bought } : item
      )
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;
      setArchivedItems((archived) => {
        if (archived.some((item) => item.id === id)) return archived;
        return [{ ...target, deletedAt: new Date().toISOString() }, ...archived];
      });
      return prev.filter(item => item.id !== id);
    });
  };

  const handleRestoreItem = (id: string) => {
    setArchivedItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;
      const { deletedAt, ...rest } = target;
      setItems((current) => {
        if (current.some((item) => item.id === id)) return current;
        return [rest, ...current];
      });
      return prev.filter(item => item.id !== id);
    });
  };

  const handlePurgeArchivedItem = (id: string) => {
    setArchivedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, updatedData: Partial<ShoppingItem>) => {
    setItems((prev) => 
      prev.map(item => 
        item.id === id ? { ...item, ...updatedData } : item
      )
    );
  };

  const handleUpdateBudget = (type: 'cash' | 'card', newBudget: number) => {
    if (type === 'cash') {
      setCashBudget(newBudget);
      return;
    }
    setCardBudget(newBudget);
  };

  const handleAddCategory = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const normalized = trimmedName.toLowerCase();
    if (categories.some((cat) => cat.name.toLowerCase() === normalized)) return;

    const palette = ['#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6', '#6B7280'];
    const nextColor = palette[categories.length % palette.length];
    const newCategory = {
      id: `custom-${normalized.replace(/\s+/g, '-')}`,
      name: trimmedName,
      color: nextColor
    };

    setCategories((prev) => [...prev, newCategory]);
  };

  const handleAddPlace = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (places.some((place) => place.toLowerCase() === trimmedName.toLowerCase())) return;
    setPlaces((prev) => [trimmedName, ...prev]);
  };

  const handleAddServicePayment = (paymentData: Omit<ServicePayment, 'id' | 'createdAt'>) => {
    const newPayment: ServicePayment = {
      ...paymentData,
      id: `service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    setServicePayments((prev) => [newPayment, ...prev]);
    if (paymentData.service && !serviceOptions.some((service) => service.toLowerCase() === paymentData.service.toLowerCase())) {
      setServiceOptions((prev) => [paymentData.service, ...prev]);
    }
  };

  const handleDeleteServicePayment = (id: string) => {
    setServicePayments((prev) => prev.filter((payment) => payment.id !== id));
  };

  const handleAddServiceOption = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (serviceOptions.some((service) => service.toLowerCase() === trimmedName.toLowerCase())) return;
    setServiceOptions((prev) => [trimmedName, ...prev]);
  };

  // Reset shopping database completely
  const handleResetData = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = () => {
    setItems([]);
    setArchivedItems([]);
    setServicePayments([]);
    setCashBudget(0);
    setCardBudget(0);
    setSelectedStoreFilter(null);
    setPlaces([]);
    setServiceOptions(PREDEFINED_SERVICES);
    setIsResetModalOpen(false);
  };

  // Export List functionality
  const handleExportData = () => {
    const keys = ['Producto', 'Lugar', 'Precio Unitario', 'Cantidad', 'Costo Total', 'Categoria', 'Metodo de Pago', 'Comprado', 'Fecha de Registro'];
    const csvContent = [
      keys.join(','),
      ...items.map(i => [
        `"${i.name.replace(/"/g, '""')}"`,
        `"${i.place.replace(/"/g, '""')}"`,
        i.price.toFixed(2),
        i.quantity,
        (i.price * i.quantity).toFixed(2),
        `"${i.category}"`,
        `"${PAYMENT_METHODS.find((method) => method.id === i.paymentMethod)?.name || 'Tarjeta'}"`,
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
  const itemsSpent = items.reduce((acc, curr) => acc + (curr.bought ? curr.price * curr.quantity : 0), 0);
  const planned = items.reduce((acc, curr) => acc + (!curr.bought ? curr.price * curr.quantity : 0), 0);
  const servicesSpent = servicePayments.reduce((acc, curr) => acc + curr.amount, 0);
  const spent = itemsSpent + servicesSpent;
  const totalBudget = cashBudget + cardBudget;
  const remaining = totalBudget - spent;

  const cashSpentItems = items.reduce((acc, curr) => acc + (curr.bought && curr.paymentMethod === 'efectivo' ? curr.price * curr.quantity : 0), 0);
  const cashPlanned = items.reduce((acc, curr) => acc + (!curr.bought && curr.paymentMethod === 'efectivo' ? curr.price * curr.quantity : 0), 0);
  const cardSpentItems = items.reduce((acc, curr) => acc + (curr.bought && curr.paymentMethod !== 'efectivo' ? curr.price * curr.quantity : 0), 0);
  const cardPlanned = items.reduce((acc, curr) => acc + (!curr.bought && curr.paymentMethod !== 'efectivo' ? curr.price * curr.quantity : 0), 0);
  const cashSpentServices = servicePayments.reduce((acc, curr) => acc + (curr.paymentMethod === 'efectivo' ? curr.amount : 0), 0);
  const cardSpentServices = servicePayments.reduce((acc, curr) => acc + (curr.paymentMethod !== 'efectivo' ? curr.amount : 0), 0);
  const cashSpent = cashSpentItems + cashSpentServices;
  const cardSpent = cardSpentItems + cardSpentServices;

  const budgetSummary: BudgetSummary = {
    totalBudget,
    spent,
    planned,
    remaining,
    cashBudget,
    cardBudget,
    cashSpent,
    cashPlanned,
    cardSpent,
    cardPlanned
  };

  // Extract unique place strings sorted for smart Autocomplete suggestions
  const existingPlaces: string[] = places.map((place) => place.trim()).filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 flex flex-col font-sans" id="app-root-layout">
      
      {/* Upper Navigation / Title Block with Minimal Elements */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-xs sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo Brand Title */}
          <div className="flex items-center gap-2 sm:gap-3.5">
            <div className="w-9 h-9 sm:w-11 sm:h-11 bg-slate-900 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0" id="app-logo-bg">
              <ShoppingBag className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 text-emerald-400 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-sm sm:text-xl font-black text-slate-900 tracking-tight leading-none">Cuentas Compras</h1>
              <p className="hidden md:block text-xs text-slate-500 font-semibold mt-1">Gestión & Control de Presupuestos</p>
            </div>
          </div>

          {/* User profile identifier & Quick reset/csv actions */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            
            {/* User chip */}
            <button
              onClick={() => {
                setTempName(userName);
                setIsNameModalOpen(true);
              }}
              className="flex items-center gap-1 sm:gap-2 bg-slate-50 hover:bg-slate-100 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-full border border-slate-200 hover:border-slate-355 text-[10px] sm:text-xs text-slate-700 font-extrabold cursor-pointer transition-all shadow-xs active:scale-95 select-none shrink-0"
              title="Cambiar tu nombre de usuario"
              id="user-profile-chip"
            >
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 shrink-0" />
              <span><span className="hidden sm:inline">Hola, </span><span className="text-emerald-600 font-black">{userName}</span></span>
            </button>

            {/* Export CSV action button */}
            <button
              onClick={handleExportData}
              className="p-2 sm:px-4 sm:py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
              title="Exportar compras completas a Excel / CSV"
              id="export-csv-btn"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>

            {/* Reiniciar demo seed values */}
            <button
              onClick={handleResetData}
              className="p-2 sm:p-2.5 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl transition-all cursor-pointer active:scale-95 shrink-0"
              title="Restablecer base de datos"
              id="reset-raw-db"
            >
              <RotateCcw className="w-4 sm:w-4.5 h-4 sm:h-4.5" />
            </button>

          </div>
        </div>
      </header>

      {/* Main Body Grid Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">

        {/* Month Change Banner Alert */}
        {showMonthChangeBanner && (
          <div className="mb-6 p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 text-white rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <span className="text-xl shrink-0">📅</span>
              <div>
                <h4 className="font-extrabold text-sm text-emerald-400">¡Ha cambiado el mes calendario!</h4>
                <p className="text-[10px] text-slate-300 font-semibold mt-0.5">Te sugerimos archivar {currentMonthName} y configurar tus fondos iniciales para el nuevo mes.</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setShowMonthChangeBanner(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Ocultar
              </button>
              <button
                onClick={() => {
                  setShowMonthChangeBanner(false);
                  setIsCloseWizardOpen(true);
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-sm"
              >
                Cerrar Mes <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        
        {/* Navigation Tabs - Modern Glass Switch */}
        <div className="flex justify-center mb-8" id="view-mode-tabs">
          <div className="bg-slate-200/60 p-1 rounded-2xl flex items-center gap-0.5 sm:gap-1 border border-slate-300/40 backdrop-blur-xs max-w-2xl w-full sm:w-auto shadow-xs">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer active:scale-95 ${
                activeTab === 'list' 
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <ShoppingBag className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-700 shrink-0" />
              <span>
                <span className="inline sm:hidden">Lista</span>
                <span className="hidden sm:inline">Lista de Compras</span>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer active:scale-95 ${
                activeTab === 'calendar' 
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <Calendar className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-700 shrink-0" />
              <span>
                <span className="inline sm:hidden">Calendario</span>
                <span className="hidden sm:inline">Calendario Mensual</span>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer active:scale-95 ${
                activeTab === 'charts' 
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <BarChart3 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-700 shrink-0" />
              <span>
                <span className="inline sm:hidden">Gráficos</span>
                <span className="hidden sm:inline">Gráficos Analíticos</span>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer active:scale-95 ${
                activeTab === 'history' 
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-700 shrink-0" />
              <span>
                <span className="inline sm:hidden">Historial</span>
                <span className="hidden sm:inline">Historial Mensual</span>
              </span>
            </button>
          </div>
        </div>

        {activeTab === 'list' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
            
            {/* LEFT 2 COLS: Budget Metrics Board & Purchase List */}
            <div className="lg:col-span-2 space-y-8 flex flex-col">
              
              {/* Top metrics with inline customizable budget cap */}
              <BudgetCard 
                summary={budgetSummary} 
                onUpdateBudget={handleUpdateBudget}
                onOpenCloseWizard={() => setIsCloseWizardOpen(true)}
                totalIncomesCash={incomes.filter(i => i.paymentMethod === 'efectivo').reduce((acc, curr) => acc + curr.amount, 0)}
                totalIncomesCard={incomes.filter(i => i.paymentMethod === 'tarjeta').reduce((acc, curr) => acc + curr.amount, 0)}
                apartados={apartados}
                onAddApartado={handleAddApartado}
                onDepositToApartado={handleDepositToApartado}
                onWithdrawFromApartado={handleWithdrawFromApartado}
                onDeleteApartado={handleDeleteApartado}
              />

              {/* List with rich actions: edit inline, check toggles, filters, sorts */}
              <div className="flex-grow">
                <PurchaseList 
                  items={items}
                  archivedItems={archivedItems}
                  selectedStoreFilter={selectedStoreFilter}
                  onToggleBought={handleToggleBought}
                  onDeleteItem={handleDeleteItem}
                  onUpdateItem={handleUpdateItem}
                  onRestoreItem={handleRestoreItem}
                  onPurgeArchivedItem={handlePurgeArchivedItem}
                  categories={categories}
                />
              </div>
              
            </div>

            {/* RIGHT 1 COL: Planning form & Store ledger aggregates */}
            <div className="space-y-8">
              
              {/* Dynamic Interactive Input form */}
              <AddItemForm 
                onAddItem={handleAddItem} 
                existingPlaces={existingPlaces}
                onAddPlace={handleAddPlace}
                categories={categories}
                onAddCategory={handleAddCategory}
              />

              <IncomesManager
                incomes={incomes}
                onAddIncome={handleAddIncome}
                onDeleteIncome={handleDeleteIncome}
              />

              <ServicePayments
                payments={servicePayments}
                services={serviceOptions}
                onAddPayment={handleAddServicePayment}
                onDeletePayment={handleDeleteServicePayment}
                onAddService={handleAddServiceOption}
              />

              {/* Aggregated store financial sums ("haciendo cuentas por lugar") */}
              <StoreSummary 
                items={items}
                selectedStoreFilter={selectedStoreFilter}
                onSelectStoreFilter={setSelectedStoreFilter}
              />

            </div>

          </div>
        ) : activeTab === 'calendar' ? (
          <div className="animate-in fade-in duration-200">
            <ExpenseCalendar 
              items={items} 
              servicePayments={servicePayments} 
            />
          </div>
        ) : activeTab === 'charts' ? (
          <div className="animate-in fade-in duration-200">
            <ExpenseCharts
              items={items}
              servicePayments={servicePayments}
              categories={categories}
              cashBudget={cashBudget}
              cardBudget={cardBudget}
            />
          </div>
        ) : (
          <div className="animate-in fade-in duration-200">
            <MonthlyHistory history={monthlyHistory} />
          </div>
        )}
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
      {isNameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-150 p-6 space-y-4 animate-in zoom-in duration-250">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
              <User className="w-5 h-5 text-emerald-500" />
              <h2 className="text-sm font-black text-slate-900">¿Cómo te llamas?</h2>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Escribe tu nombre para personalizar tu perfil y para que el asistente de Inteligencia Artificial se dirija a ti de manera cercana y personalizada.
            </p>

            <div>
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                maxLength={20}
                placeholder="Escribe tu nombre (ej. Raúl)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-400 placeholder-slate-400"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tempName.trim()) {
                    handleUpdateUserName(tempName);
                    setIsNameModalOpen(false);
                  }
                }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsNameModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleUpdateUserName(tempName);
                  setIsNameModalOpen(false);
                }}
                disabled={!tempName.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 transition cursor-pointer"
              >
                Guardar Nombre
              </button>
            </div>
          </div>
        </div>
      )}

      <MonthCloseWizard
        isOpen={isCloseWizardOpen}
        onClose={() => setIsCloseWizardOpen(false)}
        currentMonthName={currentMonthName}
        cashBudget={cashBudget}
        cardBudget={cardBudget}
        items={items}
        servicePayments={servicePayments}
        incomes={incomes}
        onConfirmClose={handleConfirmCloseMonth}
      />

      <AIAssistant
        userName={userName}
        items={items}
        archivedItems={archivedItems}
        servicePayments={servicePayments}
        cashBudget={cashBudget}
        cardBudget={cardBudget}
        categories={categories}
        places={places}
        serviceOptions={serviceOptions}
        onAddItem={handleAddItem}
        onToggleBought={handleToggleBought}
        onDeleteItem={handleDeleteItem}
        onUpdateItem={handleUpdateItem}
        onUpdateBudget={handleUpdateBudget}
        onAddServicePayment={handleAddServicePayment}
        onDeleteServicePayment={handleDeleteServicePayment}
        onAddCategory={handleAddCategory}
        onAddPlace={handleAddPlace}
        onAddServiceOption={handleAddServiceOption}
        onRestoreItem={handleRestoreItem}
        onPurgeArchivedItem={handlePurgeArchivedItem}
        onResetDatabase={handleConfirmReset}
        incomes={incomes}
        monthlyHistory={monthlyHistory}
        currentMonth={currentMonth}
        onAddIncome={handleAddIncome}
        onDeleteIncome={handleDeleteIncome}
      />

    </div>
  );
}
