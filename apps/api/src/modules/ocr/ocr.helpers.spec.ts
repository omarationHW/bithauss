import {
  coerceText,
  normalizeStr,
  citiesMatch,
  namesMatch,
  addressesMatch,
  cuentasPredialMatch,
  cuentaAguaMatch,
  parseFlexibleDate,
} from './ocr.service';

describe('coerceText', () => {
  it('returns empty for null/undefined', () => {
    expect(coerceText(null)).toBe('');
    expect(coerceText(undefined)).toBe('');
  });
  it('returns the string unchanged', () => {
    expect(coerceText('Av. Insurgentes 123')).toBe('Av. Insurgentes 123');
  });
  it('coerces numbers and booleans', () => {
    expect(coerceText(42)).toBe('42');
    expect(coerceText(true)).toBe('true');
  });
  it('joins arrays', () => {
    expect(coerceText(['A', 'B', 'C'])).toBe('A B C');
  });
  it('joins object values (the OCR-as-object failure mode)', () => {
    expect(
      coerceText({
        calle: 'Colorado',
        numero: '36',
        colonia: 'Napoles',
      }),
    ).toBe('Colorado 36 Napoles');
  });
  it('recurses into nested arrays', () => {
    expect(coerceText({ a: ['x', 'y'], b: 'z' })).toBe('x y z');
  });
});

describe('normalizeStr', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(normalizeStr('Ávila, México.')).toBe('avila mexico');
  });
  it('collapses whitespace', () => {
    expect(normalizeStr('  hello   world  ')).toBe('hello world');
  });
  it('handles objects via coerceText', () => {
    expect(normalizeStr({ calle: 'Niño Perdido' })).toBe('nino perdido');
  });
});

describe('citiesMatch', () => {
  it('exact normalized match', () => {
    expect(citiesMatch('Guadalajara', 'Guadalajara')).toBe(true);
    expect(citiesMatch('Guadalajara', 'GUADALAJARA')).toBe(true);
  });
  it('CDMX synonyms — distrito federal ≡ benito juárez', () => {
    expect(citiesMatch('Distrito Federal', 'Benito Juárez')).toBe(true);
    expect(citiesMatch('CDMX', 'Coyoacán')).toBe(true);
    expect(citiesMatch('Ciudad de México', 'Delegación Cuauhtémoc')).toBe(true);
    expect(citiesMatch('México DF', 'Iztapalapa')).toBe(true);
  });
  it('different states do NOT match', () => {
    expect(citiesMatch('Guadalajara', 'Monterrey')).toBe(false);
    expect(citiesMatch('Cuauhtémoc', 'Cancún')).toBe(false);
  });
  it('partial inclusion (city + state suffix)', () => {
    expect(citiesMatch('Guadalajara, Jalisco', 'Guadalajara')).toBe(true);
  });
  it('returns false on empty', () => {
    expect(citiesMatch('', 'Guadalajara')).toBe(false);
    expect(citiesMatch(null, undefined)).toBe(false);
  });
});

describe('namesMatch', () => {
  it('exact match', () => {
    expect(namesMatch('Carlos Hernández Sotelo', 'Carlos Hernández Sotelo')).toBe(true);
  });
  it('case- and accent-insensitive', () => {
    expect(namesMatch('Carlos Hernández', 'CARLOS HERNANDEZ')).toBe(true);
  });
  it('partial — escritura name fully contained in INE name', () => {
    expect(
      namesMatch(
        'Carlos Hernández',
        'Carlos Hernández Sotelo López',
      ),
    ).toBe(true);
  });
  it('different names do NOT match', () => {
    expect(
      namesMatch('Carlos Hernández', 'Hector Gómez González'),
    ).toBe(false);
  });
  it('empty inputs do NOT match', () => {
    expect(namesMatch('', 'Carlos')).toBe(false);
    expect(namesMatch(undefined, undefined)).toBe(false);
  });
});

describe('addressesMatch', () => {
  it('matches with 40%+ word overlap', () => {
    expect(
      addressesMatch(
        'Colorado 36 Depto 406, Napoles, Benito Juarez, CDMX',
        'COLORADO N. 36 DEPTO. 406, NAPOLES, BENITO JUAREZ, CIUDAD DE MEXICO',
      ),
    ).toBe(true);
  });
  it('does not match completely different addresses', () => {
    expect(
      addressesMatch(
        'Insurgentes Sur 1234, Roma Norte',
        'Reforma 9, Tlatelolco',
      ),
    ).toBe(false);
  });
});

describe('cuentasPredialMatch', () => {
  it('exact normalized', () => {
    expect(cuentasPredialMatch('038-272-18-027-4', '038272180274')).toBe(true);
  });
  it('different separators, same digits', () => {
    expect(cuentasPredialMatch('038/272/18/027/4', '038-272-18-027-4')).toBe(true);
  });
  it('matches when one side is missing the check digit', () => {
    expect(cuentasPredialMatch('038-272-18-027-4', '038-272-18-027')).toBe(true);
  });
  it('matches on first 9 digits (account body without sub-account)', () => {
    expect(cuentasPredialMatch('038272180001234', '038272180999999')).toBe(true);
  });
  it('does NOT match different accounts', () => {
    expect(cuentasPredialMatch('038-272-18-001', '999-272-18-001')).toBe(false);
  });
  it('handles empty', () => {
    expect(cuentasPredialMatch('', '123')).toBe(false);
    expect(cuentasPredialMatch(null, undefined)).toBe(false);
  });
});

describe('cuentaAguaMatch', () => {
  it('matches ignoring colons and dashes', () => {
    expect(cuentaAguaMatch('19:40-460-254-01-027-2', '1940460254010272')).toBe(true);
  });
  it('matches leading digits', () => {
    expect(cuentaAguaMatch('1940460254010272', '1940460254')).toBe(true);
  });
  it('does NOT match different accounts', () => {
    expect(cuentaAguaMatch('1940460254010272', '8888888888888888')).toBe(false);
  });
});

describe('parseFlexibleDate', () => {
  it('parses ISO date', () => {
    expect(parseFlexibleDate('2024-09-18')?.toISOString().slice(0, 10)).toBe('2024-09-18');
  });
  it('parses dd/mm/yyyy', () => {
    expect(parseFlexibleDate('18/09/2024')?.toISOString().slice(0, 10)).toBe('2024-09-18');
  });
  it('parses dd-MMM-yyyy spanish', () => {
    expect(parseFlexibleDate('18-SEP-2024')?.toISOString().slice(0, 10)).toBe('2024-09-18');
  });
  it('parses mm/yyyy as last day of month', () => {
    const d = parseFlexibleDate('4/2024');
    expect(d?.getFullYear()).toBe(2024);
    expect(d?.getMonth()).toBe(3); // April
    // Day should be the last day of April (30)
    expect(d?.getDate()).toBe(30);
  });
  it('parses year range "2014 - 2024"', () => {
    const d = parseFlexibleDate('2014 - 2024');
    expect(d?.getFullYear()).toBe(2024);
    expect(d?.getMonth()).toBe(11); // December
  });
  it('parses "vigencia hasta 2030"', () => {
    expect(parseFlexibleDate('vigencia hasta 2030')?.getFullYear()).toBe(2030);
  });
  it('falls back to largest year in string', () => {
    expect(parseFlexibleDate('emitido en 2020, vence en 2026')?.getFullYear()).toBe(2026);
  });
  it('returns null for empty/null/undefined', () => {
    expect(parseFlexibleDate('')).toBeNull();
    expect(parseFlexibleDate(null)).toBeNull();
    expect(parseFlexibleDate(undefined)).toBeNull();
  });
  it('returns null for garbage', () => {
    expect(parseFlexibleDate('not a date at all')).toBeNull();
  });
});
