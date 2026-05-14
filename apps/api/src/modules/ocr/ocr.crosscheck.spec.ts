import { ConfigService } from '@nestjs/config';
import { OcrService, EscrituraCrossCheckInput, EscrituraCheck } from './ocr.service';

function makeService(): OcrService {
  const stubConfig = { get: () => '' } as unknown as ConfigService;
  return new OcrService(stubConfig);
}

function run(payload: EscrituraCrossCheckInput) {
  return makeService().crossCheckEscritura(payload);
}

function check(checks: EscrituraCheck[], rule: string): EscrituraCheck {
  const found = checks.find((c) => c.rule === rule);
  if (!found) throw new Error(`Rule "${rule}" not found in checks`);
  return found;
}

/* ----- Date helpers (rules use real Date.now) ----- */
function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function yearsFromNow(years: number): string {
  return String(new Date().getFullYear() + years);
}

/* ----- Fixtures ----- */
const HAPPY_ESCRITURA = {
  ciudadNotaria: 'Ciudad de México',
  ciudadInmueble: 'Benito Juárez',
  nombreComprador: 'Carlos Hernández Sotelo',
  curpComprador: 'HESC850101HDFXXX01',
  rfcComprador: 'HESC850101A12',
  estadoCivilComprador: 'soltero',
  regimenMatrimonial: null,
  copropietarios: [],
  nombreVendedor: 'Juan Pérez',
  direccionInmueble: 'Colorado 36 Depto 406, Napoles, Benito Juarez, CDMX',
  tipoInmueble: 'casa',
  folioReal: '1307904-0',
  cuentaPredial: '038-272-18-027-4',
  cuentaAgua: '19-40-460-254-01-027-2',
  precioVenta: 5_000_000,
  metrosCuadradosTerreno: 120,
  metrosCuadradosConstruccion: 150,
  pagoAPlazos: false,
  reservaDominio: false,
  escrituraAntecedente: null,
};

const HAPPY_INE = {
  nombreCompleto: 'Carlos Hernández Sotelo',
  curp: 'HESC850101HDFXXX01',
  vigencia: yearsFromNow(5),
};

const HAPPY_PREDIAL = {
  cuentaPredial: '038272180274',
  direccionInmueble: 'Colorado 36, Napoles, Benito Juarez, Ciudad de Mexico',
  superficieTerreno: 120,
  superficieConstruccion: 150,
  valorCatastral: 2_000_000,
  valorComercial: 4_000_000,
  fechaEmision: daysAgoISO(30),
};

const HAPPY_AGUA = {
  numeroCuenta: '19404602540102722', // same digits as escritura cuentaAgua
  direccion: 'Colorado 36 Napoles Benito Juarez',
  fechaPago: daysAgoISO(20),
};

const HAPPY_FOLIO = { folioReal: '1307904-0' };

/* ============================================================ */

describe('crossCheckEscritura — happy path', () => {
  it('all rules pass or skip cleanly with consistent docs', () => {
    const { checks, summary } = run({
      escritura: HAPPY_ESCRITURA,
      identificacion: HAPPY_INE,
      folioReal: HAPPY_FOLIO,
      certificadoLibertadGravamen: HAPPY_FOLIO,
      boletaPredial: HAPPY_PREDIAL,
      boletaAgua: HAPPY_AGUA,
    });
    expect(summary.fail).toBe(0);
    expect(check(checks, 'ciudad_notaria_inmueble').status).toBe('pass');
    expect(check(checks, 'nombre_comprador_ine').status).toBe('pass');
    expect(check(checks, 'curp_consistente').status).toBe('pass');
    expect(check(checks, 'cuenta_predial_consistente').status).toBe('pass');
    expect(check(checks, 'cuenta_agua_consistente').status).toBe('pass');
    expect(check(checks, 'folio_real_consistente').status).toBe('pass');
    expect(check(checks, 'antiguedad_boleta_predial').status).toBe('pass');
    expect(check(checks, 'antiguedad_boleta_agua').status).toBe('pass');
    expect(check(checks, 'ine_vigente').status).toBe('pass');
  });
});

describe('Rule: ciudad_notaria_inmueble', () => {
  it('fails when cities clearly differ', () => {
    const { checks } = run({
      escritura: { ...HAPPY_ESCRITURA, ciudadNotaria: 'Guadalajara', ciudadInmueble: 'Monterrey' },
    });
    expect(check(checks, 'ciudad_notaria_inmueble').status).toBe('fail');
  });
  it('passes for DF ≡ Benito Juárez (CDMX synonyms)', () => {
    const { checks } = run({
      escritura: { ...HAPPY_ESCRITURA, ciudadNotaria: 'Distrito Federal', ciudadInmueble: 'Benito Juárez' },
    });
    expect(check(checks, 'ciudad_notaria_inmueble').status).toBe('pass');
  });
  it('skips when cities not present', () => {
    const { checks } = run({
      escritura: { ...HAPPY_ESCRITURA, ciudadNotaria: null, ciudadInmueble: null },
    });
    expect(check(checks, 'ciudad_notaria_inmueble').status).toBe('skip');
  });
});

describe('Rule: nombre_comprador_ine', () => {
  it('fails when names disagree', () => {
    const { checks } = run({
      escritura: HAPPY_ESCRITURA,
      identificacion: { ...HAPPY_INE, nombreCompleto: 'GOMEZ GONZALEZ HECTOR' },
    });
    expect(check(checks, 'nombre_comprador_ine').status).toBe('fail');
  });
  it('skips when no INE attached', () => {
    const { checks } = run({ escritura: HAPPY_ESCRITURA });
    expect(check(checks, 'nombre_comprador_ine').status).toBe('skip');
  });
});

describe('Rule: copropietarios_documentos', () => {
  it('warns when copropietarios listed', () => {
    const { checks } = run({
      escritura: { ...HAPPY_ESCRITURA, copropietarios: ['María Sotelo', 'Pedro Sotelo'] },
    });
    const c = check(checks, 'copropietarios_documentos');
    expect(c.status).toBe('warn');
    expect(c.message).toContain('2 copropietario');
  });
  it('passes when explicitly empty', () => {
    const { checks } = run({ escritura: { ...HAPPY_ESCRITURA, copropietarios: [] } });
    expect(check(checks, 'copropietarios_documentos').status).toBe('pass');
  });
});

describe('Rule: curp_consistente', () => {
  it('passes when CURP matches', () => {
    const { checks } = run({ escritura: HAPPY_ESCRITURA, identificacion: HAPPY_INE });
    expect(check(checks, 'curp_consistente').status).toBe('pass');
  });
  it('fails on mismatch', () => {
    const { checks } = run({
      escritura: HAPPY_ESCRITURA,
      identificacion: { ...HAPPY_INE, curp: 'XXXX850101HDFXXX99' },
    });
    expect(check(checks, 'curp_consistente').status).toBe('fail');
  });
  it('skips when one side missing CURP', () => {
    const { checks } = run({
      escritura: { ...HAPPY_ESCRITURA, curpComprador: null },
      identificacion: HAPPY_INE,
    });
    expect(check(checks, 'curp_consistente').status).toBe('skip');
  });
});

describe('Rule: nombre_comprador_acta', () => {
  it('skips when comprador is soltero', () => {
    const { checks } = run({ escritura: HAPPY_ESCRITURA });
    const c = check(checks, 'nombre_comprador_acta');
    expect(c.status).toBe('skip');
    expect(c.message).toContain('propietario no casado');
  });
  it('passes when casado and name appears in acta', () => {
    const { checks } = run({
      escritura: { ...HAPPY_ESCRITURA, estadoCivilComprador: 'casado' },
      actaMatrimonio: {
        contrayente1: 'Carlos Hernández Sotelo',
        contrayente2: 'María López',
        regimenMatrimonial: 'sociedad conyugal',
      },
    });
    expect(check(checks, 'nombre_comprador_acta').status).toBe('pass');
  });
  it('fails when casado and name not in acta', () => {
    const { checks } = run({
      escritura: { ...HAPPY_ESCRITURA, estadoCivilComprador: 'casado' },
      actaMatrimonio: {
        contrayente1: 'Otro Persona',
        contrayente2: 'Tercero',
        regimenMatrimonial: 'sociedad conyugal',
      },
    });
    expect(check(checks, 'nombre_comprador_acta').status).toBe('fail');
  });
});

describe('Rule: folio_real_consistente', () => {
  it('passes when all 3 sources match', () => {
    const { checks } = run({
      escritura: HAPPY_ESCRITURA,
      folioReal: HAPPY_FOLIO,
      certificadoLibertadGravamen: HAPPY_FOLIO,
    });
    expect(check(checks, 'folio_real_consistente').status).toBe('pass');
  });
  it('fails when folios disagree', () => {
    const { checks } = run({
      escritura: HAPPY_ESCRITURA,
      folioReal: { folioReal: '999-X' },
    });
    expect(check(checks, 'folio_real_consistente').status).toBe('fail');
  });
  it('skips when less than 2 sources present', () => {
    const { checks } = run({ escritura: HAPPY_ESCRITURA });
    expect(check(checks, 'folio_real_consistente').status).toBe('skip');
  });
});

describe('Rule: cuenta_predial_consistente', () => {
  it('passes with different formatting but same digits', () => {
    const { checks } = run({
      escritura: { ...HAPPY_ESCRITURA, cuentaPredial: '038-272-18-027-4' },
      boletaPredial: { ...HAPPY_PREDIAL, cuentaPredial: '03827218027-4' },
    });
    expect(check(checks, 'cuenta_predial_consistente').status).toBe('pass');
  });
  it('fails for entirely different accounts', () => {
    const { checks } = run({
      escritura: { ...HAPPY_ESCRITURA, cuentaPredial: '999-272-18-027-4' },
      boletaPredial: HAPPY_PREDIAL,
    });
    expect(check(checks, 'cuenta_predial_consistente').status).toBe('fail');
  });
});

describe('Rule: precio_mayor_valor_catastral', () => {
  it('passes when price > valores', () => {
    const { checks } = run({
      escritura: HAPPY_ESCRITURA,
      boletaPredial: HAPPY_PREDIAL,
    });
    expect(check(checks, 'precio_mayor_valor_catastral').status).toBe('pass');
  });
  it('fails when price < valor catastral', () => {
    const { checks } = run({
      escritura: { ...HAPPY_ESCRITURA, precioVenta: 1_000_000 },
      boletaPredial: HAPPY_PREDIAL,
    });
    expect(check(checks, 'precio_mayor_valor_catastral').status).toBe('fail');
  });
});

describe('Rule: metros_cuadrados_consistentes', () => {
  it('passes when m² match within tolerance', () => {
    const { checks } = run({
      escritura: HAPPY_ESCRITURA,
      boletaPredial: HAPPY_PREDIAL,
    });
    expect(check(checks, 'metros_cuadrados_consistentes').status).toBe('pass');
  });
  it('apartment skips terreno comparison', () => {
    const { checks } = run({
      escritura: {
        ...HAPPY_ESCRITURA,
        tipoInmueble: 'departamento',
        metrosCuadradosTerreno: 869.62, // edificio entero
        metrosCuadradosConstruccion: 81,
      },
      boletaPredial: {
        ...HAPPY_PREDIAL,
        superficieTerreno: 18, // indiviso
        superficieConstruccion: 81,
      },
    });
    const c = check(checks, 'metros_cuadrados_consistentes');
    expect(c.status).toBe('pass');
    expect(c.message).toContain('Departamento');
  });
  it('fails for inconsistent construcción', () => {
    const { checks } = run({
      escritura: { ...HAPPY_ESCRITURA, metrosCuadradosConstruccion: 200 },
      boletaPredial: { ...HAPPY_PREDIAL, superficieConstruccion: 80 },
    });
    expect(check(checks, 'metros_cuadrados_consistentes').status).toBe('fail');
  });
});

describe('Rule: sin_gravamenes_compraventa', () => {
  it('fails when pagoAPlazos = true', () => {
    const { checks } = run({ escritura: { ...HAPPY_ESCRITURA, pagoAPlazos: true } });
    expect(check(checks, 'sin_gravamenes_compraventa').status).toBe('fail');
  });
  it('fails when reservaDominio = true', () => {
    const { checks } = run({ escritura: { ...HAPPY_ESCRITURA, reservaDominio: true } });
    expect(check(checks, 'sin_gravamenes_compraventa').status).toBe('fail');
  });
  it('passes when both false', () => {
    const { checks } = run({ escritura: HAPPY_ESCRITURA });
    expect(check(checks, 'sin_gravamenes_compraventa').status).toBe('pass');
  });
});

describe('Rule: antiguedad_boleta_predial', () => {
  it('passes for recent boleta (30 days)', () => {
    const { checks } = run({
      escritura: HAPPY_ESCRITURA,
      boletaPredial: { ...HAPPY_PREDIAL, fechaEmision: daysAgoISO(30) },
    });
    expect(check(checks, 'antiguedad_boleta_predial').status).toBe('pass');
  });
  it('fails for old boleta (200 days)', () => {
    const { checks } = run({
      escritura: HAPPY_ESCRITURA,
      boletaPredial: { ...HAPPY_PREDIAL, fechaEmision: daysAgoISO(200) },
    });
    expect(check(checks, 'antiguedad_boleta_predial').status).toBe('fail');
  });
});

describe('Rule: ine_vigente', () => {
  it('passes for future vigencia', () => {
    const { checks } = run({
      escritura: HAPPY_ESCRITURA,
      identificacion: { ...HAPPY_INE, vigencia: yearsFromNow(5) },
    });
    expect(check(checks, 'ine_vigente').status).toBe('pass');
  });
  it('fails for vencida', () => {
    const { checks } = run({
      escritura: HAPPY_ESCRITURA,
      identificacion: { ...HAPPY_INE, vigencia: '2020' },
    });
    expect(check(checks, 'ine_vigente').status).toBe('fail');
  });
  it('parses year range "2014 - 2024" as vencida', () => {
    const { checks } = run({
      escritura: HAPPY_ESCRITURA,
      identificacion: { ...HAPPY_INE, vigencia: '2014 - 2024' },
    });
    expect(check(checks, 'ine_vigente').status).toBe('fail');
  });
  it('warns when less than 60 days remain', () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const { checks } = run({
      escritura: HAPPY_ESCRITURA,
      identificacion: { ...HAPPY_INE, vigencia: d.toISOString().slice(0, 10) },
    });
    expect(check(checks, 'ine_vigente').status).toBe('warn');
  });
});

describe('Rule: escritura_antecedente_consistente', () => {
  it('skips when no antecedente referenced', () => {
    const { checks } = run({ escritura: HAPPY_ESCRITURA });
    expect(check(checks, 'escritura_antecedente_consistente').status).toBe('skip');
  });
  it('warns when antecedente referenced but not provided', () => {
    const { checks } = run({
      escritura: { ...HAPPY_ESCRITURA, escrituraAntecedente: '51130' },
    });
    expect(check(checks, 'escritura_antecedente_consistente').status).toBe('warn');
  });
  it('passes when antecedente data matches', () => {
    const { checks } = run({
      escritura: { ...HAPPY_ESCRITURA, escrituraAntecedente: '51130' },
      escrituraAntecedente: {
        nombreVendedor: 'Juan Pérez',
        direccionInmueble: 'Colorado 36 Depto 406, Napoles',
        metrosCuadradosTerreno: 120,
        metrosCuadradosConstruccion: 150,
      },
    });
    expect(check(checks, 'escritura_antecedente_consistente').status).toBe('pass');
  });
});

describe('summary counts', () => {
  it('aggregates pass/fail/warn/skip correctly', () => {
    const { summary } = run({
      escritura: { ...HAPPY_ESCRITURA, pagoAPlazos: true }, // 1 fail
      identificacion: { ...HAPPY_INE, nombreCompleto: 'OTRO' }, // 1 fail
    });
    expect(summary.fail).toBeGreaterThanOrEqual(2);
    expect(summary.pass + summary.fail + summary.warn + summary.skip).toBe(18);
  });
});
