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
