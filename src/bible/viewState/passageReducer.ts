import type { PassageLoadErrorKind } from "../passageLoadError";
import type { YouVersionBible, YouVersionPassage } from "../../youversion/client";
import { schemasSamePassage } from "./schema";
import type { PassageSkeletonSchema, PassageViewState } from "./types";

export type PassageReducerAction =
  | { type: "RESET" }
  | {
      type: "NAVIGATE";
      schema: PassageSkeletonSchema;
    }
  | {
      type: "RESOLVE_OK";
      schema: PassageSkeletonSchema;
      passage: YouVersionPassage;
      bibleId?: number | null;
      bible?: YouVersionBible | null;
    }
  | {
      type: "RESOLVE_ERR";
      schema: PassageSkeletonSchema;
      errorKind: PassageLoadErrorKind;
      message: string;
    };

export const initialPassageViewState: PassageViewState = { status: "idle", schema: null };

export function passageReducer(
  state: PassageViewState,
  action: PassageReducerAction,
): PassageViewState {
  switch (action.type) {
    case "RESET":
      return { status: "idle", schema: null };
    case "NAVIGATE": {
      const { schema } = action;
      const stalePassage =
        state.status === "success" &&
        schemasSamePassage(state.schema, schema)
          ? state.passage
          : state.status === "loading" &&
              schemasSamePassage(state.schema, schema) &&
              state.stalePassage
            ? state.stalePassage
            : null;
      const reload = Boolean(stalePassage);
      return {
        status: "loading",
        schema,
        reload,
        stalePassage,
      };
    }
    case "RESOLVE_OK":
      return {
        status: "success",
        schema: action.schema,
        passage: action.passage,
        bibleId: action.bibleId,
        bible: action.bible,
      };
    case "RESOLVE_ERR":
      return {
        status: "error",
        schema: action.schema,
        errorKind: action.errorKind,
        message: action.message,
      };
    default:
      return state;
  }
}

export function displayPassageFromViewState(state: PassageViewState): YouVersionPassage | null {
  if (state.status === "success") return state.passage;
  if (state.status === "loading" && state.stalePassage) return state.stalePassage;
  return null;
}

export function isPassageLoading(state: PassageViewState): boolean {
  return state.status === "loading";
}

export function passageViewStateSchema(state: PassageViewState): PassageSkeletonSchema | null {
  if (state.status === "idle") return state.schema;
  return state.schema;
}
