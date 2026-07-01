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
  ArrowRight,
  Wallet,
  ListTodo,
  Plus,
  TrendingUp,
  Receipt,
  Store,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Coins,
  Sparkles,
  Upload,
  Camera
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
import { parseMercadoPagoCSV } from './utils/csvParser';
import { buildDuplicateIndex, checkDuplicateTransaction } from './utils/duplicateDetector';

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

const toLocalISOString = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

export default function App() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([]);
  const [servicePayments, setServicePayments] = useState<ServicePayment[]>([]);
  // cashBudget / cardBudget YA NO son estado mutado a mano: se derivan más abajo
  // (useMemo) de initialCash/CardBudgetSnapshot + ingresos − apartados.
  // Ver causa raíz B1/B2 en PLAN_BUG_CALCULO.md.
  const [places, setPlaces] = useState<string[]>([]);
  const [serviceOptions, setServiceOptions] = useState<string[]>(PREDEFINED_SERVICES);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [categories, setCategories] = useState(PREDEFINED_CATEGORIES);
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

  // Snapshots of the confirmed initial budget for each pool, persisted to localStorage.
  // Set when the wizard closes a month (to the new month's budget) or when the user
  // corrects the budget via the Edit button. Used so monthly history records the real
  // starting value instead of a retrospective cashBudget − totalIncomes formula.
  const [initialCashBudgetSnapshot, setInitialCashBudgetSnapshot] = useState<number>(0);
  const [initialCardBudgetSnapshot, setInitialCardBudgetSnapshot] = useState<number>(0);

  // Derived available pools — ÚNICA fuente de verdad: snapshot inicial + ingresos del
  // mes − apartados activos. Antes eran estado mutado a mano y editar "Presupuesto
  // Inicial" los pisaba, borrando ingresos/apartados (B1/B2, PLAN_BUG_CALCULO.md).
  const cashBudget = useMemo(() => {
    const incomesCash = incomes
      .filter(i => i.paymentMethod === 'efectivo')
      .reduce((acc, c) => acc + c.amount, 0);
    const apartadosCash = apartados
      .filter(a => a.paymentMethod === 'efectivo')
      .reduce((acc, a) => acc + a.amount, 0);
    return initialCashBudgetSnapshot + incomesCash - apartadosCash;
  }, [initialCashBudgetSnapshot, incomes, apartados]);

  const cardBudget = useMemo(() => {
    const incomesCard = incomes
      .filter(i => i.paymentMethod !== 'efectivo')
      .reduce((acc, c) => acc + c.amount, 0);
    const apartadosCard = apartados
      .filter(a => a.paymentMethod === 'tarjeta')
      .reduce((acc, a) => acc + a.amount, 0);
    return initialCardBudgetSnapshot + incomesCard - apartadosCard;
  }, [initialCardBudgetSnapshot, incomes, apartados]);

  // Navigation and sidebar states
  const [activeSection, setActiveSection] = useState<'capital' | 'shopping-list' | 'incomes' | 'services' | 'reports'>('capital');
  const [capitalTab, setCapitalTab] = useState<'dashboard' | 'history'>('dashboard');
  const [shoppingTab, setShoppingTab] = useState<'list' | 'stores'>('list');
  const [reportTab, setReportTab] = useState<'charts' | 'calendar'>('charts');
  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Mercado Pago CSV import states
  interface PreviewItem {
    tempId: string;
    externalId: string;
    date: string;
    description: string;
    amount: number;
    status: string;
    type: 'income' | 'expense' | 'service' | 'ambiguous';
    inferredCategory: string;
    inferredService?: string;
    isDuplicate: boolean;
    isFuzzyDuplicate?: boolean;
    fuzzyMatchDetails?: string;
    excluded?: boolean;
  }
  const [importPreview, setImportPreview] = useState<PreviewItem[] | null>(null);
  const [isAIClassifying, setIsAIClassifying] = useState(false);
  const [externalAITrigger, setExternalAITrigger] = useState<{ image: string; text: string; timestamp: number } | undefined>(undefined);

  // States for Mercado Pago Screenshot comments & preview modal
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotComment, setScreenshotComment] = useState<string>('');
  const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState<boolean>(false);

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
      // Claves legacy (cobuy_total_budget/budget_cash/budget_card): se leen SOLO dentro de la
      // rama de migración (más abajo). Una vez migrado nunca se vuelven a leer.
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

      // Load capital management states first — needed to migrate to the derived-pool model.
      const storedIncomes = localStorage.getItem('cobuy_incomes');
      const storedHistory = localStorage.getItem('cobuy_history_months');
      const storedCurrentMonth = localStorage.getItem('cobuy_current_month');
      const storedApartados = localStorage.getItem('cobuy_apartados');

      const parsedIncomes: Income[] = storedIncomes ? JSON.parse(storedIncomes) : [];
      const parsedApartados: Apartado[] = storedApartados ? JSON.parse(storedApartados) : [];
      setIncomes(parsedIncomes);
      setApartados(parsedApartados);

      if (storedHistory) {
        setMonthlyHistory(JSON.parse(storedHistory));
      } else {
        setMonthlyHistory([]);
      }

      // Modelo de snapshot (B1/B2): los snapshots son la ÚNICA fuente de verdad del inicial.
      // GUARD DE MIGRACIÓN EXPLÍCITO: si ambas claves de snapshot ya existen, el usuario YA está
      // migrado → se leen directo y NUNCA se recalcula desde las claves legacy
      // (cobuy_budget_cash/card). Sin este guard, una edición del "Presupuesto Inicial" podría
      // perderse en la siguiente recarga al re-derivarse desde el pool legacy viejo.
      const storedInitialCash = localStorage.getItem('cobuy_initial_cash_snapshot');
      const storedInitialCard = localStorage.getItem('cobuy_initial_card_snapshot');

      if (storedInitialCash !== null && storedInitialCard !== null) {
        // Ya migrado: snapshots como fuente de verdad; se IGNORAN las claves legacy.
        setInitialCashBudgetSnapshot(parseFloat(storedInitialCash) || 0);
        setInitialCardBudgetSnapshot(parseFloat(storedInitialCard) || 0);
      } else {
        // Primera vez (datos legacy o usuario nuevo): migrar UNA sola vez desde el "pool vivo"
        // viejo. snapshot = pool − ingresos + apartados, para reproducir lo que el usuario veía.
        const storedBudget = localStorage.getItem('cobuy_total_budget');
        const storedCashBudget = localStorage.getItem('cobuy_budget_cash');
        const storedCardBudget = localStorage.getItem('cobuy_budget_card');
        let migratedCashPool: number;
        let migratedCardPool: number;
        if (storedCashBudget || storedCardBudget) {
          migratedCashPool = parseFloat(storedCashBudget || '0') || 0;
          migratedCardPool = parseFloat(storedCardBudget || '0') || 0;
        } else if (storedBudget) {
          migratedCashPool = 0;
          migratedCardPool = parseFloat(storedBudget) || DEFAULT_BUDGET;
        } else {
          migratedCashPool = 0;
          migratedCardPool = DEFAULT_BUDGET;
        }

        const migIncCash = parsedIncomes.filter(i => i.paymentMethod === 'efectivo').reduce((a, c) => a + c.amount, 0);
        const migIncCard = parsedIncomes.filter(i => i.paymentMethod !== 'efectivo').reduce((a, c) => a + c.amount, 0);
        const migApCash = parsedApartados.filter(a => a.paymentMethod === 'efectivo').reduce((a, c) => a + c.amount, 0);
        const migApCard = parsedApartados.filter(a => a.paymentMethod === 'tarjeta').reduce((a, c) => a + c.amount, 0);
        const migratedSnapshotCash = migratedCashPool - migIncCash + migApCash;
        const migratedSnapshotCard = migratedCardPool - migIncCard + migApCard;

        // Persistir el snapshot en localStorage AQUÍ MISMO (sincrónico), no solo vía setState.
        // Esto hace la migración segura ante la doble invocación de <StrictMode> en dev: la 2ª
        // corrida del effect ya verá las claves de snapshot y entrará por la rama "ya migrado",
        // en vez de re-migrar desde una clave legacy que este bloque acaba de borrar.
        localStorage.setItem('cobuy_initial_cash_snapshot', String(migratedSnapshotCash));
        localStorage.setItem('cobuy_initial_card_snapshot', String(migratedSnapshotCard));
        setInitialCashBudgetSnapshot(migratedSnapshotCash);
        setInitialCardBudgetSnapshot(migratedSnapshotCard);

        // Limpieza única: borrar las claves legacy para que no quede NINGÚN camino futuro que
        // recalcule el snapshot desde ellas. El pool disponible no se persiste: se deriva (useMemo).
        localStorage.removeItem('cobuy_budget_cash');
        localStorage.removeItem('cobuy_budget_card');
        localStorage.removeItem('cobuy_total_budget');
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
      setCategories(PREDEFINED_CATEGORIES);
      setPlaces([]);
      setServicePayments([]);
      setServiceOptions(PREDEFINED_SERVICES);
      setIncomes([]);
      setMonthlyHistory([]);
      setApartados([]);
      // Pools derivados: fijar los snapshots equivale a "cash=0, card=DEFAULT_BUDGET".
      setInitialCashBudgetSnapshot(0);
      setInitialCardBudgetSnapshot(DEFAULT_BUDGET);
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

  // NOTA: el pool disponible (cashBudget/cardBudget) YA NO se persiste. Es un valor derivado
  // (useMemo) de initialCash/CardBudgetSnapshot + ingresos − apartados. Lo único que se persiste
  // es el snapshot (más abajo). Persistir el pool re-crearía las claves legacy que la migración
  // borra y reabriría el riesgo de recálculo (ver guard de migración y B1/B2).

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

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('cobuy_initial_cash_snapshot', initialCashBudgetSnapshot.toString());
    localStorage.setItem('cobuy_initial_card_snapshot', initialCardBudgetSnapshot.toString());
  }, [initialCashBudgetSnapshot, initialCardBudgetSnapshot, isInitialized]);


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
  const handleAddIncome = (incomeData: Omit<Income, 'id' | 'createdAt'> & { createdAt?: string }) => {
    const newIncome: Income = {
      ...incomeData,
      id: `income-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: incomeData.createdAt || toLocalISOString()
    };
    // El pool (cashBudget/cardBudget) se deriva de incomes: no se muta a mano.
    setIncomes((prev) => [newIncome, ...prev]);
  };

  const handleDeleteIncome = (id: string) => {
    const target = incomes.find(i => i.id === id);
    if (!target) return;
    // El pool se recalcula solo al quitar el registro de incomes.
    setIncomes(prev => prev.filter(i => i.id !== id));
  };

  // Apartados handlers
  const handleAddApartado = (name: string, amount: number, paymentMethod: 'efectivo' | 'tarjeta') => {
    const trimmedName = name.trim();
    if (!trimmedName || amount <= 0) return;

    const pool = paymentMethod === 'efectivo' ? cashBudget : cardBudget;
    if (amount > pool) return;

    const newApartado: Apartado = {
      id: `apartado-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: trimmedName,
      amount,
      paymentMethod,
      createdAt: toLocalISOString()
    };

    // Reservar un apartado reduce el pool automáticamente (el useMemo resta apartados).
    setApartados((prev) => [...prev, newApartado]);
  };

  const handleDepositToApartado = (id: string, amount: number) => {
    if (amount <= 0) return;
    const target = apartados.find(ap => ap.id === id);
    if (!target) return;

    const pool = target.paymentMethod === 'efectivo' ? cashBudget : cardBudget;
    if (amount > pool) return;

    // Aumentar el apartado reduce el pool derivado; no se muta a mano.
    setApartados((prev) => prev.map(ap =>
      ap.id === id ? { ...ap, amount: ap.amount + amount } : ap
    ));
  };

  const handleWithdrawFromApartado = (id: string, amount: number) => {
    if (amount <= 0) return;
    const target = apartados.find(ap => ap.id === id);
    if (!target) return;
    const actualWithdraw = Math.min(target.amount, amount);
    if (actualWithdraw <= 0) return;

    // Retirar del apartado devuelve el monto al pool derivado automáticamente.
    setApartados((prev) => prev.map(ap =>
      ap.id === id ? { ...ap, amount: Math.max(0, ap.amount - actualWithdraw) } : ap
    ));
  };

  const handleDeleteApartado = (id: string) => {
    const target = apartados.find((ap) => ap.id === id);
    if (!target) return;

    // Eliminar el apartado devuelve su dinero al pool libre (recálculo automático).
    setApartados((prev) => prev.filter((ap) => ap.id !== id));
  };

  // Month closing wizard handler
  const handleConfirmCloseMonth = (newCashBudget: number, newCardBudget: number, carryOverPendingItems: boolean) => {
    const boughtItems = items.filter(i => i.bought);
    const pendingItems = items.filter(i => !i.bought);

    const spentCash = boughtItems
      .filter(i => i.paymentMethod === 'efectivo')
      .reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

    const spentCard = boughtItems
      .filter(i => i.paymentMethod !== 'efectivo')
      .reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

    const currentMonthServices = servicePayments.filter(s => s.createdAt.startsWith(currentMonth));

    const spentServicesCash = currentMonthServices
      .filter(s => s.paymentMethod === 'efectivo')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const spentServicesCard = currentMonthServices
      .filter(s => s.paymentMethod !== 'efectivo')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const spentServices = spentServicesCash + spentServicesCard;

    const totalIncomesCash = incomes
      .filter(i => i.paymentMethod === 'efectivo')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const totalIncomesCard = incomes
      .filter(i => i.paymentMethod !== 'efectivo')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const remainingCashVal = Math.max(0, cashBudget - spentCash - spentServicesCash);
    const remainingCardVal = Math.max(0, cardBudget - spentCard - spentServicesCard);

    const totalApartadosCash = apartados
      .filter(a => a.paymentMethod === 'efectivo')
      .reduce((acc, a) => acc + a.amount, 0);
    const totalApartadosCard = apartados
      .filter(a => a.paymentMethod === 'tarjeta')
      .reduce((acc, a) => acc + a.amount, 0);

    const [year, month] = currentMonth.split('-');

    const summary: MonthlySummary = {
      monthId: currentMonth,
      monthName: currentMonthName,
      initialCashBudget: initialCashBudgetSnapshot > 0 ? initialCashBudgetSnapshot : Math.max(0, cashBudget + totalApartadosCash - totalIncomesCash),
      initialCardBudget: initialCardBudgetSnapshot > 0 ? initialCardBudgetSnapshot : Math.max(0, cardBudget + totalApartadosCard - totalIncomesCard),
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
      servicePayments: currentMonthServices,
      incomes: [...incomes]
    };


    // Save to history (prevent duplicates by filtering out any existing record with the same monthId)
    setMonthlyHistory(prev => [record, ...prev.filter(r => r.monthId !== currentMonth)]);

    // Setup next month active settings
    const nextMonthDate = new Date(parseInt(year), parseInt(month), 1);
    const nextMonthStr = nextMonthDate.getFullYear() + '-' + String(nextMonthDate.getMonth() + 1).padStart(2, '0');

    setCurrentMonth(nextMonthStr);
    // Pool derivado = snapshot + ingresos − apartados. Los apartados PERSISTEN al cerrar
    // y newCashBudget (del wizard) ya viene neto de apartados, así que el snapshot debe
    // incluirlos para que el pool libre derivado sea exactamente newCashBudget.
    setInitialCashBudgetSnapshot(newCashBudget + totalApartadosCash);
    setInitialCardBudgetSnapshot(newCardBudget + totalApartadosCard);
    setIncomes([]);

    // Clear items: carry over pending if requested
    if (carryOverPendingItems) {
      const carriedItems = pendingItems.map(item => ({ ...item }));
      setItems(carriedItems);
    } else {
      setItems([]);
    }

    // Preserve service payments of other months (non-current month) and the latest instances of recurring service definitions
    const nonCurrentMonthServices = servicePayments.filter(sp => !sp.createdAt.startsWith(currentMonth));
    const uniqueRecurrents: Record<string, ServicePayment> = {};
    servicePayments.filter(sp => sp.isRecurring).forEach(sp => {
      if (!uniqueRecurrents[sp.service] || new Date(sp.createdAt) > new Date(uniqueRecurrents[sp.service].createdAt)) {
        uniqueRecurrents[sp.service] = sp;
      }
    });

    const newServicePaymentsMap = new Map<string, ServicePayment>();
    nonCurrentMonthServices.forEach(sp => newServicePaymentsMap.set(sp.id, sp));
    Object.values(uniqueRecurrents).forEach(sp => newServicePaymentsMap.set(sp.id, sp));

    setServicePayments(Array.from(newServicePaymentsMap.values()));

    setIsCloseWizardOpen(false);
  };

  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseMercadoPagoCSV(text);
        if (parsed.length === 0) {
          alert("No se encontraron transacciones válidas en el archivo.");
          return;
        }

        // Build the unified duplicate index including history records
        const dupIndex = buildDuplicateIndex(items, servicePayments, incomes, monthlyHistory);

        // Filter duplicates or mark them
        const marked: PreviewItem[] = parsed.map(t => {
          const check = checkDuplicateTransaction({
            name: t.description,
            amount: t.amount,
            date: t.date,
            externalId: t.externalId
          }, dupIndex);

          const isExactDup = check?.type === 'exact';
          const isFuzzy = check?.type === 'fuzzy';
          const fuzzyDetails = check?.type === 'fuzzy' ? check.details : undefined;

          return {
            ...t,
            tempId: t.externalId || `temp-import-${Math.random().toString(36).substring(2, 11)}`,
            isDuplicate: isExactDup,
            isFuzzyDuplicate: isFuzzy,
            fuzzyMatchDetails: fuzzyDetails,
            excluded: isFuzzy || isExactDup // Auto-exclude fuzzy or exact duplicates
          };
        });

        setImportPreview(marked);
        // Reset input value
        e.target.value = '';
      } catch (err: any) {
        alert(`Error al analizar el CSV: ${err.message}`);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleMPScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetInput = e.target;
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setScreenshotPreview(compressedBase64);
          setIsScreenshotModalOpen(true);
        } else {
          setScreenshotPreview(reader.result as string);
          setIsScreenshotModalOpen(true);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);

    targetInput.value = '';
  };

  const handleExecuteScreenshotScan = (base64: string, comment: string) => {
    let prompt = `Analiza detalladamente esta captura de pantalla de transacciones o movimientos financieros.
Para cada transacción o movimiento que identifiques en la imagen:
1. Extrae los datos: concepto/tienda, monto (valor numérico positivo), fecha e ID de transacción o referencia (si está visible).
2. Asocia la fecha a un formato absoluto YYYY-MM-DD (usando el mes y año actual activo de la aplicación) y pásala en el parámetro 'createdAt'.
3. Identifica qué tipo de movimiento es e invoca la herramienta adecuada correspondiente:
   - Ingresos (nómina, transferencias recibidas, regalos, abonos, etc.): usa la herramienta 'add_income_proposed'.
   - Pagos de servicios recurrentes/suscripciones o puntuales (Netflix, Spotify, agua, luz, recargas, telefonía, taxis, Uber, etc.): usa la herramienta 'add_service_proposed'.
   - Compras o gastos de consumo (supermercado, comida, compras generales, etc.): usa la herramienta 'add_item_proposed' con bought = true, place y la categoría de compra lógica.
   - Retiros, ahorros o transferencias a fondos apartados: usa la herramienta 'add_apartado_proposed' (o 'withdraw_from_apartado_proposed' si es retiro, o 'deposit_to_apartado_proposed' si es depósito).
4. Genera llamadas a herramientas separadas para cada transacción que veas en la imagen.`;

    if (comment.trim()) {
      prompt += `\n\nINSTRUCCIONES ADICIONALES DEL USUARIO (Sigue estrictamente estas indicaciones sobre qué procesar o modificar):\n"${comment.trim()}"`;
    }

    setExternalAITrigger({
      image: base64,
      text: prompt,
      timestamp: Date.now()
    });
  };

  const handleClassifyWithAI = async () => {
    if (!importPreview) return;
    const storedApiKey = localStorage.getItem('cobuy_gemini_api_key') || '';
    let apiKey = storedApiKey;
    if (storedApiKey && !storedApiKey.startsWith('AIza')) {
      try {
        apiKey = atob(storedApiKey);
      } catch (e) {
        apiKey = storedApiKey;
      }
    }

    if (!apiKey.trim()) {
      alert("Por favor, configura tu API Key de Gemini en el Asistente de IA (ícono de estrella arriba) para poder usar la clasificación inteligente.");
      return;
    }

    const ambiguousItems = importPreview.filter(t => !t.isDuplicate && t.type === 'ambiguous' && !t.excluded);
    if (ambiguousItems.length === 0) {
      alert("No hay transacciones ambiguas para clasificar en este momento.");
      return;
    }

    setIsAIClassifying(true);

    try {
      const selectedModel = localStorage.getItem('cobuy_gemini_selected_model') || 'gemini-2.5-flash';

      const prompt = `Analiza estas transacciones de Mercado Pago y clasifícalas de forma inteligente.
Tipos posibles:
1. "income": si el monto es positivo o si es un abono/transferencia recibida.
2. "service": si es un pago a un servicio frecuente (ej. Uber, Didi, Rappi, Netflix, Spotify, Internet, Luz, Agua, Gas, Celular).
3. "expense": para cualquier otra compra de bienes/comida/artículos.

Si es "expense", asígnale una categoría de compra de las siguientes: "comida", "hogar", "tecnologia", "ropa", "salud", "otros".
Si es "service", indica el nombre exacto del servicio en "serviceName" (ej. "Uber", "Spotify", "Netflix", "Internet", "Luz", etc., o "Otro servicio" si es uno recurrente pero no listado).

Transacciones a clasificar:
${JSON.stringify(ambiguousItems.map(item => ({ tempId: item.tempId, description: item.description, amount: item.amount })))}

Responde ÚNICAMENTE con un arreglo JSON válido (sin usar bloques de código markdown como \`\`\`json) en este formato:
[
  {
    "tempId": "id temporal de la transaccion",
    "type": "income" | "expense" | "service",
    "category": "comida" | "hogar" | "tecnologia" | "ropa" | "salud" | "otros",
    "serviceName": "nombre_del_servicio_o_vacio"
  }
]`;

      const requestBody = {
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey.trim()
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        throw new Error(`Error del API: HTTP ${response.status}`);
      }

      const responseData = await response.json();
      const textResponse = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResponse) {
        throw new Error("No se recibió respuesta válida del modelo de IA.");
      }

      const classifications = JSON.parse(textResponse.trim());
      if (Array.isArray(classifications)) {
        setImportPreview(prev => {
          if (!prev) return null;
          return prev.map(item => {
            const match = classifications.find((c: any) => c.tempId === item.tempId);
            if (match) {
              return {
                ...item,
                type: match.type || 'expense',
                inferredCategory: match.category || 'otros',
                inferredService: match.serviceName || undefined
              };
            }
            return item;
          });
        });
        alert(`Se han clasificado con éxito ${classifications.length} transacciones usando Gemini.`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error al clasificar con IA: ${err.message}. Verifica tu API Key y conexión.`);
    } finally {
      setIsAIClassifying(false);
    }
  };

  const handleConfirmImport = (itemsToImport: PreviewItem[]) => {
    if (itemsToImport.length === 0) return;

    const [currYear, currMonthVal] = currentMonth.split('-').map(Number);

    const newItems: ShoppingItem[] = [];
    const newServices: ServicePayment[] = [];
    const newIncomes: Income[] = [];

    const historyUpdates: Record<string, { items: ShoppingItem[], servicePayments: ServicePayment[], incomes: Income[] }> = {};

    itemsToImport.forEach((item, idx) => {
      const itemDate = new Date(item.date);
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      const monthId = `${itemYear}-${String(itemMonth).padStart(2, '0')}`;
      const isActiveMonth = itemYear === currYear && itemMonth === currMonthVal;

      if (isActiveMonth) {
        if (item.type === 'income') {
          const newInc: Income = {
            id: `income-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.description,
            amount: Math.abs(item.amount),
            paymentMethod: 'transferencia',
            createdAt: item.date,
            externalId: item.externalId
          };
          newIncomes.push(newInc);
        } else if (item.type === 'service') {
          const newServ: ServicePayment = {
            id: `service-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
            service: item.inferredService || 'Otro servicio',
            amount: Math.abs(item.amount),
            paymentMethod: 'tarjeta',
            createdAt: item.date,
            isRecurring: false,
            externalId: item.externalId
          };
          newServices.push(newServ);
        } else {
          const newExp: ShoppingItem = {
            id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.description,
            place: 'Mercado Pago',
            price: Math.abs(item.amount),
            quantity: 1,
            category: item.inferredCategory || 'otros',
            bought: true,
            paymentMethod: 'tarjeta',
            createdAt: item.date,
            externalId: item.externalId
          };
          newItems.push(newExp);
        }
      } else {
        if (!historyUpdates[monthId]) {
          historyUpdates[monthId] = { items: [], servicePayments: [], incomes: [] };
        }

        if (item.type === 'income') {
          historyUpdates[monthId].incomes.push({
            id: `income-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.description,
            amount: Math.abs(item.amount),
            paymentMethod: 'transferencia',
            createdAt: item.date,
            externalId: item.externalId
          });
        } else if (item.type === 'service') {
          historyUpdates[monthId].servicePayments.push({
            id: `service-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
            service: item.inferredService || 'Otro servicio',
            amount: Math.abs(item.amount),
            paymentMethod: 'tarjeta',
            createdAt: item.date,
            isRecurring: false,
            externalId: item.externalId
          });
        } else {
          historyUpdates[monthId].items.push({
            id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.description,
            place: 'Mercado Pago',
            price: Math.abs(item.amount),
            quantity: 1,
            category: item.inferredCategory || 'otros',
            bought: true,
            paymentMethod: 'tarjeta',
            createdAt: item.date,
            externalId: item.externalId
          });
        }
      }
    });

    if (newItems.length > 0) setItems(prev => [...newItems, ...prev]);
    if (newServices.length > 0) setServicePayments(prev => [...newServices, ...prev]);
    // Los ingresos importados entran a incomes; el pool (cardBudget) los deriva solo.
    if (newIncomes.length > 0) setIncomes(prev => [...newIncomes, ...prev]);

    setMonthlyHistory(prev => {
      const updatedHistory = [...prev];

      Object.entries(historyUpdates).forEach(([monthId, updates]) => {
        const existingRecordIdx = updatedHistory.findIndex(h => h.monthId === monthId);

        if (existingRecordIdx !== -1) {
          const record = updatedHistory[existingRecordIdx];
          const newHistoryItems = [...record.items, ...updates.items];
          const newHistoryServices = [...record.servicePayments, ...updates.servicePayments];
          const newHistoryIncomes = [...record.incomes, ...updates.incomes];

          const spentCard = newHistoryItems
            .filter(i => i.paymentMethod !== 'efectivo')
            .reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

          const spentServicesCard = newHistoryServices
            .filter(s => s.paymentMethod !== 'efectivo')
            .reduce((acc, curr) => acc + curr.amount, 0);

          const spentServices = newHistoryServices.reduce((acc, curr) => acc + curr.amount, 0);

          const totalIncomesCard = newHistoryIncomes
            .filter(i => i.paymentMethod !== 'efectivo')
            .reduce((acc, curr) => acc + curr.amount, 0);

          const remainingCardVal = Math.max(0, record.summary.initialCardBudget + totalIncomesCard - spentCard - spentServicesCard);

          const updatedSummary = {
            ...record.summary,
            totalIncomesCard,
            totalSpentCard: spentCard,
            totalSpentServices: spentServices,
            remainingCard: remainingCardVal
          };

          updatedHistory[existingRecordIdx] = {
            ...record,
            items: newHistoryItems,
            servicePayments: newHistoryServices,
            incomes: newHistoryIncomes,
            summary: updatedSummary
          };
        } else {
          const [year, month] = monthId.split('-');
          const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
          ];
          const monthName = `${monthNames[parseInt(month) - 1]} ${year}`;

          const spentCard = updates.items
            .filter(i => i.paymentMethod !== 'efectivo')
            .reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

          const spentServicesCard = updates.servicePayments
            .filter(s => s.paymentMethod !== 'efectivo')
            .reduce((acc, curr) => acc + curr.amount, 0);

          const spentServices = updates.servicePayments.reduce((acc, curr) => acc + curr.amount, 0);

          const totalIncomesCard = updates.incomes
            .filter(i => i.paymentMethod !== 'efectivo')
            .reduce((acc, curr) => acc + curr.amount, 0);

          const remainingCardVal = Math.max(0, totalIncomesCard - spentCard - spentServicesCard);

          const newSummary = {
            monthId,
            monthName,
            initialCashBudget: 0,
            initialCardBudget: 0,
            totalIncomesCash: 0,
            totalIncomesCard,
            totalSpentCash: 0,
            totalSpentCard: spentCard,
            totalSpentServices: spentServices,
            remainingCash: 0,
            remainingCard: remainingCardVal,
            createdAt: new Date().toISOString(),
            isPartialImport: true
          };

          updatedHistory.push({
            monthId,
            summary: newSummary,
            items: updates.items,
            servicePayments: updates.servicePayments,
            incomes: updates.incomes
          });
        }
      });

      return updatedHistory.sort((a, b) => b.monthId.localeCompare(a.monthId));
    });

    setImportPreview(null);
    alert(`Importación completada con éxito. Se agregaron ${itemsToImport.length} transacciones.`);
  };

  // Core Mutation Actions
  const handleAddItem = (itemData: Omit<ShoppingItem, 'id' | 'createdAt'> & { createdAt?: string }) => {
    const newItem: ShoppingItem = {
      ...itemData,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: itemData.createdAt || toLocalISOString()
    };
    setItems((prev) => [newItem, ...prev]);
    if (itemData.place) {
      setPlaces((prev) => {
        if (prev.some((place) => place.toLowerCase() === itemData.place.toLowerCase())) return prev;
        return [itemData.place, ...prev];
      });
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
    const target = items.find((item) => item.id === id);
    if (!target) return;
    setArchivedItems((archived) => {
      if (archived.some((item) => item.id === id)) return archived;
      return [{ ...target, deletedAt: new Date().toISOString() }, ...archived];
    });
    setItems((prev) => prev.filter(item => item.id !== id));
  };

  const handleRestoreItem = (id: string) => {
    const target = archivedItems.find((item) => item.id === id);
    if (!target) return;
    const { deletedAt, ...rest } = target;
    setItems((current) => {
      if (current.some((item) => item.id === id)) return current;
      return [rest, ...current];
    });
    setArchivedItems((prev) => prev.filter(item => item.id !== id));
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
    // Editar "Presupuesto Inicial" escribe SOLO sobre el snapshot (fuente de verdad).
    // El pool disponible se recalcula solo (snapshot + ingresos − apartados), por lo que
    // los ingresos y apartados ya registrados NO se pierden. Fix de B1/B2.
    if (type === 'cash') {
      setInitialCashBudgetSnapshot(newBudget);
      return;
    }
    setInitialCardBudgetSnapshot(newBudget);
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
    setPlaces((prev) => {
      if (prev.some((place) => place.toLowerCase() === trimmedName.toLowerCase())) return prev;
      return [trimmedName, ...prev];
    });
  };

  const handleAddServicePayment = (paymentData: Omit<ServicePayment, 'id' | 'createdAt'> & { createdAt?: string }) => {
    const newPayment: ServicePayment = {
      ...paymentData,
      id: `service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: paymentData.createdAt || toLocalISOString()
    };
    setServicePayments((prev) => [newPayment, ...prev]);
    if (paymentData.service) {
      setServiceOptions((prev) => {
        if (prev.some((service) => service.toLowerCase() === paymentData.service.toLowerCase())) return prev;
        return [paymentData.service, ...prev];
      });
    }
  };

  const handleDeleteServicePayment = (id: string) => {
    const target = servicePayments.find((payment) => payment.id === id);
    if (!target) return;
    if (window.confirm(`¿Estás seguro de eliminar el pago del servicio "${target.service}" por $${target.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}?`)) {
      setServicePayments((prev) => prev.filter((payment) => payment.id !== id));
    }
  };

  const handleAddServiceOption = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setServiceOptions((prev) => {
      if (prev.some((service) => service.toLowerCase() === trimmedName.toLowerCase())) return prev;
      return [trimmedName, ...prev];
    });
  };

  // Reset shopping database completely
  const handleResetData = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = () => {
    setItems([]);
    setArchivedItems([]);
    setServicePayments([]);
    setIncomes([]);
    setApartados([]);
    setMonthlyHistory([]);
    // Pools derivados: snapshots en 0 dejan cashBudget/cardBudget en 0.
    setInitialCashBudgetSnapshot(0);
    setInitialCardBudgetSnapshot(0);
    const now = new Date();
    const resetMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    setCurrentMonth(resetMonth);
    setSelectedStoreFilter(null);
    setPlaces([]);
    setServiceOptions(PREDEFINED_SERVICES);
    setIsResetModalOpen(false);
  };

  const handleDeleteHistoryMonth = (monthId: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar por completo el historial del mes ${monthId}? Esta acción no se puede deshacer.`)) {
      setMonthlyHistory(prev => prev.filter(h => h.monthId !== monthId));
    }
  };

  // Export List functionality
  const [exportType, setExportType] = useState<'items' | 'unified' | 'full'>('items');

  const handleExportData = () => {
    let keys: string[] = [];
    let csvRows: string[] = [];
    let filename = '';

    if (exportType === 'items') {
      keys = ['Producto', 'Lugar', 'Precio Unitario', 'Cantidad', 'Costo Total', 'Categoria', 'Metodo de Pago', 'Comprado', 'Fecha de Registro', 'ID Externo'];
      csvRows = items.map(i => [
        `"${i.name.replace(/"/g, '""')}"`,
        `"${i.place.replace(/"/g, '""')}"`,
        i.price.toFixed(2),
        i.quantity,
        (i.price * i.quantity).toFixed(2),
        `"${i.category}"`,
        `"${PAYMENT_METHODS.find((method) => method.id === i.paymentMethod)?.name || 'Tarjeta'}"`,
        i.bought ? "SÍ" : "NO",
        new Date(i.createdAt).toLocaleDateString('es-ES'),
        `"${i.externalId || ''}"`
      ].join(','));
      filename = `lista_compras_articulos_${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      keys = ['Mes', 'Tipo', 'Fecha', 'Descripcion', 'Monto', 'Cantidad/Info', 'Total', 'Categoria/Detalle', 'Metodo de Pago', 'Estado', 'ID Externo'];

      const appendMonthRows = (monthName: string, itemsList: typeof items, servicesList: typeof servicePayments, incomesList: typeof incomes) => {
        // Incomes
        incomesList.forEach(inc => {
          csvRows.push([
            `"${monthName}"`,
            '"Ingreso"',
            new Date(inc.createdAt).toLocaleDateString('es-ES'),
            `"${inc.name.replace(/"/g, '""')}"`,
            inc.amount.toFixed(2),
            '1',
            inc.amount.toFixed(2),
            '"Ingresos"',
            `"${PAYMENT_METHODS.find(m => m.id === inc.paymentMethod)?.name || 'Tarjeta'}"`,
            '"Recibido"',
            `"${inc.externalId || ''}"`
          ].join(','));
        });

        // Services
        servicesList.forEach(s => {
          csvRows.push([
            `"${monthName}"`,
            '"Servicio"',
            new Date(s.createdAt).toLocaleDateString('es-ES'),
            `"${s.service.replace(/"/g, '""')}"`,
            (-s.amount).toFixed(2),
            '1',
            (-s.amount).toFixed(2),
            '"Servicios"',
            `"${PAYMENT_METHODS.find(m => m.id === s.paymentMethod)?.name || 'Tarjeta'}"`,
            '"Pagado"',
            `"${s.externalId || ''}"`
          ].join(','));
        });

        // Items
        itemsList.forEach(i => {
          csvRows.push([
            `"${monthName}"`,
            '"Compra/Gasto"',
            new Date(i.createdAt).toLocaleDateString('es-ES'),
            `"${i.name.replace(/"/g, '""')}"`,
            (-i.price).toFixed(2),
            i.quantity,
            (-(i.price * i.quantity)).toFixed(2),
            `"${i.category}"`,
            `"${PAYMENT_METHODS.find(m => m.id === i.paymentMethod)?.name || 'Tarjeta'}"`,
            i.bought ? '"Comprado"' : '"Planificado"',
            `"${i.externalId || ''}"`
          ].join(','));
        });
      };

      if (exportType === 'unified') {
        appendMonthRows(currentMonthName, items, servicePayments, incomes);
        filename = `estado_cuenta_unificado_${currentMonthName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        // Full Backup: historical sorted chronologically + current active month
        const sortedHistory = [...monthlyHistory].sort((a, b) => a.monthId.localeCompare(b.monthId));
        sortedHistory.forEach(h => {
          appendMonthRows(h.summary.monthName, h.items, h.servicePayments, h.incomes);
        });
        appendMonthRows(currentMonthName, items, servicePayments, incomes);
        filename = `historial_completo_spendwise_${new Date().toISOString().slice(0, 10)}.csv`;
      }
    }

    const csvContent = [keys.join(','), ...csvRows].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // Added UTF-8 BOM to fix Excel encoding
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Compute stats in real-time (vaya haciendo cuentas de todo)
  const itemsSpent = items.reduce((acc, curr) => acc + (curr.bought ? curr.price * curr.quantity : 0), 0);
  const planned = items.reduce((acc, curr) => acc + (!curr.bought ? curr.price * curr.quantity : 0), 0);
  const currentMonthServices = servicePayments.filter(s => s.createdAt.startsWith(currentMonth));
  const servicesSpent = currentMonthServices.reduce((acc, curr) => acc + curr.amount, 0);
  const spent = itemsSpent + servicesSpent;
  const totalBudget = cashBudget + cardBudget;
  const remaining = totalBudget - spent;

  const cashSpentItems = items.reduce((acc, curr) => acc + (curr.bought && curr.paymentMethod === 'efectivo' ? curr.price * curr.quantity : 0), 0);
  const cashPlanned = items.reduce((acc, curr) => acc + (!curr.bought && curr.paymentMethod === 'efectivo' ? curr.price * curr.quantity : 0), 0);
  const cardSpentItems = items.reduce((acc, curr) => acc + (curr.bought && curr.paymentMethod !== 'efectivo' ? curr.price * curr.quantity : 0), 0);
  const cardPlanned = items.reduce((acc, curr) => acc + (!curr.bought && curr.paymentMethod !== 'efectivo' ? curr.price * curr.quantity : 0), 0);
  const cashSpentServices = currentMonthServices.reduce((acc, curr) => acc + (curr.paymentMethod === 'efectivo' ? curr.amount : 0), 0);
  const cardSpentServices = currentMonthServices.reduce((acc, curr) => acc + (curr.paymentMethod !== 'efectivo' ? curr.amount : 0), 0);
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
    cardPlanned,
    initialCashBudget: initialCashBudgetSnapshot,
    initialCardBudget: initialCardBudgetSnapshot
  };


  // Extract unique place strings sorted for smart Autocomplete suggestions
  const existingPlaces: string[] = places.map((place) => place.trim()).filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans text-slate-800" id="app-root-layout">

      {/* Sidebar for Desktop & Drawer for Mobile */}
      {/* Sidebar Backdrop for Mobile */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden transition-opacity duration-300"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Component */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200/80 transition-all duration-300 md:static overflow-hidden ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          } ${sidebarCollapsed ? 'md:w-20' : 'md:w-72'
          } w-72 shrink-0`}
      >
        {/* Sidebar Header */}
        <div className={`h-16 flex items-center border-b border-slate-200/50 shrink-0 ${sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          <div className={`flex items-center gap-2.5 overflow-hidden ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shrink-0">
              <ShoppingBag className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
            </div>
            {!sidebarCollapsed && (
              <div className="animate-in fade-in duration-200">
                <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">SpendWise Pro</h1>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Presupuesto y Control</p>
              </div>
            )}
          </div>

          {/* Desktop collapse button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-1.5 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Mobile close button */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden p-1.5 hover:bg-slate-50 border border-transparent rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {[
            { id: 'capital', label: 'Mi Capital', icon: Wallet, desc: 'Presupuestos e Historial' },
            { id: 'shopping-list', label: 'Lista de Compras', icon: ListTodo, desc: 'Gestión de compras' },
            { id: 'incomes', label: 'Ingresos del Mes', icon: Coins, desc: 'Control de ingresos' },
            { id: 'services', label: 'Pagos de Servicio', icon: Receipt, desc: 'Facturas y servicios' },
            { id: 'reports', label: 'Reportes y Calendario', icon: BarChart3, desc: 'Gráficos y fechas' }
          ].map((item) => {
            const isActive = activeSection === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id as any);
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3.5 rounded-2xl transition-all duration-150 group cursor-pointer ${sidebarCollapsed ? 'justify-center p-2.5' : 'p-3.5'} ${isActive
                  ? 'bg-slate-900 text-white shadow-sm shadow-slate-950/15'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                title={item.label}
              >
                <Icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-700'}`} />
                {!sidebarCollapsed && (
                  <div className="text-left animate-in fade-in duration-200">
                    <p className="text-xs font-extrabold tracking-tight leading-none">{item.label}</p>
                    <p className={`text-[9px] font-semibold mt-0.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>{item.desc}</p>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer - Greeting/User profile in compact sidebar */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-slate-200/50 bg-slate-50/50 text-xs font-semibold text-slate-500 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-emerald-500" />
              <span>Sesión activa como:</span>
            </div>
            <p className="text-slate-800 font-extrabold text-sm ml-6 line-clamp-1">{userName}</p>
          </div>
        )}
      </aside>

      {/* Content Area */}
      <div className="flex-grow flex flex-col min-h-screen overflow-x-hidden">

        {/* Top Header Bar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shadow-xs">
          {/* Mobile hamburger & active section title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 cursor-pointer transition active:scale-95"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight capitalize">
              {activeSection === 'capital' && 'Mi Capital & Historial'}
              {activeSection === 'shopping-list' && 'Lista de Compras'}
              {activeSection === 'incomes' && 'Ingresos del Mes'}
              {activeSection === 'services' && 'Pagos de Servicio'}
              {activeSection === 'reports' && 'Reportes y Calendario'}
            </h2>
          </div>

          {/* Global top header actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* User chip */}
            <button
              onClick={() => {
                setTempName(userName);
                setIsNameModalOpen(true);
              }}
              className="flex items-center gap-1 sm:gap-2 bg-slate-50 hover:bg-slate-100 px-2 sm:px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-300 text-[10px] sm:text-xs text-slate-700 font-extrabold cursor-pointer transition shadow-xs active:scale-95 shrink-0"
              title="Cambiar tu nombre"
              id="user-profile-chip"
            >
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Hola, <span className="text-emerald-600 font-black">{userName}</span></span>
            </button>

            {/* Export CSV action button */}
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] sm:text-xs font-extrabold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95 shrink-0"
              title="Exportar compras completas a CSV"
              id="export-csv-btn"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>

            {/* Reset DB action button */}
            <button
              onClick={handleResetData}
              className="p-1.5 sm:p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl transition cursor-pointer active:scale-95 shrink-0"
              title="Restablecer base de datos"
              id="reset-raw-db"
            >
              <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
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

          {/* Section Rendering */}
          {activeSection === 'capital' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
              {/* Tabs selector */}
              <div className="flex justify-center" id="capital-tabs">
                <div className="bg-slate-200/60 p-1 rounded-2xl flex items-center gap-0.5 sm:gap-1 border border-slate-300/40 backdrop-blur-xs max-w-md w-full sm:w-auto shadow-xs">
                  <button
                    onClick={() => setCapitalTab('dashboard')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-155 cursor-pointer active:scale-95 ${capitalTab === 'dashboard'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                      }`}
                  >
                    <Wallet className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span>Presupuesto y CSV</span>
                  </button>
                  <button
                    onClick={() => setCapitalTab('history')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-155 cursor-pointer active:scale-95 ${capitalTab === 'history'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                      }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span>Historial de Cierres</span>
                  </button>
                </div>
              </div>

              {capitalTab === 'dashboard' ? (
                <>
                  <BudgetCard
                    summary={budgetSummary}
                    onUpdateBudget={handleUpdateBudget}
                    onOpenCloseWizard={() => setIsCloseWizardOpen(true)}
                    totalIncomesCash={incomes.filter(i => i.paymentMethod === 'efectivo').reduce((acc, curr) => acc + curr.amount, 0)}
                    totalIncomesCard={incomes.filter(i => i.paymentMethod !== 'efectivo').reduce((acc, curr) => acc + curr.amount, 0)}
                    apartados={apartados}
                    onAddApartado={handleAddApartado}
                    onDepositToApartado={handleDepositToApartado}
                    onWithdrawFromApartado={handleWithdrawFromApartado}
                    onDeleteApartado={handleDeleteApartado}
                  />

                  {/* Mercado Pago CSV Import Card */}
                  <div className="glass-card rounded-3xl p-6 md:p-8 border border-slate-200/85 hover:shadow-md transition-all duration-300 bg-white" id="mp-csv-import-card">
                    <div className="flex items-center gap-2.5 text-slate-500 mb-4">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-2xs">
                        <Upload className="w-5 h-5 text-indigo-500 shrink-0 animate-bounce" />
                      </div>
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 block leading-none">
                          Extracto Digital
                        </span>
                        <h3 className="text-base font-black text-slate-900 mt-1">
                          Importar Movimientos de Mercado Pago
                        </h3>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mb-5 leading-relaxed font-semibold">
                      Carga el archivo CSV de <strong>"Todas las transacciones"</strong> o <strong>"Dinero en cuenta"</strong> exportado desde tu cuenta de Mercado Pago. La aplicación clasificará los movimientos automáticamente, omitirá duplicados y registrará ingresos, gastos y pagos de servicios.
                    </p>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleCSVFileChange}
                        className="hidden"
                        id="mp-csv-upload-input"
                      />
                      <label
                        htmlFor="mp-csv-upload-input"
                        className="flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black cursor-pointer shadow-sm hover:shadow active:scale-97 transition duration-150 shrink-0 select-none"
                      >
                        <Upload className="w-4 h-4 shrink-0" />
                        <span>Seleccionar CSV de Mercado Pago</span>
                      </label>

                      <div className="text-slate-450 text-[10.5px] font-bold leading-relaxed max-w-md font-medium">
                        El procesamiento es 100% privado en tu navegador. Tus transacciones no se guardan en ningún servidor externo.
                      </div>
                    </div>
                  </div>

                  {/* Mercado Pago Screenshot Scan Card */}
                  <div className="glass-card rounded-3xl p-6 md:p-8 border border-slate-200/85 hover:shadow-md transition-all duration-300 bg-white mt-6" id="mp-screenshot-scan-card">
                    <div className="flex items-center gap-2.5 text-slate-500 mb-4">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-2xs">
                        <Camera className="w-5 h-5 text-emerald-500 shrink-0" />
                      </div>
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 block leading-none">
                          Escaneo Visual
                        </span>
                        <h3 className="text-base font-black text-slate-900 mt-1">
                          Escanear Captura de Mercado Pago
                        </h3>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mb-5 leading-relaxed font-semibold">
                      Toma una captura de pantalla del detalle de un movimiento en Mercado Pago y súbela aquí. El Asistente de IA analizará la imagen, extraerá los datos (concepto, monto, fecha, ID de transacción) y te mostrará la tarjeta de confirmación para registrarlo sin duplicados.
                    </p>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleMPScreenshotChange}
                        className="hidden"
                        id="mp-screenshot-upload-input"
                      />
                      <label
                        htmlFor="mp-screenshot-upload-input"
                        className="flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black cursor-pointer shadow-sm hover:shadow active:scale-97 transition duration-150 shrink-0 select-none"
                      >
                        <Camera className="w-4 h-4 shrink-0" />
                        <span>Subir Captura de Mercado Pago</span>
                      </label>

                      <div className="text-slate-450 text-[10.5px] font-bold leading-relaxed max-w-md font-medium">
                        La imagen se procesa de forma segura a través de la API de Gemini utilizando visión artificial.
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <MonthlyHistory history={monthlyHistory} onDeleteMonth={handleDeleteHistoryMonth} />
              )}
            </div>
          )}

          {activeSection === 'shopping-list' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-5xl mx-auto">
                {/* Tabs selector */}
                <div className="bg-slate-200/60 p-1 rounded-2xl flex items-center gap-0.5 sm:gap-1 border border-slate-300/40 backdrop-blur-xs w-full sm:w-auto shadow-xs">
                  <button
                    onClick={() => setShoppingTab('list')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-155 cursor-pointer active:scale-95 ${shoppingTab === 'list'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                      }`}
                  >
                    <ListTodo className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span>Lista Actual</span>
                  </button>
                  <button
                    onClick={() => setShoppingTab('stores')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-155 cursor-pointer active:scale-95 ${shoppingTab === 'stores'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                      }`}
                  >
                    <Store className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span>Cuentas por Lugar</span>
                  </button>
                </div>

                {/* Plan button */}
                <button
                  onClick={() => setIsPlanningModalOpen(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black cursor-pointer shadow-sm active:scale-97 transition duration-150 shrink-0"
                >
                  <Plus className="w-4 h-4 text-white shrink-0" />
                  <span>Planificar Compra</span>
                </button>
              </div>

              {shoppingTab === 'list' ? (
                <div className="max-w-5xl mx-auto">
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
              ) : (
                <div className="max-w-3xl mx-auto">
                  <StoreSummary
                    items={items}
                    selectedStoreFilter={selectedStoreFilter}
                    onSelectStoreFilter={(store) => {
                      setSelectedStoreFilter(store);
                      setShoppingTab('list');
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {activeSection === 'incomes' && (
            <div className="max-w-3xl mx-auto animate-in fade-in duration-200">
              <IncomesManager
                incomes={incomes}
                onAddIncome={handleAddIncome}
                onDeleteIncome={handleDeleteIncome}
              />
            </div>
          )}

          {activeSection === 'services' && (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-200">
              <ServicePayments
                payments={servicePayments.filter(s => s.createdAt.startsWith(currentMonth))}
                services={serviceOptions}
                onAddPayment={handleAddServicePayment}
                onDeletePayment={handleDeleteServicePayment}
                onAddService={handleAddServiceOption}
                items={items}
                incomes={incomes}
                monthlyHistory={monthlyHistory}
              />
            </div>
          )}

          {activeSection === 'reports' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Tabs selector */}
              <div className="flex justify-center" id="report-tabs">
                <div className="bg-slate-200/60 p-1 rounded-2xl flex items-center gap-0.5 sm:gap-1 border border-slate-300/40 backdrop-blur-xs max-w-md w-full sm:w-auto shadow-xs">
                  <button
                    onClick={() => setReportTab('charts')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-155 cursor-pointer active:scale-95 ${reportTab === 'charts'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                      }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span>Gráficos de Gastos</span>
                  </button>
                  <button
                    onClick={() => setReportTab('calendar')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-155 cursor-pointer active:scale-95 ${reportTab === 'calendar'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                      }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span>Calendario de Fechas</span>
                  </button>
                </div>
              </div>

              {reportTab === 'charts' ? (
                <ExpenseCharts
                  items={items}
                  servicePayments={servicePayments.filter(s => s.createdAt.startsWith(currentMonth))}
                  categories={categories}
                  cashBudget={cashBudget}
                  cardBudget={cardBudget}
                />
              ) : (
                <ExpenseCalendar
                  items={items}
                  servicePayments={servicePayments}
                />
              )}
            </div>
          )}
        </main>

        {/* Page Footer */}
        <footer className="mt-auto border-t border-slate-100 bg-white" id="app-footer">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-450">
            <div>
              <p className="font-semibold text-slate-400">SpendWise Pro © 2026</p>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 font-semibold text-slate-500">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500/10 inline" />
              <span>Tecnología inteligente para la optimización de tu capital y planificación de compras.</span>
            </div>
          </div>
        </footer>

      </div>

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

      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-150 p-6 space-y-4 animate-in zoom-in duration-250">
            <div className="flex items-start gap-3.5 border-b border-slate-50 pb-2">
              <div className="h-10 w-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">Exportar Reportes y Datos</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Formato Excel / CSV</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                Selecciona la información que deseas exportar en formato <strong>CSV (delimitado por comas)</strong>:
              </p>

              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 cursor-pointer transition select-none">
                  <input
                    type="radio"
                    name="exportType"
                    value="items"
                    checked={exportType === 'items'}
                    onChange={() => setExportType('items')}
                    className="mt-0.5 text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <p className="text-xs font-black text-slate-800">Solo artículos de compras (Mes activo)</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Reporte tradicional de tus artículos de compras, cantidades y categorías.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 cursor-pointer transition select-none">
                  <input
                    type="radio"
                    name="exportType"
                    value="unified"
                    checked={exportType === 'unified'}
                    onChange={() => setExportType('unified')}
                    className="mt-0.5 text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <p className="text-xs font-black text-slate-800">Estado de cuenta unificado (Mes activo)</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Incluye todas tus compras, ingresos y pagos de servicios de este mes.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 cursor-pointer transition select-none">
                  <input
                    type="radio"
                    name="exportType"
                    value="full"
                    checked={exportType === 'full'}
                    onChange={() => setExportType('full')}
                    className="mt-0.5 text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <p className="text-xs font-black text-slate-800">Historial completo acumulado</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Respaldo total: exporta todos los meses archivados en tu historial y el activo.</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleExportData();
                  setIsExportModalOpen(false);
                }}
                className="px-4.5 py-2 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> Descargar CSV
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
        servicePayments={servicePayments.filter(s => s.createdAt.startsWith(currentMonth))}
        incomes={incomes}
        onConfirmClose={handleConfirmCloseMonth}
      />

      {/* Modal para añadir comentarios a la captura de pantalla */}
      {isScreenshotModalOpen && screenshotPreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 overflow-hidden">

            {/* Header */}
            <div className="p-6 border-b border-slate-150 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>📷</span> Analizar Captura con IA
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Agrega indicaciones opcionales antes de procesar con Gemini.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsScreenshotModalOpen(false);
                  setScreenshotPreview(null);
                  setScreenshotComment('');
                }}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Image Preview */}
              <div className="w-full max-h-[200px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                <img
                  src={screenshotPreview}
                  alt="Vista previa de captura"
                  className="max-w-full max-h-[200px] object-contain"
                />
              </div>

              {/* Comment Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block uppercase tracking-wider">
                  Instrucciones o Comentarios (Opcional):
                </label>
                <textarea
                  value={screenshotComment}
                  onChange={(e) => setScreenshotComment(e.target.value)}
                  placeholder="Ej: 'Solo agrega el cobro de Telcel', 'Cambia el método a efectivo'..."
                  className="w-full min-h-[80px] text-xs font-semibold p-3 border border-slate-250 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 resize-y"
                />
              </div>

              {/* Presets / Quick buttons */}
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">
                  Atajos rápidos:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setScreenshotComment("Solo registra las ganancias/rendimientos de Mercado Pago")}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-250 rounded-xl text-[10px] font-extrabold cursor-pointer transition active:scale-95 shadow-2xs"
                  >
                    📈 Solo Ganancias de Mercado Pago
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreenshotComment("Registrar solo los servicios recurrentes")}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-250 rounded-xl text-[10px] font-extrabold cursor-pointer transition active:scale-95 shadow-2xs"
                  >
                    🔄 Solo Servicios
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-150 flex items-center justify-end gap-3 bg-slate-50 shrink-0">
              <button
                onClick={() => {
                  setIsScreenshotModalOpen(false);
                  setScreenshotPreview(null);
                  setScreenshotComment('');
                }}
                className="px-5 py-3 bg-slate-250 hover:bg-slate-350 text-slate-700 rounded-2xl text-xs font-black cursor-pointer transition select-none active:scale-97"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleExecuteScreenshotScan(screenshotPreview, screenshotComment);
                  setIsScreenshotModalOpen(false);
                  setScreenshotPreview(null);
                  setScreenshotComment('');
                }}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-md cursor-pointer transition active:scale-97 select-none"
              >
                Procesar con IA
              </button>
            </div>
          </div>
        </div>
      )}

      {importPreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">

            {/* Modal Header */}
            <div className="p-6 border-b border-slate-150 flex items-center justify-between bg-slate-50 rounded-t-3xl shrink-0">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>📊</span> Previsualización de Importación: Mercado Pago
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Revisa y clasifica las transacciones antes de guardarlas en tu base de datos local.
                </p>
              </div>
              <button
                onClick={() => setImportPreview(null)}
                className="p-1.5 hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Statistics and AI Tools Bar */}
            <div className="px-6 py-4 bg-slate-100/50 border-b border-slate-150 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shrink-0">
              <div className="flex flex-wrap items-center gap-3.5 text-xs text-slate-600">
                <span className="flex items-center gap-1 font-bold">
                  Leídas: <span className="text-slate-900 font-black">{importPreview.length}</span>
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1 text-emerald-600 font-bold">
                  Nuevas: <span className="text-emerald-700 font-black">{importPreview.filter(t => !t.isDuplicate).length}</span>
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1 text-slate-450 font-bold">
                  Duplicados: <span className="text-slate-500 font-black">{importPreview.filter(t => t.isDuplicate).length}</span> (se omitirán)
                </span>
                {importPreview.some(t => t.isFuzzyDuplicate) && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="flex items-center gap-1 text-orange-600 font-bold">
                      ⚠ Posibles duplicados: <span className="text-orange-700 font-black">{importPreview.filter(t => t.isFuzzyDuplicate).length}</span>
                    </span>
                  </>
                )}
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1 text-amber-600 font-bold">
                  Ambiguas: <span className="text-amber-700 font-black">{importPreview.filter(t => !t.isDuplicate && t.type === 'ambiguous' && !t.excluded).length}</span>
                </span>
              </div>

              {/* AI Action Button */}
              {importPreview.some(t => !t.isDuplicate && t.type === 'ambiguous' && !t.excluded) && (
                <button
                  onClick={handleClassifyWithAI}
                  disabled={isAIClassifying}
                  className="flex items-center justify-center gap-2 px-4.5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-755 hover:to-indigo-750 text-white rounded-xl text-xs font-black shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-violet-200 animate-pulse shrink-0" />
                  <span>{isAIClassifying ? 'Clasificando con Gemini...' : 'Clasificar ambiguas con IA'}</span>
                </button>
              )}
            </div>

            {/* Modal Table / List Body */}
            <div className="flex-grow overflow-y-auto p-6 space-y-4">
              <div className="overflow-x-auto border border-slate-150 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">Importar</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Descripción</th>
                      <th className="py-3 px-4">Monto</th>
                      <th className="py-3 px-4">Tipo de Registro</th>
                      <th className="py-3 px-4">Categoría / Servicio</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {importPreview.map((item) => {
                      if (item.isDuplicate) return null; // No mostrar duplicados exactos en la lista

                      const isExcluded = !!item.excluded;
                      const isFuzzy = !!item.isFuzzyDuplicate;

                      return (
                        <tr
                          key={item.tempId}
                          className={`hover:bg-slate-50 transition-colors ${isExcluded ? 'opacity-40 bg-slate-50/50' : ''} ${isFuzzy && !isExcluded ? 'bg-orange-50/60' : ''}`}
                        >
                          {/* Toggle Excluded */}
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={(e) => {
                                setImportPreview(prev => {
                                  if (!prev) return null;
                                  return prev.map(p => p.tempId === item.tempId ? { ...p, excluded: !e.target.checked } : p);
                                });
                              }}
                              className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 w-4.5 h-4.5 cursor-pointer"
                            />
                          </td>

                          {/* Date */}
                          <td className="py-3 px-4 whitespace-nowrap text-slate-550 font-bold">
                            {new Date(item.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </td>

                          {/* Description */}
                          <td className="py-3 px-4 font-extrabold text-slate-800 max-w-[200px] sm:max-w-xs truncate" title={item.description}>
                            {item.description}
                          </td>

                          {/* Amount */}
                          <td className={`py-3 px-4 font-black whitespace-nowrap text-right pr-6 ${item.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.amount > 0 ? '+' : '-'}${Math.abs(item.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Type Selector */}
                          <td className="py-3 px-4">
                            <select
                              disabled={isExcluded}
                              value={item.type}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                setImportPreview(prev => {
                                  if (!prev) return null;
                                  return prev.map(p => {
                                    if (p.tempId === item.tempId) {
                                      let cat = p.inferredCategory;
                                      if (val === 'expense' && !p.inferredCategory) cat = 'otros';
                                      return { ...p, type: val, inferredCategory: cat };
                                    }
                                    return p;
                                  });
                                });
                              }}
                              className="bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-400 text-xs font-bold text-slate-700 cursor-pointer"
                            >
                              <option value="income">💰 Ingreso</option>
                              <option value="expense">🛒 Compra / Gasto</option>
                              <option value="service">🛠️ Servicio</option>
                              <option value="ambiguous">⚠️ Ambiguo</option>
                            </select>
                          </td>

                          {/* Category or Service Selection */}
                          <td className="py-3 px-4">
                            {item.type === 'expense' && (
                              <select
                                disabled={isExcluded}
                                value={item.inferredCategory}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setImportPreview(prev => {
                                    if (!prev) return null;
                                    return prev.map(p => p.tempId === item.tempId ? { ...p, inferredCategory: val } : p);
                                  });
                                }}
                                className="bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-400 text-xs font-bold text-slate-700 cursor-pointer w-full"
                              >
                                {categories.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            )}

                            {item.type === 'service' && (
                              <select
                                disabled={isExcluded}
                                value={item.inferredService || 'Otro servicio'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setImportPreview(prev => {
                                    if (!prev) return null;
                                    return prev.map(p => p.tempId === item.tempId ? { ...p, inferredService: val } : p);
                                  });
                                }}
                                className="bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-400 text-xs font-bold text-slate-700 cursor-pointer w-full"
                              >
                                {serviceOptions.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            )}

                            {(item.type === 'income' || item.type === 'ambiguous') && (
                              <span className="text-slate-400 font-bold italic pl-2">N/A</span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isExcluded && isFuzzy ? (
                              <div className="space-y-1">
                                <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-250 font-extrabold text-[10px] block text-center">Posible Duplicado</span>
                                <p className="text-[9px] text-orange-600 font-semibold leading-tight max-w-[140px]" title={item.fuzzyMatchDetails}>
                                  Coincide con: {item.fuzzyMatchDetails}
                                </p>
                              </div>
                            ) : isExcluded ? (
                              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-extrabold text-[10px]">Excluido</span>
                            ) : isFuzzy ? (
                              <div className="space-y-1">
                                <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-250 font-extrabold text-[10px] block text-center">⚠ Posible Dup.</span>
                                <p className="text-[9px] text-orange-600 font-semibold leading-tight max-w-[140px]" title={item.fuzzyMatchDetails}>
                                  Coincide con: {item.fuzzyMatchDetails}
                                </p>
                              </div>
                            ) : item.type === 'ambiguous' ? (
                              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-250 font-extrabold text-[10px]">Revisar</span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-250 font-extrabold text-[10px]">Listo</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-6 border-t border-slate-150 flex items-center justify-end gap-3 bg-slate-50 rounded-b-3xl shrink-0">
              <button
                onClick={() => setImportPreview(null)}
                className="px-5 py-3 bg-slate-250 hover:bg-slate-300 text-slate-700 rounded-2xl text-xs font-extrabold cursor-pointer transition select-none"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const valid = importPreview.filter(t => !t.isDuplicate && !t.excluded);
                  const ambiguousCount = valid.filter(t => t.type === 'ambiguous').length;
                  if (ambiguousCount > 0) {
                    if (!confirm(`Tienes ${ambiguousCount} transacciones sin clasificar (Ambiguas). Se guardarán en la categoría "Otros/Varios". ¿Deseas continuar?`)) {
                      return;
                    }
                  }
                  handleConfirmImport(valid);
                }}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-md cursor-pointer transition active:scale-97 select-none"
              >
                Confirmar e Importar ({importPreview.filter(t => !t.isDuplicate && !t.excluded).length} Transacciones)
              </button>
            </div>

          </div>
        </div>
      )}
      {isPlanningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-3xl bg-[#F8FAFC] shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in duration-250 relative overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setIsPlanningModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="border-b border-slate-100 pb-2">
              <h2 className="text-base font-black text-slate-900">Planificar Nueva Compra</h2>
            </div>
            <AddItemForm
              onAddItem={(item) => {
                handleAddItem(item);
                setIsPlanningModalOpen(false);
              }}
              existingPlaces={existingPlaces}
              onAddPlace={handleAddPlace}
              categories={categories}
              onAddCategory={handleAddCategory}
              items={items}
              servicePayments={servicePayments}
              incomes={incomes}
              monthlyHistory={monthlyHistory}
            />
          </div>
        </div>
      )}

      <AIAssistant
        userName={userName}
        items={items}
        archivedItems={archivedItems}
        servicePayments={servicePayments}
        cashBudget={cashBudget}
        cardBudget={cardBudget}
        initialCashBudget={initialCashBudgetSnapshot}
        initialCardBudget={initialCardBudgetSnapshot}
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
        apartados={apartados}
        onAddApartado={handleAddApartado}
        onDepositToApartado={handleDepositToApartado}
        onWithdrawFromApartado={handleWithdrawFromApartado}
        onDeleteApartado={handleDeleteApartado}
        externalAITrigger={externalAITrigger}
      />

    </div>
  );
}
