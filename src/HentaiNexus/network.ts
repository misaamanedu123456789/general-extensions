/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

import {
  CloudflareError,
  PaperbackInterceptor,
  URL,
  type Request,
  type Response,
} from "@paperback/types";

import { DOMAIN } from "./models";

// Intercepts all the requests and responses and allows you to make changes to them
export class HentaiNexusInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    return {
      ...request,
      headers: {
        "user-agent": await Application.getDefaultUserAgent(),
        ...request.headers,
      },
    };
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    const cfMitigated = response.headers?.["cf-mitigated"];
    if (cfMitigated === "challenge") {
      throw new CloudflareError({
        url: `${DOMAIN}/`,
        method: request.method ?? "GET",
        headers: {
          "user-agent": await Application.getDefaultUserAgent(),
        },
      });
    }

    return data;
  }
}

export const fetchText = async (url: string): Promise<string> => {
  const data = await Application.scheduleRequest({ url, method: "GET" });
  if (data[0].status == 404) throw new Error("Error 404:" + data[0].url + ", returned 404");

  return Application.arrayBufferToUTF8String(data[1]);
};

export const fetchData = (segments: string[], query?: Record<string, string>): Promise<string> => {
  const url = new URL(DOMAIN);
  segments.forEach((s) => url.addPathComponent(s));
  let queryStr = "";
  // doesn't use `url.setQueryItem(k, v)` because it URLEncore everything even when I don't want it to
  if (query)
    for (const [k, v] of Object.entries(query))
      queryStr += (queryStr == "" ? "?" : "&") + k + "=" + v;
  console.log(queryStr);
  return fetchText(url.toString() + queryStr);
};
