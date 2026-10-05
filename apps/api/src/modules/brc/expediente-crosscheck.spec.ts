import {
  checkPropertyAddress,
  crossCheckExpediente,
  pickDocuments,
  type ExpedienteDoc,
  type PropertyAddressRow,
} from './expediente-crosscheck';

const PROPERTY: PropertyAddressRow = {
  street: 'Av. Paseo de la Reforma',
  exterior_number: '222',
  neighborhood: 'Juárez',
  zip_code: '06600',
  city: 'Cuauhtémoc',
  state: 'Ciudad de México',
};

const ESCRITURA = 'Escritura de Propiedad del Inmueble a Certificar';
const deed = (data: Record<string, unknown>, status = 'VALIDADO'): ExpedienteDoc => ({
  type_name: ESCRITURA,
  status,
  data,
});
const byRule = (checks: { rule: string; status: string }[], rule: string) =>
  checks.find((c) => c.rule === rule)?.status;

describe('pickDocuments', () => {
  it('toma el documento más reciente de cada tipo e ignora los rechazados', () => {
    const picked = pickDocuments([
      deed({ folioReal: 'NUEVO' }, 'PENDIENTE'),
      deed({ folioReal: 'VIEJO' }),
    ]);
    expect(picked.escritura).toEqual({ folioReal: 'NUEVO' });

    const onlyRejected = pickDocuments([deed({ folioReal: 'X' }, 'RECHAZADO')]);
    expect(onlyRejected.escritura).toBeUndefined();
  });

  it('con varias INE (copropietarios) usa la del dueño que nombra la escritura', () => {
    const id = (nombreCompleto: string): ExpedienteDoc => ({
      type_name: 'Identificación del Propietario',
      status: 'VALIDADO',
      data: { nombreCompleto },
    });
    const picked = pickDocuments([
      id('Cynthia Alejandra Olea de la Torre'),
      id('Erika Patricia Olea de la Torre'),
      deed({ nombreComprador: 'Erika Patricia Olea de la Torre' }),
    ]);
    expect(picked.identificacion).toEqual({ nombreCompleto: 'Erika Patricia Olea de la Torre' });
  });

  it('no confunde el régimen de condominio con la escritura de propiedad', () => {
    const picked = pickDocuments([
      { type_name: 'Escritura de Régimen de Propiedad en Condominio', status: 'VALIDADO', data: { a: 1 } },
    ]);
    expect(picked.escritura).toBeUndefined();
  });
});

describe('checkPropertyAddress', () => {
  const run = (deedAddress: string, extra: Record<string, unknown> = {}) =>
    checkPropertyAddress(PROPERTY, pickDocuments([deed({ direccionInmueble: deedAddress, ...extra })]));

  it('pasa cuando la escritura describe el mismo inmueble', () => {
    const checks = run('Av. Paseo de la Reforma 222, Col. Juárez, Alcaldía Cuauhtémoc, C.P. 06600');
    expect(byRule(checks, 'direccion_capturada_escritura')).toBe('pass');
    expect(byRule(checks, 'numero_exterior_escritura')).toBe('pass');
    expect(byRule(checks, 'codigo_postal_escritura')).toBe('pass');
    expect(byRule(checks, 'alcaldia_escritura')).toBe('pass');
  });

  it('marca un número exterior distinto aunque la calle coincida', () => {
    const checks = run('Av. Paseo de la Reforma 22, Col. Juárez, C.P. 06600');
    expect(byRule(checks, 'numero_exterior_escritura')).toBe('fail');
  });

  it('marca un código postal distinto', () => {
    const checks = run('Av. Paseo de la Reforma 222, Col. Juárez, C.P. 06700');
    expect(byRule(checks, 'codigo_postal_escritura')).toBe('fail');
  });

  it('marca otra dirección', () => {
    const checks = run('Calle Falsa 123, Col. Centro, Guadalajara');
    expect(byRule(checks, 'direccion_capturada_escritura')).toBe('fail');
  });

  it('solo advierte si no encuentra la alcaldía (las escrituras viejas dicen "Delegación")', () => {
    const checks = run('Av. Paseo de la Reforma 222, Col. Juárez, Ciudad de México');
    expect(byRule(checks, 'alcaldia_escritura')).toBe('warn');
  });

  it('acepta números con letra: 12-B', () => {
    const checks = checkPropertyAddress(
      { ...PROPERTY, exterior_number: '12-B' },
      pickDocuments([deed({ direccionInmueble: 'Av. Paseo de la Reforma 12-B, Col. Juárez' })]),
    );
    expect(byRule(checks, 'numero_exterior_escritura')).toBe('pass');
  });

  it('reconoce el número exterior escrito con letra, como en las escrituras', () => {
    const checks = checkPropertyAddress(
      { ...PROPERTY, exterior_number: '36' },
      pickDocuments([deed({ direccionInmueble: 'Colorado número treinta y seis, colonia Nápoles' })]),
    );
    expect(byRule(checks, 'numero_exterior_escritura')).toBe('pass');
  });

  it('omite la comparación si el inmueble aún no tiene calle (anuncios anteriores)', () => {
    const checks = checkPropertyAddress(
      { ...PROPERTY, street: null, exterior_number: null },
      pickDocuments([deed({ direccionInmueble: 'Avenida Jesús del Monte 268, Colonia Jesús del Monte' })]),
    );
    expect(byRule(checks, 'direccion_capturada_escritura')).toBe('skip');
  });

  it('no compara número exterior "S/N"', () => {
    const checks = checkPropertyAddress(
      { ...PROPERTY, exterior_number: 'S/N' },
      pickDocuments([deed({ direccionInmueble: 'Av. Paseo de la Reforma, Col. Juárez' })]),
    );
    expect(byRule(checks, 'numero_exterior_escritura')).toBe('skip');
  });

  it('compara el comprobante de domicilio contra la escritura', () => {
    const checks = checkPropertyAddress(
      PROPERTY,
      pickDocuments([
        { type_name: 'Comprobante de Domicilio con la dirección del Inmueble', status: 'VALIDADO', data: { direccion: 'Calle Falsa 123, Guadalajara' } },
        deed({ direccionInmueble: 'Av. Paseo de la Reforma 222, Col. Juárez' }),
      ]),
    );
    expect(byRule(checks, 'domicilio_comprobante')).toBe('fail');
  });
});

describe('crossCheckExpediente', () => {
  it('sin escritura no hay nada que comparar', () => {
    expect(crossCheckExpediente([], PROPERTY)).toBeNull();
  });

  it('junta las 18 reglas de la escritura con las de la dirección capturada', () => {
    const result = crossCheckExpediente(
      [deed({ direccionInmueble: 'Av. Paseo de la Reforma 222, Col. Juárez, C.P. 06600' })],
      PROPERTY,
    );
    expect(result).not.toBeNull();
    expect(result!.checks.some((c) => c.rule === 'ine_vigente')).toBe(true);
    expect(result!.checks.some((c) => c.rule === 'direccion_capturada_escritura')).toBe(true);
    const total = Object.values(result!.summary).reduce((a, b) => a + b, 0);
    expect(total).toBe(result!.checks.length);
  });
});
