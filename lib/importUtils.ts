import * as XLSX from 'xlsx';
import { applyClassificationRules } from './rulesEngine';
import type { AutoRule } from './types';

export interface ParsedRow {
  date: string;
  description: string;
  reference: string;
  amount: number;
  rawData: any;
}

export interface ImportResult {
  success: boolean;
  rows: ParsedRow[];
  errors: string[];
  warnings: string[];
}

export function parseBancolombiaExcel(fileData: ArrayBuffer): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows: ParsedRow[] = [];

  try {
    const workbook = XLSX.read(fileData, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (jsonData.length === 0) {
      errors.push('El archivo está vacío');
      return { success: false, rows, errors, warnings };
    }

    const headerRow = jsonData[0];
    const dateColIndex = headerRow.findIndex((h: string) =>
      h && h.toString().toLowerCase().includes('fecha')
    );
    const descriptionColIndex = headerRow.findIndex((h: string) =>
      h && h.toString().toLowerCase().includes('descripci')
    );
    const referenceColIndex = headerRow.findIndex((h: string) =>
      h && h.toString().toLowerCase().includes('referencia')
    );
    const amountColIndex = headerRow.findIndex((h: string) =>
      h && h.toString().toLowerCase().includes('valor')
    );

    if (dateColIndex === -1) {
      errors.push('No se encontró la columna "Fecha"');
    }
    if (descriptionColIndex === -1) {
      errors.push('No se encontró la columna "Descripción"');
    }
    if (amountColIndex === -1) {
      errors.push('No se encontró la columna "Valor"');
    }

    if (errors.length > 0) {
      return { success: false, rows, errors, warnings };
    }

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];

      if (!row || row.length === 0 || !row[dateColIndex] || !row[amountColIndex]) {
        continue;
      }

      try {
        const dateValue = row[dateColIndex];
        let parsedDate: string;

        if (typeof dateValue === 'number') {
          const excelDate = XLSX.SSF.parse_date_code(dateValue);
          parsedDate = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
        } else {
          const dateStr = dateValue.toString();
          const dateParts = dateStr.split('/');
          if (dateParts.length === 3) {
            const day = dateParts[0].padStart(2, '0');
            const month = dateParts[1].padStart(2, '0');
            const year = dateParts[2].length === 2 ? '20' + dateParts[2] : dateParts[2];
            parsedDate = `${year}-${month}-${day}`;
          } else {
            parsedDate = new Date().toISOString().split('T')[0];
            warnings.push(`Fila ${i + 1}: Formato de fecha no reconocido, se usará fecha actual`);
          }
        }

        const description = row[descriptionColIndex]?.toString().trim() || 'Sin descripción';
        const reference = referenceColIndex !== -1 ? (row[referenceColIndex]?.toString().trim() || '') : '';

        let amount: number;
        const amountValue = row[amountColIndex];
        if (typeof amountValue === 'number') {
          amount = amountValue;
        } else {
          const amountStr = amountValue.toString().replace(/[^\d.,-]/g, '').replace(',', '.');
          amount = parseFloat(amountStr) || 0;
        }

        rows.push({
          date: parsedDate,
          description,
          reference,
          amount,
          rawData: row,
        });
      } catch (error) {
        warnings.push(`Fila ${i + 1}: Error al procesar - ${error}`);
      }
    }

    return {
      success: true,
      rows,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`Error al leer el archivo: ${error}`);
    return { success: false, rows, errors, warnings };
  }
}

export function parseCSV(fileData: string): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows: ParsedRow[] = [];

  try {
    const lines = fileData.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      errors.push('El archivo está vacío');
      return { success: false, rows, errors, warnings };
    }

    const headerRow = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const dateColIndex = headerRow.findIndex(h =>
      h.toLowerCase().includes('fecha')
    );
    const descriptionColIndex = headerRow.findIndex(h =>
      h.toLowerCase().includes('descripci')
    );
    const referenceColIndex = headerRow.findIndex(h =>
      h.toLowerCase().includes('referencia')
    );
    const amountColIndex = headerRow.findIndex(h =>
      h.toLowerCase().includes('valor')
    );

    if (dateColIndex === -1 || descriptionColIndex === -1 || amountColIndex === -1) {
      errors.push('No se encontraron todas las columnas requeridas (Fecha, Descripción, Valor)');
      return { success: false, rows, errors, warnings };
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

      if (values.length < Math.max(dateColIndex, descriptionColIndex, amountColIndex) + 1) {
        continue;
      }

      try {
        const dateStr = values[dateColIndex];
        const dateParts = dateStr.split('/');
        let parsedDate: string;

        if (dateParts.length === 3) {
          const day = dateParts[0].padStart(2, '0');
          const month = dateParts[1].padStart(2, '0');
          const year = dateParts[2].length === 2 ? '20' + dateParts[2] : dateParts[2];
          parsedDate = `${year}-${month}-${day}`;
        } else {
          parsedDate = new Date().toISOString().split('T')[0];
          warnings.push(`Fila ${i + 1}: Formato de fecha no reconocido`);
        }

        const description = values[descriptionColIndex] || 'Sin descripción';
        const reference = referenceColIndex !== -1 ? (values[referenceColIndex] || '') : '';
        const amountStr = values[amountColIndex].replace(/[^\d.,-]/g, '').replace(',', '.');
        const amount = parseFloat(amountStr) || 0;

        rows.push({
          date: parsedDate,
          description,
          reference,
          amount,
          rawData: values,
        });
      } catch (error) {
        warnings.push(`Fila ${i + 1}: Error al procesar`);
      }
    }

    return {
      success: true,
      rows,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`Error al leer el archivo: ${error}`);
    return { success: false, rows, errors, warnings };
  }
}

export function detectDuplicates(
  newRows: ParsedRow[],
  existingTransactions: Array<{
    transaction_date: string;
    amount: number;
    description: string;
    reference?: string;
  }>
): number[] {
  const duplicateIndices: number[] = [];

  newRows.forEach((newRow, index) => {
    const isDuplicate = existingTransactions.some(existing => {
      const dateDiff = Math.abs(
        new Date(newRow.date).getTime() - new Date(existing.transaction_date).getTime()
      );
      const daysDiff = dateDiff / (1000 * 60 * 60 * 24);

      const amountMatch = Math.abs(Math.abs(newRow.amount) - existing.amount) < 0.01;
      const dateMatch = daysDiff <= 2;

      const descriptionSimilarity = calculateStringSimilarity(
        newRow.description.toLowerCase(),
        existing.description.toLowerCase()
      );

      const referenceSimilarity = newRow.reference && existing.reference
        ? calculateStringSimilarity(
            newRow.reference.toLowerCase(),
            existing.reference.toLowerCase()
          )
        : 0;

      return amountMatch && dateMatch && (descriptionSimilarity > 0.7 || referenceSimilarity > 0.8);
    });

    if (isDuplicate) {
      duplicateIndices.push(index);
    }
  });

  return duplicateIndices;
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export function suggestTransactionType(amount: number): 'income' | 'expense' | 'transfer' {
  if (amount > 0) {
    return 'income';
  } else if (amount < 0) {
    return 'expense';
  }
  return 'transfer';
}

export function suggestCategory(
  description: string,
  amount: number,
  categories: Array<{ id: string; name: string; type: string }>
): string | null {
  const descLower = description.toLowerCase();
  const type = amount > 0 ? 'income' : 'expense';

  const keywords: { [key: string]: string[] } = {
    'Supermercado': ['exito', 'carulla', 'olímpica', 'mercado', 'super'],
    'Restaurantes': ['restaurante', 'comida', 'domicilio', 'rappi', 'uber eats'],
    'Transporte': ['transporte', 'taxi', 'uber', 'gasolina', 'combustible', 'peaje'],
    'Servicios': ['internet', 'telefono', 'celular', 'agua', 'luz', 'energia', 'gas'],
    'Salud': ['farmacia', 'drogueria', 'medicina', 'medico', 'hospital', 'clinica'],
    'Entretenimiento': ['cine', 'teatro', 'concierto', 'streaming', 'netflix', 'spotify'],
    'Salario': ['nomina', 'salario', 'sueldo', 'pago'],
    'Transferencia': ['transferencia', 'transf'],
  };

  for (const [categoryName, keywordList] of Object.entries(keywords)) {
    if (keywordList.some(keyword => descLower.includes(keyword))) {
      const matchedCategory = categories.find(
        cat => cat.name === categoryName && cat.type === type
      );
      if (matchedCategory) {
        return matchedCategory.id;
      }
    }
  }

  return null;
}

export function suggestCategoryWithRules(
  description: string,
  amount: number,
  accountId: string,
  rules: AutoRule[]
): {
  categoryId?: string;
  subcategoryId?: string;
  suggestedType?: string;
  confidence: number;
} {
  const result = applyClassificationRules(description, amount, accountId, rules);
  return {
    categoryId: result.categoryId,
    subcategoryId: result.subcategoryId,
    suggestedType: result.suggestedType,
    confidence: result.confidence,
  };
}
