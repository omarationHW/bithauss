"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COLONIA_OTRA, usePostalLookup, type PostalRecord } from "@/lib/postal";
import {
  MEXICAN_STATES,
  normalizeText,
  useColoniaSearch,
  useColoniaValidity,
  useMunicipios,
} from "@/lib/mx-locations";

/* ------------------------------------------------------------------ */
/*  LocationPicker                                                     */
/*                                                                     */
/*  Estado -> Ciudad/Municipio -> Colonia chained against the SEPOMEX  */
/*  catalog, so a listing can never be filed under an ambiguous or     */
/*  non-existent place ("Polanco" alone means nothing: it exists in    */
/*  several states). The postal-code shortcut still works: typing a    */
/*  C.P. fills the three fields with consistent, catalog-backed data.  */
/*                                                                     */
/*  Values are plain strings and map 1:1 to the DB columns             */
/*  (state / city / neighborhood / zip_code) — nothing changes shape.  */
/* ------------------------------------------------------------------ */

export interface LocationValue {
  estado: string;
  ciudad: string;
  colonia: string;
  codigo_postal: string;
}

export interface LocationStatus {
  /** The ciudad/municipio belongs to the selected state in the catalog. */
  municipioEnCatalogo: boolean;
  /** The colonia belongs to the selected municipio (or is empty). */
  coloniaEnCatalogo: boolean;
  /** The user explicitly chose to type a colonia outside the catalog. */
  coloniaLibre: boolean;
}

export const INITIAL_LOCATION_STATUS: LocationStatus = {
  municipioEnCatalogo: true,
  coloniaEnCatalogo: true,
  coloniaLibre: false,
};

/**
 * Validate a location before saving. Returns a Spanish error message or null.
 * Fails open on catalog/network problems (the status flags default to true)
 * so a temporary outage never blocks a publication.
 */
export function validateLocation(
  value: LocationValue,
  status: LocationStatus
): string | null {
  if (!value.estado) return "Selecciona el estado.";
  if (!value.ciudad.trim()) return "Selecciona la ciudad o municipio.";
  if (!status.municipioEnCatalogo) {
    return "La ciudad o municipio no existe en el catálogo del estado seleccionado. Elígela de la lista.";
  }
  if (value.codigo_postal && !/^\d{5}$/.test(value.codigo_postal)) {
    return "El código postal debe tener 5 dígitos.";
  }
  if (value.colonia.trim() && !status.coloniaLibre && !status.coloniaEnCatalogo) {
    return 'La colonia no existe en el catálogo de esa ciudad. Elígela de la lista o marca "Otra (escribir)".';
  }
  return null;
}

export interface LocationPickerProps {
  value: LocationValue;
  /** Patch update — the parent merges it into its own form state. */
  onChange: (patch: Partial<LocationValue>) => void;
  /** Reported whenever catalog validation changes. */
  onStatusChange?: (status: LocationStatus) => void;
  /** Prefix for field ids so two pickers can coexist. */
  idPrefix?: string;
}

export function LocationPicker({
  value,
  onChange,
  onStatusChange,
  idPrefix = "loc",
}: LocationPickerProps) {
  const { estado, ciudad, colonia, codigo_postal: cp } = value;

  // Free-text escape hatch for colonias missing from SEPOMEX.
  const [coloniaLibre, setColoniaLibre] = useState(false);
  const [coloniaQuery, setColoniaQuery] = useState("");

  // True once the user types in the C.P. field: only then may a resolved
  // record overwrite estado/ciudad/colonia (never on a programmatic fill).
  const cpEditedRef = useRef(false);
  const lastRecordRef = useRef<PostalRecord | null>(null);

  /* ---- Catalog data ---- */

  const {
    municipios,
    loading: loadingMunicipios,
    loaded: municipiosLoaded,
  } = useMunicipios(estado);

  const { colonias: catalogColonias, loading: loadingColonias } =
    useColoniaSearch({
      estado,
      municipio: ciudad,
      q: coloniaQuery,
      limit: 40,
      enabled: Boolean(estado) && Boolean(ciudad) && !coloniaLibre,
    });

  const handlePostalResolve = useCallback(
    (record: PostalRecord | null) => {
      lastRecordRef.current = record;
      if (!record || !cpEditedRef.current) return;
      setColoniaLibre(false);
      const patch: Partial<LocationValue> = {
        // The municipio (alcaldía) is the precise unit; SEPOMEX's `ciudad` is
        // often just the state capital and would be too coarse to filter by.
        ciudad: record.municipio || record.ciudad,
      };
      if ((MEXICAN_STATES as readonly string[]).includes(record.estado)) {
        patch.estado = record.estado;
      }
      if (!record.colonias.includes(colonia)) patch.colonia = "";
      onChange(patch);
    },
    [colonia, onChange]
  );

  const { colonias: cpColonias, loading: loadingCp } = usePostalLookup(
    cp,
    handlePostalResolve
  );

  /* ---- Catalog validation ---- */

  const knownColonias = useMemo(
    () => [...cpColonias, ...catalogColonias.map((c) => c.colonia)],
    [cpColonias, catalogColonias]
  );

  const coloniaValid = useColoniaValidity(estado, ciudad, colonia, knownColonias);

  const municipioEnCatalogo = useMemo(() => {
    if (!ciudad.trim()) return true;
    // Fail open while loading or when the catalog could not be reached.
    if (!estado || !municipiosLoaded || municipios.length === 0) return true;
    const key = normalizeText(ciudad);
    return municipios.some((m) => normalizeText(m.municipio) === key);
  }, [ciudad, estado, municipios, municipiosLoaded]);

  const status = useMemo<LocationStatus>(
    () => ({
      municipioEnCatalogo,
      // `null` = still unknown -> treat as valid (fail open).
      coloniaEnCatalogo: coloniaValid !== false,
      coloniaLibre,
    }),
    [municipioEnCatalogo, coloniaValid, coloniaLibre]
  );

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  /* ---- Options ---- */

  const municipioOptions = useMemo<ComboboxOption[]>(
    () =>
      municipios.map((m) => ({
        value: m.municipio,
        hint:
          m.ciudad && normalizeText(m.ciudad) !== normalizeText(m.municipio)
            ? m.ciudad
            : undefined,
      })),
    [municipios]
  );

  // With a resolved C.P. its own colonias are authoritative; otherwise we
  // offer every colonia of the selected municipio.
  const usingCpList = /^\d{5}$/.test(cp) && cpColonias.length > 0;

  // Filtering happens here (never in the Combobox) so the "Otra (escribir)"
  // escape hatch stays reachable even when nothing else matches.
  const coloniaOptions = useMemo<ComboboxOption[]>(() => {
    const q = normalizeText(coloniaQuery);
    const base: ComboboxOption[] = usingCpList
      ? cpColonias
          .filter((c) => !q || normalizeText(c).includes(q))
          .map((c) => ({ value: c }))
      : catalogColonias.map((c) => ({
          value: c.colonia,
          hint: c.cps.length === 1 ? `C.P. ${c.cps[0]}` : undefined,
        }));
    return [
      ...base,
      { value: COLONIA_OTRA, label: "Otra (escribir)", hint: "Fuera del catálogo" },
    ];
  }, [usingCpList, cpColonias, catalogColonias, coloniaQuery]);

  /* ---- Handlers ---- */

  function handleEstadoChange(next: string) {
    cpEditedRef.current = false;
    setColoniaLibre(false);
    setColoniaQuery("");
    onChange({ estado: next, ciudad: "", colonia: "", codigo_postal: "" });
  }

  function handleMunicipioChange(next: string) {
    setColoniaLibre(false);
    setColoniaQuery("");
    const record = lastRecordRef.current;
    const cpMatches =
      record && normalizeText(record.municipio) === normalizeText(next);
    onChange({
      ciudad: next,
      colonia: "",
      // A C.P. from another municipio would contradict the new selection.
      ...(cpMatches ? {} : { codigo_postal: "" }),
    });
  }

  function handleColoniaChange(next: string) {
    if (next === COLONIA_OTRA) {
      setColoniaLibre(true);
      onChange({ colonia: "" });
      return;
    }
    const match = catalogColonias.find(
      (c) => normalizeText(c.colonia) === normalizeText(next)
    );
    const patch: Partial<LocationValue> = { colonia: next };
    // A colonia with a single postal code fills the C.P. for the user.
    if (!cp && match?.cps.length === 1) patch.codigo_postal = match.cps[0];
    setColoniaQuery("");
    onChange(patch);
  }

  const cpNotFound =
    /^\d{5}$/.test(cp) && !loadingCp && cpColonias.length === 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Estado */}
        <div>
          <Label className="mb-1.5 block text-gray-700">
            Estado <span className="text-red-500">*</span>
          </Label>
          <Select value={estado} onValueChange={handleEstadoChange}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-60 overflow-y-auto">
              {MEXICAN_STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ciudad / Municipio */}
        <div>
          <Label
            htmlFor={`${idPrefix}-municipio`}
            className="mb-1.5 block text-gray-700"
          >
            Ciudad / Municipio <span className="text-red-500">*</span>
          </Label>
          <Combobox
            id={`${idPrefix}-municipio`}
            value={ciudad}
            onChange={handleMunicipioChange}
            options={municipioOptions}
            loading={loadingMunicipios}
            disabled={!estado}
            inputClassName="rounded-xl"
            placeholder={
              estado ? "Busca la ciudad o municipio" : "Elige primero el estado"
            }
            emptyMessage="Ninguna coincidencia en el catálogo"
          />
          {!municipioEnCatalogo && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                &laquo;{ciudad}&raquo; no está en el catálogo de {estado}. Elige
                una opción de la lista.
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Colonia */}
        <div>
          <Label
            htmlFor={`${idPrefix}-colonia`}
            className="mb-1.5 block text-gray-700"
          >
            Colonia
          </Label>
          {coloniaLibre ? (
            <>
              <Input
                id={`${idPrefix}-colonia`}
                placeholder="Nombre de la colonia"
                value={colonia}
                onChange={(e) => onChange({ colonia: e.target.value })}
                className="rounded-xl"
              />
              <button
                type="button"
                onClick={() => {
                  setColoniaLibre(false);
                  setColoniaQuery("");
                  onChange({ colonia: "" });
                }}
                className="mt-1.5 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                Elegir del catálogo
              </button>
            </>
          ) : (
            <>
              <Combobox
                id={`${idPrefix}-colonia`}
                value={colonia}
                onChange={handleColoniaChange}
                options={coloniaOptions}
                onQueryChange={setColoniaQuery}
                filterLocally={false}
                loading={loadingColonias}
                disabled={!ciudad}
                inputClassName="rounded-xl"
                placeholder={
                  ciudad ? "Busca la colonia" : "Elige primero la ciudad"
                }
                emptyMessage="Ninguna colonia coincide"
              />
              {usingCpList && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Mostrando las colonias del C.P. {cp}. Borra el C.P. para ver
                  todas las del municipio.
                </p>
              )}
              {coloniaValid === false && colonia.trim() !== "" && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    &laquo;{colonia}&raquo; no está en el catálogo. Elígela de la
                    lista o usa &laquo;Otra (escribir)&raquo;.
                  </span>
                </p>
              )}
            </>
          )}
        </div>

        {/* Código postal */}
        <div>
          <Label
            htmlFor={`${idPrefix}-cp`}
            className="mb-1.5 block text-gray-700"
          >
            Código postal
          </Label>
          <Input
            id={`${idPrefix}-cp`}
            placeholder="00000"
            inputMode="numeric"
            maxLength={5}
            value={cp}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, "").slice(0, 5);
              cpEditedRef.current = true;
              onChange({ codigo_postal: next });
            }}
            className="rounded-xl"
          />
          {cpNotFound ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>No encontramos ese C.P. Revisa o completa a mano.</span>
            </p>
          ) : usingCpList ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>C.P. validado con el catálogo SEPOMEX.</span>
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-gray-500">
              ¿Ya lo sabes? Escríbelo y completamos estado, ciudad y colonia.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
