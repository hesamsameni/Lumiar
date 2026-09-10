// ============================================================
// Email — thin wrapper around the Resend REST API.
// No extra package required; uses $fetch from the Nitro runtime.
//
// Required env vars:
//   RESEND_API_KEY  — Resend API key (https://resend.com)
//   ADMIN_EMAIL     — recipient address for admin notifications
// ============================================================

interface ResendPayload {
  from: string
  to: string | string[]
  subject: string
  html: string
}

export async function sendAdminEmail(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!apiKey || !to) {
    console.warn('[email] RESEND_API_KEY or ADMIN_EMAIL is not set — skipping email.')
    return
  }

  const payload: ResendPayload = {
    from: 'Lumiar <noreply@lumiar.app>',
    to,
    subject,
    html,
  }

  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: payload,
    })
  } catch (err) {
    console.error('[email] Failed to send admin email:', err)
  }
}

// ── Email templates ───────────────────────────────────────────

export interface SyncEmailModel {
  id: string
  name: string
  tier: string
  tokens_per_generation: number
  price_estimate: string
  flags?: string[]
}

export function buildSyncEmailHtml(opts: {
  imageModels: SyncEmailModel[]
  videoModels: SyncEmailModel[]
  skippedImage: SyncEmailModel[]
  siteUrl: string
}): string {
  const { imageModels, videoModels, skippedImage, siteUrl } = opts

  const total = imageModels.length + videoModels.length
  if (total === 0 && skippedImage.length === 0) return ''

  const row = (m: SyncEmailModel) => {
    const flagHtml = m.flags?.length
      ? `<br><small style="color:#f59e0b">⚠ ${m.flags.join(' · ')}</small>`
      : ''
    return `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #1e293b">${m.name}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;font-family:monospace;font-size:12px">${m.id}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #1e293b">${m.tier}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #1e293b">${m.tokens_per_generation} cr</td>
        <td style="padding:6px 12px;border-bottom:1px solid #1e293b">${m.price_estimate}${flagHtml}</td>
      </tr>`
  }

  const tableHeader = `
    <tr style="background:#1e293b">
      <th style="padding:8px 12px;text-align:left">Name</th>
      <th style="padding:8px 12px;text-align:left">Model ID</th>
      <th style="padding:8px 12px;text-align:left">Tier</th>
      <th style="padding:8px 12px;text-align:left">Credits</th>
      <th style="padding:8px 12px;text-align:left">Price</th>
    </tr>`

  const imageSection = imageModels.length > 0 ? `
    <h2 style="color:#e2e8f0;margin-top:24px">🖼 Image Models (${imageModels.length})</h2>
    <table style="width:100%;border-collapse:collapse;background:#0f172a;color:#e2e8f0;font-size:13px">
      ${tableHeader}
      ${imageModels.map(row).join('')}
    </table>` : ''

  const videoSection = videoModels.length > 0 ? `
    <h2 style="color:#e2e8f0;margin-top:24px">🎬 Video Models (${videoModels.length})</h2>
    <table style="width:100%;border-collapse:collapse;background:#0f172a;color:#e2e8f0;font-size:13px">
      ${tableHeader}
      ${videoModels.map(row).join('')}
    </table>` : ''

  const skippedSection = skippedImage.length > 0 ? `
    <h2 style="color:#f59e0b;margin-top:24px">⚠ Skipped — Token-based Pricing (${skippedImage.length})</h2>
    <p style="color:#94a3b8;font-size:13px">These image models use per-token pricing and cannot be auto-priced. Add them manually.</p>
    <table style="width:100%;border-collapse:collapse;background:#0f172a;color:#e2e8f0;font-size:13px">
      ${tableHeader}
      ${skippedImage.map(row).join('')}
    </table>` : ''

  const adminUrl = `${siteUrl}/admin`

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#020817;color:#e2e8f0;padding:24px;max-width:800px;margin:0 auto">
  <h1 style="color:#fff">Lumiar — New Models Detected</h1>
  <p style="color:#94a3b8">
    The weekly model sync found <strong style="color:#fff">${total} new model${total === 1 ? '' : 's'}</strong>
    from OpenRouter. All have been added with <code style="background:#1e293b;padding:2px 6px;border-radius:4px">is_active = false</code>
    — review and activate them in the admin dashboard.
  </p>

  ${imageSection}
  ${videoSection}
  ${skippedSection}

  <div style="margin-top:32px">
    <a href="${adminUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">
      Open Admin Dashboard →
    </a>
  </div>

  <hr style="border-color:#1e293b;margin-top:32px">
  <p style="color:#475569;font-size:12px">
    Models with unknown companies need a logo added to <code>public/ai-logos/</code>
    and an entry in <code>app/utils/modelCompanies.ts</code> before they appear correctly in the picker.
  </p>
</body>
</html>`
}
