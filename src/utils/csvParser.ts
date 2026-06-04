/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PREDEFINED_SERVICES, PREDEFINED_CATEGORIES } from '../types';

export interface ParsedMPTransaction {
  externalId: string;
  date: string; // ISO string
  description: string;
  amount: number; // Positivo (Ingreso), Negativo (Gasto)
  status: string; // approved, rejected, etc.
  type: 'income' | 'expense' | 'service' | 'ambiguous';
  inferredCategory: string; // comida, hogar, etc.
  inferredService?: string; // Nombre del servicio si es tipo 'service'
  rawRow: Record<string, string>;
}

// Heurísticas locales para clasificar transacciones basadas en su descripción
const SERVICE_KEYWORDS: Record<string, string[]> = {
  'Uber': ['uber', 'uber.com', 'uber *trip'],
  'Didi': ['didi', 'didi *ride', 'didi food'],
  'Rappi': ['rappi'],
  'Netflix': ['netflix', 'netflix.com'],
  'Spotify': ['spotify', 'spotify.com'],
  'Internet': ['internet', 'telmex', 'izzi', 'totalplay', 'megacable', 'claro'],
  'Luz': ['cfe', 'luz', 'edenor', 'edesur', 'coope', 'electricidad'],
  'Agua': ['agua', 'smapa', 'sacmex', 'ayuda de agua'],
  'Gas': ['gas', 'naturgy', 'gas natural'],
  'Celular': ['telcel', 'movistar', 'att', 'at&t', 'recar', 'recarga cel', 'bait']
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'comida': ['mercadona', 'walmart', 'oxxo', 'soriana', 'chedraui', 'super', 'bodega aurrera', 'mini super', 'restaurante', 'food', 'cafe', 'starbucks', 'mcdonalds', 'kfc', 'comida', 'abarrotes', 'panaderia', 'pasteleria'],
  'hogar': ['home depot', 'ferreteria', 'limpieza', 'detergente', 'jabon', 'coppel', 'ikea', 'easy', 'sodimac', 'walmart hogar', 'muebles'],
  'tecnologia': ['amazon', 'mercadolibre', 'apple', 'samsung', 'computadora', 'celular', 'audifonos', 'electronics', 'tecnologia', 'game', 'playstation', 'xbox', 'steam', 'nintendo'],
  'ropa': ['zara', 'h&m', 'shein', 'pull & bear', 'bershka', 'tenis', 'ropa', 'calzado', 'boutique', 'moda'],
  'salud': ['farmacia', 'similares', 'guadalajara', 'ahorro', 'medico', 'dentista', 'hospital', 'doctor', 'salud', 'clinica', 'pastillas']
};

/**
 * Función robusta para parsear una línea CSV teniendo en cuenta comillas dobles y delimitadores.
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Toggle inQuotes
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }
  result.push(currentField.trim());
  return result;
}

/**
 * Normaliza y limpia un número en formato de texto (soporta separadores de miles y decimales mixtos).
 */
export function parseMPNumber(valStr: string): number {
  if (!valStr) return 0;
  
  // Eliminar símbolos de moneda y espacios
  let cleanStr = valStr.replace(/[$\s]/g, '');

  // Detectar formato: si contiene coma y punto, o solo comas
  // Ejemplos: "1,250.50" (US), "1.250,50" (ES/AR), "-450,00"
  if (cleanStr.includes(',') && cleanStr.includes('.')) {
    // Si la coma está antes del punto, es formato US: quitar comas y parsear
    if (cleanStr.indexOf(',') < cleanStr.indexOf('.')) {
      cleanStr = cleanStr.replace(/,/g, '');
    } else {
      // Formato ES/AR: quitar puntos y reemplazar coma por punto
      cleanStr = cleanStr.replace(/\./g, '').replace(/,/g, '.');
    }
  } else if (cleanStr.includes(',')) {
    // Si solo tiene comas, comprobar si actúa como decimal (e.g. 2 o 1 dígito al final)
    const parts = cleanStr.split(',');
    if (parts[parts.length - 1].length <= 2) {
      // Actúa como decimal: ej. "1250,50" -> "1250.50"
      cleanStr = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    } else {
      // Actúa como separador de miles: ej. "1,250" -> "1250"
      cleanStr = cleanStr.replace(/,/g, '');
    }
  }

  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

/**
 * Convierte un texto con formato de fecha en un string ISO válido.
 */
function parseMPDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  
  const cleanDate = dateStr.trim();
  
  // Si tiene formato YYYY-MM-DD o similar al inicio, usar Date.parse nativo
  if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(cleanDate)) {
    const parsed = Date.parse(cleanDate);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  
  // Intentar parsear explícitamente DD/MM/YYYY o DD-MM-YYYY primero (formato estándar de Mercado Pago en LATAM)
  const parts = cleanDate.split(/[\sT]+/);
  const dateParts = parts[0].split(/[-/]/);
  if (dateParts.length === 3) {
    let day = parseInt(dateParts[0]);
    let month = parseInt(dateParts[1]) - 1;
    let year = parseInt(dateParts[2]);

    // Corregir orden si el año está al inicio (YYYY-MM-DD)
    if (dateParts[0].length === 4) {
      year = parseInt(dateParts[0]);
      month = parseInt(dateParts[1]) - 1;
      day = parseInt(dateParts[2]);
    }

    let hours = 12, minutes = 0, seconds = 0;
    if (parts.length > 1) {
      const timeParts = parts[1].split(':');
      if (timeParts.length >= 2) {
        hours = parseInt(timeParts[0]);
        minutes = parseInt(timeParts[1]);
        if (timeParts.length >= 3) {
          seconds = parseInt(timeParts[2]);
        }
      }
    }

    const manualDate = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(manualDate.getTime())) {
      return manualDate.toISOString();
    }
  }

  // Fallback final a Date.parse nativo
  const parsed = Date.parse(cleanDate);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  return new Date().toISOString();
}

/**
 * Función principal que analiza el texto completo del CSV y retorna una lista de transacciones mapeadas.
 */
export function parseMercadoPagoCSV(csvText: string): ParsedMPTransaction[] {
  if (!csvText || !csvText.trim()) return [];

  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // 1. Detectar delimitador (coma o punto y coma) en la primera línea
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  // 2. Parsear cabecera y normalizar nombres de columna
  const headers = parseCSVLine(headerLine, delimiter).map(h => 
    h.toLowerCase()
     .normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
     .trim()
  );

  // Mapear índices de columnas de interés
  let dateIdx = -1;
  let idIdx = -1;
  let descIdx = -1;
  let netAmountIdx = -1;
  let creditIdx = -1;
  let debitIdx = -1;
  let statusIdx = -1;

  const dateHeaders = ['date', 'fecha', 'fecha de liberacion', 'fecha de liberacion', 'fecha_liberacion', 'fecha_creacion', 'date_created'];
  const idHeaders = ['source_id', 'transaction_id', 'id de operacion', 'id_operacion', 'id', 'id_transaccion', 'sourceid'];
  const descHeaders = ['description', 'descripcion', 'concepto', 'reason', 'detalle', 'motivo'];
  const netAmountHeaders = ['settlement_net_amount', 'net_amount', 'monto_neto', 'monto', 'importe', 'amount'];
  const creditHeaders = ['net_credit_amount', 'credit_amount', 'credito', 'ingresos', 'ingreso'];
  const debitHeaders = ['net_debit_amount', 'debit_amount', 'debito', 'egresos', 'egreso'];
  const statusHeaders = ['status', 'estado', 'estado_operacion', 'state'];

  headers.forEach((header, idx) => {
    if (dateHeaders.some(dh => header.includes(dh)) && dateIdx === -1) dateIdx = idx;
    if (idHeaders.some(ih => header.includes(ih)) && idIdx === -1) idIdx = idx;
    if (descHeaders.some(dh => header.includes(dh)) && descIdx === -1) descIdx = idx;
    if (netAmountHeaders.some(nah => header === nah) && netAmountIdx === -1) netAmountIdx = idx;
    if (creditHeaders.some(ch => header.includes(ch)) && creditIdx === -1) creditIdx = idx;
    if (debitHeaders.some(dh => header.includes(dh)) && debitIdx === -1) debitIdx = idx;
    if (statusHeaders.some(sh => header.includes(sh)) && statusIdx === -1) statusIdx = idx;
  });

  // Si no se encuentra un monto neto exacto pero sí columnas de crédito/débito por separado
  if (netAmountIdx === -1 && dateIdx !== -1) {
    // Si no encontramos un match exacto, busquemos el primero que contenga 'monto' o 'amount'
    netAmountIdx = headers.findIndex(h => h.includes('monto') || h.includes('amount') || h.includes('neto') || h.includes('importe'));
  }

  // Validación mínima de columnas requeridas
  if (dateIdx === -1 || (netAmountIdx === -1 && creditIdx === -1 && debitIdx === -1)) {
    console.error("Columnas detectadas:", headers);
    throw new Error("El archivo CSV no tiene el formato esperado de Mercado Pago. Asegúrate de incluir las columnas de Fecha, ID y Monto/Importe.");
  }

  const parsedTransactions: ParsedMPTransaction[] = [];

  // 3. Procesar las líneas de datos
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const columns = parseCSVLine(rawLine, delimiter);

    // Evitar líneas vacías o incompletas
    if (columns.length < Math.max(dateIdx, idIdx, descIdx, netAmountIdx, creditIdx, debitIdx) + 1) {
      continue;
    }

    // Extraer datos primarios
    const rawDate = columns[dateIdx];
    const rawDesc = descIdx !== -1 ? columns[descIdx] : 'Transacción Mercado Pago';
    let rawId = '';
    if (idIdx !== -1 && columns[idIdx] && columns[idIdx].trim()) {
      rawId = columns[idIdx].trim();
    } else {
      const cleanDesc = rawDesc.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      rawId = `mp-det-${rawDate || 'nodate'}-${cleanDesc}-${i}`;
    }
    const rawStatus = statusIdx !== -1 ? columns[statusIdx].toLowerCase() : 'approved';

    // Omitir transacciones rechazadas o canceladas si el estado está explícito
    if (rawStatus && (rawStatus.includes('reject') || rawStatus.includes('cancel') || rawStatus.includes('rechaz') || rawStatus.includes('falli') || rawStatus.includes('fail'))) {
      continue;
    }

    // Determinar el monto neto
    let amount = 0;
    if (netAmountIdx !== -1 && columns[netAmountIdx]) {
      amount = parseMPNumber(columns[netAmountIdx]);
    } else {
      const creditVal = creditIdx !== -1 && columns[creditIdx] ? parseMPNumber(columns[creditIdx]) : 0;
      const debitVal = debitIdx !== -1 && columns[debitIdx] ? parseMPNumber(columns[debitIdx]) : 0;
      
      // En Mercado Pago, el crédito suma al saldo y el débito resta
      if (creditVal !== 0) {
        amount = Math.abs(creditVal);
      } else if (debitVal !== 0) {
        amount = -Math.abs(debitVal); // Asegurar que el egreso sea negativo
      }
    }

    if (amount === 0) {
      continue; // Ignorar movimientos con monto cero
    }

    // Crear mapa de fila cruda para depuración
    const rawRow: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rawRow[h] = columns[idx] || '';
    });

    // 4. Clasificación inteligente e Inferencias
    let type: 'income' | 'expense' | 'service' | 'ambiguous' = 'ambiguous';
    let inferredCategory = 'otros';
    let inferredService: string | undefined = undefined;

    const cleanDesc = rawDesc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (amount > 0) {
      // Es un ingreso
      type = 'income';
      // Buscar si el concepto indica algún tipo de ingreso obvio (ej. Nómina o transferencia conocida)
      if (cleanDesc.includes('nomina') || cleanDesc.includes('sueldo') || cleanDesc.includes('honorarios') || cleanDesc.includes('quincena')) {
        type = 'income';
      }
    } else {
      // Es un egreso/gasto
      // Intentar clasificar como servicio primero
      let serviceFound = false;
      for (const [serviceName, keywords] of Object.entries(SERVICE_KEYWORDS)) {
        if (keywords.some(kw => cleanDesc.includes(kw))) {
          type = 'service';
          inferredService = serviceName;
          serviceFound = true;
          break;
        }
      }

      if (!serviceFound) {
        // Intentar clasificar en categorías de compras
        let categoryFound = false;
        for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
          if (keywords.some(kw => cleanDesc.includes(kw))) {
            type = 'expense';
            inferredCategory = catName;
            categoryFound = true;
            break;
          }
        }

        // Si no coincide con ninguna palabra clave obvia, se marca como 'ambiguous'
        // para que sea clasificado por el bot o el usuario, excepto si es muy genérico,
        // en cuyo caso queda en 'expense' con categoría 'otros'.
        if (!categoryFound) {
          // Si tiene un patrón común de pago comercial pero desconocido
          if (cleanDesc.includes('mercadopago') || cleanDesc.includes('mp*') || cleanDesc.includes('pago a') || cleanDesc.includes('compra en')) {
            type = 'ambiguous';
          } else {
            type = 'ambiguous'; // Dejar como ambiguo para confirmación
          }
        }
      }
    }

    parsedTransactions.push({
      externalId: rawId,
      date: parseMPDate(rawDate),
      description: rawDesc,
      amount,
      status: rawStatus,
      type,
      inferredCategory,
      inferredService,
      rawRow
    });
  }

  // Ordenar transacciones de más antiguas a más recientes para una correcta inserción cronológica
  return parsedTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
