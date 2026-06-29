/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

// TODO:
// - Fix exclude search
// - Add the English name to the title view
// - Add additional info to the title view
// - Make getChapterDetails only return new chapters
// - Add content settings support to search
// - Remove the content.json file and switch to cheerio

import {
  BasicRateLimiter,
  DiscoverSectionType,
  type Chapter,
  type ChapterDetails,
  type DiscoverSection,
  type DiscoverSectionItem,
  type ExtensionImpl,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
  type SourceManga,
} from "@paperback/types";

// Extension forms file
// import { HentaiNexusAdvancedSearchForm, SettingsForm } from "./forms";
import type { HentaiNexusSearchMetadata, Metadata } from "./models";
// Extension network file
import { HentaiNexusAPI, HentaiNexusInterceptor } from "./network";
import {
  maxPagesResult,
  parseChapterPage,
  parseResultpage,
  parseViewPage,
  toSearchResult,
} from "./parsers";
import type HentaiNexusConfig from "./pbconfig";

// Main extension class
export class HentaiNexusExtension implements ExtensionImpl<typeof HentaiNexusConfig> {
  // Implementation of the main rate limiter
  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 15,
    bufferInterval: 10,
    ignoreImages: true,
  });

  // Implementation of the main interceptor
  mainInterceptor = new HentaiNexusInterceptor("main");

  // Method from the Extension interface which we implement, initializes the rate limiter, interceptor, discover sections and search filters
  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.mainInterceptor.registerInterceptor();
  }
  async getDiscoverSections(): Promise<DiscoverSection[]> {
    // First template discover section, gets populated by the getDiscoverSectionItems method
    const latestSection: DiscoverSection = {
      id: "latest",
      title: "Latest",
      subtitle: "Latest Hentai",
      type: DiscoverSectionType.prominentCarousel,
    };

    return [latestSection];
  }

  // Populates both the discover sections
  async getDiscoverSectionItems(
    _section: DiscoverSection,
    metadata: Metadata,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;

    const api = new HentaiNexusAPI();

    const homepage = await api.fetchResultPage(page);

    const results = parseResultpage(homepage);

    const maxHomePage = maxPagesResult(homepage);
    return { items: results, metadata: page <= maxHomePage ? { page: page + 1 } : undefined };
  }

  // Populates search
  async getSearchResults(
    query: SearchQuery<HentaiNexusSearchMetadata>,
    metadata?: Metadata,
    _sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;

    const api = new HentaiNexusAPI();

    const homepage = await api.fetchResultPage(page, query.title != "" ? "?q=" + query.title : "");

    const results = toSearchResult(parseResultpage(homepage));

    const maxHomePage = maxPagesResult(homepage);
    return { items: results, metadata: page <= maxHomePage ? { page: page + 1 } : undefined };
  }

  // Populates the title details
  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const api = new HentaiNexusAPI();
    const mangaPage = await api.fetchMangaPage(mangaId);

    return parseViewPage(mangaPage, mangaId);
  }

  // Populates the chapter list
  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const additionalInfo = sourceManga.mangaInfo?.additionalInfo;
    console.log(JSON.stringify(additionalInfo, null, 4));
    return [
      {
        chapterId: sourceManga.mangaId,
        sourceManga: sourceManga,
        langCode: "en",
        // stole the idea from https://github.com/Catta1997/Sinon-Paperback-Extensions/blob/a750f31f65b058ed670b3068487478213ce57b0a/src/EHentai/parser.ts#L233
        title: additionalInfo?.pages ? additionalInfo.pages + " pages" : "",
        chapNum: 1,
        volume: 0,
      },
    ];
  }

  // Populates a chapter with images
  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const api = new HentaiNexusAPI();
    const mangaPage = await api.fetchChapterPage(chapter.chapterId);

    return await parseChapterPage(mangaPage, chapter.chapterId);
  }
}

export const HentaiNexus = new HentaiNexusExtension();
