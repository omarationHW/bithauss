import { BrcService } from './brc.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

/* ------------------------------------------------------------------ */
/*  Supabase mock builder                                              */
/*  Builds a chainable mock that returns canned data per table and per  */
/*  operation (select / insert / update), because the two-step flow     */
/*  reads and writes the same tables in one call.                       */
/* ------------------------------------------------------------------ */

interface Canned {
  data?: unknown;
  error?: unknown;
}

/** Either a single canned response for every operation, or one per op. */
type TableSpec =
  | Canned
  | {
      select?: Canned;
      /** An array is consumed in order; the last entry repeats. */
      insert?: Canned | Canned[];
      update?: Canned;
    };

interface TableResponses {
  [table: string]: TableSpec;
}

interface MockSupabase {
  from: jest.Mock;
  rpc: jest.Mock;
  insertCalls: { table: string; payload: unknown }[];
  updateCalls: { table: string; payload: unknown }[];
  rpcCalls: string[];
}

/**
 * Folios the stubbed `next_brc_certificate_number()` hands out, in order.
 * `null` means "function not deployed", which exercises the fallback.
 */
type RpcPlan = (string | null)[] | undefined;

const CHAIN_FILTERS = [
  'select',
  'eq',
  'neq',
  'in',
  'is',
  'not',
  'like',
  'ilike',
  'gte',
  'lte',
  'order',
  'limit',
  'match',
];

function makeSupabase(tables: TableResponses, rpcPlan?: RpcPlan): MockSupabase {
  const insertCalls: { table: string; payload: unknown }[] = [];
  const updateCalls: { table: string; payload: unknown }[] = [];
  const rpcCalls: string[] = [];
  const insertCursors: Record<string, number> = {};
  let rpcCursor = 0;

  function cannedFor(table: string, op: 'select' | 'insert' | 'update'): Canned {
    const spec = tables[table] as Record<string, unknown> | undefined;
    if (!spec) return { data: null };
    // Legacy shape: { data, error } applies to every operation.
    if ('data' in spec || 'error' in spec) return spec as Canned;
    const value = spec[op] as Canned | Canned[] | undefined;
    if (value === undefined) return { data: null };
    if (Array.isArray(value)) {
      const idx = insertCursors[table] ?? 0;
      insertCursors[table] = idx + 1;
      return value[Math.min(idx, value.length - 1)] ?? { data: null };
    }
    return value;
  }

  function makeChain(resolve: () => Canned): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    for (const method of CHAIN_FILTERS) {
      chain[method] = jest.fn(() => chain);
    }
    chain.maybeSingle = jest.fn(() => Promise.resolve(resolve()));
    chain.single = jest.fn(() => Promise.resolve(resolve()));
    chain.then = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled);
    return chain;
  }

  const from = jest.fn((table: string) => {
    const base = makeChain(() => cannedFor(table, 'select'));
    base.select = jest.fn(() => makeChain(() => cannedFor(table, 'select')));
    base.insert = jest.fn((payload: unknown) => {
      insertCalls.push({ table, payload });
      return makeChain(() => cannedFor(table, 'insert'));
    });
    base.update = jest.fn((payload: unknown) => {
      updateCalls.push({ table, payload });
      return makeChain(() => cannedFor(table, 'update'));
    });
    return base;
  });

  const rpc = jest.fn((name: string) => {
    rpcCalls.push(name);
    if (!rpcPlan) {
      // No plan: behave like a database where the function is missing, so the
      // derived-numbering fallback is what the test observes.
      return Promise.resolve({ data: null, error: { message: 'undefined function' } });
    }
    const value = rpcPlan[Math.min(rpcCursor, rpcPlan.length - 1)];
    rpcCursor += 1;
    return Promise.resolve(
      value === null
        ? { data: null, error: { message: 'undefined function' } }
        : { data: value, error: null },
    );
  });

  return { from, rpc, insertCalls, updateCalls, rpcCalls };
}

function makeService(mock: MockSupabase): BrcService {
  const stubConfig = {
    getAdminClient: () => mock as unknown as ReturnType<MockSupabase['from']>,
  };
  // BrcService only uses SupabaseConfigService.getAdminClient()
  return new BrcService(stubConfig as never);
}

/* ------------------------------------------------------------------ */
/*  Fixtures                                                            */
/* ------------------------------------------------------------------ */

const NOTARY_ID = 'notary-1';
const OPERATOR_ID = 'operator-1';
const REQUESTER_ID = 'requester-1';
const EXP_ID = 'exp-1';
const PROP_ID = 'prop-1';
const DOC_ID = 'doc-1';
const YEAR = new Date().getFullYear();

const baseExpediente = {
  id: EXP_ID,
  requested_by: REQUESTER_ID,
  assigned_notary_id: NOTARY_ID,
  assigned_operator_id: null,
  status: 'EN_REVISION',
  property_id: PROP_ID,
};

const notarialDto = {
  file_url: 'https://x/storage/v1/object/public/brc-documents/certificates/exp-1/cn.pdf',
  file_name: 'certificado-notarial.pdf',
  file_size: 12345,
  mime_type: 'application/pdf',
  observations: 'Expediente en regla',
};

/** Everything step A reads when the file is complete and valid. */
function readyForNotarialCertificate(
  overrides: TableResponses = {},
): TableResponses {
  return {
    brc_expedientes: { select: { data: baseExpediente } },
    brc_document_types: {
      select: {
        data: [
          { id: 'dt-1', name: 'Escritura de Propiedad del Inmueble a Certificar', is_required: true },
          { id: 'dt-2', name: 'Resolución Judicial', is_required: false },
        ],
      },
    },
    brc_documents: {
      select: {
        data: [
          {
            id: 'd1',
            document_type_id: 'dt-1',
            status: 'VALIDADO',
            reviewed_by: NOTARY_ID,
            created_at: '2026-08-01T00:00:00.000Z',
          },
        ],
      },
    },
    properties: { select: { data: { type: 'CASA', operation: 'VENTA' } } },
    brc_notarial_certificates: { insert: { data: { id: 'nc-1' } } },
    profiles: { select: { data: { role: 'NOTARIO' } } },
    ...overrides,
  };
}

/** Everything step B reads for a file waiting on its BRC. */
function readyForBrc(overrides: TableResponses = {}): TableResponses {
  return {
    profiles: { select: { data: { role: 'OPERADOR_BRC' } } },
    brc_expedientes: {
      select: {
        data: {
          ...baseExpediente,
          status: 'PENDIENTE_EMISION_BRC',
          // Step B is gated on the fee actually being collected.
          payment_status: 'PAGADO',
        },
      },
    },
    brc_notarial_certificates: {
      select: { data: { id: 'nc-1', file_url: 'https://x/cn.pdf', observations: null } },
    },
    brc_certificates: {
      select: { data: [] },
      insert: { data: { id: 'new-cert-id' } },
    },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Access control                                                      */
/* ------------------------------------------------------------------ */

describe('BrcService.assertNotaryOnExpediente (via approveDocument)', () => {
  it('throws NotFoundException when document does not exist', async () => {
    const mock = makeSupabase({ brc_documents: { data: null } });
    const service = makeService(mock);
    await expect(service.approveDocument(DOC_ID, NOTARY_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when caller is neither notary nor operator nor admin', async () => {
    const mock = makeSupabase({
      brc_documents: { data: { id: DOC_ID, expediente_id: EXP_ID, document_type_id: 'dt-1', brc_document_types: { name: 'INE' } } },
      brc_expedientes: { data: baseExpediente },
      profiles: { data: { role: 'CLIENTE' } },
    });
    const service = makeService(mock);
    await expect(service.approveDocument(DOC_ID, 'stranger-id')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows ADMIN even when not assigned to the expediente', async () => {
    const mock = makeSupabase({
      brc_documents: { data: { id: DOC_ID, expediente_id: EXP_ID, document_type_id: 'dt-1', brc_document_types: { name: 'INE' } } },
      brc_expedientes: { data: baseExpediente },
      profiles: { data: { role: 'ADMIN' } },
    });
    const service = makeService(mock);
    const result = await service.approveDocument(DOC_ID, 'admin-id');
    expect(result.status).toBe('VALIDADO');
  });
});

describe('BrcService.approveDocument', () => {
  it('updates the document to VALIDADO and writes an audit log', async () => {
    const mock = makeSupabase({
      brc_documents: { data: { id: DOC_ID, expediente_id: EXP_ID, document_type_id: 'dt-1', brc_document_types: { name: 'INE' } } },
      brc_expedientes: { data: baseExpediente },
    });
    const service = makeService(mock);
    const result = await service.approveDocument(DOC_ID, NOTARY_ID);

    expect(result).toMatchObject({
      id: DOC_ID,
      status: 'VALIDADO',
      expediente_id: EXP_ID,
      requester_id: REQUESTER_ID,
    });
    const logEntry = mock.insertCalls.find(
      (c) => c.table === 'brc_expediente_logs',
    );
    expect(logEntry).toBeDefined();
    expect(logEntry?.payload).toMatchObject({
      action: 'DOCUMENTO_VALIDADO',
      performed_by: NOTARY_ID,
    });
  });

  it('freezes the reviewer name on the row instead of relying on the viewer', async () => {
    const mock = makeSupabase({
      brc_documents: { data: { id: DOC_ID, expediente_id: EXP_ID, document_type_id: 'dt-1', brc_document_types: { name: 'INE' } } },
      brc_expedientes: { data: baseExpediente },
      profiles: { data: { first_name: 'Jesús', last_name: 'Valdez', role: 'NOTARIO' } },
    });
    const service = makeService(mock);
    await service.approveDocument(DOC_ID, NOTARY_ID);

    const docUpdate = mock.updateCalls.find((c) => c.table === 'brc_documents');
    expect(docUpdate?.payload).toMatchObject({ reviewer_name: 'Jesús Valdez' });
  });
});

describe('BrcService.rejectDocument', () => {
  it('updates to RECHAZADO with reason and notifies the requester', async () => {
    const mock = makeSupabase({
      brc_documents: { data: { id: DOC_ID, expediente_id: EXP_ID, document_type_id: 'dt-1', brc_document_types: { name: 'INE' } } },
      brc_expedientes: { data: baseExpediente },
    });
    const service = makeService(mock);

    const dto = { reason: 'Foto borrosa', owner_instruction: 'Adjunta una foto nítida.' };
    const result = await service.rejectDocument(DOC_ID, NOTARY_ID, dto);

    expect(result.status).toBe('RECHAZADO');
    const notif = mock.insertCalls.find((c) => c.table === 'notifications');
    expect(notif).toBeDefined();
    expect(notif?.payload).toMatchObject({
      recipient_id: REQUESTER_ID,
      type: 'BRC_ESTADO_CAMBIO',
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Certificates collected by the notary (green block)                  */
/* ------------------------------------------------------------------ */

describe('BrcService.updateCertificateTracking', () => {
  const tables = {
    brc_documents: {
      select: { data: { id: DOC_ID, expediente_id: EXP_ID, cert_requested_at: null } },
      update: { data: { id: DOC_ID, cert_result: 'FAVORABLE' } },
    },
    brc_expedientes: { select: { data: baseExpediente } },
  };

  it('writes only the fields present in the payload', async () => {
    const mock = makeSupabase(tables);
    const service = makeService(mock);
    await service.updateCertificateTracking(DOC_ID, NOTARY_ID, {
      cert_result: 'FAVORABLE',
    });

    const update = mock.updateCalls.find((c) => c.table === 'brc_documents');
    expect(update?.payload).toEqual({ cert_result: 'FAVORABLE' });
    // A legal opinion typed earlier must not be wiped by an unrelated save.
    expect(update?.payload).not.toHaveProperty('notary_legal_opinion');
  });

  it('stamps who requested the certificate the first time a date is recorded', async () => {
    const mock = makeSupabase(tables);
    const service = makeService(mock);
    await service.updateCertificateTracking(DOC_ID, NOTARY_ID, {
      cert_requested_at: '2026-08-10T00:00:00.000Z',
    });

    const update = mock.updateCalls.find((c) => c.table === 'brc_documents');
    expect(update?.payload).toMatchObject({ cert_requested_by: NOTARY_ID });
  });

  it('rejects an empty payload rather than issuing a no-op update', async () => {
    const mock = makeSupabase(tables);
    const service = makeService(mock);
    await expect(
      service.updateCertificateTracking(DOC_ID, NOTARY_ID, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

/* ------------------------------------------------------------------ */
/*  Step A — Certificado Notarial                                       */
/* ------------------------------------------------------------------ */

describe('BrcService.issueNotarialCertificate', () => {
  it('refuses a notary who is not the one assigned', async () => {
    const mock = makeSupabase(
      readyForNotarialCertificate({ profiles: { select: { data: { role: 'NOTARIO' } } } }),
    );
    const service = makeService(mock);
    await expect(
      service.issueNotarialCertificate(EXP_ID, 'other-notary', notarialDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses when a required document is still pending', async () => {
    const mock = makeSupabase(
      readyForNotarialCertificate({
        brc_documents: {
          select: {
            data: [
              {
                id: 'd1',
                document_type_id: 'dt-1',
                status: 'PENDIENTE',
                reviewed_by: null,
                created_at: '2026-08-01T00:00:00.000Z',
              },
            ],
          },
        },
      }),
    );
    const service = makeService(mock);
    await expect(
      service.issueNotarialCertificate(EXP_ID, NOTARY_ID, notarialDto),
    ).rejects.toThrow(/Faltan documentos obligatorios/);
  });

  it('refuses when a required document was never uploaded at all', async () => {
    const mock = makeSupabase(
      readyForNotarialCertificate({ brc_documents: { select: { data: [] } } }),
    );
    const service = makeService(mock);
    await expect(
      service.issueNotarialCertificate(EXP_ID, NOTARY_ID, notarialDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses when the catalogue has no required documents at all', async () => {
    const mock = makeSupabase(
      readyForNotarialCertificate({
        brc_document_types: {
          select: { data: [{ id: 'dt-2', name: 'Resolución Judicial', is_required: false }] },
        },
      }),
    );
    const service = makeService(mock);
    await expect(
      service.issueNotarialCertificate(EXP_ID, NOTARY_ID, notarialDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('honours the conditional land-use rule instead of the raw is_required flag', async () => {
    // The land-use certificate is optional in the catalogue but mandatory for
    // an office sale, and it has not been uploaded.
    const mock = makeSupabase(
      readyForNotarialCertificate({
        brc_document_types: {
          select: {
            data: [
              { id: 'dt-1', name: 'Escritura de Propiedad del Inmueble a Certificar', is_required: true },
              { id: 'dt-3', name: 'Constancia de Uso de Suelo autorizado del Inmueble', is_required: false },
            ],
          },
        },
        properties: { select: { data: { type: 'OFICINA', operation: 'VENTA' } } },
      }),
    );
    const service = makeService(mock);
    await expect(
      service.issueNotarialCertificate(EXP_ID, NOTARY_ID, notarialDto),
    ).rejects.toThrow(/Uso de Suelo/);
  });

  it('leaves the expediente PENDING BRC ISSUANCE, never CERTIFICADO', async () => {
    const mock = makeSupabase(readyForNotarialCertificate());
    const service = makeService(mock);
    const result = await service.issueNotarialCertificate(EXP_ID, NOTARY_ID, notarialDto);

    expect(result).toMatchObject({
      notarial_certificate_id: 'nc-1',
      status: 'PENDIENTE_EMISION_BRC',
    });

    const expUpdate = mock.updateCalls.find((c) => c.table === 'brc_expedientes');
    expect(expUpdate?.payload).toEqual({ status: 'PENDIENTE_EMISION_BRC' });

    const propUpdate = mock.updateCalls.find((c) => c.table === 'properties');
    expect(propUpdate?.payload).toEqual({ brc_status: 'PENDIENTE_EMISION_BRC' });

    // The seal must NOT be granted by the notary.
    expect(
      mock.updateCalls.some(
        (c) =>
          c.table === 'properties' &&
          (c.payload as Record<string, unknown>).brc_certificate_id !== undefined,
      ),
    ).toBe(false);
    expect(mock.insertCalls.some((c) => c.table === 'brc_certificates')).toBe(false);
  });

  it('stores the file and supersedes any previous notarial certificate', async () => {
    const mock = makeSupabase(readyForNotarialCertificate());
    const service = makeService(mock);
    await service.issueNotarialCertificate(EXP_ID, NOTARY_ID, notarialDto);

    const insert = mock.insertCalls.find(
      (c) => c.table === 'brc_notarial_certificates',
    );
    expect(insert?.payload).toMatchObject({
      expediente_id: EXP_ID,
      notary_id: NOTARY_ID,
      file_name: 'certificado-notarial.pdf',
    });

    const supersede = mock.updateCalls.find(
      (c) => c.table === 'brc_notarial_certificates',
    );
    expect(supersede?.payload).toMatchObject({
      superseded_at: expect.any(String),
    });
  });

  it('logs the act and notifies both the applicant and BitHauss', async () => {
    const mock = makeSupabase(readyForNotarialCertificate());
    const service = makeService(mock);
    await service.issueNotarialCertificate(EXP_ID, NOTARY_ID, notarialDto);

    const log = mock.insertCalls.find((c) => c.table === 'brc_expediente_logs');
    expect(log?.payload).toMatchObject({
      action: 'CERTIFICADO_NOTARIAL_EMITIDO',
      new_status: 'PENDIENTE_EMISION_BRC',
    });

    const notif = mock.insertCalls.find((c) => c.table === 'notifications');
    expect(notif?.payload).toMatchObject({ recipient_id: REQUESTER_ID });
    expect((notif?.payload as { body: string }).body).toMatch(/BitHauss emitirá/);
  });

  /* --- auditoría BH-05: `status` alone proves nothing --------------- */

  it('refuses a document marked VALIDADO that nobody actually reviewed', async () => {
    // Exactly the shape the applicant could forge from the browser console
    // before migration 024 pinned the reserved columns.
    const mock = makeSupabase(
      readyForNotarialCertificate({
        brc_documents: {
          select: {
            data: [
              {
                id: 'd1',
                document_type_id: 'dt-1',
                status: 'VALIDADO',
                reviewed_by: null,
                created_at: '2026-08-01T00:00:00.000Z',
              },
            ],
          },
        },
      }),
    );
    const service = makeService(mock);
    await expect(
      service.issueNotarialCertificate(EXP_ID, NOTARY_ID, notarialDto),
    ).rejects.toThrow(/nadie los dictaminó/);
    expect(
      mock.insertCalls.some((c) => c.table === 'brc_notarial_certificates'),
    ).toBe(false);
  });

  it('refuses a document validated by someone outside the notary office', async () => {
    const mock = makeSupabase(
      readyForNotarialCertificate({
        brc_documents: {
          select: {
            data: [
              {
                id: 'd1',
                document_type_id: 'dt-1',
                status: 'VALIDADO',
                reviewed_by: REQUESTER_ID,
                created_at: '2026-08-01T00:00:00.000Z',
              },
            ],
          },
        },
      }),
    );
    const service = makeService(mock);
    await expect(
      service.issueNotarialCertificate(EXP_ID, NOTARY_ID, notarialDto),
    ).rejects.toThrow(/ajeno a la notaría/);
  });

  it('accepts a document validated by BitHauss staff', async () => {
    const mock = makeSupabase(
      readyForNotarialCertificate({
        brc_documents: {
          select: {
            data: [
              {
                id: 'd1',
                document_type_id: 'dt-1',
                status: 'VALIDADO',
                reviewed_by: OPERATOR_ID,
                created_at: '2026-08-01T00:00:00.000Z',
              },
            ],
          },
        },
        profiles: {
          select: { data: [{ id: OPERATOR_ID, role: 'OPERADOR_BRC' }] },
        },
      }),
    );
    const service = makeService(mock);
    await expect(
      service.issueNotarialCertificate(EXP_ID, NOTARY_ID, notarialDto),
    ).resolves.toMatchObject({ status: 'PENDIENTE_EMISION_BRC' });
  });

  it('refuses on an already closed expediente', async () => {
    const mock = makeSupabase(
      readyForNotarialCertificate({
        brc_expedientes: { select: { data: { ...baseExpediente, status: 'CERTIFICADO' } } },
      }),
    );
    const service = makeService(mock);
    await expect(
      service.issueNotarialCertificate(EXP_ID, NOTARY_ID, notarialDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

/* ------------------------------------------------------------------ */
/*  Step B — BRC issuance (BitHauss only)                               */
/* ------------------------------------------------------------------ */

describe('BrcService.issueBrc', () => {
  it('NEVER lets a NOTARIO issue the BRC', async () => {
    const mock = makeSupabase(
      readyForBrc({ profiles: { select: { data: { role: 'NOTARIO' } } } }),
    );
    const service = makeService(mock);
    await expect(service.issueBrc(EXP_ID, NOTARY_ID, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(mock.insertCalls.some((c) => c.table === 'brc_certificates')).toBe(false);
  });

  it('refuses any other role too', async () => {
    for (const role of ['VENDEDOR', 'BROKER', 'INMOBILIARIA', 'COMPRADOR']) {
      const mock = makeSupabase(readyForBrc({ profiles: { select: { data: { role } } } }));
      const service = makeService(mock);
      await expect(service.issueBrc(EXP_ID, 'someone', {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
  });

  it('allows ADMIN and OPERADOR_BRC', async () => {
    for (const role of ['ADMIN', 'OPERADOR_BRC']) {
      const mock = makeSupabase(readyForBrc({ profiles: { select: { data: { role } } } }));
      const service = makeService(mock);
      const result = await service.issueBrc(EXP_ID, OPERATOR_ID, {});
      expect(result.certificate_id).toBe('new-cert-id');
    }
  });

  it('refuses before the notary has issued the Certificado Notarial', async () => {
    const mock = makeSupabase(
      readyForBrc({
        brc_expedientes: { select: { data: { ...baseExpediente, status: 'EN_REVISION' } } },
      }),
    );
    const service = makeService(mock);
    await expect(service.issueBrc(EXP_ID, OPERATOR_ID, {})).rejects.toThrow(
      /Certificado Notarial/,
    );
  });

  // The BRC price list is only real if issuance actually checks the charge:
  // migration 026 wrote `payment_status` and nothing ever read it.
  it('refuses to issue the BRC when the fee has not been collected', async () => {
    const mock = makeSupabase(
      readyForBrc({
        brc_expedientes: {
          select: {
            data: {
              ...baseExpediente,
              status: 'PENDIENTE_EMISION_BRC',
              payment_status: 'PENDIENTE',
            },
          },
        },
      }),
    );
    const service = makeService(mock);
    await expect(service.issueBrc(EXP_ID, OPERATOR_ID, {})).rejects.toThrow(
      /pago de la certificación BRC/,
    );
    // Nothing may be written when the gate closes.
    expect(mock.insertCalls.find((c) => c.table === 'brc_certificates')).toBeUndefined();
  });

  it('issues the BRC for a dossier waived as EXENTO', async () => {
    const mock = makeSupabase(
      readyForBrc({
        brc_expedientes: {
          select: {
            data: {
              ...baseExpediente,
              status: 'PENDIENTE_EMISION_BRC',
              payment_status: 'EXENTO',
            },
          },
        },
      }),
    );
    const service = makeService(mock);
    await expect(service.issueBrc(EXP_ID, OPERATOR_ID, {})).resolves.toBeDefined();
  });

  it('refuses when the notarial certificate row is missing', async () => {
    const mock = makeSupabase(
      readyForBrc({ brc_notarial_certificates: { select: { data: null } } }),
    );
    const service = makeService(mock);
    await expect(service.issueBrc(EXP_ID, OPERATOR_ID, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses to certify the same expediente twice', async () => {
    const mock = makeSupabase(
      readyForBrc({
        brc_expedientes: { select: { data: { ...baseExpediente, status: 'CERTIFICADO' } } },
      }),
    );
    const service = makeService(mock);
    await expect(service.issueBrc(EXP_ID, OPERATOR_ID, {})).rejects.toThrow(
      /ya tiene un BRC/,
    );
  });

  it('generates the folio server-side, sequentially after the issued ones', async () => {
    const mock = makeSupabase(
      readyForBrc({
        brc_certificates: {
          select: {
            data: [
              { certificate_number: `BRC-${YEAR}-000001` },
              { certificate_number: `BRC-${YEAR}-000007` },
              { certificate_number: `BRC-${YEAR}-000003` },
            ],
          },
          insert: { data: { id: 'new-cert-id' } },
        },
      }),
    );
    const service = makeService(mock);
    const result = await service.issueBrc(EXP_ID, OPERATOR_ID, {});

    expect(result.certificate_number).toBe(`BRC-${YEAR}-000008`);
    const insert = mock.insertCalls.find((c) => c.table === 'brc_certificates');
    expect(insert?.payload).toMatchObject({
      certificate_number: `BRC-${YEAR}-000008`,
      expediente_id: EXP_ID,
      property_id: PROP_ID,
      issued_by: OPERATOR_ID,
      notarial_certificate_id: 'nc-1',
    });
  });

  it('ignores a folio supplied by the caller', async () => {
    const mock = makeSupabase(readyForBrc());
    const service = makeService(mock);
    // The DTO has no certificate_number field at all; prove the payload is
    // derived and not echoed from an arbitrary body.
    const result = await service.issueBrc(EXP_ID, OPERATOR_ID, {
      certificate_number: 'BRC-1999-999999',
    } as never);
    expect(result.certificate_number).toBe(`BRC-${YEAR}-000001`);
  });

  /* --- auditoría BH-03: the folio is assigned by the server -------- */

  it('draws the folio from the atomic sequence function when it exists', async () => {
    const mock = makeSupabase(readyForBrc(), [`BRC-${YEAR}-000042`]);
    const service = makeService(mock);
    const result = await service.issueBrc(EXP_ID, OPERATOR_ID, {});

    expect(mock.rpcCalls).toContain('next_brc_certificate_number');
    expect(result.certificate_number).toBe(`BRC-${YEAR}-000042`);
  });

  it('gives two concurrent issuances different folios (nextval is atomic)', async () => {
    // Both issuances see the same (empty) brc_certificates table, which is
    // exactly the race the old max()+1 derivation lost. The sequence does not.
    const mock = makeSupabase(readyForBrc(), [
      `BRC-${YEAR}-000010`,
      `BRC-${YEAR}-000011`,
    ]);
    const service = makeService(mock);

    const [first, second] = await Promise.all([
      service.issueBrc(EXP_ID, OPERATOR_ID, {}),
      service.issueBrc(EXP_ID, OPERATOR_ID, {}),
    ]);

    expect(first.certificate_number).not.toBe(second.certificate_number);
    expect(
      [first.certificate_number, second.certificate_number].sort(),
    ).toEqual([`BRC-${YEAR}-000010`, `BRC-${YEAR}-000011`]);
  });

  it('falls back to derived numbering when the function is not deployed', async () => {
    const mock = makeSupabase(
      readyForBrc({
        brc_certificates: {
          select: { data: [{ certificate_number: `BRC-${YEAR}-000004` }] },
          insert: { data: { id: 'new-cert-id' } },
        },
      }),
      [null],
    );
    const service = makeService(mock);
    const result = await service.issueBrc(EXP_ID, OPERATOR_ID, {});
    expect(mock.rpcCalls).toContain('next_brc_certificate_number');
    expect(result.certificate_number).toBe(`BRC-${YEAR}-000005`);
  });

  it('ignores a malformed value coming back from the function', async () => {
    const mock = makeSupabase(readyForBrc(), ['not-a-folio']);
    const service = makeService(mock);
    const result = await service.issueBrc(EXP_ID, OPERATOR_ID, {});
    expect(result.certificate_number).toBe(`BRC-${YEAR}-000001`);
  });

  it('retries when the number is taken concurrently, then gives up with 409', async () => {
    const uniqueViolation = { error: { code: '23505', message: 'duplicate key' } };
    const mock = makeSupabase(
      readyForBrc({
        brc_certificates: {
          select: { data: [] },
          insert: [uniqueViolation, uniqueViolation, uniqueViolation, uniqueViolation, uniqueViolation],
        },
      }),
    );
    const service = makeService(mock);
    await expect(service.issueBrc(EXP_ID, OPERATOR_ID, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    const attempts = mock.insertCalls.filter((c) => c.table === 'brc_certificates');
    expect(attempts).toHaveLength(5);
  });

  it('succeeds on the retry after one collision', async () => {
    const mock = makeSupabase(
      readyForBrc({
        brc_certificates: {
          select: { data: [] },
          insert: [
            { error: { code: '23505', message: 'duplicate key' } },
            { data: { id: 'new-cert-id' } },
          ],
        },
      }),
    );
    const service = makeService(mock);
    const result = await service.issueBrc(EXP_ID, OPERATOR_ID, {});
    expect(result.certificate_id).toBe('new-cert-id');
  });

  it('stamps the listing: property CERTIFICADO with the certificate attached', async () => {
    const mock = makeSupabase(readyForBrc());
    const service = makeService(mock);
    await service.issueBrc(EXP_ID, OPERATOR_ID, {});

    const expUpdate = mock.updateCalls.find((c) => c.table === 'brc_expedientes');
    expect(expUpdate?.payload).toEqual({ status: 'CERTIFICADO' });

    const propUpdate = mock.updateCalls.find((c) => c.table === 'properties');
    expect(propUpdate?.payload).toMatchObject({
      brc_status: 'CERTIFICADO',
      brc_certificate_id: 'new-cert-id',
    });

    const log = mock.insertCalls.find((c) => c.table === 'brc_expediente_logs');
    expect(log?.payload).toMatchObject({
      action: 'CERTIFICADO_EMITIDO',
      old_status: 'PENDIENTE_EMISION_BRC',
      new_status: 'CERTIFICADO',
    });

    const notif = mock.insertCalls.find((c) => c.table === 'notifications');
    expect(notif?.payload).toMatchObject({ recipient_id: REQUESTER_ID });
  });

  it('fills the public verification QR with the new certificate id', async () => {
    const mock = makeSupabase(readyForBrc());
    const service = makeService(mock);
    await service.issueBrc(EXP_ID, OPERATOR_ID, {});

    const qrUpdate = mock.updateCalls.find(
      (c) =>
        c.table === 'brc_certificates' &&
        (c.payload as Record<string, unknown>).qr_code_url !== undefined,
    );
    expect((qrUpdate?.payload as { qr_code_url: string }).qr_code_url).toContain(
      '/verify/new-cert-id',
    );
  });

  it('gives the certificate an expiry so public verification can report it', async () => {
    const mock = makeSupabase(readyForBrc());
    const service = makeService(mock);
    await service.issueBrc(EXP_ID, OPERATOR_ID, {});

    const insert = mock.insertCalls.find((c) => c.table === 'brc_certificates');
    const payload = insert?.payload as { issued_at: string; expires_at: string };
    const days =
      (new Date(payload.expires_at).getTime() - new Date(payload.issued_at).getTime()) /
      86_400_000;
    expect(Math.round(days)).toBe(90);
  });
});

/* ------------------------------------------------------------------ */

describe('BrcService.rejectExpediente', () => {
  it('sets the expediente and the property to RECHAZADO and notifies the requester', async () => {
    const mock = makeSupabase({
      brc_expedientes: { data: baseExpediente },
    });
    const service = makeService(mock);
    const result = await service.rejectExpediente(EXP_ID, NOTARY_ID, {
      reason: 'Documentación inconsistente',
    });
    expect(result).toEqual({ id: EXP_ID, status: 'RECHAZADO' });

    const expUpdate = mock.updateCalls.find((c) => c.table === 'brc_expedientes');
    expect(expUpdate?.payload).toEqual({ status: 'RECHAZADO' });

    const propUpdate = mock.updateCalls.find((c) => c.table === 'properties');
    expect(propUpdate?.payload).toEqual({ brc_status: 'RECHAZADO' });

    const notif = mock.insertCalls.find((c) => c.table === 'notifications');
    expect(notif?.payload).toMatchObject({ recipient_id: REQUESTER_ID });
  });
});
