import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import cors from "cors";
import express from "express";
import { env } from "./env.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { leadsRouter } from "./routes/leads.js";
import { runsRouter } from "./routes/runs.js";
import { offersRouter } from "./routes/offers.js";
import { outreachRouter } from "./routes/outreach.js";
import { outreachListsRouter } from "./routes/outreach-lists.js";

const exec = promisify(execCallback);

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/api/campaigns", campaignsRouter);
app.use("/api/runs", runsRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/offers", offersRouter);
app.use("/api/outreach", outreachRouter);
app.use("/api/outreach-lists", outreachListsRouter);

async function freeConfiguredPort(port: number): Promise<void> {
  if (process.platform !== "win32") return;

  try {
    const { stdout } = await exec(`netstat -ano | findstr :${port}`);
    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.includes("LISTENING") && line.includes(`:${port}`));

    const pids = new Set<number>();
    for (const line of lines) {
      const parts = line.split(/\s+/);
      const pidRaw = parts[parts.length - 1];
      const pid = Number(pidRaw);
      if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
        pids.add(pid);
      }
    }

    for (const pid of pids) {
      try {
        await exec(`taskkill /PID ${pid} /F`);
        console.log(`[startup] Killed PID ${pid} using port ${port}.`);
      } catch {
        console.warn(`[startup] Failed to kill PID ${pid} on port ${port}.`);
      }
    }
  } catch {
    // no listener found or command output empty
  }
}

async function start(): Promise<void> {
  await freeConfiguredPort(env.port);

  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
    console.log(`[startup] CORS origins: ${env.corsOrigins.join(", ")}`);
  });
}

void start();
