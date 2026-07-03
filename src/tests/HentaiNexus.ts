import type { SearchQuery } from "@paperback/types";
import { expect } from "chai";

import type { SearchMetadata } from "../HentaiNexus/models.js";
import { makeSearchQuery } from "../HentaiNexus/parsers.js";

export async function runTests() {
  const cases: Array<{ name: string; query: SearchQuery<SearchMetadata>; expected: string }> = [
    {
      name: "builds simple tag search with included and excluded terms",
      query: {
        title: "The Real Izumi-san",
        metadata: {
          tag: {
            "tag%3Aahegao": "included",
            "tag%3Akogal": "included",
            "tag%3Ax-ray": "excluded",
          },
        },
      },
      expected: "The Real Izumi-san tag:ahegao tag:kogal -tag:x-ray",
    },
    {
      name: "quotes values that contain spaces",
      query: {
        title: "",
        metadata: {
          magazine: "Comic Kairakuten 2019-04",
        },
      },
      expected: 'magazine:"Comic+Kairakuten+2019-04"',
    },
    {
      name: "uses the correct prefix for multiple category filters",
      query: {
        title: "",
        metadata: {
          artist: {
            NaPaTa: "included",
          },
          tag: {
            vanilla: "included",
          },
        },
      },
      expected: "artist:NaPaTa tag:vanilla",
    },
  ];

  for (const testCase of cases) {
    expect(makeSearchQuery(testCase.query)).to.equal(testCase.expected, testCase.name);
  }
}
