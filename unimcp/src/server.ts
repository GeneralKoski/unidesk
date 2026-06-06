#!/usr/bin/env -S npx tsx
/**
 * unimcp - server MCP che espone Esse3 ed Elly come tool per l'orchestratore.
 *
 * Le credenziali si leggono dal `.env` alla root (vedi @unidesk/core/config).
 * Tutto in SOLA LETTURA: nessuna scrittura/prenotazione è esposta qui.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Esse3Client, ellyClient, credentialStatus } from "@unidesk/core";

const server = new McpServer({ name: "unimcp", version: "0.1.0" });

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: "text" as const, text: `Errore: ${message}` }],
  };
}

server.registerTool(
  "status",
  {
    title: "Stato credenziali",
    description:
      "Mostra se le credenziali Esse3 ed Elly sono configurate nel .env (senza esporre i valori).",
    inputSchema: {},
  },
  async () => json(credentialStatus()),
);

server.registerTool(
  "esse3_carriere",
  {
    title: "Carriere Esse3",
    description:
      "Elenca le carriere (trattiCarriera) dell'utente. La attiva ha staStuCod='A'.",
    inputSchema: {},
  },
  async () => {
    try {
      return json(await new Esse3Client().getCarriere());
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "esse3_libretto",
  {
    title: "Libretto Esse3",
    description:
      "Restituisce il libretto (esami superati/da fare, CFU, media ponderata). Se matId non è fornito usa la carriera attiva.",
    inputSchema: {
      matId: z
        .number()
        .optional()
        .describe("matId della carriera; se assente usa la carriera attiva"),
    },
  },
  async ({ matId }) => {
    try {
      const client = new Esse3Client();
      const id = matId ?? (await client.getActiveCareer()).matId;
      return json(await client.getLibretto(id));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "esse3_appelli",
  {
    title: "Appelli Esse3 (probe, sola lettura)",
    description:
      "Probe del calesa-service per appelli/prenotazioni. cdsId e adId si prendono da chiaveADContestualizzata di una riga del libretto.",
    inputSchema: {
      cdsId: z.number().describe("cdsId dalla chiaveADContestualizzata"),
      adId: z.number().describe("adId dalla chiaveADContestualizzata"),
    },
  },
  async ({ cdsId, adId }) => {
    try {
      return json(await new Esse3Client().getAppelli(cdsId, adId));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "elly_courses",
  {
    title: "Corsi Elly",
    description: "Elenca i corsi Moodle (Elly) a cui l'utente è iscritto.",
    inputSchema: {},
  },
  async () => {
    try {
      return json(await ellyClient().getCourses());
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "elly_course_contents",
  {
    title: "Contenuti corso Elly",
    description:
      "Sezioni, moduli e file di un corso Elly. courseid si prende da elly_courses.",
    inputSchema: {
      courseid: z.number().describe("id del corso (da elly_courses)"),
    },
  },
  async ({ courseid }) => {
    try {
      return json(await ellyClient().getCourseContents(courseid));
    } catch (err) {
      return fail(err);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
