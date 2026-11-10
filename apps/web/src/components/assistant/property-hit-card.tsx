"use client";

import Image from "next/image";
import Link from "next/link";
import { Home, MapPin, Navigation } from "lucide-react";
import type { PropertySearchHit } from "@bithauss/types";
import { propertyOperationTag } from "@/components/propiedades/property-operations";
import {
  directionsUrl,
  formatArea,
  formatDistance,
  formatHitLocation,
  formatHitPrice,
  hitImageSrc,
  plural,
  safePropertyPath,
} from "@/lib/assistant/format";

interface Props {
  hit: PropertySearchHit;
  /** Called when the user follows "Ver propiedad" (the panel closes). */
  onNavigate?: () => void;
}

/** Compact version of the /propiedades card, sized for a 400px chat panel. */
export function PropertyHitCard({ hit, onNavigate }: Props) {
  const href = safePropertyPath(hit);
  const image = hitImageSrc(hit);
  const maps = directionsUrl(hit);
  const distance = formatDistance(hit.distance_km);
  const location = formatHitLocation(hit);
  const price = formatHitPrice(hit);
  const facts = [
    formatArea(hit.area_m2),
    hit.bedrooms ? plural(hit.bedrooms, "recámara", "recámaras") : null,
    hit.bathrooms ? plural(hit.bathrooms, "baño", "baños") : null,
  ].filter((f): f is string => !!f);

  return (
    <article
      className="overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm"
      aria-label={hit.title}
    >
      <div className="flex gap-3 p-2.5">
        <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
          {image ? (
            <Image
              src={image}
              alt=""
              fill
              sizes="112px"
              className="object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Home className="h-6 w-6" aria-hidden />
            </div>
          )}
          <span className="absolute left-1.5 top-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
            {propertyOperationTag(hit.operation)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{hit.title}</h3>
          <p className="mt-0.5 text-sm font-bold text-foreground">{price}</p>
          {facts.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">{facts.join(" · ")}</p>
          )}
          {(location || distance) && (
            <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="line-clamp-2">
                {location}
                {location && distance ? " · " : ""}
                {distance && <span className="font-medium text-foreground">{distance}</span>}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-t border-border/60 p-2">
        <Link
          href={href}
          onClick={onNavigate}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Ver propiedad
        </Link>
        {maps && (
          <a
            href={maps}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Navigation className="h-4 w-4" aria-hidden />
            Cómo llegar
            <span className="sr-only">(abre Google Maps en otra pestaña)</span>
          </a>
        )}
      </div>
    </article>
  );
}
