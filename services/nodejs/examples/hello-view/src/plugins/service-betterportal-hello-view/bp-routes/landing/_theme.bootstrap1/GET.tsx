/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

function capabilityCards(items: ResponseData["capabilities"]): HtmlRenderable {
  return (
    <div class="bp-landing-card-grid">
      {items.map((item) => (
        <article class="bp-landing-card">
          <div class="bp-landing-card__title">{item.title}</div>
          <p>{item.text}</p>
        </article>
      ))}
    </div>
  );
}

function audienceCards(items: ResponseData["audiences"]): HtmlRenderable {
  return (
    <div class="bp-landing-audience-grid">
      {items.map((item) => (
        <article class="bp-landing-audience">
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </article>
      ))}
    </div>
  );
}

function proofStrip(items: ResponseData["highlights"]): HtmlRenderable {
  return (
    <div class="bp-landing-proof-grid">
      {items.map((item) => (
        <div class="bp-landing-proof">
          <div class="bp-landing-proof__label">{item.title}</div>
          <p>{item.text}</p>
        </div>
      ))}
    </div>
  );
}

export function render(data: ResponseData): HtmlRenderable {
  return (
    <main class="bp-landing">
      <style>
        {`
          :root {
            --bp-landing-bg: #f7f8fb;
            --bp-landing-panel: #ffffff;
            --bp-landing-text: #172033;
            --bp-landing-muted: #647084;
            --bp-landing-line: rgba(23,32,51,.12);
            --bp-landing-accent: #195cff;
            --bp-landing-accent-2: #0f9f8a;
            --bp-landing-accent-3: #7c3aed;
          }
          [data-bs-theme="dark"] {
            --bp-landing-bg: #0e1118;
            --bp-landing-panel: #161b26;
            --bp-landing-text: #f3f6fb;
            --bp-landing-muted: #aeb8c8;
            --bp-landing-line: rgba(243,246,251,.14);
            --bp-landing-accent: #7ca2ff;
            --bp-landing-accent-2: #4dd6c2;
            --bp-landing-accent-3: #b69cff;
          }
          .bp-landing {
            min-height: 100vh;
            color: var(--bp-landing-text);
            background:
              radial-gradient(circle at 18% 18%, rgba(25,92,255,.16), transparent 26rem),
              radial-gradient(circle at 82% 12%, rgba(15,159,138,.14), transparent 24rem),
              linear-gradient(180deg, var(--bp-landing-bg), var(--bs-body-bg));
          }
          .bp-landing-shell {
            min-height: 100vh;
            display: grid;
            grid-template-rows: auto 1fr auto;
          }
          .bp-landing-nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            max-width: 1180px;
            width: min(100% - 2rem, 1180px);
            margin: 0 auto;
            padding: 1.25rem 0;
          }
          .bp-landing-brand {
            display: inline-flex;
            align-items: center;
            gap: .75rem;
            color: var(--bp-landing-text);
            text-decoration: none;
            font-weight: 700;
          }
          .bp-landing-mark {
            width: 2.5rem;
            height: 2.5rem;
            display: grid;
            place-items: center;
            border-radius: .8rem;
            color: #fff;
            background: linear-gradient(135deg, var(--bp-landing-accent), var(--bp-landing-accent-2));
            box-shadow: 0 .9rem 2rem rgba(25,92,255,.24);
          }
          .bp-landing-links {
            display: flex;
            align-items: center;
            gap: .5rem;
          }
          .bp-landing-link {
            color: var(--bp-landing-muted);
            text-decoration: none;
            padding: .55rem .75rem;
            border-radius: .6rem;
          }
          .bp-landing-link:hover {
            color: var(--bp-landing-text);
            background: rgba(100,112,132,.10);
          }
          .bp-landing-hero {
            width: min(100% - 2rem, 1180px);
            margin: 0 auto;
            display: grid;
            grid-template-columns: minmax(0, 1.05fr) minmax(320px, .95fr);
            gap: clamp(2rem, 6vw, 5rem);
            align-items: center;
            padding: clamp(2rem, 5vw, 4.5rem) 0;
          }
          .bp-landing-kicker {
            display: inline-flex;
            align-items: center;
            gap: .5rem;
            padding: .45rem .75rem;
            border: 1px solid var(--bp-landing-line);
            border-radius: 999px;
            color: var(--bp-landing-muted);
            background: color-mix(in srgb, var(--bp-landing-panel) 80%, transparent);
            margin-bottom: 1.25rem;
          }
          .bp-landing-dot {
            width: .5rem;
            height: .5rem;
            border-radius: 999px;
            background: var(--bp-landing-accent-2);
          }
          .bp-landing h1 {
            font-size: clamp(3.2rem, 8vw, 7.4rem);
            line-height: .9;
            letter-spacing: 0;
            margin: 0 0 1.25rem;
          }
          .bp-landing-lead {
            font-size: clamp(1.25rem, 2vw, 1.65rem);
            line-height: 1.35;
            color: var(--bp-landing-muted);
            max-width: 46rem;
            margin: 0 0 1.5rem;
          }
          .bp-landing-summary {
            color: var(--bp-landing-muted);
            max-width: 42rem;
            margin: 0 0 2rem;
          }
          .bp-landing-actions {
            display: flex;
            flex-wrap: wrap;
            gap: .75rem;
          }
          .bp-landing-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 3rem;
            padding: .85rem 1.1rem;
            border-radius: .8rem;
            text-decoration: none;
            font-weight: 650;
          }
          .bp-landing-button--primary {
            color: #fff;
            background: var(--bp-landing-accent);
            box-shadow: 0 1rem 2rem rgba(25,92,255,.22);
          }
          .bp-landing-button--secondary {
            color: var(--bp-landing-text);
            border: 1px solid var(--bp-landing-line);
            background: color-mix(in srgb, var(--bp-landing-panel) 82%, transparent);
          }
          .bp-landing-console {
            border: 1px solid var(--bp-landing-line);
            border-radius: 1.25rem;
            background: color-mix(in srgb, var(--bp-landing-panel) 88%, transparent);
            box-shadow: 0 1.5rem 4rem rgba(0,0,0,.12);
            overflow: hidden;
          }
          .bp-landing-console__top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid var(--bp-landing-line);
          }
          .bp-landing-pill {
            border: 1px solid var(--bp-landing-line);
            border-radius: 999px;
            padding: .35rem .65rem;
            color: var(--bp-landing-muted);
            font-size: .875rem;
          }
          .bp-landing-stack {
            display: grid;
            gap: .85rem;
            padding: 1rem;
          }
          .bp-landing-node {
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: center;
            gap: .85rem;
            padding: .95rem;
            border: 1px solid var(--bp-landing-line);
            border-radius: .9rem;
            background: var(--bp-landing-panel);
          }
          .bp-landing-node__icon {
            width: 2.2rem;
            height: 2.2rem;
            border-radius: .65rem;
            background: rgba(25,92,255,.12);
          }
          .bp-landing-node:nth-child(2) .bp-landing-node__icon { background: rgba(15,159,138,.14); }
          .bp-landing-node:nth-child(3) .bp-landing-node__icon { background: rgba(124,58,237,.14); }
          .bp-landing-node strong {
            display: block;
          }
          .bp-landing-node span {
            color: var(--bp-landing-muted);
            font-size: .92rem;
          }
          .bp-landing-status {
            color: var(--bp-landing-accent-2);
            font-weight: 700;
            font-size: .85rem;
          }
          .bp-landing-proof-section,
          .bp-landing-capability-section,
          .bp-landing-audience-section {
            width: min(100% - 2rem, 1180px);
            margin: 0 auto;
            padding: clamp(2.5rem, 5vw, 4rem) 0;
            border-top: 1px solid var(--bp-landing-line);
          }
          .bp-landing-proof-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 1rem;
          }
          .bp-landing-proof {
            padding: 1.25rem;
            border-radius: 1rem;
            background: color-mix(in srgb, var(--bp-landing-panel) 84%, transparent);
            border: 1px solid var(--bp-landing-line);
          }
          .bp-landing-proof__label {
            font-weight: 750;
            margin-bottom: .45rem;
          }
          .bp-landing-proof p,
          .bp-landing-card p,
          .bp-landing-audience p {
            color: var(--bp-landing-muted);
            margin: 0;
          }
          .bp-landing-section-head {
            max-width: 46rem;
            margin-bottom: 1.5rem;
          }
          .bp-landing-section-head h2 {
            font-size: clamp(2rem, 4vw, 3.4rem);
            line-height: 1;
            margin: 0 0 .8rem;
          }
          .bp-landing-section-head p {
            color: var(--bp-landing-muted);
            margin: 0;
          }
          .bp-landing-card-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 1rem;
          }
          .bp-landing-card {
            min-height: 14rem;
            padding: 1.25rem;
            border: 1px solid var(--bp-landing-line);
            border-radius: 1rem;
            background: var(--bp-landing-panel);
          }
          .bp-landing-card__title {
            font-size: 1.15rem;
            font-weight: 750;
            margin-bottom: .65rem;
          }
          .bp-landing-audience-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 1rem;
          }
          .bp-landing-audience {
            padding: 1.25rem;
            border-left: 3px solid var(--bp-landing-accent);
            background: color-mix(in srgb, var(--bp-landing-panel) 78%, transparent);
          }
          .bp-landing-audience h3 {
            font-size: 1rem;
            margin: 0 0 .5rem;
          }
          .bp-landing-footer {
            width: min(100% - 2rem, 1180px);
            margin: 0 auto;
            padding: 1.5rem 0 2rem;
            color: var(--bp-landing-muted);
            border-top: 1px solid var(--bp-landing-line);
          }
          @media (max-width: 991.98px) {
            .bp-landing-hero,
            .bp-landing-proof-grid,
            .bp-landing-card-grid,
            .bp-landing-audience-grid {
              grid-template-columns: 1fr;
            }
            .bp-landing-links {
              display: none;
            }
            .bp-landing h1 {
              font-size: clamp(3rem, 14vw, 5rem);
            }
          }
        `}
      </style>

      <div class="bp-landing-shell">
        <nav class="bp-landing-nav" aria-label="BetterPortal">
          <a class="bp-landing-brand" href="/landing">
            <span class="bp-landing-mark">BP</span>
            <span>BetterPortal</span>
          </a>
          <div class="bp-landing-links">
            <a class="bp-landing-link" href="#capabilities">Capabilities</a>
            <a class="bp-landing-link" href="#use-cases">Use cases</a>
            <a class="bp-landing-link" href={data.aboutHref}>About</a>
          </div>
        </nav>

        <section class="bp-landing-hero">
          <div>
            <div class="bp-landing-kicker"><span class="bp-landing-dot" /> Service-oriented portal framework</div>
            <h1>{data.headline}</h1>
            <p class="bp-landing-lead">{data.subheading}</p>
            <p class="bp-landing-summary">{data.summary}</p>
            <div class="bp-landing-actions">
              <a class="bp-landing-button bp-landing-button--primary" href={data.aboutHref}>Explore the architecture</a>
              <a class="bp-landing-button bp-landing-button--secondary" href="/hello">Open the demo service</a>
            </div>
          </div>

          <aside class="bp-landing-console" aria-label="BetterPortal service graph">
            <div class="bp-landing-console__top">
              <strong>Portal composition</strong>
              <span class="bp-landing-pill">typed runtime</span>
            </div>
            <div class="bp-landing-stack">
              <div class="bp-landing-node">
                <span class="bp-landing-node__icon" />
                <div><strong>Theme service</strong><span>Shell, fragments, chrome, navigation</span></div>
                <span class="bp-landing-status">active</span>
              </div>
              <div class="bp-landing-node">
                <span class="bp-landing-node__icon" />
                <div><strong>Auth provider</strong><span>Default JWT or external providers</span></div>
                <span class="bp-landing-status">bound</span>
              </div>
              <div class="bp-landing-node">
                <span class="bp-landing-node__icon" />
                <div><strong>Business services</strong><span>API, views, streams, files, metadata</span></div>
                <span class="bp-landing-status">mounted</span>
              </div>
              <div class="bp-landing-node">
                <span class="bp-landing-node__icon" />
                <div><strong>Config manager</strong><span>Tenants, apps, routes, scoped config</span></div>
                <span class="bp-landing-status">syncing</span>
              </div>
            </div>
          </aside>
        </section>

        <section class="bp-landing-proof-section">
          {proofStrip(data.highlights)}
        </section>
      </div>

      <section class="bp-landing-capability-section" id="capabilities">
        <div class="bp-landing-section-head">
          <h2>One contract for UI, API, automation, and AI.</h2>
          <p>BetterPortal keeps each service independently deployable while making its behavior discoverable, typed, and mountable by tenant/app configuration.</p>
        </div>
        {capabilityCards(data.capabilities)}
      </section>

      <section class="bp-landing-audience-section" id="use-cases">
        <div class="bp-landing-section-head">
          <h2>Built for teams that need platform control without monolith gravity.</h2>
          <p>Use it for admin portals, customer portals, internal tools, embedded views, workflow endpoints, and AI-readable service surfaces.</p>
        </div>
        {audienceCards(data.audiences)}
      </section>

      <footer class="bp-landing-footer">
        BetterPortal ships services, themes, auth, configuration, manifests, and typed routes as one composable platform model.
      </footer>
    </main>
  );
}
