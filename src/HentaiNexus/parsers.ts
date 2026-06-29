import {
  ContentRating,
  type ChapterDetails,
  type ProminentCarouselItem,
  type SearchResultItem,
  type SourceManga,
} from "@paperback/types";
import * as cheerio from "cheerio";

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

export const parseViewPage = (viewPageRAW: string, mangaId: string): SourceManga => {
  const $ = cheerio.load(viewPageRAW);
  const infoBox = $("div.box:first");

  const image = $("figure > img", infoBox).attr("src");

  // Build a dictionary from the table rows
  const tableData: Record<string, any> = {};

  $("table > tbody > tr", infoBox).each((_, row) => {
    const cells = $("td", row);
    const key = cells.first().text().trim().toLowerCase().replace(/\s+/g, "_"); // e.g. "Release Date" → "release_date"
    const value = cells.last();

    if (key) tableData[key] = value;
  });
  console.log(tableData, Object.keys(tableData));
  const artist = tableData["artist"]
    .children()
    .first()
    .clone()
    .find("span")
    .remove()
    .end()
    .text()
    .trim();

  const synopsis = tableData["description"]?.text().trim() ?? "";
  return {
    mangaId,
    mangaInfo: {
      thumbnailUrl: image ?? "",
      synopsis: synopsis ?? "",
      primaryTitle: $("h1.title", infoBox).text().trim(),
      secondaryTitles: [],
      contentRating: ContentRating.ADULT,
      status: "Completed",
      author: artist,
      rating: 0,
      tagGroups: [],
      shareUrl: `${DOMAIN}/view/${mangaId}`,
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
