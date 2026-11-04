/* FMC adapter: global_x. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_global_x={key:'global_x',label:'Global X Investments Canada',style:'globalx_new',signatures:[/GLOBAL X INVESTMENTS CANADA INC/i,/Global X Canadian Oil and Gas/i],title:/^\s*(Global X[^\n]{5,180}?ETF)\s*$/im};

const fmcConfig_global_x={issuerPrefix:/^Global X\s/i};

// @mrfp:extraction
function parseGlobalX(pages){
 // Global X financial statements sometimes render digits split after a
 // decimal point ('104. 36%'); join those spans only inside ratio-table rows.
 const labels={MER:/^Management expense ratio\s+(?!before)/i,TER:/^Trading expense ratio\s+/i,PTR:/^Portfolio turnover rate\s+/i};
 for(const page of pages){
  const block=page.text.split(/\r?\n/);
  if(!block.some(s=>/^Ratios and Supplemental Data/i.test(s.trim())))continue;
  const vals={MER:null,TER:null,PTR:null};const seen=new Set();
  for(const s of block){
   const line=normalizeExtraText(s).trim();
   for(const [metric,re] of Object.entries(labels)){
    const match=re.exec(line);if(!match)continue;
    const tail=line.slice(match[0].length).trim();
    const token=/^(\d+)\.\s*(\d+)%?|^([—–−-])(?=\s|$)/.exec(tail);
    if(token){vals[metric]=token[3]?null:toNumber(token[1]+'.'+token[2]);seen.add(metric);}
   }
  }
  if(seen.size===3)return [{cls:'ETF Units',values:vals,quality:3,evidence:{}}];
 }
 return [];
}
// IG financial highlights sometimes omit the *printed* latest-year header
// for the final series on a continuation page. The current-period numeric
// column can still exist to the left of all labelled historical columns.
// Recognize it only when the same physical half-page has a normal series
// header for this report's year AND exactly one extra ratio value for each
// metric. Never substitute the historical first-labelled-year value.
function parseGlobalXB2(pages){
 for(const pg of pages){const start=pg.text.search(/Ratios\s+and\s+Supplemental\s+Data/i);if(start<0)continue;
  const lines=pg.text.slice(start).split(/\r?\n/),vals={};let quality=0;
  for(const metric of ['MER','TER','PTR']){
   const re=metric==='MER'?/^\s*Management\s+expense\s+ratio\b(?!\s+before)/i:metric==='TER'?/^\s*Trading\s+expense\s+ratio/i:/^\s*Portfolio\s+turnover\s+rate/i;
   const row=lines.find(t=>re.test(t));if(!row)continue;
   const tail=row.slice(re.exec(row)[0].length).replace(/^\s*(?:\(\d+\)|[¹²³⁴⁵])\s*/,'');
   const m=/([—–−-]|\d+\.\s*\d+|\d+\.\d+)\s*%/i.exec(tail);if(!m)continue;
   vals[metric]=toNumber(m[1].replace(/\.\s+/g,'.'));quality++;
  }
  if(quality===3)return [{cls:'ETF Units',values:vals,quality,evidence:{}}];
 }
 return [];
}
// v3-1: secondary Global X ratio reader. Runs only when the primary
// Global X table parser returned nothing. Restrict to financial tables,
// exact metric names (not 'excluding' or 'before') and current-year column.
function parseGlobalXWrappedRatios(pages,date){
 if(!date)return [];
 const year=date.slice(0,4);
 for(const pg of pages){
  const txt=normalizeExtraText(pg.text||'');const pos=txt.search(/Ratios?\s+and\s+Supplemental\s+Data/i);if(pos<0)continue;
  const lines=txt.slice(pos,pos+6500).split(/\r?\n/);
  const header=lines.slice(0,8).join(' ');
  const years=header.match(/20\d{2}/g)||[];if(years[0]!==year)continue;
  const vals={MER:null,TER:null,PTR:null},evidence={};let seen=0;
  for(const metric of ['MER','TER','PTR']){
   const re=metric==='MER'?/^\s*Management\s+expense\s+ratio\b/i:
    metric==='TER'?/^\s*Trading\s+expense\s+ratio\b/i:/^\s*Portfolio\s+turnover\s+(?:rate|ratio)\b/i;
   for(let i=0;i<lines.length;i++){
    const match=re.exec(lines[i]);if(!match)continue;
    let after=lines[i].slice(match[0].length);
    // Exclude alternate ratios that are not the reporting MER/TER/PTR.
    if(/^\s*(?:before|excluding)\b/i.test(after))continue;
    if(!after.trim()){
     const next=lines[i+1]||'';
     if(/^\s*(?:before|excluding)\b/i.test(next))continue;
     after=next;
    }
    const token=/^\s*([—–−-]|\d+\.\s*\d+)\s*%/.exec(after);
    if(!token)continue;
    vals[metric]=toNumber(token[1].replace(/\.\s+/g,'.'));seen++;
    evidence[metric]={page:pg.page,source:'Global X wrapped current-year ratio table',method:'native-js'};
    break;
   }
  }
  if(seen===3)return [{cls:'ETF Units',values:vals,evidence,quality:3}];
 }
 return [];
}

// Layout-only fallback for Global X reports. PDF.js may keep label, footnote
// and first-year cell in separate text runs or even separate lines. Read the
// physical first reporting column, never an arbitrary percentage in prose.
// This runs AFTER all existing Global X text parsers and only for its issuer.

function parseGlobalXPositionedRatios(pages, date) {
  if (!date) return [];

  const targetYear = date.slice(0, 4);
  const normalize = s => String(s || '').replace(/\s+/g, ' ').trim();

  for (const pg of pages) {
    const items = Array.isArray(pg.items)
      ? pg.items.filter(it =>
          it &&
          typeof it.str === 'string' &&
          it.str.trim() &&
          Number.isFinite(it.x) &&
          Number.isFinite(it.y)
        )
      : [];

    if (!items.length) continue;

    const rows = [];

    for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
      let row = rows.find(r => Math.abs(r.y - it.y) <= 3.4);

      if (!row) {
        row = { y: it.y, parts: [] };
        rows.push(row);
      }

      row.parts.push(it);
    }

    rows.sort((a, b) => b.y - a.y);

    for (const row of rows) {
      row.parts.sort((a, b) => a.x - b.x);
      row.label = normalize(
        row.parts.filter(x => x.x < 270).map(x => x.str).join(' ')
      );
    }

    const idx = rows.findIndex(r =>
      /Ratios?\s+and\s+Supplemental\s+Data/i.test(r.label)
    );

    if (idx < 0) continue;

    let firstYear = null;
    let secondYear = null;
    let yearIdx = -1;

    for (let i = idx + 1; i < Math.min(rows.length, idx + 9); i++) {
      const dateBits = rows[i].parts
        .filter(x => x.x > 260 && /^\d+$/.test(normalize(x.str)))
        .sort((a, b) => a.x - b.x);

      const merged = [];

      for (const bit of dateBits) {
        const str = normalize(bit.str);
        const last = merged[merged.length - 1];

        if (
          last &&
          last.str.length < 4 &&
          bit.x >= last.x &&
          bit.x - (last.x + last.w) <= 8
        ) {
          last.str += str;
          last.w = Math.max(last.w, bit.x + (bit.w || 0) - last.x);
        } else {
          merged.push({ str, x: bit.x, w: bit.w || 0 });
        }
      }

      const years = merged.filter(x => /^20\d{2}$/.test(x.str));

      if (years.length >= 2) {
        firstYear = years[0];
        secondYear = years[1];
        yearIdx = i;
        break;
      }
    }

    if (!firstYear || firstYear.str.trim() !== targetYear) continue;

    const vals = { MER: null, TER: null, PTR: null };
    const evidence = {};
    let seen = 0;

    const specs = {
      MER: /^Management\s+expense\s+ratio\b(?!\s+before)/i,
      TER: /^Trading\s+expense\s+ratio\b/i,
      PTR: /^Portfolio\s+turnover\s+(?:rate|ratio)\b/i
    };

    for (const metric of ['MER', 'TER', 'PTR']) {
      for (let i = yearIdx + 1; i < Math.min(rows.length, yearIdx + 25); i++) {
        const row = rows[i];

        if (!specs[metric].test(row.label)) continue;

        if (
          metric === 'MER' &&
          /^Management\s+expense\s+ratio\s+(?:excluding|before)\b/i.test(row.label)
        ) continue;

        const boundary = (firstYear.x + secondYear.x) / 2;

        const column = items.filter(x =>
          x.x >= firstYear.x - 57 &&
          x.x < boundary + 1
        );

        const seed = column
          .filter(x =>
            Math.abs(x.y - row.y) <= 6 &&
            /[\d.\u2014\u2013\u2212-]/.test(x.str)
          )
          .sort((a, b) =>
            Math.abs(a.y - row.y) - Math.abs(b.y - row.y) ||
            a.x - b.x
          )[0];

        if (!seed) break;

        
        const pieces = row.parts
        .filter(x =>
        x.x >= firstYear.x - 57 &&
        x.x < (firstYear.x + secondYear.x) / 2 + 1
        )
        .sort((a, b) => a.x - b.x);


        
        const tokens = [...pieces].sort((a, b) => a.x - b.x);

        let value = normalize(tokens.map(x => x.str).join(' '))
        .replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');

        // Reconstruct split decimals from PDF.js fragments.
        if (
          tokens.length === 2 &&
          /^\d{1,3}$/.test(normalize(tokens[0].str)) &&
          /^\d{2}%$/.test(normalize(tokens[1].str))
        ) {
        const gap = tokens[1].x -
        (tokens[0].x + (tokens[0].w || 0));

        if (Number.isFinite(gap) && gap >= -0.5 && gap <= 4) {
          value = normalize(tokens[0].str) +
           '.' + normalize(tokens[1].str);
        }
}

        const m = /^([—–−-]|\d+(?:\.\d+)?|\.\d+)\s*%?$/.exec(value);


        if (!m) break;

        vals[metric] = toNumber(m[1]);

        evidence[metric] = {
          page: pg.page,
          source: 'Global X positioned latest-year ratio table',
          method: 'native-pdfjs-geometry'
        };

        seen++;
        break;
      }
    }

    if (seen === 3) {
      return [{
        cls: 'ETF Units',
        values: vals,
        quality: 3,
        evidence
      }];
    }
  }

  return [];
}

// Include Listed Accumulating Units alongside Listed CAD/USD Units.
// Inspect the right financial-ratio column only, not unrelated left-side
// Net Assets per Unit tables or future period announcements.

function extract_global_x(pages,p,fund,date){const r=parseGlobalX(pages);if(r.length)return r;const b=parseGlobalXB2(pages);if(b.length)return b;const w=parseGlobalXWrappedRatios(pages,reportDate(pages));return w.length?w:parseGlobalXPositionedRatios(pages,reportDate(pages));}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundLate_global_x(pages,p,head){
if(p.key==='global_x'){
    for(const pg of pages.slice(0,9))for(const raw of pg.text.split(/\r?\n/)){
      const line=raw.replace(/[\u00a0\u202f]/g,' ').replace(/\s+/g,' ').trim();
      const m=/^(Global\s*X\s+[^\n]{8,160}?ETF)\s*$/i.exec(line);
      if(m)return clean(m[1]).replace(/^Global\s*X/i,'Global X');
    }
  }
}

// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_global_x={stamps:{lastGapLocatorVersion:1}};


function locateGap_global_x(page,lines,row,key,value){return gapEtfYearCell(page,lines,row,key,value);}
