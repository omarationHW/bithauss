import {
  USO_DE_SUELO_DOC,
  areRequiredDocumentsValidated,
  isDocumentRequired,
  isDocumentValidated,
  missingRequiredDocuments,
  requiresUsoDeSuelo,
  type DocumentRequirementRow,
} from './required-documents';

const HOUSE_SALE = { type: 'CASA', operation: 'VENTA' };
const OFFICE_SALE = { type: 'OFICINA', operation: 'VENTA' };
const HOUSE_RENT = { type: 'CASA_USO_SUELO', operation: 'RENTA' };

const escritura: DocumentRequirementRow = {
  name: 'Escritura de Propiedad del Inmueble a Certificar',
  is_required: true,
  status: 'VALIDADO',
};

describe('requiresUsoDeSuelo', () => {
  it('applies to the sale of an office or a commercially zoned house', () => {
    expect(requiresUsoDeSuelo(OFFICE_SALE)).toBe(true);
    expect(requiresUsoDeSuelo({ type: 'CASA_USO_SUELO', operation: 'VENTA_RENTA' })).toBe(true);
  });

  it('does not apply to a plain house sale or to a rental', () => {
    expect(requiresUsoDeSuelo(HOUSE_SALE)).toBe(false);
    expect(requiresUsoDeSuelo(HOUSE_RENT)).toBe(false);
  });

  it('tolerates missing type / operation', () => {
    expect(requiresUsoDeSuelo({ type: null, operation: null })).toBe(false);
  });
});

describe('isDocumentRequired', () => {
  it('falls back to the catalogue flag for documents without a rule', () => {
    expect(isDocumentRequired({ name: 'INE', is_required: true }, HOUSE_SALE)).toBe(true);
    expect(isDocumentRequired({ name: 'INE', is_required: false }, HOUSE_SALE)).toBe(false);
  });

  it('overrides the flag for the land-use certificate', () => {
    const doc = { name: USO_DE_SUELO_DOC, is_required: true };
    expect(isDocumentRequired(doc, HOUSE_SALE)).toBe(false);
    expect(isDocumentRequired(doc, OFFICE_SALE)).toBe(true);
  });
});

describe('isDocumentValidated', () => {
  it('accepts both spellings and nothing else', () => {
    expect(isDocumentValidated('VALIDADO')).toBe(true);
    expect(isDocumentValidated('APROBADO')).toBe(true);
    expect(isDocumentValidated('RECIBIDO')).toBe(false);
    expect(isDocumentValidated(null)).toBe(false);
  });
});

describe('missingRequiredDocuments', () => {
  it('is empty when every required document is cleared', () => {
    expect(missingRequiredDocuments([escritura], HOUSE_SALE)).toEqual([]);
  });

  it('flags a required document with no upload', () => {
    expect(
      missingRequiredDocuments([{ ...escritura, status: null }], HOUSE_SALE),
    ).toEqual([escritura.name]);
  });

  it('flags a required document whose latest version was rejected', () => {
    expect(
      missingRequiredDocuments([{ ...escritura, status: 'RECHAZADO' }], HOUSE_SALE),
    ).toEqual([escritura.name]);
  });

  it('ignores optional documents', () => {
    expect(
      missingRequiredDocuments(
        [escritura, { name: 'Resolución Judicial', is_required: false, status: null }],
        HOUSE_SALE,
      ),
    ).toEqual([]);
  });
});

describe('areRequiredDocumentsValidated', () => {
  it('is false when the catalogue declares nothing required', () => {
    expect(
      areRequiredDocumentsValidated(
        [{ name: 'Resolución Judicial', is_required: false, status: null }],
        HOUSE_SALE,
      ),
    ).toBe(false);
    expect(areRequiredDocumentsValidated([], HOUSE_SALE)).toBe(false);
  });

  it('is true only when every required document is cleared', () => {
    expect(areRequiredDocumentsValidated([escritura], HOUSE_SALE)).toBe(true);
    expect(
      areRequiredDocumentsValidated([{ ...escritura, status: 'PENDIENTE' }], HOUSE_SALE),
    ).toBe(false);
  });
});
