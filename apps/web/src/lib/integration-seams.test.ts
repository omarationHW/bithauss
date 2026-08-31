import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { BrcStatus } from "@bithauss/types";

import {
  ALL_BRC_STATUSES,
  BRC_STATUS,
  BRC_STATUS_BADGE_STYLES,
  BRC_STATUS_LABELS,
  BRC_STATUS_SHORT_LABELS,
  isBrcInProgress,
  isTerminalBrcStatus,
} from "./brc-notarial";

/**
 * QA de integración — costuras F y H.
 *
 * Ningún módulo por separado puede ver estos fallos: cada agente probó su
 * propio `switch`, y el estado que falta sólo se nota cuando el expediente lo
 * alcanza en producción y la pantalla se queda en blanco.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");

function readRepoFile(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

/* ------------------------------------------------------------------ */
/*  F · PENDIENTE_EMISION_BRC y el resto del enum                      */
/* ------------------------------------------------------------------ */

/** Every value of the Postgres `brc_status` enum, read from the migrations. */
function postgresBrcStatuses(): string[] {
  const initial = readRepoFile("packages/supabase/migrations/001_initial_schema.sql");
  const block = /create type brc_status as enum \(([^)]*)\)/.exec(initial);
  expect(block, "001 ya no declara el enum brc_status").toBeTruthy();
  const values = [...block![1]!.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]!);

  // Later migrations append values one at a time (018, 024).
  for (const file of [
    "packages/supabase/migrations/018_brc_expediente_borrador.sql",
    "packages/supabase/migrations/024_notarial_module.sql",
  ]) {
    for (const [, value] of readRepoFile(file).matchAll(
      /alter type brc_status add value if not exists '([A-Z_]+)'/g,
    )) {
      values.push(value!);
    }
  }
  return values;
}

describe("costura F · coherencia del estado PENDIENTE_EMISION_BRC", () => {
  const pgStatuses = postgresBrcStatuses();

  it("el enum de Postgres incluye PENDIENTE_EMISION_BRC (migración 024)", () => {
    expect(pgStatuses).toContain("PENDIENTE_EMISION_BRC");
    expect(pgStatuses).toContain("BORRADOR");
  });

  it("BRC_STATUS cubre exactamente el enum de Postgres", () => {
    expect(Object.values(BRC_STATUS).sort()).toEqual([...pgStatuses].sort());
    expect([...ALL_BRC_STATUSES].sort()).toEqual([...pgStatuses].sort());
  });

  it("el enum de TypeScript compartido no se quedó atrás", () => {
    // `BrcStatus` de @bithauss/types no declara BORRADOR (es un estado del
    // expediente, no de la propiedad); todo lo demás debe estar.
    for (const status of pgStatuses) {
      if (status === "BORRADOR") continue;
      expect(Object.values(BrcStatus)).toContain(status);
    }
  });

  it("todo estado tiene etiqueta larga, etiqueta corta y estilo de badge", () => {
    // Un Record incompleto no falla: devuelve undefined y la insignia
    // desaparece en silencio. Eso es exactamente lo que pasaba con
    // PENDIENTE_EMISION_BRC en la lista de propiedades.
    for (const status of ALL_BRC_STATUSES) {
      expect(BRC_STATUS_LABELS[status], `falta etiqueta de ${status}`).toBeTruthy();
      expect(
        BRC_STATUS_SHORT_LABELS[status],
        `falta etiqueta corta de ${status}`,
      ).toBeTruthy();
      if (status === "NO_SOLICITADO") continue; // no se dibuja insignia
      expect(
        BRC_STATUS_BADGE_STYLES[status],
        `falta estilo de badge de ${status}`,
      ).toBeTruthy();
    }
  });

  it("isBrcInProgress cubre los cuatro estados intermedios y sólo ésos", () => {
    expect(isBrcInProgress("EN_REVISION")).toBe(true);
    expect(isBrcInProgress("DOCUMENTACION_PENDIENTE")).toBe(true);
    expect(isBrcInProgress("VALIDACION_NOTARIAL")).toBe(true);
    expect(isBrcInProgress("PENDIENTE_EMISION_BRC")).toBe(true);

    expect(isBrcInProgress("NO_SOLICITADO")).toBe(false);
    expect(isBrcInProgress("BORRADOR")).toBe(false);
    expect(isBrcInProgress("CERTIFICADO")).toBe(false);
    expect(isBrcInProgress("RECHAZADO")).toBe(false);
    expect(isBrcInProgress(null)).toBe(false);
  });

  it("cada estado es exactamente uno de: sin solicitar, en curso o terminal", () => {
    for (const status of ALL_BRC_STATUSES) {
      const buckets = [
        status === "NO_SOLICITADO" || status === "BORRADOR",
        isBrcInProgress(status),
        isTerminalBrcStatus(status),
      ].filter(Boolean);
      expect(buckets, `${status} no cae en ninguna categoría`).toHaveLength(1);
    }
  });

  it("las pantallas que pintan estados leen los mapas compartidos", () => {
    // La lista de propiedades y el panel de asignaciones tenían cada uno su
    // propia tabla de estados; la de asignaciones ni siquiera coincidía con el
    // enum (SOLICITADO / EN_PROCESO / PENDIENTE_FIRMA no existen en Postgres).
    for (const file of [
      "apps/web/src/app/dashboard/propiedades/page.tsx",
      "apps/web/src/app/dashboard/admin/asignaciones/page.tsx",
    ]) {
      const source = readRepoFile(file);
      expect(source, `${file} ya no lee lib/brc-notarial`).toContain(
        '"@/lib/brc-notarial"',
      );
      // Como VALORES (no en un comentario que explique por qué se fueron).
      expect(source).not.toMatch(/["']PENDIENTE_FIRMA["']/);
      expect(source).not.toMatch(/["']EN_PROCESO["']/);
      expect(source).not.toMatch(/["']SOLICITADO["']/);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  H · fotos y videos comparten property_media                        */
/* ------------------------------------------------------------------ */

describe("costura H · ninguna consulta de fotos arrastra videos", () => {
  it("el re-sellado de marca de agua sólo toca filas IMAGE", () => {
    // Este flujo descarga cada `url`, la re-renderiza como PNG y escribe el
    // resultado de vuelta en property_media.url. Sin el filtro, sobrescribía
    // el video de la propiedad con una imagen.
    const source = readRepoFile("apps/web/src/app/dashboard/configuracion/page.tsx");
    const queries = [
      ...source.matchAll(/\.from\("property_media"\)([\s\S]{0,400}?);/g),
    ].map((m) => m[1]!);

    expect(queries.length).toBeGreaterThan(0);
    for (const query of queries) {
      // `update` writes a row already selected by id; only the READS need the
      // type filter.
      if (query.includes(".update(")) continue;
      expect(query, `consulta de fotos sin filtro de media_type:\n${query}`).toContain(
        '.eq("media_type", "IMAGE")',
      );
    }
  });

  it("la portada del expediente se toma de las fotos, no de la primera fila", () => {
    const source = readRepoFile(
      "apps/web/src/app/dashboard/expedientes/[id]/page.tsx",
    );
    expect(source).toContain("const propertyPhotos = property.property_media.filter");
    expect(source).toContain("const heroImage = propertyPhotos[0]?.url ?? null;");
    expect(source).not.toContain("property.property_media[0]?.url");
  });

  it("el editor borra y reinserta cada tipo por separado", () => {
    // Un delete sin `media_type` borraría los videos al guardar las fotos.
    const source = readRepoFile(
      "apps/web/src/app/dashboard/propiedades/[id]/editar/page.tsx",
    );
    const deletes = [
      ...source.matchAll(/\.from\("property_media"\)\s*\.delete\(\)([\s\S]{0,200}?);/g),
    ].map((m) => m[1]!);

    expect(deletes).toHaveLength(2);
    expect(deletes.some((d) => d.includes('.eq("media_type", "IMAGE")'))).toBe(true);
    expect(deletes.some((d) => d.includes('.eq("media_type", "VIDEO")'))).toBe(true);
  });
});
