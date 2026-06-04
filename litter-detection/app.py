"""
LDS Dashboard — app.py
Flask web UI to review litter events.

Usage:
    python app.py
    Then open http://localhost:5000
"""

import json
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path

from flask import Flask, abort, jsonify, render_template_string, request, send_file

# ── Email config (set these or export as env vars) ────────────────────────────
SMTP_USER = os.environ.get("LDS_SMTP_USER", "")   # your Gmail address
SMTP_PASS = os.environ.get("LDS_SMTP_PASS", "")   # Gmail App Password

EVIDENCE_DIR = Path("evidence")
LOG_FILE = EVIDENCE_DIR / "events.json"

app = Flask(__name__)

DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LDS - Litter Detection System</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script>
function updateSend(idx, timestamp) {
  var name = document.getElementById("name-" + idx).value.trim();
  var reg  = document.getElementById("reg-"  + idx).value.trim();
  var btn  = document.getElementById("send-" + idx);
  if (name && reg) {
    btn.classList.add("visible");
    btn.dataset.name = name;
    btn.dataset.reg  = reg;
    btn.dataset.ts   = timestamp;
  } else {
    btn.classList.remove("visible");
  }
}
function sendReport(idx) {
  var btn  = document.getElementById("send-" + idx);
  var name = btn.dataset.name;
  var reg  = btn.dataset.reg;
  btn.textContent = "Sending...";
  btn.style.opacity = "0.6";
  fetch("/send_report", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({idx: parseInt(idx), name: name, reg: reg})
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.ok) {
      btn.textContent = "✓ Sent!";
      btn.style.background = "linear-gradient(135deg,#5ef2a0,#27d5a7)";
    } else {
      btn.textContent = "✉ Send Report";
      btn.style.opacity = "1";
      alert("Failed to send: " + data.error);
    }
  })
  .catch(function(e) {
    btn.textContent = "✉ Send Report";
    btn.style.opacity = "1";
    alert("Network error: " + e);
  });
}
</script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #07140e;
    --panel:     #0f2a1c;
    --border:    #1a3d28;
    --lime:      #b8ff3c;
    --mint:      #5ef2a0;
    --teal:      #27d5a7;
    --text:      #d4f5e2;
    --muted:     #4d8c6a;
    --danger:    #ff5c5c;
  }

  body {
    font-family: 'Sora', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
  }

  /* ── Noise grain overlay ── */
  body::before {
    content: '';
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    opacity: .025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px;
  }

  /* ── Header ── */
  header {
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 2rem;
    background: rgba(7,20,14,.7);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
  }

  .brand { display: flex; align-items: center; gap: .75rem; }

  .logo-mark {
    width: 38px; height: 38px; border-radius: 10px;
    background: linear-gradient(135deg, var(--lime), var(--teal));
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .logo-mark svg { width: 20px; height: 20px; color: #06241a; }

  .brand-text { display: flex; flex-direction: column; line-height: 1.15; }
  .brand-text .app-name {
    font-size: 1.1rem; font-weight: 700;
    background: linear-gradient(90deg, var(--lime), var(--mint));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .brand-text .app-sub { font-size: .68rem; color: var(--muted); font-weight: 400; }

  .header-right { display: flex; align-items: center; gap: .75rem; }

  .pill {
    display: inline-flex; align-items: center; gap: .35rem;
    padding: .3rem .85rem; border-radius: 9999px; font-size: .72rem; font-weight: 600;
    border: 1px solid var(--border);
  }
  .pill-live { background: rgba(94,242,160,.1); color: var(--mint); border-color: rgba(94,242,160,.25); }
  .pill-live::before {
    content: ''; width: 6px; height: 6px; border-radius: 50%;
    background: var(--mint); animation: pulse 1.5s infinite;
  }
  .pill-count { background: rgba(184,255,60,.08); color: var(--lime); border-color: rgba(184,255,60,.2); }

  @keyframes pulse {
    0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(94,242,160,.4); }
    50% { opacity: .7; box-shadow: 0 0 0 4px rgba(94,242,160,0); }
  }

  /* ── Main layout ── */
  main { position: relative; z-index: 1; padding: 2rem; max-width: 1400px; margin: 0 auto; }

  /* ── Section title ── */
  .section-title {
    font-size: .7rem; font-weight: 600; letter-spacing: .12em;
    text-transform: uppercase; color: var(--muted); margin-bottom: 1rem;
  }

  /* ── Stat cards ── */
  .stats { display: flex; gap: 1rem; margin-bottom: 2.5rem; flex-wrap: wrap; }

  .stat-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.2rem 1.6rem;
    min-width: 150px;
    transition: transform .2s, box-shadow .2s;
  }
  .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,.4); }

  .stat-card .val {
    font-size: 2.2rem; font-weight: 700; line-height: 1;
    background: linear-gradient(135deg, var(--lime), var(--teal));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .stat-card .lbl { font-size: .75rem; color: var(--muted); margin-top: .35rem; font-weight: 500; }

  /* ── Events grid ── */
  .events-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .event-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 20px;
    overflow: hidden;
    transition: transform .25s, box-shadow .25s;
  }
  .event-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(184,255,60,.1);
  }

  .thumb-wrap { position: relative; width: 100%; height: 190px; background: #0a1f13; }
  .thumb-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb-wrap .no-img {
    width: 100%; height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: .5rem; color: var(--muted); font-size: .8rem;
  }
  .thumb-wrap .no-img svg { opacity: .4; }

  .thumb-badge {
    position: absolute; top: .75rem; left: .75rem;
    background: rgba(7,20,14,.75); backdrop-filter: blur(8px);
    border: 1px solid rgba(184,255,60,.3);
    color: var(--lime); font-size: .65rem; font-weight: 700;
    letter-spacing: .08em; text-transform: uppercase;
    padding: .25rem .65rem; border-radius: 9999px;
  }

  .event-info { padding: 1rem 1.1rem .6rem; }
  .event-info .ev-label {
    font-size: 1rem; font-weight: 700; text-transform: capitalize; color: var(--text);
  }
  .event-info .ev-ts {
    font-size: .72rem; color: var(--muted); margin-top: .25rem; font-weight: 400;
  }
  .event-info .ev-meta {
    margin-top: .5rem;
    display: inline-flex; align-items: center; gap: .3rem;
    font-size: .7rem; font-weight: 600; color: var(--mint);
    background: rgba(94,242,160,.08); border: 1px solid rgba(94,242,160,.15);
    padding: .2rem .65rem; border-radius: 9999px;
  }

  .event-actions { display: flex; gap: .6rem; padding: .75rem 1.1rem 1.1rem; }

  .btn {
    display: inline-flex; align-items: center; gap: .4rem;
    padding: .5rem 1.1rem; border-radius: 9999px;
    font-size: .78rem; font-weight: 600; text-decoration: none;
    border: none; cursor: pointer; transition: all .2s;
  }
  .btn-primary {
    background: linear-gradient(135deg, var(--lime), var(--teal));
    color: #07140e;
  }
  .btn-primary:hover { opacity: .88; transform: scale(1.03); }
  .btn-outline {
    background: transparent; color: var(--muted);
    border: 1px solid var(--border);
  }
  .btn-outline:hover { color: var(--text); border-color: var(--muted); }

  /* ── Tag person form ── */
  .tag-form {
    border-top: 1px solid var(--border);
    padding: .85rem 1.1rem 1rem;
    display: flex; flex-direction: column; gap: .55rem;
  }
  .tag-form-title {
    font-size: .65rem; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: var(--muted);
  }
  .tag-inputs { display: flex; gap: .5rem; }
  .tag-inputs input {
    flex: 1; background: var(--bg); border: 1px solid var(--border);
    border-radius: 8px; padding: .45rem .75rem;
    font-size: .75rem; font-family: inherit; color: var(--text);
    outline: none; transition: border-color .2s;
  }
  .tag-inputs input::placeholder { color: var(--muted); }
  .tag-inputs input:focus { border-color: var(--teal); }
  .btn-send {
    width: 100%; margin-top: .2rem;
    display: none; align-items: center; justify-content: center; gap: .4rem;
    padding: .55rem 1rem; border-radius: 9999px; border: none; cursor: pointer;
    background: linear-gradient(135deg, var(--lime), var(--teal));
    color: #07140e; font-size: .78rem; font-weight: 700;
    font-family: inherit; transition: opacity .2s, transform .2s;
    text-decoration: none;
  }
  .btn-send.visible { display: inline-flex; }
  .btn-send:hover { opacity: .88; transform: scale(1.02); }

  /* ── Empty state ── */
  .empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 6rem 2rem; text-align: center; gap: 1rem;
  }
  .empty-icon {
    width: 72px; height: 72px; border-radius: 20px;
    background: var(--panel); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center; font-size: 2rem;
  }
  .empty h2 { font-size: 1.3rem; font-weight: 700; color: var(--text); }
  .empty p { font-size: .85rem; color: var(--muted); max-width: 360px; line-height: 1.6; }
  .empty code {
    display: inline-block; margin-top: .5rem;
    background: var(--panel); border: 1px solid var(--border);
    padding: .4rem .9rem; border-radius: 8px;
    font-size: .78rem; color: var(--lime); font-family: monospace;
  }

  /* ── Footer ── */
  footer {
    position: relative; z-index: 1;
    text-align: center; padding: 2rem;
    font-size: .7rem; color: var(--muted); border-top: 1px solid var(--border);
  }
</style>
</head>
<body>

<header>
  <div class="brand">
    <div class="logo-mark">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06241a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </svg>
    </div>
    <div class="brand-text">
      <span class="app-name">LDS by Bro Codes</span>
      <span class="app-sub">Litter Detection System</span>
    </div>
  </div>
  <div class="header-right">
    <span class="pill pill-live">Live</span>
    <span class="pill pill-count">{{ events|length }} Event{% if events|length != 1 %}s{% endif %}</span>
  </div>
</header>

<main>

  

  <!-- Events -->
  {% if events %}
  <p class="section-title">Flagged Incidents</p>
  <div class="events-grid">
    {% for ev in events|reverse %}
    <div class="event-card">
      <div class="thumb-wrap">
        {% if ev.frame_path and ev.frame_path != "" %}
          <img src="/frame/{{ loop.revindex0 }}" alt="event frame" loading="lazy">
        {% else %}
          <div class="no-img">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <span>No thumbnail</span>
          </div>
        {% endif %}
        <span class="thumb-badge">{{ ev['label'] or 'litter' }}</span>
      </div>

      <div class="event-info">
        <div class="ev-label">{{ ev['label'] or ev.get('class', 'litter') }}</div>
        <div class="ev-ts">{{ ev.timestamp }}</div>
        <div class="ev-meta">
          {% if ev.confidence %}
            ✓ {{ "%.0f"|format(ev.confidence * 100) }}% confidence
          {% else %}
            ◎ Motion detected
          {% endif %}
        </div>
      </div>

      <div class="event-actions">
        {% if ev.clip_path and ev.clip_path != "" %}
        <a class="btn btn-primary" href="/clip/{{ loop.revindex0 }}" target="_blank">
          ▶ Review Clip
        </a>
        {% endif %}
        <a class="btn btn-outline" href="/api/events" target="_blank">JSON</a>
      </div>

      <!-- Tag & notify form -->
      <div class="tag-form" id="form-{{ loop.revindex0 }}">
        <div class="tag-form-title">🏷 Tag &amp; Notify Offender</div>
        <div class="tag-inputs">
          <input type="text"
                 placeholder="Full name"
                 oninput="updateSend('{{ loop.revindex0 }}','{{ ev.timestamp }}')"
                 id="name-{{ loop.revindex0 }}">
          <input type="text"
                 placeholder="Reg number"
                 oninput="updateSend('{{ loop.revindex0 }}','{{ ev.timestamp }}')"
                 id="reg-{{ loop.revindex0 }}">
        </div>
        <button class="btn-send" id="send-{{ loop.revindex0 }}" onclick="sendReport('{{ loop.revindex0 }}')">
          ✉ Send Report
        </button>
      </div>
    </div>
    {% endfor %}
  </div>

  {% else %}
  <div class="empty">
    <div class="empty-icon">🌍</div>
    <h2>No incidents logged yet</h2>
    <p>Run the detector on a video or webcam feed to start catching litter events.</p>
    <code>python detect.py --source 0 --show</code>
  </div>
  {% endif %}
<!-- Stats row -->
  {% if events %}
  {% set labels = events|map(attribute='label')|list %}
  <p class="section-title">Overview</p>
  <div class="stats">
    <div class="stat-card">
      <div class="val">{{ events|length }}</div>
      <div class="lbl">Total Events</div>
    </div>
    {% set litter_count = labels|select("equalto", "litter")|list|length %}
    {% if litter_count %}
    <div class="stat-card">
      <div class="val">{{ litter_count }}</div>
      <div class="lbl">Motion Detected</div>
    </div>
    {% endif %}
    {% for cls_name in ['bottle','cup','bag','handbag','suitcase','wine glass'] %}
    {% set n = labels|select("equalto", cls_name)|list|length %}
    {% if n %}
    <div class="stat-card">
      <div class="val">{{ n }}</div>
      <div class="lbl">{{ cls_name|capitalize }}</div>
    </div>
    {% endif %}
    {% endfor %}
  </div>
  {% endif %}
</main>

<footer>
  LDS by Bro Codes &nbsp;·&nbsp; Litter Detection System &nbsp;·&nbsp; Powered by YOLOv8
</footer>


</body>
</html>
"""


def load_events() -> list:
    if not LOG_FILE.exists():
        return []
    with open(LOG_FILE) as f:
        return json.load(f)


@app.route("/")
def index():
    events = load_events()
    return render_template_string(DASHBOARD_HTML, events=events)


@app.route("/api/events")
def api_events():
    return jsonify(load_events())


@app.route("/frame/<int:idx>")
def serve_frame(idx: int):
    events = load_events()
    real_idx = len(events) - 1 - idx
    if real_idx < 0 or real_idx >= len(events):
        abort(404)
    path = events[real_idx].get("frame_path", "")
    if not path or not os.path.exists(path):
        abort(404)
    return send_file(path, mimetype="image/jpeg")


@app.route("/clip/<int:idx>")
def serve_clip(idx: int):
    events = load_events()
    real_idx = len(events) - 1 - idx
    if real_idx < 0 or real_idx >= len(events):
        abort(404)
    ev = events[real_idx]
    path = ev.get("clip_path", "")
    if not path or not os.path.exists(path):
        abort(404)
    label = ev.get("label") or ev.get("class", "litter")
    ts = ev.get("timestamp", "")
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap" rel="stylesheet">
<title>Clip — {ts}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Sora', system-ui, sans-serif;
    background: #07140e; color: #d4f5e2;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 100vh; gap: 1.5rem; padding: 2rem;
  }}
  .chip {{
    background: rgba(184,255,60,.08); border: 1px solid rgba(184,255,60,.2);
    color: #b8ff3c; font-size: .72rem; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase;
    padding: .3rem .9rem; border-radius: 9999px;
  }}
  h2 {{ font-size: 1.1rem; font-weight: 600; text-transform: capitalize; }}
  p {{ font-size: .78rem; color: #4d8c6a; }}
  video {{
    max-width: min(860px, 92vw); width: 100%;
    border-radius: 16px; background: #000;
    box-shadow: 0 24px 60px rgba(0,0,0,.6);
  }}
  .back {{
    display: inline-flex; align-items: center; gap: .4rem;
    padding: .5rem 1.2rem; border-radius: 9999px;
    background: linear-gradient(135deg, #b8ff3c, #27d5a7);
    color: #07140e; font-weight: 700; font-size: .8rem;
    text-decoration: none; transition: opacity .2s;
  }}
  .back:hover {{ opacity: .85; }}
</style></head>
<body>
  <span class="chip">Litter Event</span>
  <h2>{label} detected</h2>
  <p>{ts}</p>
  <video controls autoplay src="/clip_raw/{idx}"></video>
  <a class="back" href="/">← Back to Dashboard</a>
</body></html>"""
    return html


@app.route("/clip_raw/<int:idx>")
def serve_clip_raw(idx: int):
    events = load_events()
    real_idx = len(events) - 1 - idx
    if real_idx < 0 or real_idx >= len(events):
        abort(404)
    path = events[real_idx].get("clip_path", "")
    if not path or not os.path.exists(path):
        abort(404)
    return send_file(path, mimetype="video/mp4")


@app.route("/send_report", methods=["POST"])
def send_report():
    data = request.get_json()
    idx  = data.get("idx")
    name = data.get("name", "").strip()
    reg  = data.get("reg",  "").strip()

    if not name or not reg:
        return jsonify(ok=False, error="Name and reg number required")
    if not SMTP_USER or not SMTP_PASS:
        return jsonify(ok=False, error="SMTP not configured. Set LDS_SMTP_USER and LDS_SMTP_PASS env vars.")

    events   = load_events()
    real_idx = len(events) - 1 - idx
    if real_idx < 0 or real_idx >= len(events):
        return jsonify(ok=False, error="Event not found")

    ev         = events[real_idx]
    ts         = ev.get("timestamp", "")
    clip_path  = ev.get("clip_path", "")
    to_addr    = f"{reg}@topfaith.edu.ng"

    body = f"""Dear {name},

This is an official notice from the Top Faith University Litter Detection System (LDS).

You have been identified in a litter incident recorded on {ts}.

Littering in public areas is a violation of the university environmental policy.

As a result, a FINE OF ₦1,000 has been added to your student portal.
Please log in to settle this fine at: https://portal.topfaith.edu.ng

The evidence clip from the incident is attached to this email for your review.
This report was reviewed and approved by a human operator before sending.
If you believe this is an error, please contact the campus security office immediately.

Regards,
Bro Codes LDS System
Top Faith University"""

    msg = MIMEMultipart()
    msg["From"]    = SMTP_USER
    msg["To"]      = to_addr
    msg["Subject"] = f"Litter Incident Notice & Fine — {ts}"
    msg.attach(MIMEText(body, "plain"))

    if clip_path and os.path.exists(clip_path):
        with open(clip_path, "rb") as f:
            part = MIMEBase("video", "mp4")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f'attachment; filename="evidence_{ts[:10]}.mp4"')
        msg.attach(part)

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, to_addr, msg.as_string())
        return jsonify(ok=True)
    except Exception as e:
        return jsonify(ok=False, error=str(e))


if __name__ == "__main__":
    app.run(debug=True, port=5000)
