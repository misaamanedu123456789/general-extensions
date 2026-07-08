/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

// TODO:
// - Add extension specific settings

import {
  AdvancedSearchForm,
  ButtonRow,
  Form,
  InputRow,
  LabelRow,
  NavigationRow,
  Section,
  SelectRow,
  ToggleRow,
  TriStateSelectRow,
  type SearchQuery,
  type Tag,
} from "@paperback/types";

import type { Categories, SearchMetadata } from "./models";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("playground", [
        NavigationRow("playground", {
          title: "SourceUI Playground",
          form: new SourceUIPlaygroundForm(),
        }),
      ]),
    ];
  }
}

class SourceUIPlaygroundForm extends Form {
  private inputValue = "";
  private rowsVisible = false;
  private items: string[] = [];

  override getSections() {
    return [
      Section("hideStuff", [
        ToggleRow("toggle", {
          title: "Toggles can hide rows",
          value: this.rowsVisible,
          onValueChange: Application.Selector(
            this as SourceUIPlaygroundForm,
            "handleRowsVisibleChange",
          ),
        }),
      ]),

      ...(this.rowsVisible
        ? [
            Section("hiddenSection", [
              InputRow("input", {
                title: "Dynamic Input",
                value: this.inputValue,
                onValueChange: Application.Selector(
                  this as SourceUIPlaygroundForm,
                  "handleInputChange",
                ),
              }),

              LabelRow("boundLabel", {
                title: "Bound label to input",
                subtitle: "This label updates with the input",
                value: this.inputValue,
              }),
            ]),

            Section("items", [
              ...this.items.map((item) =>
                LabelRow(item, {
                  title: item,
                }),
              ),

              ButtonRow("addNewItem", {
                title: "Add New Item",
                onSelect: Application.Selector(this as SourceUIPlaygroundForm, "addNewItem"),
              }),
            ]),
          ]
        : []),
    ];
  }

  async handleRowsVisibleChange(value: boolean): Promise<void> {
    this.rowsVisible = value;
    this.reloadForm();
  }

  async handleInputChange(value: string): Promise<void> {
    this.inputValue = value;
    this.reloadForm();
  }

  async addNewItem(): Promise<void> {
    this.items.push("Item " + (this.items.length + 1));
    this.reloadForm();
  }
}

export class HentaiNexusAdvancedSearchForm extends AdvancedSearchForm {
  private artist: Record<string, "included" | "excluded">;
  private author: Record<string, "included" | "excluded">;
  private circle: string[];
  private event: string[];
  private magazine: string[];
  private parody: string[];
  private publisher: string[];
  private tag: Record<string, "included" | "excluded">;

  private readonly artistOption: Tag[];
  private readonly authorOption: Tag[];
  private readonly circleOption: Tag[];
  private readonly eventOption: Tag[];
  private readonly magazineOption: Tag[];
  private readonly parodyOption: Tag[];
  private readonly publisherOption: Tag[];
  private readonly tagOption: Tag[];
  constructor(searchQuery: SearchQuery<SearchMetadata>, filters: Categories) {
    console.log("constructor 1");
    super();

    this.artistOption = filters.artist;
    this.authorOption = filters.author;
    this.circleOption = filters.circle;
    this.eventOption = filters.event;
    this.magazineOption = filters.magazine;
    this.parodyOption = filters.parody;
    this.publisherOption = filters.publisher;
    this.tagOption = filters.tag;

    const meta = searchQuery.metadata;
    this.artist = this.getValidTriStateSelection(meta?.artist, this.artistOption);
    this.author = this.getValidTriStateSelection(meta?.author, this.authorOption);
    this.circle = this.getValidSingleSelection(meta?.circle, this.circleOption);
    this.event = this.getValidSingleSelection(meta?.event, this.eventOption);
    this.magazine = this.getValidSingleSelection(meta?.magazine, this.magazineOption);
    this.parody = this.getValidSingleSelection(meta?.parody, this.parodyOption);
    this.publisher = this.getValidSingleSelection(meta?.publisher, this.publisherOption);
    this.tag = this.getValidTriStateSelection(meta?.tag, this.tagOption);
    console.log("constructor 2");
  }

  private getValidSingleSelection(value: string | undefined, options: Tag[]): string[] {
    if (!value) return [];
    return options.some((option) => option.id === value) ? [value] : [];
  }

  private getValidTriStateSelection(
    value: Record<string, "included" | "excluded"> | undefined,
    options: Tag[],
  ): Record<string, "included" | "excluded"> {
    if (!value) return {};

    return Object.fromEntries(
      Object.entries(value).filter(([id]) => options.some((option) => option.id === id)),
    ) as Record<string, "included" | "excluded">;
  }

  override getSections() {
    console.log("getSections");
    return [
      Section("tag", [
        TriStateSelectRow("Tag", {
          title: "Tag",
          layout: "flow",
          value: this.tag,
          items: this.tagOption,
          allowExclusion: true,
          allowEmptySelection: true,
          onValueChange: Application.Selector(
            this as HentaiNexusAdvancedSearchForm,
            "handleTagChange",
          ),
        }),
      ]),
      Section("parody", [
        SelectRow("Parody", {
          title: "Parody",
          layout: "list",
          value: this.parody,
          items: this.parodyOption,
          minItemCount: 0,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as HentaiNexusAdvancedSearchForm,
            "handleParodyChange",
          ),
        }),
      ]),
      Section("artist", [
        TriStateSelectRow("Artist", {
          title: "Artist",
          layout: "list",
          value: this.artist,
          items: this.artistOption,
          allowExclusion: true,
          allowEmptySelection: true,
          onValueChange: Application.Selector(
            this as HentaiNexusAdvancedSearchForm,
            "handleArtistChange",
          ),
        }),
      ]),
      Section("author", [
        TriStateSelectRow("Author", {
          title: "Author",
          layout: "list",
          value: this.author,
          items: this.authorOption,
          allowExclusion: true,
          allowEmptySelection: true,
          onValueChange: Application.Selector(
            this as HentaiNexusAdvancedSearchForm,
            "handleAuthorChange",
          ),
        }),
      ]),
      Section("publisher", [
        SelectRow("Publisher", {
          title: "Publisher",
          layout: "list",
          value: this.publisher,
          items: this.publisherOption,
          minItemCount: 0,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as HentaiNexusAdvancedSearchForm,
            "handlePublisherChange",
          ),
        }),
      ]),
      Section("magazine", [
        SelectRow("Magazine", {
          title: "Magazine",
          layout: "list",
          value: this.magazine,
          items: this.magazineOption,
          minItemCount: 0,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as HentaiNexusAdvancedSearchForm,
            "handleMagazineChange",
          ),
        }),
      ]),
      Section("event", [
        SelectRow("Event", {
          title: "Event",
          layout: "list",
          value: this.event,
          items: this.eventOption,
          minItemCount: 0,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as HentaiNexusAdvancedSearchForm,
            "handleEventChange",
          ),
        }),
      ]),
      Section("circle", [
        SelectRow("Circle", {
          title: "Circle",
          layout: "list",
          value: this.circle,
          items: this.circleOption,
          minItemCount: 0,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as HentaiNexusAdvancedSearchForm,
            "handleCircleChange",
          ),
        }),
      ]),
    ];
  }

  async handleArtistChange(value: Record<string, "included" | "excluded">): Promise<void> {
    this.artist = value;
  }

  async handleAuthorChange(value: Record<string, "included" | "excluded">): Promise<void> {
    this.author = value;
  }

  async handleCircleChange(value: string[]): Promise<void> {
    this.circle = value;
  }

  async handleEventChange(value: string[]): Promise<void> {
    this.event = value;
  }

  async handleMagazineChange(value: string[]): Promise<void> {
    this.magazine = value;
  }

  async handleParodyChange(value: string[]): Promise<void> {
    this.parody = value;
  }

  async handlePublisherChange(value: string[]): Promise<void> {
    this.publisher = value;
  }

  async handleTagChange(value: Record<string, "included" | "excluded">): Promise<void> {
    this.tag = value;
  }

  override getSearchQueryMetadata(): SearchMetadata {
    console.log("making search query");
    const result: SearchMetadata = {};
    if (Object.keys(this.artist).length > 0) result.artist = this.artist;
    if (Object.keys(this.author).length > 0) result.author = this.author;
    if (this.circle.length > 0) result.circle = this.circle[0];
    if (this.event.length > 0) result.event = this.event[0];
    if (this.magazine.length > 0) result.magazine = this.magazine[0];
    if (this.parody.length > 0) result.parody = this.parody[0];
    if (this.publisher.length > 0) result.publisher = this.publisher[0];
    if (Object.keys(this.tag).length > 0) result.tag = this.tag;
    console.log("sending search query");
    return result;
  }
}
