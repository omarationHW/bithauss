/* ------------------------------------------------------------------ */
/*  Property field matrix — web re-export                              */
/*                                                                     */
/*  The table itself lives in @bithauss/validators                     */
/*  (packages/validators/src/property-fields.ts) so the Zod schema,    */
/*  the NestJS DTOs and these forms all validate against ONE           */
/*  transcription of the client's "DATOS DEL INMUEBLE × TIPO DE        */
/*  PROPIEDAD" image. Duplicating it here is what let the alta and     */
/*  edición forms drift apart in the first place.                      */
/*                                                                     */
/*  This module exists only so app code can keep importing from        */
/*  "@/lib/property-fields" instead of reaching into the package.      */
/* ------------------------------------------------------------------ */

export {
  PROPERTY_TYPES,
  PROPERTY_FIELD_KEYS,
  PROPERTY_FIELD_META,
  PROPERTY_FIELD_MATRIX,
  getFieldRequirement,
  isFieldVisible,
  isFieldRequired,
  getVisibleFields,
  getRequiredFields,
  getPropertyFieldLabel,
  parseFieldNumber,
  validatePropertyFields,
} from "@bithauss/validators";

export type {
  PropertyTypeValue,
  PropertyFieldKey,
  PropertyFieldKind,
  PropertyFieldMeta,
  PropertyFieldRequirement,
  PropertyFieldValueMap,
  PropertyFieldError,
} from "@bithauss/validators";
