import { BrcService } from './brc.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

/* ------------------------------------------------------------------ */
/*  Supabase mock builder                                              */
/*  Builds a chainable mock that returns canned data per table.        */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown> | null;

interface TableResponses {
  [table: string]: { data?: Row | Row[]; error?: unknown };
}

interface MockSupabase {
  from: jest.Mock;
  insertCalls: { table: string; payload: unknown }[];
  updateCalls: { table: string; payload: unknown }[];
}

function makeSupabase(tables: TableResponses): MockSupabase {
  const insertCalls: { table: string; payload: unknown }[] = [];
  const updateCalls: { table: string; payload: unknown }[] = [];

  const from = jest.fn((table: string) => {
    const canned = tables[table] ?? { data: null };
    const chain: Record<string, unknown> = {};
    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.order = jest.fn(() => chain);
    chain.maybeSingle = jest.fn(() => Promise.resolve(canned));
    chain.single = jest.fn(() => Promise.resolve(canned));
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(canned).then(resolve);
    chain.insert = jest.fn((payload: unknown) => {
      insertCalls.push({ table, payload });
      // Some inserts then call .select().single() — keep chain alive
      const insertChain: Record<string, unknown> = {};
      insertChain.select = jest.fn(() => insertChain);
      insertChain.single = jest.fn(() => Promise.resolve(canned));
      insertChain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve);
      return insertChain;
    });
    chain.update = jest.fn((payload: unknown) => {
      updateCalls.push({ table, payload });
      const updateChain: Record<string, unknown> = {};
      updateChain.eq = jest.fn(() => Promise.resolve({ data: null, error: null }));
      return updateChain;
    });
    return chain;
  });

  return { from, insertCalls, updateCalls };
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
const REQUESTER_ID = 'requester-1';
const EXP_ID = 'exp-1';
const PROP_ID = 'prop-1';
const DOC_ID = 'doc-1';

const baseExpediente = {
  id: EXP_ID,
  requested_by: REQUESTER_ID,
  assigned_notary_id: NOTARY_ID,
  assigned_operator_id: null,
  status: 'EN_REVISION',
  property_id: PROP_ID,
};

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
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

describe('BrcService.certifyExpediente', () => {
  const validDto = {
    certificate_number: 'BRC-2026-000001',
    observations: 'Todo en regla',
    pdf_url: undefined,
  };

  it('throws BadRequest when there are no required documents at all', async () => {
    const mock = makeSupabase({
      brc_expedientes: { data: baseExpediente },
      brc_documents: { data: [] }, // no docs
    });
    const service = makeService(mock);
    await expect(
      service.certifyExpediente(EXP_ID, NOTARY_ID, validDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequest when at least one required doc is not VALIDADO/APROBADO', async () => {
    const mock = makeSupabase({
      brc_expedientes: { data: baseExpediente },
      brc_documents: {
        data: [
          { id: 'd1', status: 'VALIDADO', brc_document_types: { is_required: true } },
          { id: 'd2', status: 'PENDIENTE', brc_document_types: { is_required: true } },
        ],
      },
    });
    const service = makeService(mock);
    await expect(
      service.certifyExpediente(EXP_ID, NOTARY_ID, validDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('issues the certificate when all required docs are VALIDADO/APROBADO', async () => {
    const mock = makeSupabase({
      brc_expedientes: { data: baseExpediente },
      brc_documents: {
        data: [
          { id: 'd1', status: 'VALIDADO', brc_document_types: { is_required: true } },
          { id: 'd2', status: 'APROBADO', brc_document_types: { is_required: true } },
          { id: 'd3', status: 'PENDIENTE', brc_document_types: { is_required: false } },
        ],
      },
      brc_certificates: { data: { id: 'new-cert-id' } },
    });
    const service = makeService(mock);
    const result = await service.certifyExpediente(EXP_ID, NOTARY_ID, validDto);

    expect(result).toEqual({
      certificate_id: 'new-cert-id',
      certificate_number: 'BRC-2026-000001',
    });

    // Verify the side-effect chain happened
    const certInsert = mock.insertCalls.find((c) => c.table === 'brc_certificates');
    expect(certInsert?.payload).toMatchObject({
      certificate_number: 'BRC-2026-000001',
      property_id: PROP_ID,
      issued_by: NOTARY_ID,
    });

    const expedienteUpdate = mock.updateCalls.find((c) => c.table === 'brc_expedientes');
    expect(expedienteUpdate?.payload).toEqual({ status: 'CERTIFICADO' });

    const propertyUpdate = mock.updateCalls.find((c) => c.table === 'properties');
    expect(propertyUpdate?.payload).toMatchObject({
      brc_status: 'CERTIFICADO',
      brc_certificate_id: 'new-cert-id',
    });

    const log = mock.insertCalls.find(
      (c) => c.table === 'brc_expediente_logs',
    );
    expect(log?.payload).toMatchObject({
      action: 'CERTIFICADO_EMITIDO',
      new_status: 'CERTIFICADO',
    });

    const notif = mock.insertCalls.find((c) => c.table === 'notifications');
    expect(notif?.payload).toMatchObject({ recipient_id: REQUESTER_ID });
  });
});

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
