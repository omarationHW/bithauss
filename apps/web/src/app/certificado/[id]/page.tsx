"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  ArrowLeft,
  Download,
  Calendar,
  MapPin,
  User,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";

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

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function CertificateSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="animate-pulse space-y-8">
          {/* Back button */}
          <div className="h-10 w-24 rounded-xl bg-gray-200" />
          {/* Card */}
          <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-100 space-y-8">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="h-10 w-40 rounded-lg bg-gray-200" />
            </div>
            {/* Title */}
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-80 rounded-lg bg-gray-200" />
              <div className="h-6 w-48 rounded-lg bg-gray-200" />
            </div>
            {/* Property section */}
            <div className="flex gap-4">
              <div className="h-32 w-48 rounded-xl bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-full rounded bg-gray-200" />
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-5 w-1/3 rounded bg-gray-200" />
              </div>
            </div>
            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="h-20 rounded-xl bg-gray-200" />
              <div className="h-20 rounded-xl bg-gray-200" />
              <div className="h-20 rounded-xl bg-gray-200" />
              <div className="h-20 rounded-xl bg-gray-200" />
            </div>
            {/* Footer */}
            <div className="h-16 rounded-xl bg-gray-200" />
          </div>
        </div>
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

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function fetchCertificate() {
      if (!certificateId) return;

      // Fetch certificate (no joins to avoid RLS issues)
      const { data: certData, error: certError } = await supabase
        .from("brc_certificates")
        .select("id, certificate_number, qr_code_url, pdf_url, issued_at, issued_by, expires_at, created_at, property_id, expediente_id")
        .eq("id", certificateId)
        .maybeSingle();

      if (!certData || certError) {
        logError("Cert fetch error:", certError);
        setLoading(false);
        return;
      }

      // Fetch issuer profile + notary_profiles separately
      let issuedByProfile = null;
      let notaryProfile = null;

      if (certData.issued_by) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", certData.issued_by)
          .maybeSingle();

        issuedByProfile = profileData;

        const { data: notaryData } = await supabase
          .from("notary_profiles")
          .select("notary_number, notary_state")
          .eq("profile_id", certData.issued_by)
          .maybeSingle();

        notaryProfile = notaryData;
      }

      // Fetch property info
      let propertyData = null;
      if (certData.property_id) {
        const { data: pData } = await supabase
          .from("properties")
          .select("id, title, address_line, city, state, price, currency, featured_image_url")
          .eq("id", certData.property_id)
          .maybeSingle();
        propertyData = pData;
      }

      // Fetch expediente info
      let expedienteData = null;
      if (certData.expediente_id) {
        const { data: eData } = await supabase
          .from("brc_expedientes")
          .select("status, created_at")
          .eq("id", certData.expediente_id)
          .maybeSingle();
        expedienteData = eData;
      }

      setCertificate({
        ...(certData as unknown as CertificateData),
        properties: propertyData,
        brc_expedientes: expedienteData,
        issued_by_profile: issuedByProfile,
        notary_profile: notaryProfile,
      });
      setLoading(false);
    }

    fetchCertificate();
  }, [certificateId, supabase]);

  /* ---------------------------------------------------------------- */
  /*  Loading                                                          */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return <CertificateSkeleton />;
  }

  /* ---------------------------------------------------------------- */
  /*  Not found                                                        */
  /* ---------------------------------------------------------------- */

  if (!certificate) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="flex flex-col items-center justify-center py-24">
            <AlertCircle className="h-16 w-16 text-gray-300 mb-4" />
            <h2
              className="text-xl font-bold text-gray-900 mb-2"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Certificado no encontrado
            </h2>
            <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
              El certificado solicitado no existe o ha sido removido.
            </p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al inicio
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  const expired = isExpired(certificate.expires_at);
  const property = certificate.properties ?? { id: "", title: "Propiedad", address_line: null, city: null, state: null, price: 0, currency: "MXN", featured_image_url: null };
  const address = [property.address_line, property.city, property.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen bg-gray-50 pt-[100px]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* Back button */}
        <div className="mb-6">
          <Button
            asChild
            variant="ghost"
            className="rounded-xl text-gray-600 hover:text-gray-900"
          >
            <Link href={`/propiedades/${property.id}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Link>
          </Button>
        </div>

        {/* Certificate Card */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          {/* Gradient top accent */}
          <div
            className="h-2"
            style={{
              background:
                "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
            }}
          />

          <div className="p-6 sm:p-10 space-y-8">
            {/* ---- Logo ---- */}
            <div className="flex justify-center">
              <Link href="/">
                <Image
                  src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Logo-BitHauss.png"
                  alt="BitHauss"
                  width={160}
                  height={40}
                  className="h-10 w-auto"
                  priority
                />
              </Link>
            </div>

            {/* ---- Title ---- */}
            <div className="text-center space-y-3">
              <h1
                className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                  fontFamily: "Barlow, Inter, sans-serif",
                }}
              >
                Certificado de Bienes Raices (BRC)
              </h1>
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <span
                  className="text-lg font-semibold text-gray-700 tracking-wide"
                  style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                >
                  {certificate.certificate_number}
                </span>
              </div>

              {/* Status badge */}
              <div className="flex justify-center">
                {expired ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-4 py-1.5 text-sm font-semibold text-red-600">
                    <XCircle className="h-4 w-4" />
                    Expirado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5 text-sm font-semibold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Vigente
                  </span>
                )}
              </div>
            </div>

            {/* ---- Divider ---- */}
            <div className="border-t border-dashed border-gray-200" />

            {/* ---- Property Info ---- */}
            <div>
              <h3
                className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Propiedad Certificada
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                {property.featured_image_url && (
                  <div className="relative h-32 w-full sm:w-48 shrink-0 rounded-xl overflow-hidden bg-gray-100">
                    <Image
                      src={property.featured_image_url}
                      alt={property.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 192px"
                      unoptimized
                    />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <h4
                    className="text-lg font-bold text-gray-900"
                    style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                  >
                    {property.title}
                  </h4>
                  {address && (
                    <p className="flex items-center gap-1.5 text-sm text-gray-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {address}
                    </p>
                  )}
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(property.price, property.currency)}
                  </p>
                  <Link
                    href={`/propiedades/${property.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                    style={{ color: "hsl(221 83% 53%)" }}
                  >
                    Ver propiedad
                  </Link>
                </div>
              </div>
            </div>

            {/* ---- Divider ---- */}
            <div className="border-t border-dashed border-gray-200" />

            {/* ---- Certification Details Grid ---- */}
            <div>
              <h3
                className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Detalles de Certificacion
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Issued date */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Fecha de Emision
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatDate(certificate.issued_at)}
                  </p>
                </div>

                {/* Expiry date */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Fecha de Vencimiento
                    </span>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      expired ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {formatDate(certificate.expires_at)}
                  </p>
                </div>

                {/* Notary name */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Notario Certificador
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {certificate.issued_by_profile
                      ? `${certificate.issued_by_profile.first_name} ${certificate.issued_by_profile.last_name}`
                      : "No disponible"}
                  </p>
                </div>

                {/* Notary number & state */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Notaria
                    </span>
                  </div>
                  {certificate.notary_profile ? (
                    <p className="text-sm font-semibold text-gray-900">
                      No. {certificate.notary_profile.notary_number},{" "}
                      {certificate.notary_profile.notary_state}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-gray-500">
                      No disponible
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ---- Divider ---- */}
            <div className="border-t border-dashed border-gray-200" />

            {/* ---- QR Code & Actions ---- */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              {/* QR Code */}
              <div className="flex flex-col items-center gap-2">
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : ""}/certificado/${certificate.id}`)}`}
                  alt="Codigo QR de verificacion"
                  width={120}
                  height={120}
                  className="rounded-lg"
                  unoptimized
                />
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                  Codigo de verificacion
                </span>
              </div>

              {/* Download PDF */}
              {certificate.pdf_url && (
                <Button
                  asChild
                  className="rounded-xl border-0 text-white px-6"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                  }}
                >
                  <a
                    href={certificate.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar PDF
                  </a>
                </Button>
              )}
            </div>

            {/* ---- Footer ---- */}
            <div
              className="rounded-xl p-4 flex items-center justify-center gap-3"
              style={{
                background:
                  "linear-gradient(135deg, hsl(221 83% 53% / 0.05), hsl(160 84% 39% / 0.05))",
              }}
            >
              <ShieldCheck
                className="h-5 w-5 shrink-0"
                style={{ color: "hsl(160 84% 39%)" }}
              />
              <p className="text-sm font-semibold text-gray-600">
                Verificado por{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                  }}
                >
                  BitHauss
                </span>
              </p>
            </div>
          </div>

          {/* Gradient bottom accent */}
          <div
            className="h-2"
            style={{
              background:
                "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
            }}
          />
        </div>
      </div>
    </div>
  );
}
