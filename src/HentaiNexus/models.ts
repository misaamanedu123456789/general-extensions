/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

import type { JSONObject, Tag } from "@paperback/types";

export const DOMAIN = "https://hentainexus.com";

export const MODE_OPTIONS: Tag[] = [
  { id: "include", title: "Include" },
  { id: "exclude", title: "Exclude" },
];

export type HentaiNexusSearchMetadata = {
  mode?: "include" | "exclude";
};

export type DiscoveryIds =
  | "featuredCarouselItem"
  | "simpleCarouselItem"
  | "prominentCarouselItem"
  | "chapterUpdatesCarouselItem"
  | "genresCarouselItem";

export interface ChapterItem {
  id: number;
  mangaId: number;
  isOfficial: boolean;
  number: number;
  name: string;
  language: string;
  volume: number;
  votes: number;
  createdAtFormatted: string;
  url: string;
  group?: { name: string } | null;
}

export interface Metadata extends JSONObject {
  page: number;
}

export interface InitReaderArgs {
  base64Data: string;
  title: string;
  options: Record<string, string>;
}
