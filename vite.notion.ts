import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { handleYouVersion } from "./api/youversion.mjs";
import { handleBibleAudio } from "./api/bible-audio.mjs";

/**
 * Dev/preview middleware for local Bible APIs (S21 + audio catalog).
 * Kept filename `vite.notion.ts` for import stability in vite.config.
 */
export function notionFlashcardPlugin(_mode: string): Plugin {
  const mount = (server: {
    middlewares: {
      use: (
        path: string,
        fn: (req: IncomingMessage, res: ServerResponse) => void,
      ) => void;
    };
  }) => {
    server.middlewares.use("/api/youversion", (req, res) => {
      void handleYouVersion(req, res);
    });
    server.middlewares.use("/api/bible-audio", (req, res) => {
      void handleBibleAudio(req, res);
    });
  };
  return {
    name: "bible-dev-api",
    configureServer: mount,
    configurePreviewServer: mount,
  };
}
