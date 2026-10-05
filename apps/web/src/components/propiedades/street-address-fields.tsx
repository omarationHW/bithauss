"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StreetAddress } from "@/lib/brc-address";

/* ------------------------------------------------------------------ */
/*  Calle / Número exterior / Número interior                          */
/*                                                                     */
/*  Optional to publish, required to request the BRC (migración 040). */
/*  Kept apart so the exterior number can be checked against the      */
/*  escritura instead of being buried in a free-text line.            */
/* ------------------------------------------------------------------ */

export interface StreetAddressFieldsProps {
  value: StreetAddress;
  onChange: (patch: Partial<StreetAddress>) => void;
  /** Free-text address saved before the fields were split, if any. */
  legacyAddress?: string | null;
  idPrefix?: string;
}

export function StreetAddressFields({
  value,
  onChange,
  legacyAddress,
  idPrefix = "dir",
}: StreetAddressFieldsProps) {
  const showLegacy =
    Boolean(legacyAddress?.trim()) &&
    !value.street.trim() &&
    !value.exterior_number.trim();

  return (
    <div className="space-y-2">
      <div className="grid gap-5 sm:grid-cols-[1fr_9rem_9rem]">
        <div>
          <Label htmlFor={`${idPrefix}-calle`} className="mb-1.5 block text-gray-700">
            Calle
          </Label>
          <Input
            id={`${idPrefix}-calle`}
            placeholder="Av. Paseo de la Reforma"
            autoComplete="address-line1"
            value={value.street}
            onChange={(e) => onChange({ street: e.target.value })}
            className="rounded-xl"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-ext`} className="mb-1.5 block text-gray-700">
            Núm. exterior
          </Label>
          <Input
            id={`${idPrefix}-ext`}
            placeholder="222"
            value={value.exterior_number}
            onChange={(e) => onChange({ exterior_number: e.target.value })}
            className="rounded-xl"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-int`} className="mb-1.5 block text-gray-700">
            Núm. interior
          </Label>
          <Input
            id={`${idPrefix}-int`}
            placeholder="Opcional"
            autoComplete="address-line2"
            value={value.interior_number}
            onChange={(e) => onChange({ interior_number: e.target.value })}
            className="rounded-xl"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Uso interno. Opcional para publicar, obligatoria para solicitar el BRC:
        escríbela como aparece en la escritura.
      </p>
      {showLegacy && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Dirección registrada anteriormente: «{legacyAddress}». Sepárala en
          calle y número para poder solicitar el BRC.
        </p>
      )}
    </div>
  );
}
