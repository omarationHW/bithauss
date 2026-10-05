import type { Metadata } from "next";
import { headers } from "next/headers";
import PropertyDetailClient from "./property-detail-client";
import {
  buildPropertyShareMetadata,
  fetchSharedProperty,
  resolveBaseUrl,
} from "@/lib/property-share-metadata";

/**
 * Server wrapper of the public property page. The page itself is a client
 * component; this file exists so `generateMetadata` can put the Open Graph
 * tags in the server HTML — WhatsApp / iMessage never run JS, so tags added
 * on the client are invisible to them.
 *
 * Only PUBLICADO listings get a rich preview. Drafts, paused or deleted ones
 * return `{}` and inherit the generic metadata of the root layout.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const property = await fetchSharedProperty(decodeURIComponent(id));
  if (!property) return {};
  return buildPropertyShareMetadata(property, resolveBaseUrl(await headers()));
}

export default function PropertyDetailPage() {
  return <PropertyDetailClient />;
}
