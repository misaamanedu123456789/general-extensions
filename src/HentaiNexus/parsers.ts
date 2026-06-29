import {
  ContentRating,
  type ChapterDetails,
  type ProminentCarouselItem,
  type SearchResultItem,
  type SourceManga,
  type Tag,
  type TagSection,
} from "@paperback/types";
import * as cheerio from "cheerio";
import type { Element } from "domhandler"; // Cheerio's Element, not the DOM's

import { extractImageUrls } from "./decrypt";
import { DOMAIN, type InitReaderArgs } from "./models";

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
    return element.children().first().clone().find("span").remove().end().text().trim();
  };

  console.log(tableData, Object.keys(tableData));

  const title = $("h1.title", infoBox).text().trim();

  const artist = tableRes(tableData["artist"]);
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

  const displayedSynopsis = `${likes} likes | ${pages} pages | publisher: ${publisher}${synopsis ? "\n\n" + synopsis : ""}`;
  // .trim().replace(/\s*\(.*\)$/, "").trim()
  console.log(JSON.stringify({ title, artist, publisher, synopsis, likes, pages }, null, 4));
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

// TODO: do the rest in the main for advanced search lul
export const parseCategoryPage = (categoryPageRAW: string): Tag[] => {
  const $ = cheerio.load(categoryPageRAW);

  const tags = $("div.is-multiline").children();
  const tagList: Tag[] = [];

  tags.each((i: number, _el: Element) => {
    const tagTextContent = tags.eq(i).text();
    const cleanTagName = tagTextContent.trim().replace(/\s*\(\d[\d,]*\)$/, "");

    tagList.push({
      id: textToId(cleanTagName),
      title: cleanTagName,
    });
  });
  return tagList;
};
