export interface MexicoState {
  name: string;
  abbreviation: string;
}

/**
 * All 32 states of Mexico.
 */
export const MEXICO_STATES: readonly MexicoState[] = [
  { name: 'Aguascalientes', abbreviation: 'AGS' },
  { name: 'Baja California', abbreviation: 'BC' },
  { name: 'Baja California Sur', abbreviation: 'BCS' },
  { name: 'Campeche', abbreviation: 'CAM' },
  { name: 'Chiapas', abbreviation: 'CHIS' },
  { name: 'Chihuahua', abbreviation: 'CHIH' },
  { name: 'Ciudad de México', abbreviation: 'CDMX' },
  { name: 'Coahuila', abbreviation: 'COAH' },
  { name: 'Colima', abbreviation: 'COL' },
  { name: 'Durango', abbreviation: 'DGO' },
  { name: 'Estado de México', abbreviation: 'MEX' },
  { name: 'Guanajuato', abbreviation: 'GTO' },
  { name: 'Guerrero', abbreviation: 'GRO' },
  { name: 'Hidalgo', abbreviation: 'HGO' },
  { name: 'Jalisco', abbreviation: 'JAL' },
  { name: 'Michoacán', abbreviation: 'MICH' },
  { name: 'Morelos', abbreviation: 'MOR' },
  { name: 'Nayarit', abbreviation: 'NAY' },
  { name: 'Nuevo León', abbreviation: 'NL' },
  { name: 'Oaxaca', abbreviation: 'OAX' },
  { name: 'Puebla', abbreviation: 'PUE' },
  { name: 'Querétaro', abbreviation: 'QRO' },
  { name: 'Quintana Roo', abbreviation: 'QROO' },
  { name: 'San Luis Potosí', abbreviation: 'SLP' },
  { name: 'Sinaloa', abbreviation: 'SIN' },
  { name: 'Sonora', abbreviation: 'SON' },
  { name: 'Tabasco', abbreviation: 'TAB' },
  { name: 'Tamaulipas', abbreviation: 'TAMPS' },
  { name: 'Tlaxcala', abbreviation: 'TLAX' },
  { name: 'Veracruz', abbreviation: 'VER' },
  { name: 'Yucatán', abbreviation: 'YUC' },
  { name: 'Zacatecas', abbreviation: 'ZAC' },
] as const;

/**
 * Helper: get a state by abbreviation.
 */
export function getStateByAbbreviation(abbr: string): MexicoState | undefined {
  return MEXICO_STATES.find(
    (s) => s.abbreviation.toUpperCase() === abbr.toUpperCase(),
  );
}

/**
 * Helper: get abbreviations array (for Zod enum, dropdowns, etc.)
 */
export function getStateAbbreviations(): string[] {
  return MEXICO_STATES.map((s) => s.abbreviation);
}
