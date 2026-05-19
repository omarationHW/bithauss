"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Download,
  Calendar,
  MapPin,
  CheckCircle2,
  XCircle,
  Share2,
  FileCheck,
  AlertCircle,
  Loader2,
  Sparkles,
  BadgeCheck,
  Fingerprint,
  RotateCw,
} from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";
import { ShieldBrc } from "@/components/ui/shield-brc";
import { BrcExclusionNotice } from "@/components/ui/brc-exclusion-notice";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CertificateData {
  id: string;
  certificate_number: string;
  qr_code_url: string | null;
  pdf_url: string | null;
  issued_at: string;
  expires_at: string;
  created_at: string;
  properties: {
    id: string;
    title: string;
    address_line: string | null;
    city: string | null;
    state: string | null;
    price: number;
    currency: string;
    featured_image_url: string | null;
  } | null;
  issued_by_profile: {
    first_name: string;
    last_name: string;
  } | null;
  notary_profile: {
    notary_number: string;
    notary_state: string;
  } | null;
  brc_expedientes: {
    status: string;
    created_at: string;
  } | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(amount: number, currency: string = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt) < new Date();
}

function daysUntil(dateStr: string) {
  const diffMs = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/* ------------------------------------------------------------------ */
/*  Verification checklist — the 7 guarantees a BRC certificate makes */
/* ------------------------------------------------------------------ */

const VERIFICATIONS = [
  {
    title: "Libre de gravámenes",
    description: "Hipotecas y embargos verificados ante el Registro Público.",
  },
  {
    title: "Escrituras inscritas",
    description: "Escrituras públicas debidamente registradas y vigentes.",
  },
  {
    title: "Libertad de gravamen",
    description: "Certificado emitido por el Registro Público de la Propiedad.",
  },
  {
    title: "Impuesto predial",
    description: "Pagos al corriente comprobados con la autoridad fiscal local.",
  },
  {
    title: "Alineamiento y número oficial",
    description: "Constancia urbana emitida por el municipio correspondiente.",
  },
  {
    title: "No adeudo de agua",
    description: "Constancia oficial del organismo operador de agua potable.",
  },
  {
    title: "Identidad del propietario",
    description: "Identificación oficial y legitimación validadas por Notario.",
  },
];

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function CertificateSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 pt-[100px]">
      <div className="mx-auto flex max-w-4xl items-center justify-center px-4 py-24">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CertificadoPage() {
  const params = useParams();
  const certificateId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [qrSrc, setQrSrc] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{
    status: "VIGENTE" | "EXPIRADO" | "REVOCADO" | "NO_ENCONTRADO";
    reason?: string;
    verifiedAt: string;
    verificationId: string;
    signature: string;
  } | null>(null);

  const supabase = useMemo(() => createClient(), []);

  /* ------------ Fetch via verification endpoint (single source of truth) ------------ */
  useEffect(() => {
    let cancelled = false;
    async function verify() {
      if (!certificateId) return;
      try {
        const res = await fetch(`/api/verify/${certificateId}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;

        setVerifyStatus({
          status: data.status,
          reason: data.reason,
          verifiedAt: data.verifiedAt,
          verificationId: data.verificationId,
          signature: data.signature,
        });

        if (!data.certificate) {
          setLoading(false);
          return;
        }

        setCertificate({
          id: data.certificate.id,
          certificate_number: data.certificate.certificate_number,
          qr_code_url: null,
          pdf_url: null,
          issued_at: data.certificate.issued_at,
          expires_at: data.certificate.expires_at,
          created_at: data.certificate.issued_at,
          properties: data.property
            ? {
                id: data.property.id,
                title: data.property.title,
                address_line: data.property.address_line,
                city: data.property.city,
                state: data.property.state,
                price: data.property.price,
                currency: data.property.currency,
                featured_image_url: data.property.featured_image_url,
              }
            : null,
          issued_by_profile: data.notary?.name
            ? {
                first_name: data.notary.name.split(" ")[0] ?? "",
                last_name: data.notary.name.split(" ").slice(1).join(" "),
              }
            : null,
          notary_profile: data.notary?.number
            ? {
                notary_number: data.notary.number,
                notary_state: data.notary.state ?? "",
              }
            : null,
          brc_expedientes: null,
        });
        setLoading(false);

        // Check ownership for showing the download button
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user && data.property?.owner_id === authData.user.id) {
          setIsOwner(true);
        }
      } catch (err) {
        logError("Verify fetch failed", err);
        if (!cancelled) setLoading(false);
      }
    }
    verify();
    return () => {
      cancelled = true;
    };
  }, [certificateId, supabase]);

  /* ------------ QR — local generation (no external dependency) ------------ */
  useEffect(() => {
    if (!certificate) return;
    const verifyUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/certificado/${certificate.id}`
        : `/certificado/${certificate.id}`;
    QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      color: { dark: "#1B2A4A", light: "#ffffff" },
    })
      .then(setQrSrc)
      .catch((err) => logError("QR generation failed", err));
  }, [certificate]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logError("Copy failed", err);
    }
  }

  const [reVerifying, setReVerifying] = useState(false);
  async function handleReVerify() {
    if (!certificateId || reVerifying) return;
    setReVerifying(true);
    try {
      const res = await fetch(`/api/verify/${certificateId}`, { cache: "no-store" });
      const data = await res.json();
      setVerifyStatus({
        status: data.status,
        reason: data.reason,
        verifiedAt: data.verifiedAt,
        verificationId: data.verificationId,
        signature: data.signature,
      });
    } catch (err) {
      logError("Re-verify failed", err);
    } finally {
      setReVerifying(false);
    }
  }

  function timeAgo(iso: string): string {
    const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (diffSec < 60) return `hace ${diffSec}s`;
    const m = Math.floor(diffSec / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    return `hace ${h} h`;
  }

  if (loading) return <CertificateSkeleton />;

  if (!certificate) {
    return (
      <div className="min-h-screen bg-slate-50 pt-[100px]">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="flex flex-col items-center justify-center py-24">
            <AlertCircle className="mb-4 h-16 w-16 text-slate-300" />
            <h2 className="mb-2 text-xl font-bold text-slate-900">
              Certificado no encontrado
            </h2>
            <p className="mb-6 max-w-md text-center text-sm text-slate-500">
              El certificado solicitado no existe o ha sido removido.
            </p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al inicio
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const expired = isExpired(certificate.expires_at);
  const remainingDays = daysUntil(certificate.expires_at);
  const property =
    certificate.properties ?? {
      id: "",
      title: "Propiedad",
      address_line: null,
      city: null,
      state: null,
      price: 0,
      currency: "MXN",
      featured_image_url: null,
    };
  const address = [property.address_line, property.city, property.state].filter(Boolean).join(", ");
  const notaryName = certificate.issued_by_profile
    ? `${certificate.issued_by_profile.first_name} ${certificate.issued_by_profile.last_name}`
    : null;
  const notaryNumber = certificate.notary_profile?.notary_number ?? null;
  const notaryState = certificate.notary_profile?.notary_state ?? null;

  return (
    <div className="min-h-screen bg-slate-50 pt-[100px] pb-16">
      <div className="mx-auto max-w-4xl px-4">
        {/* Back nav */}
        <div className="mb-6">
          <Button asChild variant="ghost" className="rounded-xl text-slate-600 hover:text-slate-900">
            <Link href={property.id ? `/propiedades/${property.id}` : "/"}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a la propiedad
            </Link>
          </Button>
        </div>

        {/* ------------ HERO ------------ */}
        <section
          className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-xl"
        >
          {/* Gradient ribbon */}
          <div
            className="absolute inset-x-0 top-0 h-2"
            style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
          />
          {/* Decorative orbs */}
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
            style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
          />
          <div
            className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full opacity-15 blur-3xl"
            style={{ background: "linear-gradient(135deg, hsl(160 84% 39%), hsl(221 83% 53%))" }}
          />

          <div className="relative p-6 sm:p-10">
            <div className="flex flex-col items-center gap-6 text-center">
              {/* Shield emblem */}
              <div className="relative">
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-full shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                  }}
                >
                  <ShieldBrc className="h-12 w-12 text-white" strokeWidth={1.6} />
                </div>
                <Sparkles className="absolute -right-1 -top-1 h-6 w-6 text-amber-400 drop-shadow-md" />
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2">
                {expired ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-sm font-bold text-red-700">
                    <XCircle className="h-4 w-4" />
                    Certificación expirada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-bold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Certificación BRC válida
                  </span>
                )}
              </div>

              {/* Headline */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Bien Raíz Certificado
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Esta propiedad cumple con la verificación BRC
                </h1>
                <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base">
                  BitHauss ha validado documental y notarialmente esta propiedad. Cada uno de los
                  siguientes puntos fue revisado y firmado por un Notario Público.
                </p>
              </div>

              {/* Certificate number pill */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-sm font-bold tracking-wider text-slate-900">
                  <FileCheck className="h-4 w-4 text-slate-500" />
                  {certificate.certificate_number}
                </div>
                {!expired && (
                  <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    Vence en {remainingDays} días
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ------------ PROPERTY ------------ */}
        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm">
          <div className="flex flex-col sm:flex-row">
            {property.featured_image_url && (
              <div className="relative h-56 w-full sm:h-auto sm:w-72">
                <Image
                  src={property.featured_image_url}
                  alt={property.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 288px"
                  unoptimized
                />
                <div className="absolute left-3 top-3">
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm"
                  >
                    <ShieldBrc className="h-3 w-3" />
                    Certificado BRC
                  </span>
                </div>
              </div>
            )}
            <div className="flex flex-1 flex-col justify-center p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Propiedad certificada
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{property.title}</h2>
              {address && (
                <p className="mt-2 inline-flex items-start gap-1.5 text-sm text-slate-500">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{address}</span>
                </p>
              )}
              <p className="mt-3 text-2xl font-bold text-slate-900">
                {formatCurrency(property.price, property.currency)}
              </p>
              <Button asChild className="mt-5 w-fit rounded-xl text-white" style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}>
                <Link href={`/propiedades/${property.id}`}>
                  Ver propiedad completa
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ------------ WHAT WE VERIFIED ------------ */}
        <section className="mt-8 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm sm:p-10">
          <div className="mb-6 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/60 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
              <BadgeCheck className="h-3.5 w-3.5" />
              Garantías del certificado
            </span>
            <h3 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              Qué hemos verificado
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
              7 validaciones legales y notariales que respaldan esta certificación.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {VERIFICATIONS.map((v) => (
              <div
                key={v.title}
                className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "linear-gradient(135deg, hsl(221 83% 53% / 0.12), hsl(160 84% 39% / 0.12))" }}
                >
                  <CheckCircle2 className="h-5 w-5" style={{ color: "hsl(160 84% 39%)" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{v.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{v.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ------------ NOTARY + DATES ------------ */}
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Vigencia
            </p>
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Emitido</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatDate(certificate.issued_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Vence</p>
                  <p className={`text-sm font-semibold ${expired ? "text-red-600" : "text-slate-900"}`}>
                    {formatDate(certificate.expires_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Validado por
            </p>
            <div className="mt-4 flex items-start gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white shadow-md"
                style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
              >
                {notaryName ? notaryName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() : "NP"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {notaryName ?? "Notario Público"}
                </p>
                <p className="text-xs text-slate-500">
                  {notaryNumber ? `Notaría No. ${notaryNumber}` : "Notario Público"}
                  {notaryState ? ` · ${notaryState}` : ""}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
                  Firma notarial digital
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------ QR + ACTIONS ------------ */}
        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-stretch sm:justify-between">
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              {qrSrc && (
                <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc} alt="Código QR de verificación" width={120} height={120} />
                </div>
              )}
              <div className="text-center sm:text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Código de verificación
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Escanea para validar la autenticidad de este certificado en
                  cualquier momento.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              {isOwner && (
                <Button
                  asChild
                  className="w-full rounded-xl text-white sm:w-auto"
                  style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                >
                  <Link href={`/certificado/${certificate.id}/oficio`}>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar certificado oficial
                  </Link>
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full rounded-xl sm:w-auto"
                onClick={handleCopyLink}
              >
                <Share2 className="mr-2 h-4 w-4" />
                {copied ? "Enlace copiado ✓" : "Copiar enlace de verificación"}
              </Button>
            </div>
          </div>

          {/* ------------ CRYPTOGRAPHIC VERIFICATION WIDGET ------------ */}
          {verifyStatus && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      verifyStatus.status === "VIGENTE"
                        ? "bg-emerald-100 text-emerald-700"
                        : verifyStatus.status === "EXPIRADO"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    <Fingerprint className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Verificación criptográfica
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">
                      {verifyStatus.status === "VIGENTE" && "Confirmado por BitHauss"}
                      {verifyStatus.status === "EXPIRADO" && "Certificado expirado"}
                      {verifyStatus.status === "REVOCADO" && "Certificado revocado"}
                      {verifyStatus.status === "NO_ENCONTRADO" && "No encontrado"}
                      <span className="ml-2 font-normal text-slate-500">
                        · firmado {timeAgo(verifyStatus.verifiedAt)}
                      </span>
                    </p>
                    {verifyStatus.reason && (
                      <p className="mt-1 text-xs text-slate-500">{verifyStatus.reason}</p>
                    )}
                    <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
                      <p className="font-mono text-slate-500">
                        <span className="font-sans text-slate-400">ID:</span>{" "}
                        {verifyStatus.verificationId.slice(0, 8)}
                      </p>
                      <p className="truncate font-mono text-slate-500">
                        <span className="font-sans text-slate-400">SHA-256:</span>{" "}
                        {verifyStatus.signature.slice(0, 16)}…
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReVerify}
                  disabled={reVerifying}
                  className="self-start text-xs sm:self-center"
                >
                  <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${reVerifying ? "animate-spin" : ""}`} />
                  Re-verificar
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* ------------ EXCLUSION NOTICE ------------ */}
        <section className="mt-8">
          <BrcExclusionNotice />
        </section>

        {/* ------------ FOOTER TRUST LINE ------------ */}
        <section
          className="mt-8 rounded-3xl border p-6 text-center"
          style={{
            background: "linear-gradient(135deg, hsl(221 83% 53% / 0.06), hsl(160 84% 39% / 0.06))",
            borderColor: "hsl(221 83% 53% / 0.18)",
          }}
        >
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <ShieldBrc className="h-6 w-6" gradient strokeWidth={1.6} />
            <p className="text-sm font-semibold text-slate-700">
              Verificado por{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
              >
                BitHauss
              </span>
              {" · "}
              <span className="text-slate-500 font-normal">Protocolo Digital Real Estate</span>
            </p>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Tecnología blockchain + validación notarial — la primera certificación
            inmobiliaria digital de México.
          </p>
        </section>
      </div>
    </div>
  );
}
