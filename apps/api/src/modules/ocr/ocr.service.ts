import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/* ------------------------------------------------------------------ */
/*  Document type prompts for structured extraction                    */
/* ------------------------------------------------------------------ */

const DOCUMENT_PROMPTS: Record<string, { expectedType: string; prompt: string }> = {
  escritura_propiedad: {
    expectedType: 'Escritura de Propiedad',
    prompt:
      'Verifica si este texto corresponde a una ESCRITURA PÚBLICA DE PROPIEDAD de un inmueble en México. ' +
      'Extrae en JSON: tipoDocumento (si es escritura pon "Escritura de Propiedad", si no indica qué es), numeroEscritura, volumen, nombreNotario, numeroNotaria, nombrePropietario, direccionInmueble, fechaEscritura, ciudad, estado.',
  },
  folio_real: {
    expectedType: 'Folio Real',
    prompt:
      'Verifica si este texto corresponde a un FOLIO REAL o CONSTANCIA DE INSCRIPCIÓN del Registro Público de la Propiedad en México. ' +
      'Extrae en JSON: tipoDocumento (si es folio real pon "Folio Real", si no indica qué es), folioReal, nombrePropietario, descripcionInmueble, fechaInscripcion, registroPublico.',
  },
  resolucion_judicial: {
    expectedType: 'Resolución Judicial',
    prompt:
      'Verifica si este texto corresponde a una RESOLUCIÓN JUDICIAL o SENTENCIA de un juzgado en México. ' +
      'Extrae en JSON: tipoDocumento (si es resolución judicial pon "Resolución Judicial", si no indica qué es), juzgado, numeroExpediente, tipoJuicio, juez, actor, demandado, fechaResolucion.',
  },
  ultima_boleta_predial: {
    expectedType: 'Boleta Predial',
    prompt:
      'Verifica si este texto corresponde a una BOLETA DE PAGO DE IMPUESTO PREDIAL de un inmueble en México. ' +
      'Extrae en JSON: tipoDocumento (si es boleta predial pon "Boleta Predial", si no indica qué es), cuentaPredial, nombrePropietario, direccionInmueble, superficieTerreno, superficieConstruccion, valorCatastral, montoPagado, periodo, fechaPago.',
  },
  ultima_boleta_agua: {
    expectedType: 'Boleta de Agua',
    prompt:
      'Verifica si este texto corresponde a una BOLETA o RECIBO DE PAGO DE SERVICIO DE AGUA POTABLE en México. Puede ser de SACMEX, SIAPA, CEAS, COMAPA, JAPAC u otro organismo. ' +
      'Extrae en JSON: tipoDocumento (si es boleta de agua pon "Boleta de Agua", si no indica qué es), numeroCuenta, nombreTitular, direccion, consumoM3, montoPagado, periodo, fechaPago, organismoOperador.',
  },
  uso_de_suelo: {
    expectedType: 'Constancia de Uso de Suelo',
    prompt:
      'Verifica si este texto corresponde a una CONSTANCIA DE USO DE SUELO o CERTIFICADO DE ZONIFICACIÓN en México. ' +
      'Extrae en JSON: tipoDocumento (si es constancia de uso de suelo pon "Constancia de Uso de Suelo", si no indica qué es), usoAutorizado, direccionInmueble, autoridadEmisora, folio, vigencia, superficie, zonificacion, fechaEmision.',
  },
  no_adeudo_mantenimiento: {
    expectedType: 'Constancia de No Adeudo',
    prompt:
      'Verifica si este texto corresponde a una CONSTANCIA DE NO ADEUDO DE CUOTAS DE MANTENIMIENTO de un condominio en México. ' +
      'Extrae en JSON: tipoDocumento (si es constancia de no adeudo pon "Constancia de No Adeudo", si no indica qué es), nombreCondominio, unidad, nombrePropietario, cuotaMensual, periodoVerificado, administrador, fechaEmision, estatusAdeudo.',
  },
  regimen_condominio: {
    expectedType: 'Escritura de Régimen en Condominio',
    prompt:
      'Verifica si este texto corresponde a una ESCRITURA DE RÉGIMEN DE PROPIEDAD EN CONDOMINIO en México. ' +
      'Extrae en JSON: tipoDocumento (si es escritura de régimen en condominio pon "Escritura de Régimen en Condominio", si no indica qué es), nombreCondominio, numeroEscritura, nombreNotario, numeroNotaria, ubicacion, fechaEscritura, numeroUnidades.',
  },
  identificacion_propietario: {
    expectedType: 'Identificación Oficial',
    prompt:
      'Verifica si este texto corresponde a una IDENTIFICACIÓN OFICIAL de México (INE, IFE o Pasaporte). ' +
      'Extrae en JSON: tipoDocumento (si es identificación pon "Identificación Oficial", si no indica qué es), nombreCompleto, curp, claveElector, seccion, vigencia, fechaNacimiento, domicilio, numeroDocumento.',
  },
  acta_matrimonio: {
    expectedType: 'Acta de Matrimonio',
    prompt:
      'Verifica si este texto corresponde a un ACTA DE MATRIMONIO emitida por el Registro Civil en México. ' +
      'Extrae en JSON: tipoDocumento (si es acta de matrimonio pon "Acta de Matrimonio", si no indica qué es), contrayente1, contrayente2, actaNumero, oficialia, entidad, regimenMatrimonial, fechaMatrimonio, testigos (como array de strings).',
  },
  comprobante_domicilio: {
    expectedType: 'Comprobante de Domicilio',
    prompt:
      'Verifica si este texto corresponde a un COMPROBANTE DE DOMICILIO en México (recibo de luz CFE, gas, teléfono, internet, etc.). ' +
      'Extrae en JSON: tipoDocumento (si es comprobante de domicilio pon "Comprobante de Domicilio", si no indica qué es), tipoServicio, direccion, nombreTitular, numeroCuenta, periodo, fechaEmision, monto.',
  },
  poder_notarial: {
    expectedType: 'Poder Notarial',
    prompt:
      'Verifica si este texto corresponde a un PODER NOTARIAL para actos de administración o dominio en México. ' +
      'Extrae en JSON: tipoDocumento (si es poder notarial pon "Poder Notarial", si no indica qué es), otorgante, apoderado, tipoPoder, facultades, nombreNotario, numeroNotaria, fechaOtorgamiento.',
  },
};

/* ------------------------------------------------------------------ */
/*  Name-to-slug mapping                                               */
/* ------------------------------------------------------------------ */

const NAME_TO_SLUG: Record<string, string> = {
  'Escritura de Propiedad del Inmueble a Certificar': 'escritura_propiedad',
  'Folio Real del Inmueble (Constancia de Inscripción en el RPP)': 'folio_real',
  'Resolución Judicial': 'resolucion_judicial',
  'Última Boleta Predial del Inmueble': 'ultima_boleta_predial',
  'Última Boleta de Agua del Inmueble': 'ultima_boleta_agua',
  'Constancia de Uso de Suelo autorizado del Inmueble': 'uso_de_suelo',
  'Constancia de No Adeudo de Cuotas de Mantenimiento': 'no_adeudo_mantenimiento',
  'Escritura de Régimen de Propiedad en Condominio': 'regimen_condominio',
  'Identificación del Propietario': 'identificacion_propietario',
  'Acta de Matrimonio del Propietario': 'acta_matrimonio',
  'Comprobante de Domicilio con la dirección del Inmueble': 'comprobante_domicilio',
  'Poder Notarial para actos de Administración': 'poder_notarial',
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OcrValidationResult {
  valid: boolean;
  confidence: 'high' | 'medium' | 'low';
  detectedType: string;
  expectedType: string;
  extractedData: Record<string, unknown>;
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  // Azure Document Intelligence
  private readonly docIntelligenceEndpoint: string;
  private readonly docIntelligenceKey: string;

  // Azure OpenAI
  private readonly openaiEndpoint: string;
  private readonly openaiKey: string;
  private readonly openaiDeployment: string;

  constructor(private configService: ConfigService) {
    this.docIntelligenceEndpoint = this.configService.get<string>('AZURE_DOC_INTELLIGENCE_ENDPOINT') ?? '';
    this.docIntelligenceKey = this.configService.get<string>('AZURE_DOC_INTELLIGENCE_KEY') ?? '';
    this.openaiEndpoint = this.configService.get<string>('AZURE_OPENAI_ENDPOINT') ?? '';
    this.openaiKey = this.configService.get<string>('AZURE_OPENAI_KEY') ?? '';
    this.openaiDeployment = this.configService.get<string>('AZURE_OPENAI_DEPLOYMENT') ?? 'gpt-4.1-mini';
  }

  static nameToSlug(name: string): string | null {
    return NAME_TO_SLUG[name] ?? null;
  }

  /* ---- Main validation method ---- */
  async validateDocument(
    file: Express.Multer.File,
    documentSlug: string,
  ): Promise<OcrValidationResult> {
    const config = DOCUMENT_PROMPTS[documentSlug];

    if (!config) {
      return {
        valid: true,
        confidence: 'low',
        detectedType: 'Desconocido',
        expectedType: documentSlug,
        extractedData: {},
        message: 'Tipo de documento no configurado para validación OCR. Se acepta sin verificación.',
      };
    }

    try {
      // Step 1: Extract text from document using Azure Document Intelligence
      this.logger.log(`Extracting text from document for ${documentSlug}...`);
      const extractedText = await this.extractText(file);

      if (!extractedText || extractedText.trim().length < 10) {
        return {
          valid: true,
          confidence: 'low',
          detectedType: 'No legible',
          expectedType: config.expectedType,
          extractedData: { textoExtraido: extractedText || '' },
          message: 'No se pudo extraer texto suficiente del documento. Se acepta para revisión manual del notario.',
        };
      }

      // Step 2: Send extracted text to Azure OpenAI for structured analysis
      this.logger.log(`Analyzing text with OpenAI for ${documentSlug}...`);
      const structured = await this.analyzeWithOpenAI(extractedText, config.prompt);

      // Step 3: Validate the result
      const detectedType = String(structured.tipoDocumento ?? '').trim();
      const expected = config.expectedType.trim();

      // Count meaningful extracted fields (everything except tipoDocumento)
      const dataFields = Object.entries(structured).filter(
        ([k]) => k !== 'tipoDocumento' && k !== 'tipo_documento',
      );
      const populatedFields = dataFields.filter(([, v]) => {
        if (v == null) return false;
        if (typeof v === 'string' && v.trim() === '') return false;
        if (Array.isArray(v) && v.length === 0) return false;
        if (typeof v === 'object' && v !== null && Object.keys(v).length === 0) return false;
        return true;
      });
      const populationRatio = dataFields.length > 0
        ? populatedFields.length / dataFields.length
        : 0;

      const typeMatches =
        detectedType !== '' &&
        (detectedType.toLowerCase().includes(expected.toLowerCase()) ||
          expected.toLowerCase().includes(detectedType.toLowerCase()));

      let confidence: 'high' | 'medium' | 'low';
      let valid: boolean;

      if (typeMatches && populationRatio >= 0.5) {
        confidence = 'high';
        valid = true;
      } else if (typeMatches && populationRatio >= 0.25) {
        // Type matches but few fields extracted — accept with caution
        confidence = 'medium';
        valid = true;
      } else if (typeMatches) {
        // Claims type match but extracted almost nothing — model is hallucinating the type
        confidence = 'low';
        valid = false;
      } else {
        confidence = 'low';
        valid = false;
      }

      const displayType = valid ? config.expectedType : (detectedType || 'No identificado');

      let message: string;
      if (valid && confidence === 'high') {
        message = `Documento verificado correctamente como "${config.expectedType}".`;
      } else if (valid && confidence === 'medium') {
        message = `Documento aceptado como "${config.expectedType}" pero con datos limitados. Verificar manualmente.`;
      } else if (typeMatches && !valid) {
        message = `El documento se etiquetó como "${config.expectedType}" pero no se encontraron los datos esperados. Probablemente no es del tipo correcto.`;
      } else if (detectedType && !valid) {
        message = `El documento no parece ser "${config.expectedType}". Se detectó: "${detectedType}". Por favor sube el documento correcto.`;
      } else {
        message = `El documento no parece ser "${config.expectedType}". Por favor sube el documento correcto.`;
      }

      // Remove tipoDocumento from displayed data since we show it in the header
      const displayData = { ...structured };
      delete displayData.tipoDocumento;

      return {
        valid,
        confidence,
        detectedType: displayType,
        expectedType: config.expectedType,
        extractedData: displayData,
        message,
      };
    } catch (error) {
      this.logger.error(`OCR validation failed for ${documentSlug}:`, error);
      return {
        valid: true,
        confidence: 'low',
        detectedType: 'Error de procesamiento',
        expectedType: config.expectedType,
        extractedData: {},
        message: 'No se pudo validar el documento automáticamente. Se acepta para revisión manual del notario.',
      };
    }
  }

  /* ---- Step 1: Extract text using Azure Document Intelligence ---- */
  private async extractText(file: Express.Multer.File): Promise<string> {
    const analyzeUrl = `${this.docIntelligenceEndpoint}documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30`;

    // Submit document for analysis
    const submitResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.docIntelligenceKey,
        'Content-Type': file.mimetype || 'application/octet-stream',
      },
      body: file.buffer,
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`Document Intelligence submit failed (${submitResponse.status}): ${errorText}`);
    }

    const operationLocation = submitResponse.headers.get('operation-location');
    if (!operationLocation) {
      throw new Error('No operation-location header from Document Intelligence');
    }

    // Poll until analysis is complete
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const pollResponse = await fetch(operationLocation, {
        headers: { 'Ocp-Apim-Subscription-Key': this.docIntelligenceKey },
      });

      if (!pollResponse.ok) {
        throw new Error(`Document Intelligence poll failed (${pollResponse.status})`);
      }

      const result = await pollResponse.json() as {
        status: string;
        analyzeResult?: { content?: string };
      };

      if (result.status === 'succeeded') {
        return result.analyzeResult?.content ?? '';
      }

      if (result.status === 'failed') {
        throw new Error('Document Intelligence analysis failed');
      }
    }

    throw new Error('Document Intelligence analysis timed out');
  }

  /* ---- Step 2: Analyze text with Azure OpenAI ---- */
  private async analyzeWithOpenAI(text: string, prompt: string): Promise<Record<string, unknown>> {
    const url = `${this.openaiEndpoint}openai/deployments/${this.openaiDeployment}/chat/completions?api-version=2025-01-01-preview`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': this.openaiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content:
              'Eres un asistente de verificación documental inmobiliaria en México para la plataforma BitHauss. ' +
              'Tu tarea es clasificar y extraer datos de documentos con RIGOR. ' +
              'REGLA CRÍTICA: en el campo tipoDocumento debes poner EXACTAMENTE lo que ES el documento, no lo que se espera. ' +
              'Si te preguntan por una "Boleta Predial" pero el documento es una INE, pon tipoDocumento: "INE" — NO "Boleta Predial". ' +
              'Solo pon el tipo esperado en tipoDocumento si el documento REALMENTE coincide. ' +
              'Si los campos solicitados no aparecen en el texto, déjalos como null — nunca inventes valores. ' +
              'Devuelves ÚNICAMENTE JSON válido, sin explicaciones.',
          },
          {
            role: 'user',
            content: `${prompt}\n\n--- TEXTO DEL DOCUMENTO ---\n${text}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? '';

    // Parse JSON from response
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    try {
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      }
      return { tipoDocumento: 'No identificado', textoExtraido: text.substring(0, 500) };
    }
  }
}
