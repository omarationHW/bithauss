"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L, { type LatLngBoundsExpression } from "leaflet";
import Link from "next/link";
import "leaflet/dist/leaflet.css";

export interface MapProperty {
  id: string;
  title: string;
  priceLabel: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  brc: boolean;
  image: string;
  latitude: number;
  longitude: number;
}

interface PropertyMapProps {
  properties: MapProperty[];
  activeId?: string | null;
  onMarkerClick?: (id: string) => void;
}

function makePriceIcon(priceLabel: string, active: boolean): L.DivIcon {
  const bg = active
    ? "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))"
    : "white";
  const color = active ? "white" : "#0f172a";
  const border = active ? "transparent" : "#cbd5e1";
  const html = `
    <div style="
      background: ${bg};
      color: ${color};
      border: 1px solid ${border};
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      white-space: nowrap;
      transform: translate(-50%, -100%);
      display: inline-block;
    ">${priceLabel}</div>`;
  return L.divIcon({
    className: "bithauss-price-marker",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function FitBounds({ properties }: { properties: MapProperty[] }) {
  const map = useMap();
  const lastSig = useRef<string>("");
  useEffect(() => {
    if (properties.length === 0) return;
    const sig = properties.map((p) => p.id).sort().join(",");
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    if (properties.length === 1) {
      const p = properties[0]!;
      map.setView([p.latitude, p.longitude], 14, { animate: true });
      return;
    }
    const bounds: LatLngBoundsExpression = properties.map(
      (p) => [p.latitude, p.longitude] as [number, number],
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: true });
  }, [properties, map]);
  return null;
}

export default function PropertyMap({ properties, activeId, onMarkerClick }: PropertyMapProps) {
  const defaultCenter: [number, number] = [19.4326, -99.1332]; // CDMX
  const defaultZoom = 11;

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      scrollWheelZoom
      style={{ width: "100%", height: "100%", borderRadius: 12 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds properties={properties} />
      {properties.map((p) => (
        <Marker
          key={p.id}
          position={[p.latitude, p.longitude]}
          icon={makePriceIcon(p.priceLabel, activeId === p.id)}
          eventHandlers={{
            click: () => onMarkerClick?.(p.id),
          }}
        >
          <Popup>
            <div style={{ minWidth: 200 }}>
              <img
                src={p.image}
                alt={p.title}
                style={{
                  width: "100%",
                  height: 120,
                  objectFit: "cover",
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              />
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.title}</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "hsl(221 83% 53%)", marginBottom: 6 }}>
                {p.priceLabel}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                {p.bedrooms} rec · {p.bathrooms} baños · {p.area} m²
                {p.brc && <span style={{ marginLeft: 6, color: "hsl(160 84% 39%)", fontWeight: 700 }}>BRC ✓</span>}
              </div>
              <Link
                href={`/propiedades/${p.id}`}
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                  color: "white",
                  fontWeight: 600,
                  fontSize: 12,
                  borderRadius: 8,
                  textDecoration: "none",
                }}
              >
                Ver detalles →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
