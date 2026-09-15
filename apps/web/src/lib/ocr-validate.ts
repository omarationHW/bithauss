/**
 * Runs a document through the OCR validation endpoint and normalizes the
 * response into the shape `brc_documents` stores.
 *
 * Shared so every upload path produces the same OCR payload. The corrected
 * file uploaded after a rejection used to skip validation entirely, which left
 * the notary reviewing a document with no OCR analysis next to it while the
 * original had one.
 */
import { createClient } from "@/lib/supabase/client";

export interface OcrStandaloneCheckRaw {
  rule: string;
  label: string;
  status: string;
  message: string;
}

export interface OcrValidationResult {
  valid: boolean;
  confidence: string;
  message: string;
  detectedType: string;
  extractedData: Record<string, unknown>;
  standaloneChecks?: OcrStandaloneCheckRaw[];
}

/** Columns of `brc_documents` that carry the OCR outcome. */
export interface OcrColumns {
  ocr_detected_type: string | null;
  ocr_confidence: string | null;
  ocr_valid: boolean | null;
  ocr_extracted_data: Record<string, unknown> | null;
  ocr_validated_at: string | null;
  ocr_standalone_checks:
    | { label: string; passed: boolean; detail: string }[]
    | null;
}

/**
 * Validates `file` against the expected `documentName`.
 *
 * Returns null when the OCR service is unreachable or errors: the upload must
 * still go through — a human reviews it either way — so OCR is best-effort.
 */
/** Debe coincidir con OCR_MAX_FILE_BYTES en apps/api/src/modules/ocr/ocr.controller.ts. */
export const OCR_MAX_FILE_MB = 30;

/**
 * Convierte la respuesta de error del endpoint /ocr/validate en un mensaje
 * legible para el usuario. El archivo se acepta igual para revisión manual;
 * lo importante es que sepa POR QUÉ no se validó automáticamente.
 */
export function describeOcrFailure(
  status: number,
  body: unknown,
  file: { size: number },
): string {
  const raw =
    body && typeof body === "object" && "message" in body
      ? String((body as { message: unknown }).message ?? "")
      : "";
  const mb = (file.size / (1024 * 1024)).toFixed(1);
  if (/file size|expected size/i.test(raw) || status === 413) {
    return `El archivo pesa ${mb} MB y el máximo para validación automática es ${OCR_MAX_FILE_MB} MB. Se aceptó para revisión manual.`;
  }
  if (/expected type|magic|mime|formato/i.test(raw)) {
    return "El archivo no es un PDF, JPG o PNG válido. Se aceptó para revisión manual.";
  }
  if (status === 401 || status === 403) {
    return "Tu sesión no permite validar en automático. Se aceptó para revisión manual.";
  }
  if (status === 429) {
    return "Demasiadas validaciones seguidas; espera un minuto. Se aceptó para revisión manual.";
  }
  if (raw && raw.length < 160) {
    return `No se pudo validar automáticamente (${raw}). Se aceptó para revisión manual.`;
  }
  return "No se pudo validar automáticamente. Se aceptó para revisión manual.";
}

export async function runOcrValidation(
  file: File,
  documentName: string,
): Promise<OcrValidationResult | null> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentName", documentName);

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    const res = await fetch(`${apiBase}/api/v1/ocr/validate`, {
      method: "POST",
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
      body: formData,
    });

    if (!res.ok) return null;
    return (await res.json()) as OcrValidationResult;
  } catch {
    return null;
  }
}

/** Maps an OCR result onto the `brc_documents` columns. */
export function ocrColumns(result: OcrValidationResult | null): OcrColumns {
  if (!result) {
    return {
      ocr_detected_type: null,
      ocr_confidence: null,
      ocr_valid: null,
      ocr_extracted_data: null,
      ocr_validated_at: null,
      ocr_standalone_checks: null,
    };
  }

  const checks =
    Array.isArray(result.standaloneChecks) && result.standaloneChecks.length > 0
      ? result.standaloneChecks.map((c) => ({
          label: c.label,
          passed: c.status === "pass",
          detail: c.message,
        }))
      : null;

  return {
    ocr_detected_type: result.detectedType ?? null,
    ocr_confidence: result.confidence ?? null,
    ocr_valid: result.valid ?? null,
    ocr_extracted_data: result.extractedData ?? null,
    ocr_validated_at: new Date().toISOString(),
    ocr_standalone_checks: checks,
  };
}
