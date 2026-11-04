/* FMC adapter: sun_life. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const sunLife={key:'sun_life',label:'Sun Life Global Investments',style:'sun_life',signatures:[/SLGI ASSET MANAGEMENT INC/i,/sunlifeglobalinvestments\.com/i,/Sun Life Granite/i],title:/^\s*(Sun Life\s+[^\n]{3,120}(?:Fund|Class|Portfolio))\s*$/im};

const fmcConfig_sun_life={issuerPrefix:/^Sun Life\s/i,splitColumns:true,deduplicate:true,allowMetricWithoutRatioHeading:true};

// @mrfp:extraction
function parseSunLifePositioned(pages) {
  const out = new Map();
  const normalized = s => String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const reportYear = reportDate(pages)?.slice(0, 4);
  if (!reportYear) return [];

  const metrics = {
    MER: {
      start: /^management\s+expense(?:\s+ratio)?\b/i,
      finish: /\bratio\s*\(\s*%\s*\)/i
    },
    TER: {
      start: /^trading\s+expense(?:\s+ratio)?\b/i,
      finish: /\bratio\s*\(\s*%\s*\)/i
    },
    PTR: {
      start: /^portfolio\s+turnover(?:\s+rate)?\b/i,
      finish: /\brate\s*\(\s*%\s*\)/i
    }
  };

  function readMetric(lines, metric) {
    const rule = metrics[metric];

    for (let i = 0; i < lines.length; i++) {
      if (!rule.start.test(lines[i])) continue;

      if (metric === 'MER' &&
          /\b(?:before|waivers?|absorption)\b/i.test(lines[i])) {
        continue;
      }

      for (let j = i; j < Math.min(i + 5, lines.length); j++) {
        const line = lines[j];

        if (j > i &&
            /^(?:management\s+expense|trading\s+expense|portfolio\s+turnover|net\s+asset\s+value)/i.test(line)) {
          break;
        }

        if (!rule.finish.test(line)) continue;
        if (/\b(?:before|waivers?|absorption)\b/i.test(line)) break;

        const tail = line.slice(
          line.search(rule.finish) + line.match(rule.finish)[0].length
        ).replace(
          /^\s*(?:\(\s*\d+\s*\)|[¹²³⁴⁵⁶⁷⁸⁹])+/,
          ''
        ).trim();

        const found =
          /^([—–−-]|\d+(?:\.\d+)?|\.\d+)(?=\s|%|$)/.exec(tail);

        if (found) {
          return {
            seen: true,
            value: toNumber(found[1])
          };
        }
      }
    }

    return { seen: false, value: null };
  }

  for (const page of pages) {
    
    // Rebuild Sun Life right column using actual PDF.js positions.
    // Exclude left-column values that leak into rightText.
    let cleanRight = page.rightText;

    if (Array.isArray(page.items) &&
        page.items.length &&
        Number.isFinite(page.width)) {

      const filtered = page.items.filter(t =>
        typeof t.str === 'string' &&
        t.str.trim() &&
        Number.isFinite(t.x) &&
        Number.isFinite(t.y) &&
        t.x >= page.width / 2 + 20
      );

      const groups = [];

      for (const t of filtered) {
        let g = groups.find(r =>
          Math.abs(r.y - t.y) <
          Math.max(2, Math.min(3, (t.h || 7) * 0.28))
        );

        if (!g) {
          g = { y: t.y, items: [] };
          groups.push(g);
        }

        g.items.push(t);
      }

      groups.sort((a, b) => b.y - a.y);

      cleanRight = groups.map(g => {
        const sorted = g.items.sort((a, b) => a.x - b.x);
        let text = '';
        let end = 0;

        for (const part of sorted) {
          const gap = part.x - end;

          if (text &&
              gap > Math.max(1.5, (part.h || 7) * 0.20)) {
            text += ' '.repeat(
              Math.max(1, Math.min(12,
                Math.round(
                  gap / Math.max(3, (part.h || 7) * 0.32)
                )
              ))
            );
          }

          text += part.str;
          end = Math.max(end, part.x + (part.w || 0));
        }

        return text.trimEnd();
      }).join('\n');
    }

    const cols = [page.leftText, cleanRight]
      .filter(t => typeof t === 'string' && t.trim());

    for (const col of cols) {
      const lines = col.split(/\r?\n/).map(normalized);
      const heads = [];

      for (let i = 0; i < lines.length; i++) {
        const m =
          /^sun\s+life\s+.+?\s*[-–]\s*series\s+([a-z][a-z0-9-]*)\s*$/i
          .exec(lines[i]);

        if (m) {
          heads.push({
            index: i,
            cls: 'Series ' + m[1].toUpperCase()
          });
        }
      }

      for (let i = 0; i < heads.length; i++) {
        const h = heads[i];
        const block = lines.slice(
          h.index + 1,
          heads[i + 1]?.index ?? lines.length
        );

        const yearLine = block.slice(0, 8)
          .find(t => /\b20\d{2}\b/.test(t));

        if (!yearLine ||
            (yearLine.match(/20\d{2}/g) || [])[0] !== reportYear) {
          continue;
        }

        const values = {};
        const evidence = {};
        let count = 0;

        for (const metric of ['MER', 'TER', 'PTR']) {
          const result = readMetric(block, metric);
          values[metric] = result.value;

          if (result.seen) {
            count++;
            evidence[metric] = {
              page: page.page,
              source: metric + ' (Sun Life current-period ratio table)',
              method: 'native-pdfjs'
            };
          }
        }

        if (count !== 3) continue;

        out.set(h.cls.toLowerCase(), {
          cls: h.cls,
          values,
          evidence,
          page: page.page,
          quality: count
        });
      }
    }
  }

  return [...out.values()];
}


function extract_sun_life(pages,p,fund,date){const positioned=parseSunLifePositioned(pages);return positioned.length?positioned:tableBlocks(pages,p,{allowWithoutRatio:true});}
// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_sun_life(line){
 const style='sun_life';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='sun_life'){m=/(?:^|\s[-–]\s)(Series\s+[A-Z][A-Z0-9-]*)$/i.exec(s);return m?m[1]:null;}
 return null;
}

// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_sun_life={stamps:{lastGapLocatorVersion:1}};
function gapSunLifeCell(page,lines,row,key,value){
 const yr=Number(row.report_date?.slice(0,4));
 const target=clean(row.class_name),fund=clean(row.fund_name),out=[];
 if(!['MER','PTR'].includes(key))return null;
 const heads=lines.filter(l=>l.items.some(it=>it.x<330&&clean(it.str)===fund+' - '+target));
 for(const head of heads){
  const next=lines.filter(l=>l.y<head.y&&l.y>head.y-260&&l.items.some(i=>i.x<330&&clean(i.str).startsWith(fund+' - series '))).sort((a,b)=>b.y-a.y)[0];
  const low=next?.y??Math.max(0,head.y-260);
  const yearLine=lines.filter(l=>l.y<head.y&&l.y>low&&l.items.some(i=>i.str.trim()===String(yr)&&i.x<330)).sort((a,b)=>b.y-a.y)[0];
  if(!yearLine)continue;
  const yearX=yearLine.items.find(i=>i.str.trim()===String(yr)&&i.x<330).x;
  for(const label of lines.filter(l=>l.y<yearLine.y&&l.y>low)){
   const t=clean(label.items.filter(i=>i.x<330).map(i=>i.str).join(' '));
   if(key==='MER'&&t!=='management expense')continue;
   if(key==='PTR'&&t!=='portfolio turnover')continue;
   const nexts=lines.filter(l=>l.y<label.y&&label.y-l.y<13&&l.items.some(i=>i.x<330&&/^(?:ratio|rate)\s*\(%\)/i.test(i.str.trim())));
   if(nexts.length!==1)continue;
   const candidates=cells(nexts[0]).filter(c=>Math.abs(c.x-yearX)<14&&matchesCell(c,value));
   if(candidates.length===1)out.push(candidates[0]);
  }
 }
 return out.length===1?out[0]:null;
}


function locateGap_sun_life(page,lines,row,key,value){return gapSunLifeCell(page,lines,row,key,value);}
