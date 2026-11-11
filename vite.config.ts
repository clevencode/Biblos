import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import os from "node:os";
import { notionFlashcardPlugin } from "./vite.notion.ts";

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version: string;
};

/** Interfaces virtuais/VPN que o Vite lista como "Network" mas o celular não alcança. */
const SKIP_IFACE =
  /loopback|virtual|vethernet|hyper-v|topaz|vpn|tun|tap|bluetooth|km-test/i;

/** Primeiro IPv4 privado (RFC1918) numa interface real — típico Wi‑Fi/Ethernet. */
function privateLanIPv4(): string | null {
  const nets = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(nets)) {
    if (SKIP_IFACE.test(name)) continue;
    for (const net of addrs ?? []) {
      const v4 = net.family === "IPv4" || (net.family as unknown) === 4;
      if (!v4 || net.internal) continue;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(net.address)) {
        return net.address;
      }
    }
  }
  return null;
}

/** Destaca o URL Wi‑Fi correcto (evita IP do Topaz Loopback / VPN). */
function lanUrlHintPlugin(): Plugin {
  const lan = privateLanIPv4();
  const logUrl = (
    logger: { info: (msg: string) => void; warn: (msg: string) => void },
    port: number,
  ) => {
    if (lan) {
      logger.info(
        `\n  \u001b[32mCelular (mesma Wi‑Fi):\u001b[0m http://${lan}:${port}/\n`,
      );
    } else {
      logger.warn(
        "\n  Nenhum IPv4 privado encontrado — o celular pode não alcançar este PC.\n",
      );
    }
  };

  return {
    name: "biblos-lan-url",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const addr = server.httpServer?.address();
        const port = addr && typeof addr === "object" ? addr.port : 5173;
        logUrl(server.config.logger, port);
      });
    },
    configurePreviewServer(server) {
      server.httpServer?.once("listening", () => {
        const addr = server.httpServer?.address();
        const port = addr && typeof addr === "object" ? addr.port : 4173;
        logUrl(server.config.logger, port);
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), notionFlashcardPlugin(mode), lanUrlHintPlugin()],
  // 0.0.0.0 = localhost + LAN (celular). Evita host só em 127.0.0.1.
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
}));
