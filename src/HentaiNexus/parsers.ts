import {
  ContentRating,
  type ChapterDetails,
  type ProminentCarouselItem,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
  type SourceManga,
  type Tag,
  type TagSection,
} from "@paperback/types";
import * as cheerio from "cheerio";
import type { Element } from "domhandler"; // Cheerio's Element, not the DOM's

import { extractImageUrls } from "./decrypt";
import { DOMAIN, type SearchMetadata, type InitReaderArgs, type tagCategory } from "./models";

export const parseResultpage = (resultPageRAW: string): ProminentCarouselItem[] => {
  const $ = cheerio.load(resultPageRAW);

  const cards = $("body > section > div > div").children();

  let results: ProminentCarouselItem[] = [];

  for (const card of cards) {
    const link = $("a", card).attr("href");
    const slug = link?.split("/")[2] ?? "";
    if (slug == "") console.error("[parseHomepage] Null slug");

    const image = $("div.card-image > .image > img", card).attr("src");
    if (image == "") console.warn("[parseHomepage] No image for", slug);

    const title = $("p.card-header-title", card).text().trim();

    results.push({
      type: "prominentCarouselItem",
      mangaId: slug ?? "",
      imageUrl: image ?? "",
      title: title ?? "",
      subtitle: "",
      contentRating: ContentRating.ADULT,
    });
  }
  return results;
};

export const toSearchResult = (items: ProminentCarouselItem[]): SearchResultItem[] => {
  return items.map((item) => {
    return {
      mangaId: item.mangaId,
      title: item.title,
      subtitle: item.subtitle,
      imageUrl: item.imageUrl,
      metadata: item.metadata,
      contentRating: item.contentRating,
    };
  });
};

export const maxPagesResult = (resultPageRAW: string): number => {
  const $ = cheerio.load(resultPageRAW);
  const lastPageELement = $("ul.pagination-list:first").children().last();
  const lastPageLink = $("a", lastPageELement);

  return Number(lastPageLink.text().trim());
};

export function textToId(text: string): string {
  return encodeURIComponent(text).replace(
    /[!'()*~]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * Restores the original UTF-8 text.
 */
export function idToText(id: string): string {
  return decodeURIComponent(id);
}

export const parseViewPage = (viewPageRAW: string, mangaId: string): SourceManga => {
  const $ = cheerio.load(viewPageRAW);
  const infoBox = $("div.box:first");

  const image = $("figure > img", infoBox).attr("src");

  // Build a dictionary from the table rows
  const tableData: Record<string, cheerio.Cheerio<Element>> = {};

  $("table > tbody > tr", infoBox).each((_, row) => {
    const cells = $("td", row);
    const key = cells.first().text().trim().toLowerCase().replace(/\s+/g, "_"); // e.g. "Release Date" → "release_date"
    const value = cells.last();

    if (key) tableData[key] = value;
  });

  const tableRes = (element: cheerio.Cheerio<Element>): string => {
    console.log("element parsing");
    if (!element) return "";
    const els = element.children();
    let result: string[] = [];
    els.each((i: number, _el: Element) => {
      const text = els.eq(i).clone().find("span").remove().end().text().trim();
      if (text) result.push(text);
    });
    return result.join(", ");
  };

  console.log("start line parse L107");

  const title = $("h1.title", infoBox).text().trim();

  const artist = tableRes(tableData["artist"]);
  const circle = tableRes(tableData["circle"]) ?? "";
  const event = tableRes(tableData["event"]) ?? "";
  const magazine = tableRes(tableData["magazine"]) ?? "";
  const parody = tableRes(tableData["parody"]) ?? "";
  const publisher = tableRes(tableData["publisher"]);
  const synopsis = tableData["description"]?.text().trim() ?? "";
  const likes = Number(tableData["favorites"]?.text().trim()).toString() ?? "";
  const pages = Number(tableData["pages"]?.text().trim()).toString() ?? "";

  const tagList: TagSection[] = [
    {
      id: "tags",
      title: "Tags",
      tags: [],
    },
  ];
  const tagsElement = tableData["tags"].children();
  tagsElement.each((i: number, _el: Element) => {
    const tagTextContent = tagsElement.eq(i).text();

    const cleanTagName = tagTextContent.trim().replace(/\s*\(\d[\d,]*\)$/, "");
    console.log(cleanTagName, textToId(cleanTagName));
    tagList[0].tags.push({
      id: textToId(cleanTagName),
      title: cleanTagName,
    });
    return;
  });

  let preSynopsis = `${likes} likes | ${pages} pages`;

  const extraMetadata: Record<string, string> = { parody, publisher, magazine, circle, event };

  preSynopsis += Object.entries(extraMetadata)
    .filter(([, value]) => value !== "")
    .map(([catName, value]) => ` | ${catName}: ${value}`)
    .join("");

  const displayedSynopsis = preSynopsis + (synopsis !== "" ? "\n\n" + synopsis : "");
  console.log(JSON.stringify({ title, artist, synopsis, likes, pages, extraMetadata }, null, 4));
  return {
    mangaId,
    mangaInfo: {
      thumbnailUrl: image ?? "",
      synopsis: displayedSynopsis ?? "",
      primaryTitle: title ?? "",
      secondaryTitles: [],
      contentRating: ContentRating.ADULT,
      status: "Completed",
      author: artist,
      rating: 0,
      tagGroups: tagList,
      shareUrl: `${DOMAIN}/view/${mangaId}`,
      additionalInfo: {
        publisher,
        likes,
        pages,
      },
    },
  };
};

function parseInitReaderCall(html: string): InitReaderArgs {
  // Find the initReader( line
  console.log("start parse html");
  const match = html.match(/initReader\(\s*"([\s\S]*?)",\s*"(.*?)",\s*(\{[\s\S]*?\})\s*\)/);
  console.log("end parse html");
  if (!match) {
    throw new Error("Could not find initReader() call in HTML");
  }

  const [, base64Data, title, optionsRaw] = match;

  // Parse the options object — it's plain JS so we use a loose JSON parse
  // e.g. {direction: "rtl", smooth_scroll: "disabled", fit_to_screen: "enabled"}
  const options: Record<string, string> = {};
  const optMatches = optionsRaw.matchAll(/(\w+)\s*:\s*"([^"]*)"/g);
  for (const [, key, value] of optMatches) {
    options[key] = value;
  }

  return { base64Data, title, options };
}

export const parseChapterPage = async (
  readPageRAW: string,
  chapterId: string,
): Promise<ChapterDetails> => {
  const { base64Data } = parseInitReaderCall(readPageRAW);
  console.log("extracting images");
  const pages = await extractImageUrls(base64Data, "hentainexus.com");
  console.log(pages);
  return {
    type: "images",
    id: chapterId,
    mangaId: chapterId,
    pages: pages,
  };
};

function quotesIfSpaces(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const needsQuotes = /\s/.test(trimmed);
  return needsQuotes ? `"${trimmed}"` : trimmed;
}

// TODO: do the rest in the main for advanced search lul
export const parseCategoryPage = (categoryPageRAW: string): Tag[] => {
  const $ = cheerio.load(categoryPageRAW);

  const tags = $("div.is-multiline").children();
  const tagList: Tag[] = [];

  tags.each((i: number, _el: Element) => {
    const tagTextContent = tags.eq(i).text();
    const cleanTagName = tagTextContent.trim().split("\t\t\t")[0];

    tagList.push({
      id: textToId(cleanTagName),
      title: cleanTagName,
    });
  });
  console.log("category :", tagList.length, "ex:", JSON.stringify(tagList[0]));
  return tagList;
};

export const makeSearchQuery = (
  query: SearchQuery<SearchMetadata>,
  sortingOption?: SortingOption,
): string => {
  // returns the text in the q param of the http request
  // docs at: https://hentainexus.com/page/search
  const terms: string[] = [];
  const title = query.title?.trim();

  if (title) {
    terms.push(title);
  }

  if (sortingOption && sortingOption.id == "popular") terms.push("sort:popular");

  const meta = query.metadata;
  if (meta) {
    const appendCategoryTerms = (
      prefix: tagCategory,
      values: Record<string, "included" | "excluded"> | undefined,
    ) => {
      if (!values || Object.keys(values).length === 0) {
        return;
      }

      Object.entries(values).forEach(([tagName, state]) => {
        const decodedTag = decodeURIComponent(tagName).trim();
        if (!decodedTag) {
          return;
        }

        const encodedTag = quotesIfSpaces(decodedTag);
        if (!encodedTag) {
          return;
        }

        terms.push(`${state === "excluded" ? "-" : ""}${prefix}:${encodedTag}`);
        console.log(
          "prefix",
          prefix,
          "encoded",
          quotesIfSpaces(encodedTag),
          "original",
          decodedTag,
          "originalxoriginal",
          tagName,
        );
      });
    };

    appendCategoryTerms("artist", meta.artist);
    appendCategoryTerms("author", meta.author);
    appendCategoryTerms("tag", meta.tag);

    const appendSingleValueTerm = (prefix: string, value: string | undefined) => {
      const trimmed = value?.trim();
      if (!trimmed) return;
      const encoded = quotesIfSpaces(decodeURIComponent(trimmed));

      terms.push(`${prefix}:${encoded}`);
      console.log("prefix", prefix, "encoded", encoded, "original", value);
    };

    appendSingleValueTerm("parody", meta.parody);
    appendSingleValueTerm("publisher", meta.publisher);
    appendSingleValueTerm("magazine", meta.magazine);
    appendSingleValueTerm("event", meta.event);
    appendSingleValueTerm("circle", meta.circle);
  }

  return encodeURIComponent(terms.join(" ")).replace(/%20/g, "+");
};
