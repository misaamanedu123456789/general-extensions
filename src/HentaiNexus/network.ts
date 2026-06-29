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

export class HentaiNexusAPI {
  private async fetchText(url: string): Promise<string> {
    const data = await Application.scheduleRequest({ url, method: "GET" });
    if (data[0].status == 404) throw new Error("Error 404:" + data[0].url + ", returned 404");

    return Application.arrayBufferToUTF8String(data[1]);
  }

  async fetchResultPage(page = 1, query = ""): Promise<string> {
    let url = new URL(DOMAIN).addPathComponent("page").addPathComponent(page.toString());
    return this.fetchText(url.toString() + query);
  }

  async fetchMangaPage(mangaId: string): Promise<string> {
    let url = new URL(DOMAIN).addPathComponent("view").addPathComponent(mangaId);
    return this.fetchText(url.toString());
  }

  async fetchChapterPage(chapterId: string): Promise<string> {
    let url = new URL(DOMAIN).addPathComponent("read").addPathComponent(chapterId);
    return this.fetchText(url.toString());
  }
}
