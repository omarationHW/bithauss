import { applyRegexFallback } from './ocr.service';

// A realistic chunk of OCR text from an INE
const INE_TEXT = `
INSTITUTO NACIONAL ELECTORAL
CREDENCIAL PARA VOTAR
NOMBRE
HERNANDEZ
SOTELO
CARLOS
DOMICILIO
COLORADO 36 DEPTO 406
COL NAPOLES
03810 BENITO JUAREZ DF
CLAVE DE ELECTOR
HRSTCR85010109H300
CURP
HESC850101HDFRTL09
ANO DE REGISTRO 2014 03
ESTADO 09 MUNICIPIO 014
SECCION 1234
LOCALIDAD 0001 EMISION 2014
VIGENCIA 2024
`;

const ESCRITURA_TEXT = `
ESCRITURA PUBLICA NUMERO 50,000
COMPARECIENTES
ADQUIRENTE: CARLOS HERNANDEZ SOTELO
CURP: HESC850101HDFRTL09
RFC: HESC850101A12
DOMICILIO ...
PRECIO DE VENTA ...
`;

describe('applyRegexFallback — CURP', () => {
  it('fills CURP when LLM omitted it', () => {
    const structured: Record<string, unknown> = { curp: null };
    applyRegexFallback(INE_TEXT, structured);
    expect(structured.curp).toBe('HESC850101HDFRTL09');
  });

  it('does not overwrite a valid CURP from the LLM', () => {
    const structured: Record<string, unknown> = { curp: 'HESC850101HDFRTL09' };
    applyRegexFallback(INE_TEXT, structured);
    expect(structured.curp).toBe('HESC850101HDFRTL09');
  });

  it('overrides garbage CURP from LLM with the regex match', () => {
    const structured: Record<string, unknown> = { curp: 'OBVIOUSLY_NOT_A_CURP' };
    applyRegexFallback(INE_TEXT, structured);
    expect(structured.curp).toBe('HESC850101HDFRTL09');
  });

  it('does nothing when no CURP appears in the text', () => {
    const structured: Record<string, unknown> = { curp: null };
    applyRegexFallback('Texto cualquiera sin curp valida.', structured);
    expect(structured.curp).toBeNull();
  });

  it('handles CURP with spaces / dashes inserted by OCR', () => {
    const ocrNoisy = 'CURP: HESC 850101 HDF RTL 09 algo más';
    const structured: Record<string, unknown> = { curp: null };
    applyRegexFallback(ocrNoisy, structured);
    expect(structured.curp).toBe('HESC850101HDFRTL09');
  });

  it('picks the most common CURP when several appear (defensive)', () => {
    const text = 'CURP HESC850101HDFRTL09 ... CURP HESC850101HDFRTL09 ... OTRO ABCD800101HDFXXX01';
    const structured: Record<string, unknown> = { curp: null };
    applyRegexFallback(text, structured);
    expect(structured.curp).toBe('HESC850101HDFRTL09');
  });
});

describe('applyRegexFallback — RFC', () => {
  it('fills rfcComprador when schema includes it and LLM missed it', () => {
    const structured: Record<string, unknown> = {
      rfcComprador: null,
      curpComprador: 'HESC850101HDFRTL09',
    };
    applyRegexFallback(ESCRITURA_TEXT, structured);
    expect(structured.rfcComprador).toBe('HESC850101A12');
  });

  it('fills the generic rfc field when only that key exists', () => {
    const structured: Record<string, unknown> = { rfc: null };
    applyRegexFallback('Contribuyente: HESC850101A12 ...', structured);
    expect(structured.rfc).toBe('HESC850101A12');
  });

  it('does NOT attempt RFC extraction when neither rfc nor rfcComprador key exists', () => {
    // INE-only flow: structured has curp but no rfc/rfcComprador key
    const structured: Record<string, unknown> = { curp: null };
    applyRegexFallback(INE_TEXT, structured);
    expect(Object.keys(structured)).toEqual(['curp']);
    expect((structured as { rfc?: unknown }).rfc).toBeUndefined();
    expect((structured as { rfcComprador?: unknown }).rfcComprador).toBeUndefined();
  });

  it('does not overwrite a valid RFC from the LLM', () => {
    const structured: Record<string, unknown> = { rfcComprador: 'HESC850101A12' };
    applyRegexFallback(ESCRITURA_TEXT, structured);
    expect(structured.rfcComprador).toBe('HESC850101A12');
  });
});

describe('applyRegexFallback — boundaries', () => {
  it('empty text does nothing', () => {
    const structured: Record<string, unknown> = { curp: null, rfc: null };
    applyRegexFallback('', structured);
    expect(structured.curp).toBeNull();
    expect(structured.rfc).toBeNull();
  });
  it('does not mutate unrelated fields', () => {
    const structured: Record<string, unknown> = {
      curp: null,
      nombreCompleto: 'Carlos Hernandez',
      domicilio: 'Colorado 36',
    };
    applyRegexFallback(INE_TEXT, structured);
    expect(structured.nombreCompleto).toBe('Carlos Hernandez');
    expect(structured.domicilio).toBe('Colorado 36');
  });
});
