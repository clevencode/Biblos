import type { CatalogSource } from "../bibleCatalogRepository";
import type { YouVersionBible, YouVersionBook } from "../../youversion/client";

export type CatalogViewState =
  | {
      status: "loading";
      books: YouVersionBook[];
      bible: YouVersionBible;
      source: CatalogSource;
    }
  | {
      status: "ready";
      books: YouVersionBook[];
      bible: YouVersionBible;
      source: CatalogSource;
      isOffline: boolean;
      isNetworkRefresh: boolean;
    };
