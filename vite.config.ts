import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { notionFlashcardPlugin } from "./vite.notion.ts";

const S21_JHN_CHAPTER_MP3 =
  process.env.S21_JHN1_MP3 ||
  "C:\\Users\\Clevy\\Projects\\BibleAudioproject\\bible-s21-audiobook\\output\\43_John\\audio\\Chapitre complet\\Jean\\Jean_Chapitre_1.mp3";

function s21ChapterAudioDevPlugin(): Plugin {
  return {
    name: "s21-chapter-audio-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url !== "/s21-audio-sync/jhn/Jean_Chapitre_1.mp3") {
          next();
          return;
        }
        if (!existsSync(S21_JHN_CHAPTER_MP3)) {
          res.statusCode = 404;
          res.end("MP3 em falta — define S21_JHN1_MP3 ou gera Jean 1 no bible-s21-audiobook");
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Accept-Ranges", "bytes");
        createReadStream(S21_JHN_CHAPTER_MP3).pipe(res);
      });
    },
  };
}

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version: string;
};

export default defineConfig(({ mode }) => ({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), notionFlashcardPlugin(mode), s21ChapterAudioDevPlugin()],
  server: {
    host: true,
  },
}));
