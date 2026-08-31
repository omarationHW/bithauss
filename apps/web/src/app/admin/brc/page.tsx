"use client";

/**
 * BitHauss's BRC console — step B of the certification flow.
 *
 * The notary issues the *Certificado Notarial*; BitHauss reads it and issues
 * the *BRC*, which is what tokenises the file and puts the seal on the
 * listing. This screen is where that second act happens, so it has to show
 * the queue of expedientes sitting on PENDIENTE_EMISION_BRC, give access to
 * the notarial certificate behind each one, and issue.
 *
 * It used to render a hard-coded array of ten fake expedientes. That was
 * harmless while nothing could be issued from here; it is not any more.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getSignedDocumentUrl } from "@/lib/private-storage";
import {
  BRC_STATUS,
  BRC_STATUS_BADGE_STYLES,
  BRC_STATUS_SHORT_LABELS,
} from "@/lib/brc-notarial";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  Eye,
  FileText,
  Loader2,
  Scale,
  Stamp,
  TrendingUp,
  X,
} from "lucide-react";
import { ShieldBrc } from "@/components/ui/shield-brc";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProfileLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface NotarialCertificateLite {
  id: string;
  expediente_id: string;
  file_url: string;
  file_name: string;
  observations: string | null;
  issued_at: string;
}

interface AdminExpediente {
  id: string;
  status: string;
  created_at: string;
  property_id: string;
  requested_by: string | null;
  assigned_notary_id: string | null;
  propertyTitle: string;
  propertyLocation: string;
  applicant: string;
  notary: string | null;
  notarialCertificate: NotarialCertificateLite | null;
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

/** Each tab is a set of expediente states, in workflow order. */
const TABS: { key: string; label: string; statuses: string[] | null }[] = [
  { key: "todos", label: "Todos", statuses: null },
  {
    key: "revision",
    label: "En revisión",
    statuses: [BRC_STATUS.EN_REVISION, BRC_STATUS.DOCUMENTACION_PENDIENTE],
  },
  {
    key: "notarial",
    label: "Validación notarial",
    statuses: [BRC_STATUS.VALIDACION_NOTARIAL],
  },
  {
    key: "emision",
    label: "Pendientes de BRC",
    statuses: [BRC_STATUS.PENDIENTE_EMISION_BRC],
  },
  { key: "certificados", label: "Certificados", statuses: [BRC_STATUS.CERTIFICADO] },
  { key: "rechazados", label: "Rechazados", statuses: [BRC_STATUS.RECHAZADO] },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fullName(profile: ProfileLite | undefined): string | null {
  if (!profile) return null;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(status: string) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px]",
        BRC_STATUS_BADGE_STYLES[status] ??
          "bg-gray-100 text-gray-600 border-gray-200",
      )}
    >
      {BRC_STATUS_SHORT_LABELS[status] ?? status}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function BRCExpedientesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState("emision");
  const [loading, setLoading] = useState(true);
  const [expedientes, setExpedientes] = useState<AdminExpediente[]>([]);
  const [openingCertId, setOpeningCertId] = useState<string | null>(null);

  /* Issuance modal */
  const [issuing, setIssuing] = useState<AdminExpediente | null>(null);
  const [issueObservations, setIssueObservations] = useState("");
  const [issuePdf, setIssuePdf] = useState<File | null>(null);
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issuedNumber, setIssuedNumber] = useState<string | null>(null);

  /* ---------------------------------------------------------------- */

  const fetchData = useCallback(async () => {
    const { data: rows } = await supabase
      .from("brc_expedientes")
      .select(
        "id, status, created_at, property_id, requested_by, assigned_notary_id, properties ( title, city, state )",
      )
      .neq("status", "BORRADOR")
      .order("created_at", { ascending: false });

    const list = (rows ?? []) as unknown as (Omit<
      AdminExpediente,
      "propertyTitle" | "propertyLocation" | "applicant" | "notary" | "notarialCertificate"
    > & {
      properties: { title: string; city: string | null; state: string | null } | null;
    })[];

    // Two foreign keys point at `profiles` from the same table, so resolve the
    // names in a second query instead of relying on an ambiguous embed.
    const profileIds = [
      ...new Set(
        list
          .flatMap((e) => [e.requested_by, e.assigned_notary_id])
          .filter((id): id is string => !!id),
      ),
    ];

    const { data: profiles } = profileIds.length
      ? await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", profileIds)
      : { data: [] as ProfileLite[] };

    const profileById = new Map(
      ((profiles ?? []) as ProfileLite[]).map((p) => [p.id, p]),
    );

    const { data: certs } = await supabase
      .from("brc_notarial_certificates")
      .select("id, expediente_id, file_url, file_name, observations, issued_at")
      .is("superseded_at", null);

    const certByExpediente = new Map(
      ((certs ?? []) as NotarialCertificateLite[]).map((c) => [c.expediente_id, c]),
    );

    setExpedientes(
      list.map((e) => ({
        id: e.id,
        status: e.status,
        created_at: e.created_at,
        property_id: e.property_id,
        requested_by: e.requested_by,
        assigned_notary_id: e.assigned_notary_id,
        propertyTitle: e.properties?.title ?? "Propiedad sin título",
        propertyLocation: [e.properties?.city, e.properties?.state]
          .filter(Boolean)
          .join(", "),
        applicant: fullName(profileById.get(e.requested_by ?? "")) ?? "—",
        notary: fullName(profileById.get(e.assigned_notary_id ?? "")),
        notarialCertificate: certByExpediente.get(e.id) ?? null,
      })),
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---------------------------------------------------------------- */

  const counts = useMemo(() => {
    const byTab: Record<string, number> = {};
    for (const tab of TABS) {
      byTab[tab.key] = tab.statuses
        ? expedientes.filter((e) => tab.statuses!.includes(e.status)).length
        : expedientes.length;
    }
    return byTab;
  }, [expedientes]);

  const activeStatuses = TABS.find((t) => t.key === activeTab)?.statuses ?? null;
  const visible = activeStatuses
    ? expedientes.filter((e) => activeStatuses.includes(e.status))
    : expedientes;

  /* ---------------------------------------------------------------- */

  /** `brc-documents` is private: mint a short-lived signed URL on click. */
  async function openNotarialCertificate(exp: AdminExpediente) {
    if (!exp.notarialCertificate) return;
    setOpeningCertId(exp.id);
    try {
      const signed = await getSignedDocumentUrl(
        supabase,
        exp.notarialCertificate.file_url,
      );
      if (!signed) {
        window.alert("No se pudo abrir el Certificado Notarial.");
        return;
      }
      window.open(signed, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningCertId(null);
    }
  }

  function startIssuing(exp: AdminExpediente) {
    setIssuing(exp);
    setIssueObservations("");
    setIssuePdf(null);
    setIssueError(null);
    setIssuedNumber(null);
  }

  /**
   * Step B. The folio is NOT sent: the API derives it, sequentially and
   * checked against collision. Anything the browser proposed would be a
   * guess at the identifier of a legal document.
   */
  async function handleIssueBrc() {
    if (!issuing) return;
    setIssueSubmitting(true);
    setIssueError(null);

    try {
      let pdfUrl: string | undefined;
      if (issuePdf) {
        const path = `certificates/${issuing.id}/brc-${Date.now()}-${issuePdf.name}`;
        const { error: uploadError } = await supabase.storage
          .from("brc-documents")
          .upload(path, issuePdf, { upsert: true });
        if (uploadError) throw new Error(uploadError.message);
        pdfUrl =
          supabase.storage.from("brc-documents").getPublicUrl(path).data
            ?.publicUrl ?? undefined;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(
        `${apiBase}/api/v1/brc/expedientes/${issuing.id}/issue-brc`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            observations: issueObservations.trim() || undefined,
            pdf_url: pdfUrl,
          }),
        },
      );

      const body = (await res.json().catch(() => null)) as
        | { certificate_number?: string; message?: string }
        | null;

      if (!res.ok) {
        throw new Error(body?.message ?? "No se pudo emitir el certificado BRC.");
      }

      setIssuedNumber(body?.certificate_number ?? null);
      await fetchData();
    } catch (err) {
      setIssueError(
        err instanceof Error ? err.message : "No se pudo emitir el certificado BRC.",
      );
    } finally {
      setIssueSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- */

  const pendingIssuance = counts.emision ?? 0;
  const certified = counts.certificados ?? 0;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Expedientes BRC</h2>
        <p className="text-muted-foreground">
          BitHauss emite el certificado BRC a partir del Certificado Notarial de
          cada expediente.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <ShieldBrc className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Expedientes</p>
              <p className="text-xl font-bold">{expedientes.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
              <Stamp className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendientes de emitir BRC</p>
              <p className="text-xl font-bold">{pendingIssuance}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En proceso</p>
              <p className="text-xl font-bold">
                {(counts.revision ?? 0) + (counts.notarial ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Certificados</p>
              <p className="text-xl font-bold">{certified}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
              {tab.label}
              <Badge
                variant="secondary"
                className={cn(
                  "px-1.5 py-0 text-[10px]",
                  tab.key === "emision" && (counts[tab.key] ?? 0) > 0
                    ? "bg-indigo-500 text-white hover:bg-indigo-500"
                    : "",
                )}
              >
                {counts[tab.key] ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : visible.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No hay expedientes en esta vista.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <caption className="sr-only">
                      Expedientes BRC y acciones de emisión
                    </caption>
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Propiedad
                        </th>
                        <th scope="col" className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground md:table-cell">
                          Solicitante
                        </th>
                        <th scope="col" className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground lg:table-cell">
                          Notario Asignado
                        </th>
                        <th scope="col" className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground md:table-cell">
                          Fecha
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Estado
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((exp) => (
                        <tr
                          key={exp.id}
                          className="border-b transition-colors last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium">
                              {exp.propertyTitle}
                            </span>
                            {exp.propertyLocation && (
                              <span className="block text-xs text-muted-foreground">
                                {exp.propertyLocation}
                              </span>
                            )}
                          </td>
                          <td className="hidden px-4 py-3 md:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {exp.applicant}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 lg:table-cell">
                            {exp.notary ? (
                              <div className="flex items-center gap-2">
                                <Scale className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{exp.notary}</span>
                              </div>
                            ) : (
                              <span className="text-sm italic text-muted-foreground">
                                Sin asignar
                              </span>
                            )}
                          </td>
                          <td className="hidden px-4 py-3 md:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {formatDate(exp.created_at)}
                            </span>
                          </td>
                          <td className="px-4 py-3">{statusBadge(exp.status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="h-8"
                              >
                                <Link href={`/dashboard/expedientes/${exp.id}`}>
                                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                                  Ver expediente
                                </Link>
                              </Button>

                              {exp.notarialCertificate && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={openingCertId === exp.id}
                                  onClick={() => openNotarialCertificate(exp)}
                                >
                                  {openingCertId === exp.id ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                                  )}
                                  Certificado Notarial
                                </Button>
                              )}

                              {exp.status === BRC_STATUS.PENDIENTE_EMISION_BRC && (
                                <Button
                                  size="sm"
                                  className="h-8 bg-indigo-600 text-white hover:bg-indigo-700"
                                  onClick={() => startIssuing(exp)}
                                >
                                  <Stamp className="mr-1.5 h-3.5 w-3.5" />
                                  Emitir BRC
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/*  Issue BRC modal                                             */}
      {/* ============================================================ */}
      {issuing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Emitir certificado BRC"
          onClick={() => !issueSubmitting && setIssuing(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b p-6">
              <div>
                <h3 className="text-lg font-bold">Emitir Certificado BRC</h3>
                <p className="text-sm text-muted-foreground">
                  {issuing.propertyTitle}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={issueSubmitting}
                onClick={() => setIssuing(null)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Cerrar</span>
              </Button>
            </div>

            {issuedNumber ? (
              <div className="space-y-4 p-6">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-bold">Certificado BRC emitido</p>
                  <p className="mt-1">
                    Folio{" "}
                    <span className="font-mono font-bold">{issuedNumber}</span>.
                    La propiedad ya muestra el sello BRC en su publicación y el
                    solicitante fue notificado.
                  </p>
                </div>
                <Button className="w-full" onClick={() => setIssuing(null)}>
                  Cerrar
                </Button>
              </div>
            ) : (
              <div className="space-y-5 p-6">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs leading-relaxed text-indigo-900">
                  <p className="font-bold">Emisión a cargo de BitHauss.</p>
                  <p className="mt-1">
                    El Certificado Notarial de la notaría es el sustento legal.
                    Al emitir, BitHauss genera el folio BRC, lo tokeniza y
                    coloca el sello en la publicación del inmueble. El folio se
                    asigna en el servidor, de forma secuencial.
                  </p>
                </div>

                {issuing.notarialCertificate ? (
                  <button
                    type="button"
                    onClick={() => openNotarialCertificate(issuing)}
                    className="flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">
                      {issuing.notarialCertificate.file_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(issuing.notarialCertificate.issued_at)}
                    </span>
                  </button>
                ) : (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    Este expediente no tiene un Certificado Notarial vigente.
                  </p>
                )}

                <div>
                  <label
                    htmlFor="brc-observations"
                    className="mb-1.5 block text-sm font-semibold"
                  >
                    Observaciones
                  </label>
                  <textarea
                    id="brc-observations"
                    rows={3}
                    value={issueObservations}
                    onChange={(e) => setIssueObservations(e.target.value)}
                    placeholder="Observaciones que acompañan al certificado BRC..."
                    className="w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>

                <div>
                  <label
                    htmlFor="brc-pdf"
                    className="mb-1.5 block text-sm font-semibold"
                  >
                    Certificado BRC en PDF{" "}
                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </label>
                  <input
                    id="brc-pdf"
                    type="file"
                    accept=".pdf"
                    className="w-full rounded-xl border px-4 py-2.5 text-sm"
                    onChange={(e) => setIssuePdf(e.target.files?.[0] ?? null)}
                  />
                </div>

                {issueError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
                  >
                    {issueError}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={issueSubmitting}
                    onClick={() => setIssuing(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700"
                    disabled={issueSubmitting || !issuing.notarialCertificate}
                    onClick={handleIssueBrc}
                  >
                    {issueSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Emitiendo...
                      </>
                    ) : (
                      <>
                        <Stamp className="mr-2 h-4 w-4" />
                        Emitir BRC
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
