import nodemailer from "nodemailer";
import type { Job, Profile, RunResult } from "./types.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jobRow(job: Job): string {
  const badge = job.isNew ? `<span style="color:#0b6e4f;font-weight:700;">NEW</span> · ` : "";
  return `
  <tr>
    <td style="padding:14px 0;border-bottom:1px solid #e6e2da;">
      <div style="font-size:15px;font-weight:700;color:#1a1f16;">
        ${badge}${escapeHtml(job.title)}
      </div>
      <div style="color:#4a5240;margin-top:4px;">
        ${escapeHtml(job.company)} · ${escapeHtml(job.location)} · ${escapeHtml(job.source)}
      </div>
      <div style="margin-top:8px;">
        <a href="${escapeHtml(job.url)}" style="color:#0b6e4f;font-weight:600;">Apply on LinkedIn →</a>
      </div>
    </td>
  </tr>`;
}

export function buildEmailHtml(result: RunResult, profile: Profile): string {
  const dashboard = process.env.WEB_DASHBOARD_URL?.trim();
  const top = result.jobs
    .filter((j) => !j.id.startsWith("board-") && !j.userFeedback)
    .slice(0, profile.max_jobs_in_email);
  const newOnes = top.filter((j) => j.isNew);

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3efe6;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:640px;margin:0 auto;padding:28px 20px;">
    <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#6b735f;">Job Radar · Daily</div>
    <h1 style="margin:8px 0 6px;font-size:28px;color:#1a1f16;">Good morning, ${escapeHtml(profile.candidate.name.split(" ")[0])}</h1>
    <p style="margin:0 0 18px;color:#3d4536;line-height:1.5;">
      ${result.newCount} new matched role${result.newCount === 1 ? "" : "s"} today
      · ${result.totalCount} total in the shortlist.
      Focus: Smart Manufacturing / Manufacturing Systems / Engineering Management — Center &amp; Shfela.
    </p>
    ${
      dashboard
        ? `<p style="margin:0 0 22px;"><a href="${escapeHtml(dashboard)}" style="display:inline-block;background:#1a1f16;color:#f7f3ea;text-decoration:none;padding:10px 16px;font-weight:700;">Open web dashboard</a></p>`
        : `<p style="margin:0 0 22px;color:#5a6350;font-size:13px;">Open <code>web/index.html</code> locally for the full dashboard.</p>`
    }
    <table width="100%" cellpadding="0" cellspacing="0">${
      (newOnes.length ? newOnes : top).map(jobRow).join("") ||
      `<tr><td style="padding:16px 0;color:#555;">No strong new matches today — board search links are still on the dashboard.</td></tr>`
    }</table>
    <p style="margin:24px 0 0;font-size:12px;color:#7a8270;">
      Generated ${escapeHtml(result.generatedAt)} · Job Radar for ${escapeHtml(profile.candidate.name)}
    </p>
  </div>
</body></html>`;
}

export async function sendEmail(result: RunResult, profile: Profile): Promise<boolean> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const to = process.env.EMAIL_TO?.trim() || profile.candidate.email;
  const from = process.env.EMAIL_FROM?.trim() || user;

  if (!host || !user || !pass || !from) {
    console.warn("SMTP not configured — skipping email. Copy .env.example → .env and fill SMTP_*.");
    return false;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const newCount = result.newCount;
  const subject =
    newCount > 0
      ? `Job Radar · ${newCount} new match${newCount === 1 ? "" : "es"} for you`
      : `Job Radar · Daily scan (no strong new matches)`;

  await transporter.sendMail({
    from,
    to,
    subject,
    html: buildEmailHtml(result, profile),
  });

  console.log(`Email sent to ${to}`);
  return true;
}
