import "dotenv/config";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { projectRoot } from "./profile.js";
import { entryFromJob, feedbackSummary, loadFeedback, upsertFeedback } from "./feedback.js";
import { runScan, type ScanPayload } from "./scan.js";
import type { FeedbackReasonId } from "./reasons.js";
import type { FeedbackVerdict, Job, RunResult } from "./types.js";

const PORT = Number(process.env.PORT || 8787);
const root = projectRoot();

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

const BINARY = new Set([".png", ".jpg", ".jpeg", ".ico", ".gif", ".webp"]);

function send(res: import("node:http").ServerResponse, status: number, body: string | Buffer, type: string) {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function findJob(jobId: string): Job | undefined {
  const latestPath = join(root, "data", "latest.json");
  if (!existsSync(latestPath)) return undefined;
  try {
    const latest = JSON.parse(readFileSync(latestPath, "utf8")) as RunResult;
    return latest.jobs.find((j) => j.id === jobId);
  } catch {
    return undefined;
  }
}

let inFlight: Promise<ScanPayload> | null = null;

async function handleScan(): Promise<ScanPayload> {
  if (inFlight) return inFlight;
  inFlight = runScan()
    .then((r) => r.payload)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (req.method === "OPTIONS") {
    send(res, 204, "", "text/plain");
    return;
  }

  if ((url.pathname === "/api/scan" || url.pathname === "/api/refresh") && (req.method === "POST" || req.method === "GET")) {
    try {
      const payload = await handleScan();
      send(res, 200, JSON.stringify(payload), "application/json; charset=utf-8");
    } catch (err) {
      send(res, 500, JSON.stringify({ error: String(err) }), "application/json; charset=utf-8");
    }
    return;
  }

  if (url.pathname === "/api/feedback" && req.method === "GET") {
    const entries = loadFeedback();
    send(
      res,
      200,
      JSON.stringify({ entries, summary: feedbackSummary(entries) }),
      "application/json; charset=utf-8"
    );
    return;
  }

  if (url.pathname === "/api/feedback" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw) as {
        jobId?: string;
        verdict?: FeedbackVerdict;
        reasons?: FeedbackReasonId[];
        note?: string;
        job?: Job;
      };

      if (!body.jobId || (body.verdict !== "relevant" && body.verdict !== "not_relevant")) {
        send(res, 400, JSON.stringify({ error: "jobId and verdict required" }), "application/json");
        return;
      }

      const job = body.job || findJob(body.jobId);
      if (!job) {
        send(res, 404, JSON.stringify({ error: "job not found — run a search first" }), "application/json");
        return;
      }

      const reasons = Array.isArray(body.reasons) ? body.reasons : [];
      if (body.verdict === "not_relevant" && reasons.length === 0) {
        send(
          res,
          400,
          JSON.stringify({ error: "Pick at least one reason why this is not relevant" }),
          "application/json"
        );
        return;
      }

      const entries = upsertFeedback(entryFromJob(job, body.verdict, reasons, body.note));
      send(
        res,
        200,
        JSON.stringify({
          ok: true,
          summary: feedbackSummary(entries),
          verdict: body.verdict,
          reasons,
        }),
        "application/json; charset=utf-8"
      );
      console.log(`Feedback: ${body.verdict} [${reasons.join(", ")}] → ${job.title}`);
    } catch (err) {
      send(res, 500, JSON.stringify({ error: String(err) }), "application/json");
    }
    return;
  }

  let filePath = join(root, "web", url.pathname === "/" ? "index.html" : url.pathname);
  if (!existsSync(filePath)) {
    send(res, 404, "Not found", "text/plain");
    return;
  }

  const type = MIME[extname(filePath)] || "application/octet-stream";
  if (BINARY.has(extname(filePath).toLowerCase())) {
    send(res, 200, readFileSync(filePath), type);
    return;
  }
  send(res, 200, readFileSync(filePath, "utf8"), type);
});

server.listen(PORT, () => {
  console.log(`RADAR live search: http://localhost:${PORT}`);
  console.log("Refresh the page (or Search now) to scan LinkedIn, AllJobs, JobMaster.");
});
