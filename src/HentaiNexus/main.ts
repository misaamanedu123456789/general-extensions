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
  type AdvancedSearchForm,
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

import { HentaiNexusAdvancedSearchForm } from "./forms";
// Extension forms file
// import { HentaiNexusAdvancedSearchForm, SettingsForm } from "./forms";
import type { Categories, CategoriesCache, Metadata, SearchMetadata, tagCategory } from "./models";
// Extension network file
import { fetchData, HentaiNexusInterceptor } from "./network";
import {
  makeSearchQuery,
  maxPagesResult,
  parseCategoryPage,
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

  private catgoriesCache: CategoriesCache = {
    status: "unloaded",
    lastUpdate: undefined,
    categories: {
      artist: [],
      author: [],
      circle: [],
      event: [],
      magazine: [],
      parody: [],
      publisher: [],
      tag: [],
    },
  };

  private async ensureCatgoriesCache(): Promise<CategoriesCache> {
    const lastUpdateMs = this.catgoriesCache.lastUpdate?.getTime() ?? 0;
    const isStale = Date.now() - lastUpdateMs > 5 * 60 * 1000;

    if (this.catgoriesCache.status === "unloaded" || isStale) {
      let categories: Categories = this.catgoriesCache.categories;
      await Promise.all(
        (Object.keys(categories) as tagCategory[]).map(async (cat) => {
          const catPage = await fetchData(["explore", "categories", cat]);
          categories[cat] = parseCategoryPage(catPage);
        }),
      );

      this.catgoriesCache = {
        status: "loaded",
        lastUpdate: new Date(),
        categories,
      };
    }

    return this.catgoriesCache;
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    const latestSection: DiscoverSection = {
      id: "latest",
      title: "Latest",
      subtitle: "Latest",
      type: DiscoverSectionType.prominentCarousel,
    };
    const popularSection: DiscoverSection = {
      id: "popular",
      title: "Popular",
      subtitle: "Popular",
      type: DiscoverSectionType.prominentCarousel,
    };

    return [latestSection, popularSection];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: Metadata,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;

    // TODO: add query for black listed tags in the future setting form
    const homepage: string = await fetchData(["page", page.toString()], {
      q: section.id === "popular" ? "sort:popular" : "",
    });

    const results = parseResultpage(homepage);

    const maxHomePage = maxPagesResult(homepage);
    return { items: results, metadata: page <= maxHomePage ? { page: page + 1 } : undefined };
  }

  async getSearchResults(
    query: SearchQuery<SearchMetadata>,
    metadata?: Metadata,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const requestParam = makeSearchQuery(query, sortingOption);
    const homepage = await fetchData(
      ["page", page.toString()],
      requestParam != "" ? { q: requestParam } : undefined,
    );

    const results = toSearchResult(parseResultpage(homepage));

    const maxHomePage = maxPagesResult(homepage);
    return { items: results, metadata: page <= maxHomePage ? { page: page + 1 } : undefined };
  }

  async getAdvancedSearchForm(query: SearchQuery<SearchMetadata>): Promise<AdvancedSearchForm> {
    const categories = await this.ensureCatgoriesCache();
    return new HentaiNexusAdvancedSearchForm(query, categories.categories);
  }

  async getSortingOptions(_query: SearchQuery<SearchMetadata>): Promise<SortingOption[]> {
    return [
      { id: "latest", label: "Latest Update" },
      { id: "popular", label: "Popular" },
    ];
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const mangaPage = await fetchData(["view", mangaId]);

    return parseViewPage(mangaPage, mangaId);
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const additionalInfo = sourceManga.mangaInfo?.additionalInfo;
    console.log(JSON.stringify(additionalInfo, null, 4));
    return [
      {
        chapterId: sourceManga.mangaId,
        sourceManga: sourceManga,
        langCode: "en",
        title: additionalInfo?.pages ? additionalInfo.pages + " pages" : "",
        chapNum: 1,
        volume: 0,
      },
    ];
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const mangaPage = await fetchData(["read", chapter.chapterId]);

    return await parseChapterPage(mangaPage, chapter.chapterId);
  }
}

export const HentaiNexus = new HentaiNexusExtension();
