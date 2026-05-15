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
      'Extrae en JSON con TODOS estos campos (usa null si no aparece): ' +
      'tipoDocumento (si es escritura pon "Escritura de Propiedad", si no indica qué es), ' +
      'numeroEscritura, volumen, fechaEscritura, ' +
      'nombreNotario, numeroNotaria, ciudadNotaria (ciudad donde el notario tiene su sede), ' +
      'nombreComprador (nombre completo del adquirente principal), curpComprador, rfcComprador, ' +
      'estadoCivilComprador (responde exactamente "soltero" o "casado" o null), ' +
      'regimenMatrimonial (responde exactamente "sociedad conyugal" o "separacion de bienes" o null), ' +
      'copropietarios (array de strings con los nombres de los demás compradores si hay varios, si solo hay uno deja []), ' +
      'nombreVendedor, ' +
      'direccionInmueble (string ÚNICO con calle, número, colonia, código postal — NUNCA un objeto), ' +
      'ciudadInmueble (ciudad/municipio/delegación donde se ubica físicamente el inmueble — string), ' +
      'estadoInmueble (entidad federativa, ej: "Ciudad de México", "Jalisco"), ' +
      'tipoInmueble ("casa" | "departamento" | "terreno" | "local" | "otro"), ' +
      'folioReal (referenciado en la escritura), cuentaPredial (referenciada), cuentaAgua (referenciada), ' +
      'precioVenta (número en pesos, sin símbolos), valorCatastralEnEscritura (número si lo menciona, si no null), ' +
      'metrosCuadradosTerreno (número, m² del terreno asociado a la unidad — para departamentos suele ser indiviso o nulo), ' +
      'metrosCuadradosConstruccion (número, m² construidos de la unidad), ' +
      'pagoAPlazos (boolean: true SOLO si menciona explícitamente pago a plazos o crédito hipotecario sin liquidar), ' +
      'reservaDominio (boolean: true SOLO si menciona explícitamente reserva de dominio), ' +
      'escrituraAntecedente (número o referencia de la escritura previa de origen mencionada en antecedentes, o null).',
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
      'Extrae en JSON: tipoDocumento (si es boleta predial pon "Boleta Predial", si no indica qué es), ' +
      'cuentaPredial, nombrePropietario, direccionInmueble, ciudadInmueble, ' +
      'superficieTerreno (m² como número), superficieConstruccion (m² como número), ' +
      'valorCatastral (número), valorComercial (número, si se menciona, si no null), ' +
      'montoPagado (número), periodo, fechaEmision (formato YYYY-MM-DD si es posible), fechaPago.',
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
      'Extrae en JSON: ' +
      'tipoDocumento (si es identificación pon "Identificación Oficial", si no indica qué es), ' +
      'nombreCompleto, ' +
      'curp (18 caracteres alfanuméricos — búscalo aunque no esté etiquetado como "CURP"), ' +
      'claveElector, seccion, ' +
      'vigencia (puede ser "2024", "2014 - 2024", "vigencia hasta 2030", o una fecha completa — extrae el rango o fecha tal como aparece), ' +
      'fechaNacimiento, domicilio (string ÚNICO completo, NUNCA un objeto), numeroDocumento.',
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
  /** Per-document standalone checks (CURP format, age of boleta, etc.). */
  standaloneChecks?: Array<{
    rule: string;
    label: string;
    status: 'pass' | 'fail' | 'warn' | 'skip';
    message: string;
  }>;
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

      // Step 2b: Regex post-processing for high-format-confidence fields the
      // model sometimes misses (CURP/RFC have strict patterns).
      this.regexFallback(extractedText, structured);

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

      // Run per-type standalone checks (CURP format, boleta age, INE vigencia, etc.)
      const standaloneChecks = this.runStandaloneChecks(documentSlug, structured);

      return {
        valid,
        confidence,
        detectedType: displayType,
        expectedType: config.expectedType,
        extractedData: displayData,
        message,
        standaloneChecks,
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

  /* ---- Regex fallback for strict-format fields (CURP, RFC) ---- */
  // CURP: 18 chars: AAAA######H/MAAAAA[A-Z0-9]\d  (homoclave = 2 chars: 1 alphanumeric + 1 digit)
  // Persona física RFC: 13 chars: AAAA######AAA  (homoclave = 3 alphanumeric)
  // Both extracted from the raw DocIntelligence text — strip whitespace and dashes first.
  private regexFallback(rawText: string, structured: Record<string, unknown>) {
    const flat = rawText
      .toUpperCase()
      .replace(/[\s\-_]+/g, '')
      .replace(/[^A-Z0-9ÑÁÉÍÓÚÜ\n]/g, ' ');

    const curpRegex = /[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/g;
    const curps = [...flat.matchAll(curpRegex)].map((m) => m[0]);
    if (curps.length > 0) {
      // Pick the most common (in case OCR repeated it) — usually all the same.
      const counts = curps.reduce<Record<string, number>>((acc, c) => {
        acc[c] = (acc[c] ?? 0) + 1;
        return acc;
      }, {});
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (best) {
        // Only set if the LLM didn't already extract a valid-looking CURP.
        const llmCurp = String(structured.curp ?? '').toUpperCase().replace(/[\s\-_]/g, '');
        if (!curpRegex.test(llmCurp)) {
          curpRegex.lastIndex = 0;
          structured.curp = best;
        } else {
          curpRegex.lastIndex = 0;
        }
      }
    }

    // RFC (persona física) — only attempt extraction; do NOT run this on INE-only flows
    // because INE never has RFC. Other docs (escritura, comprobantes fiscales) often do.
    if (structured.rfc !== undefined || structured.rfcComprador !== undefined) {
      const rfcRegex = /\b[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}\b/g;
      const rfcs = [...rawText.toUpperCase().matchAll(rfcRegex)].map((m) => m[0]);
      // Filter out matches that look like CURPs (CURP is 18 chars; RFC is 13).
      const valid = rfcs.filter((r) => r.length === 13);
      if (valid.length > 0) {
        const counts = valid.reduce<Record<string, number>>((acc, c) => {
          acc[c] = (acc[c] ?? 0) + 1;
          return acc;
        }, {});
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (best) {
          const targetKey = structured.rfcComprador !== undefined ? 'rfcComprador' : 'rfc';
          const currentRfc = String(structured[targetKey] ?? '').toUpperCase().replace(/[\s\-_]/g, '');
          if (!/^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/.test(currentRfc)) {
            structured[targetKey] = best;
          }
        }
      }
    }
  }

  /* ---- Per-doc standalone checks ---- */
  // Each doc type may have a few rules that can be evaluated in isolation
  // (no other documents required). E.g. INE vigencia, boleta age, CURP format.
  private runStandaloneChecks(
    slug: string,
    structured: Record<string, unknown>,
  ): NonNullable<OcrValidationResult['standaloneChecks']> {
    const out: NonNullable<OcrValidationResult['standaloneChecks']> = [];
    const today = Date.now();
    const threeMonthsMs = 1000 * 60 * 60 * 24 * 92;

    const ageCheck = (
      rawDate: unknown,
      label: string,
      rule: string,
    ): NonNullable<OcrValidationResult['standaloneChecks']>[0] => {
      const value = typeof rawDate === 'string' ? rawDate : null;
      if (!value) return { rule, label, status: 'skip', message: 'No se encontró fecha en el documento.' };
      const d = parseFlexibleDate(value);
      if (!d) return { rule, label, status: 'skip', message: `No fue posible interpretar la fecha "${value}".` };
      const ageMs = today - d.getTime();
      const ageDays = Math.round(ageMs / (1000 * 60 * 60 * 24));
      if (ageMs < 0) return { rule, label, status: 'warn', message: `Fecha futura (${d.toISOString().slice(0, 10)}).` };
      if (ageMs <= threeMonthsMs) return { rule, label, status: 'pass', message: `${ageDays} día(s) de antigüedad (límite 92).` };
      return { rule, label, status: 'fail', message: `Fecha ${d.toISOString().slice(0, 10)} (${ageDays} días). Excede 3 meses.` };
    };

    if (slug === 'identificacion_propietario') {
      // CURP format
      const curpRaw = String(structured.curp ?? '').toUpperCase().replace(/[\s-]/g, '');
      if (curpRaw) {
        const valid = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(curpRaw);
        out.push({
          rule: 'curp_formato',
          label: 'CURP tiene formato válido (18 caracteres)',
          status: valid ? 'pass' : 'fail',
          message: valid ? `CURP: ${curpRaw}` : `CURP "${curpRaw}" no cumple el formato oficial.`,
        });
      } else {
        out.push({
          rule: 'curp_formato',
          label: 'CURP tiene formato válido (18 caracteres)',
          status: 'skip',
          message: 'No se encontró CURP en la identificación.',
        });
      }
      // Vigencia
      const vig = structured.vigencia;
      if (typeof vig === 'string' && vig) {
        const d = parseFlexibleDate(vig);
        if (!d) {
          out.push({ rule: 'ine_vigencia', label: 'INE vigente', status: 'skip', message: `Vigencia "${vig}" no interpretable.` });
        } else if (d.getTime() < today) {
          out.push({ rule: 'ine_vigencia', label: 'INE vigente', status: 'fail', message: `Vencida desde ${d.toISOString().slice(0, 10)}.` });
        } else {
          const daysLeft = Math.round((d.getTime() - today) / (1000 * 60 * 60 * 24));
          if (daysLeft < 60) {
            out.push({ rule: 'ine_vigencia', label: 'INE vigente', status: 'warn', message: `Vence en ${daysLeft} día(s).` });
          } else {
            out.push({ rule: 'ine_vigencia', label: 'INE vigente', status: 'pass', message: `Vigente hasta ${d.toISOString().slice(0, 10)} (${daysLeft} días).` });
          }
        }
      } else {
        out.push({ rule: 'ine_vigencia', label: 'INE vigente', status: 'skip', message: 'No se encontró vigencia.' });
      }
    }

    if (slug === 'ultima_boleta_predial') {
      out.push(
        ageCheck(
          (structured as { fechaEmision?: string }).fechaEmision ??
            (structured as { fechaPago?: string }).fechaPago ??
            (structured as { periodo?: string }).periodo,
          'Boleta predial no mayor a 3 meses',
          'antiguedad_boleta_predial',
        ),
      );
    }

    if (slug === 'ultima_boleta_agua') {
      out.push(
        ageCheck(
          (structured as { fechaPago?: string }).fechaPago ??
            (structured as { periodo?: string }).periodo,
          'Boleta de agua no mayor a 3 meses',
          'antiguedad_boleta_agua',
        ),
      );
    }

    return out;
  }

  /* ---- Cross-check: Escritura de Propiedad against supporting docs ---- */
  crossCheckEscritura(payload: EscrituraCrossCheckInput): EscrituraCrossCheckResult {
    const checks: EscrituraCheck[] = [];
    const e = payload.escritura ?? {};
    const ine = payload.identificacion ?? null;
    const acta = payload.actaMatrimonio ?? null;
    const folio = payload.folioReal ?? null;
    const libertad = payload.certificadoLibertadGravamen ?? null;
    const predial = payload.boletaPredial ?? null;
    const agua = payload.boletaAgua ?? null;
    const antecedente = payload.escrituraAntecedente ?? null;

    const todayMs = Date.now();
    const threeMonthsMs = 1000 * 60 * 60 * 24 * 92;

    /* 1. Ciudad de la notaría = ciudad del inmueble */
    push(checks, 'ciudad_notaria_inmueble', 'La ciudad de la Notaría coincide con la del inmueble',
      e.ciudadNotaria && e.ciudadInmueble
        ? citiesMatch(e.ciudadNotaria, e.ciudadInmueble)
          ? pass(`"${coerceText(e.ciudadNotaria)}" ≈ "${coerceText(e.ciudadInmueble)}" (misma ciudad).`)
          : fail(`Notaría: "${coerceText(e.ciudadNotaria)}" ≠ Inmueble: "${coerceText(e.ciudadInmueble)}".`)
        : skip('La escritura no especifica ambas ciudades.'),
    );

    /* 2. Nombre del comprador en escritura = INE/Pasaporte */
    push(checks, 'nombre_comprador_ine', 'El nombre del propietario coincide con la identificación oficial',
      ine && e.nombreComprador && ine.nombreCompleto
        ? namesMatch(e.nombreComprador, ine.nombreCompleto)
          ? pass(`"${e.nombreComprador}" coincide con la identificación.`)
          : fail(`Escritura: "${e.nombreComprador}" ≠ ID: "${ine.nombreCompleto}".`)
        : skip('Falta identificación oficial o nombre del propietario.'),
    );

    /* 3. Si hay copropietarios, deben proveerse identificaciones y actas */
    push(checks, 'copropietarios_documentos', 'Identificaciones y actas de todos los copropietarios',
      Array.isArray(e.copropietarios) && e.copropietarios.length > 0
        ? warn(`Hay ${e.copropietarios.length} copropietario(s) adicional(es): ${e.copropietarios.join(', ')}. Verifica que cada uno tenga su identificación y acta de matrimonio adjuntas.`)
        : Array.isArray(e.copropietarios)
          ? pass('No hay copropietarios adicionales.')
          : skip('La escritura no especifica si hay copropietarios.'),
    );

    /* 4. CURP del propietario consistente entre escritura e INE
       (RFC no se valida aquí porque la INE no incluye RFC.) */
    push(checks, 'curp_consistente', 'CURP del propietario coincide entre escritura e INE',
      checkCurp(e, ine),
    );

    /* 5. Estado civil declarado en la escritura */
    push(checks, 'estado_civil_declarado', 'La escritura declara el estado civil del propietario',
      e.estadoCivilComprador
        ? e.estadoCivilComprador === 'casado'
          ? pass(`Casado bajo régimen de "${e.regimenMatrimonial ?? 'no especificado'}".`)
          : pass(`Estado civil: "${e.estadoCivilComprador}".`)
        : skip('La escritura no menciona estado civil del propietario.'),
    );

    /* 6. Si está casado: nombre del propietario aparece en el acta de matrimonio */
    push(checks, 'nombre_comprador_acta', 'El nombre del propietario coincide con el acta de matrimonio',
      e.estadoCivilComprador === 'casado'
        ? acta && e.nombreComprador
          ? namesMatch(e.nombreComprador, acta.contrayente1) || namesMatch(e.nombreComprador, acta.contrayente2)
            ? pass(`"${e.nombreComprador}" aparece como contrayente en el acta.`)
            : fail(`"${e.nombreComprador}" no coincide con los contrayentes (${acta.contrayente1} / ${acta.contrayente2}).`)
          : skip('Falta acta de matrimonio.')
        : skip('No aplica (propietario no casado).'),
    );

    /* 7. Folio Real consistente entre escritura, RPP y libertad de gravamen */
    push(checks, 'folio_real_consistente', 'El Folio Real es el mismo en escritura, RPP y libertad de gravamen',
      checkFolioReal(e, folio, libertad),
    );

    /* 8. Cuenta predial en escritura = boleta predial */
    push(checks, 'cuenta_predial_consistente', 'La cuenta predial coincide entre escritura y boleta predial',
      e.cuentaPredial && predial?.cuentaPredial
        ? cuentasPredialMatch(e.cuentaPredial, predial.cuentaPredial)
          ? pass(`Cuenta ${e.cuentaPredial} ≈ ${predial.cuentaPredial}.`)
          : fail(`Escritura: "${e.cuentaPredial}" ≠ Boleta: "${predial.cuentaPredial}".`)
        : skip('Falta cuenta predial en escritura o boleta.'),
    );

    /* 9. Domicilio del inmueble = boleta predial */
    push(checks, 'domicilio_predial', 'Domicilio del inmueble coincide con la boleta predial',
      e.direccionInmueble && predial?.direccionInmueble
        ? addressesMatch(e.direccionInmueble, predial.direccionInmueble)
          ? pass(`Direcciones coinciden.`)
          : fail(`Escritura: "${coerceText(e.direccionInmueble)}" ≠ Predial: "${coerceText(predial.direccionInmueble)}".`)
        : skip('Falta domicilio en escritura o boleta predial.'),
    );

    /* 10. Precio > valor catastral y comercial */
    push(checks, 'precio_mayor_valor_catastral', 'El precio de venta es mayor a los valores catastrales y comerciales',
      checkPrecioVsValores(e, predial),
    );

    /* 11. Cuenta agua en escritura = boleta agua */
    push(checks, 'cuenta_agua_consistente', 'El número de cuenta de agua coincide entre escritura y boleta',
      e.cuentaAgua && agua?.numeroCuenta
        ? cuentaAguaMatch(e.cuentaAgua, agua.numeroCuenta)
          ? pass(`Cuenta ${e.cuentaAgua} ≈ ${agua.numeroCuenta}.`)
          : fail(`Escritura: "${e.cuentaAgua}" ≠ Boleta: "${agua.numeroCuenta}".`)
        : skip('Falta cuenta de agua en escritura o boleta.'),
    );

    /* 12. Domicilio del inmueble = boleta agua */
    push(checks, 'domicilio_agua', 'Domicilio del inmueble coincide con la boleta de agua',
      e.direccionInmueble && agua?.direccion
        ? addressesMatch(e.direccionInmueble, agua.direccion)
          ? pass(`Direcciones coinciden.`)
          : fail(`Escritura: "${coerceText(e.direccionInmueble)}" ≠ Agua: "${coerceText(agua.direccion)}".`)
        : skip('Falta domicilio en escritura o boleta de agua.'),
    );

    /* 13. m² terreno y construcción consistentes */
    push(checks, 'metros_cuadrados_consistentes', 'Los metros cuadrados de terreno y construcción coinciden con la boleta predial',
      checkMetrosCuadrados(e, predial),
    );

    /* 14. No tiene "Pago a Plazos" ni "Reserva de Dominio" */
    push(checks, 'sin_gravamenes_compraventa', 'La escritura no tiene pago a plazos ni reserva de dominio',
      e.pagoAPlazos === true
        ? fail('La escritura indica pago a plazos.')
        : e.reservaDominio === true
          ? fail('La escritura indica reserva de dominio.')
          : e.pagoAPlazos === false && e.reservaDominio === false
            ? pass('Sin pago a plazos ni reserva de dominio.')
            : skip('No fue posible determinar si tiene pago a plazos o reserva de dominio.'),
    );

    /* 15. Escritura antecedente: vendedor, dirección y m² coinciden */
    push(checks, 'escritura_antecedente_consistente', 'Datos de la escritura antecedente coinciden',
      checkAntecedente(e, antecedente),
    );

    /* 16. Boleta predial no mayor a 3 meses */
    push(checks, 'antiguedad_boleta_predial', 'La boleta predial no tiene más de 3 meses',
      checkBoletaAntiguedad(predial?.fechaEmision ?? predial?.fechaPago ?? predial?.periodo, todayMs, threeMonthsMs, 'predial'),
    );

    /* 17. Boleta agua no mayor a 3 meses */
    push(checks, 'antiguedad_boleta_agua', 'La boleta de agua no tiene más de 3 meses',
      checkBoletaAntiguedad(agua?.fechaPago ?? agua?.periodo, todayMs, threeMonthsMs, 'agua'),
    );

    /* 18. INE vigente */
    push(checks, 'ine_vigente', 'La identificación oficial está vigente',
      checkIneVigente(ine, todayMs),
    );

    const summary = checks.reduce(
      (acc, c) => {
        acc[c.status]++;
        return acc;
      },
      { pass: 0, fail: 0, warn: 0, skip: 0 },
    );

    return { checks, summary };
  }
}

/* ------------------------------------------------------------------ */
/*  Cross-check helpers                                                */
/* ------------------------------------------------------------------ */

interface EscrituraData {
  ciudadNotaria?: string | null;
  ciudadInmueble?: string | null;
  nombreComprador?: string | null;
  curpComprador?: string | null;
  rfcComprador?: string | null;
  estadoCivilComprador?: string | null;
  regimenMatrimonial?: string | null;
  copropietarios?: string[] | null;
  nombreVendedor?: string | null;
  direccionInmueble?: string | Record<string, unknown> | null;
  tipoInmueble?: string | null;
  folioReal?: string | null;
  cuentaPredial?: string | null;
  cuentaAgua?: string | null;
  precioVenta?: number | null;
  valorCatastralEnEscritura?: number | null;
  metrosCuadradosTerreno?: number | null;
  metrosCuadradosConstruccion?: number | null;
  pagoAPlazos?: boolean | null;
  reservaDominio?: boolean | null;
  escrituraAntecedente?: string | null;
}

interface IneData {
  nombreCompleto?: string | null;
  curp?: string | null;
  vigencia?: string | null;
}

interface ActaData {
  contrayente1?: string | null;
  contrayente2?: string | null;
  regimenMatrimonial?: string | null;
}

interface FolioRealData {
  folioReal?: string | null;
}

interface BoletaPredialData {
  cuentaPredial?: string | null;
  direccionInmueble?: string | null;
  superficieTerreno?: number | null;
  superficieConstruccion?: number | null;
  valorCatastral?: number | null;
  valorComercial?: number | null;
  fechaEmision?: string | null;
  fechaPago?: string | null;
  periodo?: string | null;
}

interface BoletaAguaData {
  numeroCuenta?: string | null;
  direccion?: string | null;
  fechaPago?: string | null;
  periodo?: string | null;
}

interface AntecedenteData {
  nombreVendedor?: string | null;
  direccionInmueble?: string | null;
  metrosCuadradosTerreno?: number | null;
  metrosCuadradosConstruccion?: number | null;
}

export interface EscrituraCrossCheckInput {
  escritura: EscrituraData;
  identificacion?: IneData | null;
  actaMatrimonio?: ActaData | null;
  folioReal?: FolioRealData | null;
  certificadoLibertadGravamen?: FolioRealData | null;
  boletaPredial?: BoletaPredialData | null;
  boletaAgua?: BoletaAguaData | null;
  escrituraAntecedente?: AntecedenteData | null;
}

export interface EscrituraCheck {
  rule: string;
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
}

export interface EscrituraCrossCheckResult {
  checks: EscrituraCheck[];
  summary: { pass: number; fail: number; warn: number; skip: number };
}

type CheckOutcome = { status: 'pass' | 'fail' | 'warn' | 'skip'; message: string };

function pass(message: string): CheckOutcome { return { status: 'pass', message }; }
function fail(message: string): CheckOutcome { return { status: 'fail', message }; }
function warn(message: string): CheckOutcome { return { status: 'warn', message }; }
function skip(message: string): CheckOutcome { return { status: 'skip', message }; }

function push(arr: EscrituraCheck[], rule: string, label: string, outcome: CheckOutcome) {
  arr.push({ rule, label, ...outcome });
}

export function coerceText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(coerceText).filter(Boolean).join(' ');
  if (typeof v === 'object') {
    return Object.values(v as Record<string, unknown>)
      .map(coerceText)
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

export function normalizeStr(s?: unknown): string {
  return coerceText(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* CDMX y sus 16 alcaldías comparten ciudad. Si ambos lados caen en este set, consideramos misma ciudad. */
const CDMX_SYNONYMS = new Set([
  'cdmx',
  'ciudad de mexico',
  'distrito federal',
  'df',
  'mexico df',
  'mexico distrito federal',
  // alcaldías / delegaciones
  'alvaro obregon',
  'azcapotzalco',
  'benito juarez',
  'coyoacan',
  'cuajimalpa',
  'cuajimalpa de morelos',
  'cuauhtemoc',
  'gustavo a madero',
  'iztacalco',
  'iztapalapa',
  'la magdalena contreras',
  'magdalena contreras',
  'miguel hidalgo',
  'milpa alta',
  'tlahuac',
  'tlalpan',
  'venustiano carranza',
  'xochimilco',
  // prefijos comunes
  'delegacion benito juarez',
  'delegacion coyoacan',
  'delegacion cuauhtemoc',
  'delegacion miguel hidalgo',
  'delegacion alvaro obregon',
]);

export function citiesMatch(a?: unknown, b?: unknown): boolean {
  const na = normalizeStr(a).replace(/^delegacion\s+/, '').replace(/^alcaldia\s+/, '').trim();
  const nb = normalizeStr(b).replace(/^delegacion\s+/, '').replace(/^alcaldia\s+/, '').trim();
  if (!na || !nb) return false;
  if (na === nb) return true;
  // both inside CDMX synonyms set → same city
  const aIsCdmx = CDMX_SYNONYMS.has(na) || na.includes('mexico') || na.includes('distrito federal');
  const bIsCdmx = CDMX_SYNONYMS.has(nb) || nb.includes('mexico') || nb.includes('distrito federal');
  if (aIsCdmx && bIsCdmx) return true;
  // partial inclusion (e.g., "guadalajara, jalisco" vs "guadalajara")
  return na.includes(nb) || nb.includes(na);
}

export function namesMatch(a?: unknown, b?: unknown): boolean {
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wa = na.split(' ').filter(Boolean);
  const wb = nb.split(' ').filter(Boolean);
  if (wa.length === 0 || wb.length === 0) return false;
  return wa.every((w) => wb.includes(w)) || wb.every((w) => wa.includes(w));
}

export function addressesMatch(a?: unknown, b?: unknown): boolean {
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wa = new Set(na.split(' ').filter((w) => w.length > 1));
  const wb = new Set(nb.split(' ').filter((w) => w.length > 1));
  if (wa.size === 0 || wb.size === 0) return false;
  let intersection = 0;
  for (const w of wa) if (wb.has(w)) intersection++;
  return intersection / Math.max(wa.size, wb.size) >= 0.4;
}

/**
 * Compares two cuenta predial strings. CDMX/MX format is typically AAA-AAA-AA-AAA-Y
 * where the last digit is a check digit. We strip non-digits and:
 *   - exact-match the full digit string, OR
 *   - match the first 11 digits (excluding the check digit), OR
 *   - match the first 9 digits (account body without verifier/sub-account)
 * Tolerant to extra zeros, different segment counts, and missing check digits.
 */
export function cuentasPredialMatch(a?: unknown, b?: unknown): boolean {
  const da = String(a ?? '').replace(/\D/g, '');
  const db = String(b ?? '').replace(/\D/g, '');
  if (!da || !db) return false;
  if (da === db) return true;
  // Compare leading digits (drop trailing check digit if one side has it)
  const minLen = Math.min(da.length, db.length);
  if (minLen >= 9) {
    if (da.slice(0, minLen) === db.slice(0, minLen)) return true;
    if (minLen >= 11 && da.slice(0, 11) === db.slice(0, 11)) return true;
    if (da.slice(0, 9) === db.slice(0, 9)) return true;
  }
  return false;
}

/** Cuenta agua: tolerant numeric match, ignores separators like ':' '-' '/' '.' */
export function cuentaAguaMatch(a?: unknown, b?: unknown): boolean {
  const da = String(a ?? '').replace(/\D/g, '');
  const db = String(b ?? '').replace(/\D/g, '');
  if (!da || !db) return false;
  if (da === db) return true;
  const minLen = Math.min(da.length, db.length);
  return minLen >= 10 && da.slice(0, minLen) === db.slice(0, minLen);
}

function checkCurp(e: EscrituraData, ine: IneData | null): CheckOutcome {
  if (!ine) return skip('Falta identificación oficial.');
  const curpE = normalizeStr(e.curpComprador).toUpperCase();
  const curpI = normalizeStr(ine.curp).toUpperCase();

  if (!curpE && !curpI) return skip('No se encontró CURP en escritura ni en INE.');
  if (!curpE) return skip('La escritura no incluye CURP.');
  if (!curpI) return skip('La INE no incluye CURP legible.');

  if (curpE === curpI) return pass(`CURP coincide: ${e.curpComprador}.`);
  return fail(`CURP escritura "${e.curpComprador}" ≠ INE "${ine.curp}".`);
}

function checkFolioReal(
  e: EscrituraData,
  folio: FolioRealData | null,
  libertad: FolioRealData | null,
): CheckOutcome {
  const values = [e.folioReal, folio?.folioReal, libertad?.folioReal]
    .filter((v): v is string => Boolean(v))
    .map(normalizeStr);

  if (values.length < 2) return skip('Se necesita el folio real en al menos 2 documentos para comparar.');

  const allMatch = values.every((v) => v === values[0]);
  if (allMatch) return pass(`Folio Real consistente: "${e.folioReal ?? folio?.folioReal ?? libertad?.folioReal}".`);

  const labels: string[] = [];
  if (e.folioReal) labels.push(`Escritura: "${e.folioReal}"`);
  if (folio?.folioReal) labels.push(`RPP: "${folio.folioReal}"`);
  if (libertad?.folioReal) labels.push(`Libertad de Gravamen: "${libertad.folioReal}"`);
  return fail(labels.join(' | '));
}

function checkPrecioVsValores(e: EscrituraData, predial: BoletaPredialData | null): CheckOutcome {
  const precio = e.precioVenta;
  if (typeof precio !== 'number' || precio <= 0) return skip('No se encontró precio de venta en la escritura.');

  const valores: { label: string; valor: number }[] = [];
  if (predial?.valorCatastral && predial.valorCatastral > 0) valores.push({ label: 'catastral (boleta predial)', valor: predial.valorCatastral });
  if (predial?.valorComercial && predial.valorComercial > 0) valores.push({ label: 'comercial (boleta predial)', valor: predial.valorComercial });
  if (e.valorCatastralEnEscritura && e.valorCatastralEnEscritura > 0) valores.push({ label: 'catastral (escritura)', valor: e.valorCatastralEnEscritura });

  if (valores.length === 0) return skip('No se encontraron valores catastrales o comerciales para comparar.');

  const failures = valores.filter((v) => precio <= v.valor);
  if (failures.length > 0) {
    return fail(`Precio $${precio.toLocaleString()} no es mayor a: ${failures.map((f) => `${f.label} $${f.valor.toLocaleString()}`).join(', ')}.`);
  }
  return pass(`Precio $${precio.toLocaleString()} es mayor a todos los valores comparados.`);
}

function checkMetrosCuadrados(e: EscrituraData, predial: BoletaPredialData | null): CheckOutcome {
  if (!predial) return skip('Falta boleta predial.');
  const issues: string[] = [];
  const passes: string[] = [];
  const skipReasons: string[] = [];
  const isApartment = normalizeStr(e.tipoInmueble) === 'departamento';

  const compare = (a?: number | null, b?: number | null, label?: string) => {
    if (typeof a !== 'number' || typeof b !== 'number') return;
    const tolerance = Math.max(1, a * 0.05); // 5% o 1 m² mínimo (más laxo para errores de OCR)
    if (Math.abs(a - b) <= tolerance) passes.push(`${label}: ${a} m² ≈ ${b} m²`);
    else issues.push(`${label}: escritura ${a} m² ≠ predial ${b} m²`);
  };

  // m² construcción: SIEMPRE comparable (es la unidad)
  compare(e.metrosCuadradosConstruccion, predial.superficieConstruccion, 'Construcción');

  if (isApartment) {
    // Para departamentos, el terreno de la escritura suele ser del edificio entero
    // o el indiviso. El de la boleta es el del condominio. No tiene sentido comparar.
    skipReasons.push('Departamento: m² de terreno no se comparan (escritura suele tener el del edificio entero).');
  } else {
    compare(e.metrosCuadradosTerreno, predial.superficieTerreno, 'Terreno');
  }

  if (passes.length === 0 && issues.length === 0 && skipReasons.length === 0) {
    return skip('No se encontraron metros cuadrados para comparar.');
  }
  if (issues.length > 0) return fail(issues.join(' | '));
  const msg = [...passes, ...skipReasons].join(' | ');
  return pass(msg);
}

function checkAntecedente(e: EscrituraData, ant: AntecedenteData | null): CheckOutcome {
  if (!e.escrituraAntecedente) return skip('La escritura no menciona escritura antecedente.');
  if (!ant) return warn(`La escritura referencia la antecedente "${e.escrituraAntecedente}". Súbela para validarla.`);

  const issues: string[] = [];
  const okSet: string[] = [];
  if (e.nombreVendedor && ant.nombreVendedor) {
    if (namesMatch(e.nombreVendedor, ant.nombreVendedor)) okSet.push('vendedor');
    else issues.push(`Vendedor: "${e.nombreVendedor}" ≠ antecedente "${ant.nombreVendedor}"`);
  }
  if (e.direccionInmueble && ant.direccionInmueble) {
    if (addressesMatch(e.direccionInmueble, ant.direccionInmueble)) okSet.push('dirección');
    else issues.push(`Dirección: "${e.direccionInmueble}" ≠ "${ant.direccionInmueble}"`);
  }
  if (typeof e.metrosCuadradosTerreno === 'number' && typeof ant.metrosCuadradosTerreno === 'number') {
    if (Math.abs(e.metrosCuadradosTerreno - ant.metrosCuadradosTerreno) <= 0.5) okSet.push('m² terreno');
    else issues.push(`m² terreno: ${e.metrosCuadradosTerreno} ≠ ${ant.metrosCuadradosTerreno}`);
  }
  if (typeof e.metrosCuadradosConstruccion === 'number' && typeof ant.metrosCuadradosConstruccion === 'number') {
    if (Math.abs(e.metrosCuadradosConstruccion - ant.metrosCuadradosConstruccion) <= 0.5) okSet.push('m² construcción');
    else issues.push(`m² construcción: ${e.metrosCuadradosConstruccion} ≠ ${ant.metrosCuadradosConstruccion}`);
  }
  if (issues.length > 0) return fail(issues.join(' | '));
  if (okSet.length === 0) return skip('No hay campos comparables entre la escritura y la antecedente.');
  return pass(`Coinciden: ${okSet.join(', ')}.`);
}

export function parseFlexibleDate(value?: string | null): Date | null {
  if (!value) return null;
  const v = value.trim();
  // ISO yyyy-mm-dd
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  // dd/mm/yyyy or dd-mm-yyyy
  const num = v.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (num && num[1] && num[2] && num[3]) {
    const day = Number(num[1]);
    const month = Number(num[2]);
    const yearRaw = num[3];
    const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }
  // dd-MMM-yyyy spanish: 18-SEP-2024
  const months: Record<string, number> = { ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AGO: 7, SEP: 8, OCT: 9, NOV: 10, DIC: 11 };
  const sp = v.match(/^(\d{1,2})[-/]([A-Za-zÁÉÍÓÚáéíóú]+)[-/](\d{2,4})/);
  if (sp && sp[1] && sp[2] && sp[3]) {
    const month = months[sp[2].toUpperCase().substring(0, 3)];
    if (month != null) {
      const yearRaw = sp[3];
      const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
      const d = new Date(year, month, Number(sp[1]));
      return isNaN(d.getTime()) ? null : d;
    }
  }
  // mm/yyyy or m/yyyy (period like "4/2024") — interpret as last day of that month
  const mY = v.match(/^(\d{1,2})\/(\d{4})$/);
  if (mY && mY[1] && mY[2]) {
    const d = new Date(Number(mY[2]), Number(mY[1]), 0); // last day of month
    return isNaN(d.getTime()) ? null : d;
  }
  // Year range like "2014 - 2024" or "2014-2024" → take last year as Dec 31
  const range = v.match(/(\d{4})\s*[-–—]\s*(\d{4})/);
  if (range && range[2]) {
    return new Date(Number(range[2]), 11, 31);
  }
  // "vigencia 2030", "vigencia hasta 2030", "hasta 2030"
  const phraseYear = v.match(/(?:vigencia\s*(?:hasta\s*)?|hasta\s*)(\d{4})/i);
  if (phraseYear && phraseYear[1]) {
    return new Date(Number(phraseYear[1]), 11, 31);
  }
  // Just a year
  const onlyYear = v.match(/^(\d{4})$/);
  if (onlyYear && onlyYear[1]) {
    return new Date(Number(onlyYear[1]), 11, 31);
  }
  // Last fallback: any 4-digit year in the string, take the largest one
  const allYears = [...v.matchAll(/(\d{4})/g)].map((m) => Number(m[1])).filter((y) => y > 1900 && y < 2100);
  if (allYears.length > 0) {
    const lastYear = Math.max(...allYears);
    return new Date(lastYear, 11, 31);
  }
  return null;
}

function checkBoletaAntiguedad(
  rawDate: string | null | undefined,
  todayMs: number,
  threeMonthsMs: number,
  kind: 'predial' | 'agua',
): CheckOutcome {
  if (!rawDate) return skip(`No se encontró fecha en la boleta de ${kind}.`);
  const d = parseFlexibleDate(rawDate);
  if (!d) return skip(`No fue posible interpretar la fecha "${rawDate}" en la boleta de ${kind}.`);
  const ageMs = todayMs - d.getTime();
  const ageDays = Math.round(ageMs / (1000 * 60 * 60 * 24));
  if (ageMs < 0) return warn(`Fecha futura (${d.toISOString().slice(0, 10)}) en la boleta de ${kind}. Verifica.`);
  if (ageMs <= threeMonthsMs) return pass(`Boleta de ${kind} con ${ageDays} día(s) de antigüedad (límite 92).`);
  return fail(`Boleta de ${kind} de ${d.toISOString().slice(0, 10)} (${ageDays} días). Excede 3 meses.`);
}

function checkIneVigente(ine: IneData | null, todayMs: number): CheckOutcome {
  if (!ine) return skip('Falta identificación oficial.');
  const raw = ine.vigencia;
  if (!raw) return skip('La identificación no muestra fecha de vigencia.');
  const d = parseFlexibleDate(raw);
  if (!d) return skip(`No fue posible interpretar la vigencia "${raw}".`);
  if (d.getTime() < todayMs) return fail(`Vencida desde ${d.toISOString().slice(0, 10)}.`);
  const daysRemaining = Math.round((d.getTime() - todayMs) / (1000 * 60 * 60 * 24));
  if (daysRemaining < 60) return warn(`Vence en ${daysRemaining} día(s) (${d.toISOString().slice(0, 10)}).`);
  return pass(`Vigente hasta ${d.toISOString().slice(0, 10)} (${daysRemaining} días).`);
}
