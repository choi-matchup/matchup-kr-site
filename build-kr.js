/*
 * 한국 피팅룸(/kr) 만들기 — `node build-kr.js` 하나로 dist/에 /kr 페이지 전부를 만든다(맨 아래 main).
 * matchup.fit(미국 관리자 Vercel)이 /kr, /kr/* 요청을 이 프로젝트에서 가져와 보여준다(rewrite).
 *
 * 2026-11-17 오너: "원래 사이트 내용을 그대로". 빌드할 때마다 운영 중인 영어 사이트
 * (KR_SOURCE_SITE, 기본 https://matchup.fit)의 피팅룸 페이지와 신발 페이지를 읽어 같은 틀로 만든다.
 * 미국 관리자가 디자인을 바꾸면 다음 빌드에서 따라간다(사진 외 CSS·글꼴·site.js도 영어 사이트 것).
 *   /kr          = 영어 /fitting-room 그대로 + 글자는 kr/fitting-room.ko.txt 표대로 + 신발 줄은 한국 신발
 *   /kr/<주소>    = 영어 신발 페이지의 머리글·바닥글·칸 구조 + 한국 신발 내용(어드민 '나라별 사이트')
 * 한국 신발 목록은 공개 API /api/v1/public/b2c/site/kr/shoes(사진·카테고리 포함).
 * 영어 페이지나 목록을 못 받거나, 표에 없는 영어 글자가 남으면 빌드를 멈춘다 —
 * 빈 사이트·영어 섞인 사이트를 올리지 않게(Vercel은 그동안 앞 버전을 그대로 보여준다).
 */
"use strict";
const fs = require("fs");
const path = require("path");

const KR_DIR = path.join(__dirname, "kr");
const SHOP_ID = "fittingroom.matchup.fit";
// 어드민 카테고리(영어 이름, 서버 fitting_room_fit.CATEGORIES) → 한국 사이트 분류 이름과 순서
// 분류 이름은 영어 그대로(2026-11-18 오너). 순서는 이 표 순서.
const GROUP_KO = { "Running": "Running", "Sneakers": "Sneakers", "Boots": "Boots", "Leather shoes": "Leather shoes", "": "More" };
// 신발 페이지의 고정 문구(영어 신발 페이지의 같은 자리). 어드민 글이 아니라 페이지 틀의 글자.
const KO = {
  back: "피팅룸",
  find: "내 사이즈 찾기",
  scannedBefore: "측정한 적 있으신가요?",
  login: "로그인",
  more: (group) => `More in ${group}`,   // 영어 신발 페이지와 같게(분류 이름이 영어라서)
  photo: (name, i, n) => `${name}, 사진 ${i} / ${n}`,
  showPhoto: (i) => `사진 ${i} 보기`,
  qrDialog: "QR코드를 스캔해 내 사이즈 찾기",
  qrTitle: "QR코드를 스캔해 시작해 주세요.",
  qrHint: "이미 휴대폰으로 보고 계시다면 QR코드를 터치해 주세요.",
  qrOpen: "내 사이즈 찾기 열기",
  close: "닫기",
  title: (b, n) => `${b} ${n} 사이즈, 내 발에 맞을까? | 매치업`,
  description: (b, n) => `${b} ${n}, 신어보지 않아도 발 사진 두 장으로 내 발에 맞는 사이즈와 핏을 알려드려요.`,
};

const KR_FONT = "system-ui,'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR',sans-serif";   // /ko 페이지와 같은 글꼴 순서
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
// 영어로 남아도 되는 낱말(이름·고유명사). 이것 말고 영어 낱말이 보이면 표에 빠진 글자다.
const ALLOWED_LATIN = /\b(MatchUp|Instagram|English|matchup|fit|KO|KR)\b/g;   // KR = 언어 버튼 표시(11/19 오너)
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// 문구표가 바꾸는 속성(화면에 보이거나 검색·화면 읽기 프로그램이 읽는 것만)
const TEXT_ATTRS = "(?:alt|aria-label|placeholder|title|content|value)";
const read = (name) => fs.readFileSync(path.join(KR_DIR, name), "utf8");

async function fetchText(url) {
  let res;
  try { res = await fetch(url); } catch (err) { throw new Error(`Korean site: could not reach ${url} (${err.message})`); }
  if (!res.ok) throw new Error(`Korean site: ${url} answered ${res.status}`);
  return res.text();
}

async function fetchShoes(api) {
  const data = JSON.parse(await fetchText(`${api}/api/v1/public/b2c/site/kr/shoes`));
  return (data.shoes || []).map(s => ({ ...s, group: s.category in GROUP_KO ? s.category : "" }));
}

/* 미리보기 전용(KR_DRAFTS_DIR): DB에 넣기 전의 글 초안 파일(matchup_api/b2c/drafts/kr/*.md)로 목록을 만든다.
   카드 사진·분류·순서는 영어 피팅룸 페이지의 같은 신발 카드에서. 운영 빌드는 이 값을 쓰지 않는다. */
function draftShoes(dir, enLanding, source) {
  const cards = new Map();
  for (const m of enLanding.matchAll(/<h2 class="shop-h2">([^<]*)<\/h2>([\s\S]*?)<\/section>/g)) {
    for (const c of m[2].matchAll(/<a class="shop-card" href="\/fitting-room\/([^"]+)"[\s\S]*?<img src="([^"]+)"/g)) {
      cards.set(c[1], { group: m[1], image: c[2].startsWith("/") ? source + c[2] : c[2], order: cards.size });
    }
  }
  return fs.readdirSync(dir).filter(f => f.endsWith(".md")).map(f => {
    const m = fs.readFileSync(path.join(dir, f), "utf8").replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const d = Object.fromEntries([...m[1].matchAll(/^(\w+): (.*)$/gm)].map(x => [x[1], x[2]]));
    const card = cards.get(d.source_slug) || { group: "", image: "", order: 999 };
    return { code: d.code, slug: d.slug, brand: d.brand, name: d.name, summary: d.summary || "", body: m[2].trim(),
      source_slug: d.source_slug, image_url: card.image, category: card.group, order: card.order, updated_at: null,
      group: card.group in GROUP_KO ? card.group : "" };
  }).sort((a, b) => a.order - b.order);
}

/* 문구표 읽기. 여러 표를 합치면 뒤 표가 앞 표의 같은 EN을 덮는다(페이지 표 > 공통 표).
   EN:/KO: 쌍(KO에 <br> = 줄바꿈, KO가 EN과 같으면 일부러 영어로 두는 글자), LINK: 주소 바꾸기,
   DROP: 그 글자의 링크 빼기, IMG: 영어 페이지 사진 → 한국 사이트 사진(kr/img/ 폴더). */
function readTable(problem, files = ["fitting-room.ko.txt"]) {
  const byEn = new Map(), links = [], drops = [], imgs = [], adds = [], htmls = [];
  for (const file of files) {
    let en = null;
    read(file).split(/\r?\n/).forEach((line, i) => {
      if (!line.trim() || line.startsWith("#")) return;
      const m = line.match(/^(EN|KO|LINK|DROP|IMG|ADD_AFTER|HTML):\s?(.*)$/);
      if (!m) return problem(`kr/${file} line ${i + 1}: starts with EN:, KO:, LINK:, DROP:, IMG:, ADD_AFTER: or HTML:`);
      const [, key, value] = m;
      if (key === "EN") { en = value; return; }
      if (key === "ADD_AFTER" || key === "HTML") {
        // ADD_AFTER: 영어 페이지의 이 글자 바로 뒤에 || 넣을 HTML(한국 페이지에만 있는 칸)
        // HTML: 영어 페이지의 이 HTML을 || 이 HTML로(같은 글자가 두 번 나오는데 자리마다 다르게 써야 할 때)
        const [a, b] = value.split("||").map(s => s.trim());
        if (!a || !b) return problem(`kr/${file} line ${i + 1}: ${key}: text on the page || html`);
        (key === "HTML" ? htmls : adds).push([a, b]); return;
      }
      if (key === "KO") {
        if (en === null) return problem(`kr/${file} line ${i + 1}: a KO: line needs an EN: line above it`);
        byEn.set(en, value); en = null; return;
      }
      if (key === "DROP") { drops.push(value.trim()); return; }
      const [from, to] = value.split("->").map(s => s.trim());
      if (!from || !to) return problem(`kr/${file} line ${i + 1}: ${key}: english -> korean`);
      (key === "IMG" ? imgs : links).push([from, to]);
    });
  }
  const pairs = [...byEn].sort((a, b) => b[0].length - a[0].length);   // 긴 글자 먼저(짧은 글자가 긴 글자 안을 바꾸지 않게)
  const keepEnglish = pairs.filter(([e, k]) => e === k).map(([e]) => e);
  return { pairs, links, drops, imgs, adds, htmls, keepEnglish };
}

// 화면에 보이는(또는 검색·화면 읽기 프로그램이 읽는) 글자 중 영어가 남은 것.
function leftoverEnglish(html, keepEnglish = []) {
  const found = new Set();
  for (const k of keepEnglish) html = html.split(`>${k}<`).join("><").split(`>${k.replace(/'/g, "&#39;")}<`).join("><");
  html = html.replace(/<div data-kr-added>[\s\S]*?<\/div><!--\/kr-added-->/g, " ");   // 한국 페이지에만 더한 칸(오너가 쓴 글 — 주소 등)
  const body = html.replace(/<(script|style|svg|template)\b[\s\S]*?<\/\1>/g, " ");
  const texts = [
    ...body.replace(/<[^>]+>/g, "\n").split("\n"),
    ...[...body.matchAll(/\b(?:placeholder|aria-label|alt|title)="([^"]*)"/g)].map(m => m[1]),
    ...[...html.matchAll(/<meta (?:name|property)="(?:description|og:title|og:description|og:image:alt)" content="([^"]*)"/g)].map(m => m[1]),
    ...[...html.matchAll(/<title>([^<]*)<\/title>/g)].map(m => m[1]),
  ];
  for (const t of texts) {
    const s = t.replace(/&[a-z#0-9]+;/gi, " ").replace(/\{\{KR_[A-Z_]+\}\}/g, "").trim();
    // 한글이 들어 있으면 옮긴 글자다(Shopify·QR·Ultimate 같은 이름이 섞여도 된다). 한글 없이 영어만 남은 것만 잡는다.
    if (!/[가-힣]/.test(s) && /[A-Za-z]{2,}/.test(s.replace(ALLOWED_LATIN, ""))) found.add(s);
  }
  return [...found];
}

/* 영어 페이지 → 한국어: 두 페이지가 같이 쓰는 부분(머리글·바닥글·주소·글꼴·문구표).
   ctx.enUrl = 언어 선택의 English가 갈 주소. */
function koreanize(html, ctx) {
  const { source, table, esc, siteUrl, matchupApp, matchupApi, enUrl } = ctx;
  html = html.replace(/<!--[\s\S]*?-->\n?/g, "");                                    // 개발 메모(영어)
  html = html.replace(/[ \t]*<template data-lang-bar[\s\S]*?<\/template>\n?/g, "");  // '한국어로 보기' 안내 줄(이미 한국어 페이지)
  for (const [from, to] of table.htmls || []) {
    if (!html.includes(from)) throw new Error(`Korean site: HTML place "${from}" not found on ${enUrl} — the English page changed; fix the HTML: line`);
    html = html.split(from).join(to);
  }
  html = html.replace('<html lang="en">', '<html lang="ko">');
  html = html.replace(/system-ui,sans-serif/g, KR_FONT);
  // 한국어는 낱말 중간에서 줄을 바꾸지 않게("크/게" 방지) — 영어 페이지 모양은 그대로
  html = html.replace("</head>", "<style>body { word-break: keep-all; overflow-wrap: anywhere; }</style>\n</head>");
  // 언어를 고르면 쿠키(mu_lang)에 남긴다 — matchup.fit 첫 화면의 '한국어 브라우저 → /kr' 이동이 이 쿠키가 있으면 건너뛴다
  html = html.replace("</head>", `<script>document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[data-lang]");if(a)document.cookie="mu_lang="+a.getAttribute("data-lang")+"; path=/; max-age=31536000; samesite=lax"});</script>\n</head>`);
  for (const [from, to] of table.imgs || []) html = html.split(`src="${from}"`).join(`src="${to}"`);   // 한국 사이트 사진으로
  html = html.replace(/((?:src|href)=")\/?(assets\/|site\.js)/g, `$1${source}/$2`);     // 같은 디자인: 영어 사이트의 파일
  // 매치업 앱·서버 주소: 이 빌드의 환경(스테이징이면 스테이징)으로, 앱은 한국어로 열리게
  for (const origin of new Set([...html.matchAll(/(https:\/\/[a-z0-9.-]+)\/(?:login\?from=fitting-room|welcome\?s=)/g)].map(m => m[1]))) {
    html = html.split(origin).join(matchupApp);
  }
  html = html.replace(/https:\/\/api\.matchup\.fit(?=\/api\/)/g, matchupApi)
    .replace(/(\/login\?from=fitting-room)"/g, "$1&amp;lang=ko\"");
  for (const label of table.drops) html = html.replace(new RegExp(`[ \\t]*<a\\b[^>]*>\\s*${reEsc(label)}\\s*</a>\\n?`, "g"), "");
  for (const [from, to] of table.links) html = html.split(`href="${from}"`).join(`href="${to}"`);
  // 언어 선택: 한국어 = 이 페이지, English = 같은 영어 페이지(없으면 영어 피팅룸)
  html = html.replace(/(<button type="button" class="lang-btn"[^>]*aria-label=")Language(">)EN/g, "$1언어$2KR")
    .replace(/(<ul class="lang-list"[^>]*>)[\s\S]*?(<\/ul>)/g, `$1<li><a href="${enUrl}" lang="en" hreflang="en" data-lang="en">English</a></li><li><a href="/kr" lang="ko" hreflang="ko" data-lang="ko" aria-current="page">한국어</a></li><li><a href="/ja" lang="ja" hreflang="ja" data-lang="ja">日本語</a></li>$2`);
  html = html.replace(/(&middot;\s*)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? (\d{1,2})\b/g,
    (m, dot, mon, day) => `${dot}${MONTHS[mon]}월 ${day}일`);
  // 글자: 태그 사이 글자와 화면·검색에 쓰이는 속성 값만 바꾼다(주소·이름표·data-* 는 건드리지 않는다)
  for (const [en, ko] of table.pairs) {
    for (const form of new Set([en, esc(en)])) {
      html = html.replace(new RegExp(`(>\\s*|${TEXT_ATTRS}=")${reEsc(form)}(\\s*<|")`, "g"),
        (m, a, b) => `${a}${a.endsWith('="') ? esc(ko.replace(/<br>/g, " ")) : esc(ko).replace(/&lt;br&gt;/g, "<br>")}${b}`);
    }
  }
  // 한국 페이지에만 있는 칸(ADD_AFTER:) — 영어 페이지에서 자리 글자를 못 찾으면 빌드를 멈춘다(칸이 조용히 사라지지 않게)
  for (const [anchor, add] of table.adds || []) {
    const at = html.indexOf(anchor);
    if (at < 0) throw new Error(`Korean site: ADD_AFTER place "${anchor}" not found on ${enUrl} — the English page changed; fix the ADD_AFTER line`);
    html = html.slice(0, at + anchor.length) + `<div data-kr-added>${add}</div><!--/kr-added-->` + html.slice(at + anchor.length);
  }
  return html;
}

function setHead(html, { title, description, url, image, imageAlt, alternates }, esc) {
  const meta = (attr, name, value) => (h) => h.replace(new RegExp(`(<meta ${attr}="${name}" content=")[^"]*"`), `$1${esc(value)}"`);
  for (const f of [
    (h) => h.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`),
    meta("name", "description", description), meta("property", "og:title", title),
    meta("property", "og:description", description), meta("property", "og:url", url),
    meta("property", "og:image", image), meta("property", "og:image:alt", imageAlt),
    (h) => h.replace(/(<link rel="canonical" href=")[^"]*"/, `$1${url}"`),
  ]) html = f(html);
  const links = alternates.map(([lang, href]) => `<link rel="alternate" hreflang="${lang}" href="${href}">`).join("\n");
  return html.replace("</head>", `<meta property="og:locale" content="ko_KR">\n${links}\n</head>`);
}

function check(html, where, problems, keepEnglish = []) {
  const left = leftoverEnglish(html, keepEnglish);
  if (left.length) problems.push(`these English words on ${where} are not in kr/fitting-room.ko.txt (add an EN:/KO: pair for each):\n    ${left.join("\n    ")}`);
}

// ── 신발 줄(영어 피팅룸의 줄과 같은 모양 — 같은 site.js 동작: 검색·화살표) ─────────────

function row(title, list, esc, headClass = "shop-h2") {
  const chevron = (d) => `<svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.25"/></svg>`;
  const cards = list.map(s =>
    `          <a class="shop-card" href="/kr/${esc(s.slug)}" data-fr-card data-matchup-card="${esc(s.code)}" data-search="${esc(`${s.brand} ${s.name} ${s.summary}`)}">
            <div class="shop-card-photo"><img src="${esc(s.image_url)}" alt="${esc(`${s.brand} ${s.name}`)}" loading="lazy"></div>
            <div class="shop-card-text"><p class="shop-label">${esc(s.brand)}</p><p class="shop-card-name">${esc(s.name)}</p></div>
          </a>`).join("\n");
  return `      <section class="fr-group" data-fr-group>
        <div class="fr-group-head">
          <h2 class="${headClass}">${esc(title)}</h2>
          <div class="fr-arrows" data-fr-arrows hidden>
            <button type="button" class="fr-arrow" data-fr-prev aria-label="${esc(`${title} 앞 신발`)}">${chevron("M7 1 1 7l6 6")}</button>
            <button type="button" class="fr-arrow" data-fr-next aria-label="${esc(`${title} 더 보기`)}">${chevron("M1 1l6 6-6 6")}</button>
          </div>
        </div>
        <div class="fr-row" data-fr-row>
${cards}
        </div>
      </section>`;
}

// ── 첫 화면 /kr ─────────────────────────────────────────────────────

function landingPage(en, list, ctx, problems) {
  const { esc, siteUrl } = ctx;
  const groupRe = /[ \t]*<section class="fr-group" data-fr-group>[\s\S]*?<\/section>\n?/g;
  const at = en.search(groupRe);
  if (at < 0) throw new Error(`Korean site: the shoe rows were not found on ${ctx.source}/fitting-room — its layout changed; build-kr.js needs a look`);
  let html = en.replace(groupRe, "");
  html = html.slice(0, at) + "{{KR_SHOE_ROWS}}\n" + html.slice(at);
  html = koreanize(html, { ...ctx, enUrl: "/fitting-room" });
  html = html.replace(/(<link rel="canonical" href=")[^"]*"/, `$1${siteUrl}/kr"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${siteUrl}/kr"`)
    .replace(/og-home\.png/g, "og-home-ko.png")
    .replace("</head>", `<meta property="og:locale" content="ko_KR">
<link rel="alternate" hreflang="ko" href="${siteUrl}/kr">
<link rel="alternate" hreflang="en" href="${siteUrl}/fitting-room">
<link rel="alternate" hreflang="x-default" href="${siteUrl}/fitting-room">
</head>`);
  check(html, `${ctx.source}/fitting-room`, problems, ctx.table.keepEnglish);
  const rows = Object.keys(GROUP_KO).filter(g => list.some(s => s.group === g))
    .map(g => row(GROUP_KO[g], list.filter(s => s.group === g), esc)).join("\n");
  return html.replace("{{KR_SHOE_ROWS}}", rows || `      <p class="shop-empty">신발을 준비하고 있어요.</p>`);
}

// ── 신발 페이지 /kr/<주소> ─────────────────────────────────────────────

/* 영어 신발 페이지(아무 신발 하나)에서 신발 내용을 뺀 틀. 머리글·바닥글·디자인은 영어 그대로 따라간다. */
function shoeFrame(en, ctx, problems) {
  const start = en.indexOf('<div class="shop-wrap shoe-page">');
  const end = en.indexOf("</main>");
  const qrStart = en.indexOf('<div id="qr-modal"');
  const qrEnd = en.indexOf('<script src="/site.js"></script>');
  if (start < 0 || end < start || qrStart < end || qrEnd < qrStart) {
    throw new Error(`Korean site: the shoe page layout on ${ctx.source} changed (shoe-page / qr-modal not found); build-kr.js needs a look`);
  }
  const qrClose = en.lastIndexOf("</div>", qrEnd);   // 맨 바깥 감싸개(frame.html의 글꼴 div) 닫힘
  let html = en.slice(0, start) + "{{KR_MAIN}}\n</main>" + en.slice(end + "</main>".length, qrStart) +
    "{{KR_QR}}\n" + en.slice(qrClose);
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, "");
  html = html.replace("</head>", "{{KR_LD}}\n</head>");
  return html;
}

/* 영어 원본 신발 페이지에서 가져오는 것: 사진들, 점수 숫자, 구매처 줄(오너 11/17 "같은 형식과 내용으로").
   숫자는 영어 페이지 그대로라 미국 쪽 숫자가 바뀌면 다음 빌드에 같이 바뀐다. */
function readEnglishShoe(en, url, source) {
  const track = (en.match(/<div class="shoe-gallery-track" data-track>([\s\S]*?)<\/div>/) || [])[1] || "";
  const photos = [...track.matchAll(/<img src="([^"]+)"/g)].map(m => (m[1].startsWith("/") ? source + m[1] : m[1]));
  const num = (re) => { const m = en.match(re); return m ? Number(m[1]) : null; };
  const pct = (cls) => num(new RegExp(`fit-split-key ${cls}"><\\/span><span class="fit-split-what">[^<]*<\\/span><span class="fit-split-pct">(\\d+)%`));
  const feet = (en.match(/<p class="fit-note">[^<]*? of ([\d,]+) feet/) || [])[1] || null;
  const fit = num(/<span class="fit-big">(\d+)<\/span>/) === null ? null : {
    accuracy: num(/<span class="fit-big">(\d+)<\/span>/),
    forefoot: pct("is-forefoot"), toes: pct("is-toes"), sizeDown: pct("is-down"), feet,
  };
  const buy = (en.match(/(<p class="shoe-buy-label">[\s\S]*?)\n\s*<\/div>\s*<\/div>\s*<article/) || [])[1] || "";
  if (!photos.length) throw new Error(`Korean site: no photos found on ${url} — its layout changed; build-kr.js needs a look`);
  return { photos, fit, buy: buy.trim() };
}

// 구매처(2026-11-19 오너: 한국은 쿠팡부터, 다음 링크프라이스) — 영어 페이지의 Amazon·Zappos 줄 대신
// 서버의 한국 구매처(b2c/affiliate.py, 어드민 '나라별 사이트' → 편집 → 구매처)로 같은 모양의 줄을 만든다.
// 가격은 넣지 않는다(빌드 시점 가격은 금방 낡는다 — 가격은 앱 매칭 결과에서 실시간으로).
// 한국 구매처가 없는 신발은 구매처 줄 자체를 빼고, 제휴 표시 문구는 판매처가 요구하는 문장 그대로.
const SHIP_KO = { rocket: "로켓배송", free: "무료배송", paid: "배송비 있음" };
function policyKo(p) {
  const bits = [];
  if (SHIP_KO[p.shipping]) bits.push(SHIP_KO[p.shipping]);
  if (p.returns === "free") bits.push(p.return_days ? `${p.return_days}일 무료반품` : "무료반품");
  else if (p.return_days) bits.push(`반품 ${p.return_days}일`);
  else if (p.returns === "paid") bits.push("반품비 있음");
  return bits.join(" · ");
}
function buyRows(s, esc, api) {
  const offers = (s.offers || []).filter(o => o.url);
  if (!offers.length) return "";
  const rows = offers.map(o => {
    const pol = policyKo(o.policy || {});
    return `          <a class="shoe-buy-row" href="${esc(o.url)}" target="_blank" rel="sponsored noopener noreferrer" data-kr-offer="${esc(o.retailer)}">${esc(o.store)}${pol ? ` <small style="font-weight:400; color:#64748B">· ${esc(pol)}</small>` : ""} <span>보러 가기 ↗</span></a>`;
  }).join("\n");
  const notes = [...new Set(offers.map(o => o.disclosure).filter(Boolean))];
  // 클릭 기록(sendBeacon — 링크 이동을 막지 않는다)
  const beacon = `<script>document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[data-kr-offer]");if(!a||!navigator.sendBeacon)return;try{navigator.sendBeacon(${JSON.stringify(api + "/api/v1/public/b2c/offer-click/kr")},new Blob([JSON.stringify({product:${JSON.stringify(s.code)},retailer:a.getAttribute("data-kr-offer")})],{type:"text/plain"}))}catch(_){}});</script>`;
  return `<p class="shoe-buy-label">여기서 살 수 있어요</p>
        <div class="shoe-buy">
${rows}
        </div>
${notes.map(n => `          <p class="shoe-disclosure">${esc(n)}</p>`).join("\n")}
        ${beacon}`;
}

// 영어 신발 페이지의 점수 상자와 같은 모양(같은 CSS 이름), 글자만 한국어.
function scoreColor(score) { return score < 35 ? "#F09090" : score <= 70 ? "#E0A940" : "#83B6CF"; }
function fitBox(kind, s, fit, esc) {
  if (!fit) return "";
  const brand = esc(s.brand);
  const feet = fit.feet ? `${fit.feet}개 발` : "측정한 발";
  if (kind === "score") {
    return `        <div class="fit-box" role="img" aria-label="${brand} 사이즈 안내 점수: 100점 중 ${fit.accuracy}점.">
          <p class="fit-label">${brand} 사이즈 안내 점수</p>
          <p class="fit-score"><span class="fit-big">${fit.accuracy}</span><span class="fit-of">/100</span></p>
          <div class="fit-track"><div style="width:${fit.accuracy}%;background:${scoreColor(fit.accuracy)}"></div></div>
          <p class="fit-note">${brand} 온라인 사이즈 안내로 ${feet} 중 ${fit.accuracy}%가 맞는 사이즈를 찾았어요.</p>
        </div>`;
  }
  const rows = [
    { cls: "is-right", pct: fit.accuracy, what: "사이즈표대로 맞음" },
    { cls: "is-forefoot", pct: fit.forefoot, what: "발볼 때문에 크게" },
    { cls: "is-toes", pct: fit.toes, what: "발가락 여유 때문에만 크게" },
    { cls: "is-down", pct: fit.sizeDown, what: "발볼이 남아서 작게" },
  ].filter(r => r.pct !== null);
  return `        <div class="fit-box fit-split" role="img" aria-label="${brand} 온라인 사이즈 안내를 따랐을 때: ${esc(rows.map(r => `${r.what} ${r.pct}%`).join(", "))}.">
          <p class="fit-label">${brand} 온라인 사이즈 안내를 따랐을 때</p>
          <div class="fit-split-bar">${rows.filter(r => r.pct > 0).map(r => `<div class="${r.cls}" style="flex-grow:${r.pct}"></div>`).join("")}</div>
          <ul class="fit-split-rows">
${rows.map(r => `            <li><span class="fit-split-key ${r.cls}"></span><span class="fit-split-what">${esc(r.what)}</span><span class="fit-split-pct">${r.pct}%</span></li>`).join("\n")}
          </ul>
        </div>
        <p class="fit-caption">${feet} 기준. 발 하나는 한 번만 셉니다.</p>`;
}

/* 소개 글: 영어 신발 파일과 같은 쓰기 형식(build.js writeup과 같은 결과 모양).
   빈 줄로 문단, "## 소제목"은 접히는 칸, "### 소제목", [score]·[sizing]은 점수 상자,
   "- " 목록, "1. " 번호 목록, **굵게**, *기울임*, [글자](주소). */
function inline(text, esc, krByEn = new Map()) {
  // 글 속 영어 신발 페이지 링크(/fitting-room/<영어 주소>)는 한국 사이트에 같은 신발이 있으면 한국 페이지로
  text = text.replace(/\]\(\/fitting-room\/([a-z0-9-]+)\)/g, (m, en) => (krByEn.has(en) ? `](/kr/${krByEn.get(en)})` : m));
  let s = esc(text);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const u = url.replace(/&amp;/g, "&");
    if (!/^(https?:\/\/|\/)/i.test(u)) return label;
    const ext = /^https?:/i.test(u) ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${esc(u)}"${ext}>${label}</a>`;
  });
  return s;
}
function writeup(text, s, fit, esc, krByEn) {
  const out = [];
  let inSection = false;
  const endSection = () => { if (inSection) out.push("          </div>\n        </details>"); inSection = false; };
  for (const block of text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)) {
    const lines = block.split(/\r?\n/).map(l => l.trim());
    const first = lines[0];
    let m;
    if (lines.length === 1 && (m = first.match(/^\[(score|sizing)\]$/))) { out.push(fitBox(m[1], s, fit, esc)); continue; }
    if (lines.length === 1 && (m = first.match(/^###\s+(.+)$/))) { out.push(`        <h3>${inline(m[1], esc, krByEn)}</h3>`); continue; }
    if (lines.length === 1 && (m = first.match(/^##\s+(.+)$/))) {
      endSection();
      out.push(`        <details class="shoe-sec">\n          <summary><h2>${inline(m[1], esc, krByEn)}</h2></summary>\n          <div class="shoe-sec-body">`);
      inSection = true;
      continue;
    }
    if (lines.every(l => /^[-*]\s+/.test(l))) {
      out.push("        <ul>\n" + lines.map(l => `          <li>${inline(l.replace(/^[-*]\s+/, ""), esc, krByEn)}</li>`).join("\n") + "\n        </ul>");
      continue;
    }
    if (lines.every(l => /^\d+\.\s+/.test(l))) {
      out.push("        <ol>\n" + lines.map(l => `          <li>${inline(l.replace(/^\d+\.\s+/, ""), esc, krByEn)}</li>`).join("\n") + "\n        </ol>");
      continue;
    }
    out.push(`        <p>${inline(lines.join(" "), esc, krByEn)}</p>`);
  }
  endSection();
  return out.filter(Boolean).join("\n");
}

function gallery(s, photos, esc) {
  const n = photos.length;
  const name = `${s.brand} ${s.name}`;
  const alt = (i) => esc(KO.photo(name, i + 1, n));
  return `        <div class="shoe-gallery${n < 2 ? " single" : ""}" data-gallery>
        <div class="shoe-gallery-track" data-track>
${photos.map((p, i) => `          <img src="${esc(p)}" alt="${alt(i)}"${i ? ' loading="lazy"' : ""}>`).join("\n")}
        </div>
        <div class="shoe-dots" data-dots>${photos.map((p, i) => `<button type="button" aria-label="${KO.showPhoto(i + 1)}"${i ? "" : ' aria-current="true"'}></button>`).join("")}</div>
        <div class="shoe-thumbs" data-thumbs>
${photos.map((p, i) => `          <button type="button" aria-label="${KO.showPhoto(i + 1)}"${i ? "" : ' aria-current="true"'}><img src="${esc(p)}" alt="${alt(i)}" loading="lazy"></button>`).join("\n")}
        </div>
        </div>`;
}

// 문구표의 글자 바꾸기만(koreanize의 마지막 단계와 같다) — 영어 페이지에서 가져온 조각(구매처 줄)에 쓴다.
function translatePairs(html, table, esc) {
  for (const [en, ko] of table.pairs) {
    for (const form of new Set([en, esc(en)])) {
      html = html.replace(new RegExp(`(>\\s*|${TEXT_ATTRS}=")${reEsc(form)}(\\s*<|")`, "g"), (m, a, b) => `${a}${esc(ko)}${b}`);
    }
  }
  return html;
}

async function shoePage(frame, s, list, ctx, english) {
  const { esc, siteUrl, source, matchupApp, enSlugByCode, table } = ctx;
  const url = `${siteUrl}/kr/${s.slug}`;
  const name = `${s.brand} ${s.name}`;
  const en = s.source_slug || enSlugByCode.get(s.code);
  const enUrl = en ? `/fitting-room/${en}` : "/fitting-room";
  const photos = english ? english.photos : [s.image_url];
  const firstPara = (s.body.split(/\n\s*\n/).map(p => p.trim()).find(p => p && !/^(\[|#|- )/.test(p)) || "")
    .replace(/\*+/g, "").replace(/\s+/g, " ");
  const description = s.summary || (firstPara.length > 120 ? firstPara.slice(0, 118) + "…" : firstPara) || KO.description(s.brand, s.name);
  const findUrl = `${matchupApp}/welcome?s=${SHOP_ID}&p=${encodeURIComponent(s.code)}&src=seller_qr&lang=ko`;
  const qrSvg = await require("qrcode").toString(findUrl, { type: "svg", margin: 2, color: { dark: "#000000", light: "#ffffff" } });
  const buy = buyRows(s, esc, ctx.matchupApi);   // 영어 페이지의 Amazon·Zappos 줄은 쓰지 않는다(2026-11-19)

  const others = list.filter(x => x.group === s.group && x.code !== s.code);
  const main = `  <div class="shop-wrap shoe-page">
    <a class="shoe-back" href="/kr"><svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true" focusable="false"><path d="M6.5 3 1.5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>${KO.back}</a>

    <div class="shoe-photos">
${gallery(s, photos, esc)}
    </div>

    <div class="shoe-info">
      <div class="shoe-info-in">
        <h1 class="shoe-name"><span class="shoe-brand">${esc(s.brand)}</span> ${esc(s.name)}</h1>
        <div class="shoe-find-widget" data-matchup-fit-product="${esc(s.code)}" data-matchup-fit-fallback><a href="${esc(findUrl)}" class="scan-btn shoe-find demo-cta" target="_blank" rel="noopener"><img src="${source}/assets/logo/logo.svg" alt="" width="24" height="22">${KO.find}</a></div>
        <p class="shoe-login">${KO.scannedBefore} <a href="${esc(matchupApp)}/login?from=fitting-room&amp;lang=ko">${KO.login}</a></p>
${buy ? `        ${buy}\n` : ""}      </div>
    </div>

${s.body ? `    <article class="shoe-article">
${writeup(s.body, s, english && english.fit, esc, new Map(list.filter(x => x.source_slug).map(x => [x.source_slug, x.slug])))}
    </article>` : ""}
  </div>
${others.length ? `  <div class="shoe-more" data-fr-list>
    <div class="shop-wrap">
${row(KO.more(GROUP_KO[s.group]), others, esc, "shoe-more-h")}
    </div>
  </div>` : ""}`;

  // 영어 신발 페이지의 QR 팝업과 같은 모양, 글자만 한국어
  const qr = `  <div id="qr-modal" hidden>
    <div id="qr-overlay" role="dialog" aria-modal="true" aria-label="${KO.qrDialog}" style="position:fixed; inset:0; z-index:200; background:rgba(15,23,42,0.55); display:flex; align-items:center; justify-content:center; padding:1.25rem">
      <div style="position:relative; background:#FFFFFF; border-radius:2px; padding:1.5rem; max-width:20rem; width:100%; box-sizing:border-box; text-align:center; box-shadow:0 24px 64px rgba(15,23,42,0.35)">
        <button id="qr-close" type="button" aria-label="${KO.close}" style="position:absolute; top:0.5rem; right:0.5rem; width:2rem; height:2rem; border:none; background:transparent; color:#64748B; font-size:1.25rem; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center" class="hv0">&#215;</button>
        <p style="margin:0 0 0.5rem; padding:0 1.5rem; font-size:0.875rem; font-weight:600; line-height:1.4; color:#0F172A">${esc(name)}</p>
        <img src="${esc(photos[0])}" alt="${esc(name)}" width="64" height="64" loading="lazy" style="display:block; width:64px; height:64px; object-fit:cover; margin:0 auto 0.75rem; border:1px solid #E2E8F0; border-radius:2px">
        <hr style="border:none; border-top:1px solid #E2E8F0; margin:0 0 0.875rem">
        <p style="margin:0 0 0.75rem; font-size:1rem; font-weight:600; line-height:1.4; color:#0F172A">${KO.qrTitle}</p>
        <a href="${esc(findUrl)}" target="_blank" rel="noopener" aria-label="${KO.qrOpen}" style="display:block; width:200px; max-width:100%; margin:0 auto 0.75rem; line-height:0; border:1px solid #E2E8F0; border-radius:2px; box-sizing:border-box; overflow:hidden">${qrSvg.replace("<svg", '<svg aria-hidden="true" focusable="false" style="display:block; width:100%; height:auto"')}</a>
        <p style="margin:0; font-size:0.8125rem; line-height:1.5; color:#64748B">${KO.qrHint}</p>
        <p style="margin:1.5rem 0 0; font-size:0.6875rem; line-height:1.4; letter-spacing:0.02em; color:#94A3B8">matchup.fit</p>
      </div>
    </div>
  </div>
`;

  const org = { "@type": "Organization", "@id": "https://matchup.fit/#organization", name: "MatchUp", url: "https://matchup.fit/" };
  const ld = [
    { "@context": "https://schema.org", "@type": "Article", headline: KO.title(s.brand, s.name).replace(/ \| 매치업$/, ""),
      description, url, mainEntityOfPage: url, inLanguage: "ko", image: photos,
      about: [{ "@type": "Thing", name }, { "@type": "Brand", name: s.brand }],
      ...(s.updated_at ? { dateModified: s.updated_at.slice(0, 10) } : {}), author: org, publisher: org },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: KO.back, item: `${siteUrl}/kr` },
      { "@type": "ListItem", position: 2, name: s.brand }] },
  ].map(o => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2).replace(/</g, "\\u003c")}\n</script>`).join("\n");

  let html = koreanize(frame, { ...ctx, enUrl });
  html = setHead(html, {
    title: KO.title(s.brand, s.name), description, url, image: photos[0], imageAlt: name,
    alternates: [["ko", url], ...(en ? [["en", `${siteUrl}/fitting-room/${en}`], ["x-default", `${siteUrl}/fitting-room/${en}`]] : [])],
  }, esc);
  return { html, buy, fill: { "{{KR_MAIN}}": main, "{{KR_QR}}": qr, "{{KR_LD}}": ld } };
}

/** dist/kr.html과 dist/kr/<주소>.html을 만든다. 돌려주는 값: 사이트맵에 넣을 주소들. */
async function build({ shoes: enShoes, out, esc, siteUrl, matchupApp, matchupApi }) {
  const source = (process.env.KR_SOURCE_SITE || "https://matchup.fit").replace(/\/+$/, "");
  const problems = [];
  const table = readTable((p) => problems.push(p));
  const enLanding = await fetchText(`${source}/fitting-room`);
  const drafts = process.env.KR_DRAFTS_DIR;
  const list = drafts ? draftShoes(drafts, enLanding, source) : await fetchShoes(matchupApi);
  if (drafts) console.log(`Korean site: PREVIEW from draft files in ${drafts} (${list.length} shoes), not from the shoe list API`);
  // 영어 원본 페이지를 정하지 않은 신발은, 같은 FR코드의 영어 신발 파일이 있으면 그 페이지와 언어 버전으로 잇는다.
  const enSlugByCode = new Map(enShoes.filter(s => s.matchupProduct).map(s => [s.matchupProduct, s.slug]));
  const ctx = { source, table, esc, siteUrl, matchupApp, matchupApi, enSlugByCode };

  const landing = landingPage(enLanding, list, ctx, problems);

  // 신발 페이지 틀: 그 신발의 영어 원본 페이지(없으면 영어 피팅룸의 첫 신발 페이지). 영어 검사는 틀마다 한 번.
  const firstShoe = (enLanding.match(/<a class="shop-card" href="(\/fitting-room\/[^"]+)"/) || [])[1];
  if (!firstShoe) throw new Error(`Korean site: no shoe page link on ${source}/fitting-room`);
  const pagesByUrl = new Map();
  const englishPage = async (rel) => {
    const u = `${source}${rel}`;
    if (!pagesByUrl.has(u)) {
      const en = await fetchText(u);
      const frame = shoeFrame(en, ctx, problems);
      // 영어 검사는 틀에만(신발 이름·글은 어드민의 한국어라 영어 낱말이 섞여도 된다 — 예: 아디제로 에보 SL)
      check(setHead(koreanize(frame, { ...ctx, enUrl: "/fitting-room" }),
        { title: "-", description: "-", url: "", image: "", imageAlt: "-", alternates: [] }, esc), `${u} (shoe page frame)`, problems, ctx.table.keepEnglish);
      pagesByUrl.set(u, { frame, english: readEnglishShoe(en, u, source) });
    }
    return pagesByUrl.get(u);
  };
  const pages = [];
  for (const s of list) {
    const { frame, english } = await englishPage(s.source_slug ? `/fitting-room/${s.source_slug}` : firstShoe);
    const { html, buy, fill } = await shoePage(frame, s, list, ctx, s.source_slug ? english : null);
    if (buy) check(buy.replace(/(<a class="shoe-buy-row"[^>]*>)[^<]*/g, "$1"), `${source}/fitting-room/${s.source_slug} (where to buy)`, problems, ctx.table.keepEnglish);
    pages.push([s, Object.entries(fill).reduce((h, [k, v]) => h.replace(k, () => v), html)]);
  }
  // 그 밖의 한국어 페이지(영어 페이지 틀 + 공통 문구표 + 페이지 문구표) — 2026-11-18 작동 방식
  const extra = [];
  for (const p of EXTRA_PAGES) {
    const t = readTable((x) => problems.push(x), ["fitting-room.ko.txt", ...p.tables]);
    let en = await fetchText(`${source}${p.en}`);
    if (p.merge) {
      en = mergeSections(en, await fetchText(`${source}${p.merge.from}`), p.merge);
      if (!en) throw new Error(`Korean site: sections ${p.merge.sections.join(", ")} or "${p.merge.before || p.merge.after}" not found on ${source}${p.merge.from} / ${p.en} — layout changed; build-kr.js needs a look`);
    }
    for (const label of p.drop || []) {
      if (!sectionRe(label).test(en)) throw new Error(`Korean site: section "${label}" to drop not found on ${source}${p.en} — layout changed; build-kr.js needs a look`);
      en = en.replace(sectionRe(label), "");
    }
    let html = koreanize(en, { ...ctx, table: t, enUrl: p.en });
    html = html.replace(/(<link rel="canonical" href=")[^"]*"/, `$1${siteUrl}${p.kr}"`)
      .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${siteUrl}${p.kr}"`)
      .replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?/g, "")
      .replace("</head>", `<meta property="og:locale" content="ko_KR">
<link rel="alternate" hreflang="ko" href="${siteUrl}${p.kr}">
<link rel="alternate" hreflang="en" href="${siteUrl}${p.en}">
<link rel="alternate" hreflang="x-default" href="${siteUrl}${p.en}">
</head>`);
    check(html, `${source}${p.en}`, problems, t.keepEnglish);
    extra.push([p, html]);
  }
  if (problems.length) throw new Error("Korean site was NOT built:\n  " + [...new Set(problems)].join("\n  "));

  fs.writeFileSync(path.join(out, "kr.html"), landing);
  fs.mkdirSync(path.join(out, "kr"), { recursive: true });
  for (const [s, html] of pages) fs.writeFileSync(path.join(out, "kr", `${s.slug}.html`), html);
  for (const [p, html] of extra) fs.writeFileSync(path.join(out, `${p.kr.slice(1)}.html`), html);
  // 한국 사이트 사진(IMG: 줄이 가리키는 kr/img/*) → /kr/img/*
  const imgDir = path.join(KR_DIR, "img");
  if (fs.existsSync(imgDir)) fs.cpSync(imgDir, path.join(out, "kr", "img"), { recursive: true });
  return ["/kr", ...extra.map(([p]) => p.kr), ...list.map(s => `/kr/${s.slug}`)];
}

// 피팅룸·신발 페이지 말고 한국어로 만드는 영어 페이지. 주소가 겹치지 않게 신발 주소(slug)로 쓰지 말 것.
// merge: 다른 영어 페이지의 단락(data-screen-label)을 가져와 before 단락 앞(또는 after 단락 뒤)에 넣는다(그 페이지의 <style>도 함께).
// drop: 이 페이지에서 뺄 단락.
const EXTRA_PAGES = [
  { en: "/how-it-works", kr: "/kr/how-it-works", tables: ["how-it-works.ko.txt", "home-sections.ko.txt"],
    // 2026-11-18 오너: 옛 첫 페이지(/ko) 내용을 작동 방식과 합친다 — 첫 화면 큰 그림(Specimen hero)은 피팅룸과 겹쳐 뺌
    merge: { from: "/", sections: ["Problem and outcome", "How setup works", "Available on"], before: "Navy band" } },
  // 2026-11-18 오너: 가격 안내 아래 문의 양식(CTA band)은 문의하기로 옮긴다
  // 2026-11-19: 미국 쪽도 문의 양식(CTA band)을 /pricing에서 /contact로 옮겨서 옮기기 규칙이 필요 없어졌다(영어 그대로 따라감).
  { en: "/pricing", kr: "/kr/pricing", tables: ["pricing.ko.txt"] },
  { en: "/contact", kr: "/kr/contact", tables: ["pricing.ko.txt", "contact.ko.txt"] },
];

const sectionRe = (label) => new RegExp(`[ \\t]*<section[^>]*data-screen-label="${reEsc(label)}"[\\s\\S]*?</section>\\n?`);

function mergeSections(html, other, merge) {
  const sec = (h, label) => (h.match(sectionRe(label)) || [])[0];
  const add = merge.sections.map(l => sec(other, l)).filter(Boolean);
  let at = -1;
  if (merge.before) at = html.search(new RegExp(`[ \\t]*<section[^>]*data-screen-label="${reEsc(merge.before)}"`));
  else { const m = html.match(sectionRe(merge.after)); if (m) at = m.index + m[0].length; }
  if (add.length !== merge.sections.length || at < 0) return null;
  const head = (h) => h.slice(0, h.indexOf("</head>"));
  const mine = new Set([...head(html).matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(m => m[0]));
  const styles = [...head(other).matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(m => m[0]).filter(s => !mine.has(s));
  html = html.slice(0, at) + add.join("") + html.slice(at);
  return html.replace("</head>", styles.join("\n") + "\n</head>");
}

// ── 독립 실행(이 저장소 = 대표님 GitHub, Vercel 빌드 명령 `node build-kr.js`) ─────────────────
// 환경 변수(Vercel 프로젝트 설정):
//   MATCHUP_API   매치업 서버(운영 https://api.matchup.fit, 스테이징 https://staging-api.matchup.fit)
//   MATCHUP_APP   매치업 앱(운영 https://dev.matchup.fit, 스테이징 https://staging.matchup.fit)
//   SITE_URL      이 페이지가 보이는 주소의 앞부분(운영 https://matchup.fit — /kr은 matchup.fit이 경로로 불러온다)
//   KR_SOURCE_SITE 틀을 읽어 올 영어 사이트(기본 https://matchup.fit)
//   NOINDEX=1     검색엔진에 안 나오게(스테이징)
//   KR_DRAFTS_DIR (미리보기 전용) DB 대신 글 초안 폴더
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

async function main() {
  const out = path.join(__dirname, "dist");
  const env = (k, d) => (process.env[k] || d).replace(/\/+$/, "");
  const siteUrl = env("SITE_URL", "https://matchup.fit");
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const urls = await build({
    shoes: [], out, esc, siteUrl,
    matchupApp: env("MATCHUP_APP", "https://dev.matchup.fit"),
    matchupApi: env("MATCHUP_API", "https://api.matchup.fit"),
  });
  // 없는 /kr/<주소>(한국에서 뺀 신발, 아직 한국에 없는 새 영어 신발 등) — Vercel이 404 상태로 이 페이지를 보여준다.
  // 손님은 곧바로 한국 피팅룸(/kr)으로, 검색엔진에는 '없는 페이지'(404·noindex)로(2026-11-19, 미국 관리자 질문 3).
  fs.writeFileSync(path.join(out, "404.html"), `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=/kr">
<title>피팅룸 | 매치업</title>
<script>location.replace("/kr");</script>
<style>body{margin:0;font-family:system-ui,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;color:#334155;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}a{color:#346B86}</style>
</head>
<body>
<p>찾으시는 신발은 아직 한국 피팅룸에 없어요.<br><a href="/kr">피팅룸으로 가기</a></p>
</body>
</html>
`);
  const noindex = process.env.NOINDEX === "1";
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".html") ? [path.join(dir, e.name)] : []);
  if (noindex) {
    for (const f of walk(out)) {
      const html = fs.readFileSync(f, "utf8");
      if (!html.includes('name="robots"')) fs.writeFileSync(f, html.replace("</head>", '<meta name="robots" content="noindex, nofollow">\n</head>'));
    }
  }
  // 한국 사이트 사이트맵(/kr/sitemap.xml) — 구글·네이버에 따로 등록하거나 matchup.fit 사이트맵 색인에 넣는다
  fs.mkdirSync(path.join(out, "kr"), { recursive: true });
  fs.writeFileSync(path.join(out, "kr", "sitemap.xml"), noindex ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n` :
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${siteUrl}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
  console.log(`Korean Fitting Room (${urls.length} pages)${noindex ? " — NOINDEX (test copy)" : ""}:`);
  for (const u of urls) console.log(`  ${u}`);
}

if (require.main === module) {
  main().catch((err) => { console.error(err.message || err); process.exit(1); });
}

module.exports = { build };
