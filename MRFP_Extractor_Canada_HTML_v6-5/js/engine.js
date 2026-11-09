/* GENERATED from js/core + js/fmc via dev-tools/build.cjs. DO NOT EDIT DIRECTLY. Browser file:// safe. */
(function(global){
'use strict';
/* Shared parser utilities, preserved from v5. */
function createHash() {
  let text='';
  return {
    update(input){text+=String(input);return this;},
    digest(){
      let hashes=[2166136261,2246822519,3266489917,668265263,374761393];
      for (let i=0;i<text.length;i++){
        const ch=text.charCodeAt(i);
        hashes=hashes.map((h,j)=>Math.imul(h ^ (ch + j*17),[16777619,2246822519,3266489917,374761393,2654435761][j])>>>0);
      }
      return hashes.map(x=>x.toString(16).padStart(8,'0')).join('');
    }
  }
}

// ---- src/fmc/nbi.mjs ----
// Generalized NBI fund title and expanded class headings (SmartData update).
const nbiClass=/^\s*(Investor\s*\*?\s*\/\s*Advisor\s+Series|Investor(?:-\d+)?\s+Series|Advisor(?:-\d+)?\s+Series|Series\s+[A-Z][A-Z0-9-]*|ETF(?:H)?\s+Series|Private\s+Series)\s*\*{0,5}\s*$/i;


// ---- src/fmc/profiles.mjs ----
const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function reportDate(pages){
 const head=pages.slice(0,9).map(p=>p.text).join('\n').slice(0,40000);
 const re=/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2}),?\s+(20\d\d)\b/gi;
 const rows=head.split(/\r?\n/);
 for(const preference of [/(?:period|year)\s+ended|as\s+at|as\s+of|for\s+the\s+(?:financial\s+)?period/i,/(?:202[0-9]\s+interim\s+report|report\s+of\s+fund)/i,/.*/]){
  for(const line of rows){if(!preference.test(line))continue;const matches=[...line.matchAll(re)];if(matches.length){const m=matches[0];return `${m[3]}-${String(months[m[1].slice(0,3).toLowerCase()]).padStart(2,'0')}-${m[2].padStart(2,'0')}`;}}
 }
 const m=/(?:June|December|April|September)\s+\d{1,2},?\s+20\d{2}/i.exec(head);if(m)return reportDate([{text:m[0]}]);return null;
}
const ratioMetric=(line)=>/management\s+expense\s+ratio\b(?!\s+before)/i.test(line)?'MER':/trading\s+expense\s+ratio\b/i.test(line)?'TER':/portfolio\s+turnover\s+(?:rate|ratio)\b/i.test(line)?'PTR':null;
function toNumber(token){if(token==null)return null;const s=String(token).trim().replace(/[,％%]/g,'').replace(/[\u200b\u00ad]/g,'').replace(/\([a-z0-9]{1,3}\)$/i,'').replace(/\*+$/,'');if(/^[—–-]+$/.test(s)||!s)return null;let n=Number(s);return Number.isFinite(n)?n:null;}
function metricValues(line){
 const label=/management\s+expense\s+ratio\b(?!\s+before)|trading\s+expense\s+ratio\b|portfolio\s+turnover\s+(?:rate|ratio)\b/i.exec(line);if(!label)return null;
 const metric=ratioMetric(label[0]);if(/\bmanagement\s+expense\s+ratio\s+before\b/i.test(line)||/\bFER\b/i.test(line))return null;
 // Look after metric label; skip footnote markers and (%) units, but don't pick monetary totals from elsewhere.
 let tail=line.slice(label.index+label[0].length).replace(/^\s*(?:\([^)]{1,10}\)\s*){0,3}/,'');
 const values=(tail.match(/(?:^|\s)(?:\(?-?\d[\d,]*(?:\.\d+)?\)?%?(?:\([a-z0-9]\))?|[—–-])(?=\s|$)/gi)||[]).map(s=>s.trim());
 return {metric,values};
}


// ---- src/shared/table-stream.mjs ----


function classHeading(line,style){
 const handler=FMC_CLASS_HEADING_BY_STYLE[style];
 return handler?handler(line):null;
}
function parseMetricLine(line,metric){
 const label=ratioMetric(line); if(label!==metric)return {seen:false,value:null};
 const firstLabel=/management\s+expense\s+ratio\b/i.exec(line);
 if(metric==='MER'&&firstLabel && /^(?:\s+before\b)/i.test(line.slice(firstLabel.index+firstLabel[0].length)))return {seen:false,value:null};
 let tail=line.slice(line.search(/management\s+expense\s+ratio|trading\s+expense\s+ratio|portfolio\s+turnover\s+(?:rate|ratio)/i)).replace(/^(?:management\s+expense\s+ratio|trading\s+expense\s+ratio|portfolio\s+turnover\s+(?:rate|ratio))\b/i,'');
 // Skip parenthesized footnotes, MER abbreviation, (%) units and integer footnotes.
 tail=tail.replace(/^\s*\(\s*[“"']?(?:MER|TER)[”"']?\s*\)/i,'');
 tail=tail.replace(/^\s*(?:(?:\(\s*%\s*\))|(?:\(\d+\))|(?:\d+\s*\(%\))|(?:\d+\s*\(\d+\))|(?:\(\d+\)\s*\(%\))|(?:\(\d+\)\s*\(\d+\))|(?:\(\d+\)\s*\d+))*\s*/,'');
 tail=tail.replace(/^\s*\d{1,2}(?=\s+\d|\s*\n|$)/,'');
 const values=tail.match(/(?:\d[\d,]*(?:\.\d+)?%?(?:\([a-z]\))?|[—–-])(?=\s|$)/gi)||[];
 return {seen:true,value:values.length?toNumber(values[0]):null};
}


// ---- src/extractor.mjs ----




const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
// Generic fund identity pipeline; all issuer-specific rules live in adapters.
// Hook ordering retains the original pre-title / title / post-title / fallback order.
function identifyFund(pages,p){
 const head=pages.slice(0,5).map(x=>x.text).join('\n');
 const adapter=FMC_ADAPTERS_BY_KEY[p.key];
 const early=adapter?.identifyFundEarly?.(pages,p,head);
 if(early!==undefined)return early;
 if(adapter?.config?.preferProfileLineTitle){
  for(const line of pages.slice(0,3).flatMap(pg=>pg.text.split(/\r?\n/))){
   const m=p.title&&new RegExp(p.title.source,p.title.flags).exec(line);
   if(m)return clean(m[1]);
  }
 }
 const late=adapter?.identifyFundLate?.(pages,p,head);
 if(late!==undefined)return late;
 // Preserve the original generic profile-title fallback after issuer strategies.
 const titleRe=p.title?new RegExp(p.title.source,p.title.flags.includes('g')?p.title.flags:p.title.flags+'g'):/(?!)/g;
 const matches=head.split(/\r?\n/).flatMap(line=>[...line.matchAll(titleRe)].map(m=>clean(m[1]))).filter(s=>s.length>7);
 matches.sort((a,b)=>b.length-a.length);
 if(matches[0])return matches[0];
 const fallback=adapter?.identifyFundFallback?.(pages,p,head);
 if(fallback!==undefined)return fallback;
 return issuerTitleCandidate(pages,p)?.text||'Unknown Fund';
}

function makeRow(cls,p,fund,date,vals,ev,needsReview=false,metadata=null){
 const year=date?Number(date.slice(0,4)):null;
 const fid=createHash('sha256').update(p.key+'\0'+fund.toLowerCase()).digest('hex').slice(0,20);
 // Stable row identity is based on the canonical class, never a display note
 // such as a historical re-designation appended by an issuer adapter.
 const cid=createHash('sha256').update(fid+'\0'+cls.toLowerCase()).digest('hex').slice(0,20);
 const displayClass=metadata?.displayClassName||cls;
 const aliases=Array.isArray(metadata?.classAliases)?[...new Set(metadata.classAliases.map(x=>String(x||'').trim()).filter(Boolean))]:[];
 return {class_name:displayClass,...(metadata?.displayClassName?{class_identity:cls}:{}),...(aliases.length?{class_aliases:aliases}:{}),fund_name:fund,fmc:p.label,fmc_key:p.key,fund_id:fid,class_id:cid,row_id:cid+':'+(date||year||'unknown'),report_date:date,year,MER:vals.MER??null,TER:vals.TER??null,PTR:vals.PTR??null,evidence:ev,needs_review:needsReview||!date};
}
function findMetric(block,metric){
 const lines=block.split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
   const t=lines[i].replace(/\u00a0/g,' ');
   const m=parseMetricLine(t,metric);
   if(m.seen){
      if(m.value!==null || /[—–-]\s*$/.test(t))return {found:true,value:m.value};
      const continuation=parseMetricLine(lines.slice(i,i+7).join(' '),metric);
      return {found:true,value:continuation.value};
   }
   // Labels with line breaks like "Management expense" + "ratio (%)"
   if(/\b(?:management|trading)\s+expense\s*$|\bportfolio\s+turnover\s*$/i.test(t)){
     const merged=parseMetricLine(lines.slice(i,i+8).join(' '),metric);
     if(merged.seen)return {found:true,value:merged.value};
   }
 }
 return {found:false,value:null};
}
function tableBlocks(pages,p,opts={}){
 const rows=[];const styles=p.style; let ratioSeen=false;
 for(const page of pages){
   const flags=FMC_ADAPTERS_BY_KEY[p.key]?.config||{};
   let variants=flags.splitColumns?[page.leftText||page.text,page.rightText||page.text]:[page.text];
   if(flags.waitForRatioHeading){if(/Ratios?\s+and\s+Supplemental\s+Data/i.test(page.text))ratioSeen=true;if(!ratioSeen)continue; if(/Past Performance/i.test(page.text))variants=[page.text.split(/Past Performance/i)[0]];}
   for(let text of variants){
     if(flags.startAtRatioHeading){const q=text.search(/Ratios?\s+and\s+Supplemental\s+Data/i);if(q<0)continue;text=text.slice(q);}
     if(flags.waitForRatioHeading){const q=text.search(/Ratios?\s+and\s+Supplemental\s+Data/i);if(q>=0)text=text.slice(q);}
     const lines=text.split(/\r?\n/);const headings=[];
     for(let i=0;i<lines.length;i++){const cls=classHeading(lines[i],styles);if(cls)headings.push({cls,index:i});}
     for(let i=0;i<headings.length;i++){
       const h=headings[i];let block=lines.slice(h.index,headings[i+1]?.index??lines.length).join('\n');
       if(flags.requirePriorRatioHeading){
         const prev=lines.slice(Math.max(0,h.index-6),h.index).join('\n');
         if(!/Ratios?\s+and\s+Supplemental\s+Data/i.test(prev))continue;
       }else if(!opts.allowWithoutRatio && !/Ratios?\s+and\s+Supplemental\s+Data/i.test(block) && !(flags.allowMetricWithoutRatioHeading&&/Management\s+expense/i.test(block)))continue;
       if(flags.requireRatioHeading && !/Ratios?\s+and\s+Supplemental\s+Data/i.test(block))continue;
       const vals={MER:null,TER:null,PTR:null},ev={};let count=0;
       // Isolate financial ratio section whenever it exists, avoiding older financial tables.
       const ratioIndex=block.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
       if(ratioIndex>=0 && !flags.retainRatioHeading) block=block.slice(ratioIndex);
       for(const metric of ['MER','TER','PTR']){
         const r=findMetric(block,metric);
         if(r.found){count++;vals[metric]=r.value;if(r.value!==null)ev[metric]={page:page.page,source:metric+' (ratio table)',method:'native-js',date_source:'report-header'};}
       }
       if(count<2)continue;
       rows.push({cls:h.cls,values:vals,evidence:ev,page:page.page,quality:count});
     }
   }
 }
 return rows;
}

// Sun Life two-column position-based supplement; only for pages with PDF text items.


function simpleTable(pages,p){
 // In a class-sliced ratio table, figures for the newest reporting year appear first.
 const blocks=tableBlocks(pages,p);
 const byClass=new Map();
 for(const b of blocks){const prev=byClass.get(b.cls);if(!prev || b.quality>prev.quality)byClass.set(b.cls,b);}
 return [...byClass.values()];
}
function scanSingleFund(pages,p){
 const text=pages.map(x=>x.text).join('\n');
 const vals={},ev={};let recognizedMetricLabels=0;
 for(const metric of ['MER','TER','PTR']){
   let found=false;
   for(const page of pages){const region=page.text.search(/Ratios?\s+and\s+Supplemental\s+Data/i);if(region<0)continue;
     const result=findMetric(page.text.slice(region,region+4500),metric);if(result.found){recognizedMetricLabels++;vals[metric]=result.value;if(result.value!==null)ev[metric]={page:page.page,source:metric+' (ratio table)',method:'native-js'};found=true;}if(found)break;
   }
 }
 return [{cls:null,values:vals,evidence:ev,quality:recognizedMetricLabels}];
}
function rowTable(pages,p){
 const output=[];
 for(const page of pages){let started=false,cls=null;const allLines=page.text.split(/\r?\n/);
  for(let li=0;li<allLines.length;li++){const line=allLines[li];
    if(/Ratios?\s+and\s+Supplemental\s+Data/i.test(line))started=true;
    if(!started)continue;
    const heading=classHeading(line,p.style);if(heading){cls=heading;continue;}
    if(!cls)continue;
    const m=/^\s*(?:Jun(?:e)?\.?\s+30|Dec(?:ember)?\.?\s+31)[,\s]+(20\d{2})\b/i.exec(line);
    if(!m)continue;
    const tail=line.slice(m[0].length).trim();
    let nums=tail.match(/(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\*?|[—–-]/g)||[];
    if(nums.length<6){const lines2=allLines;for(let j=li+1;j<Math.min(li+12,lines2.length)&&nums.length<7;j++){if(/^\s*(?:Series\s|Jun|Dec)/i.test(lines2[j]))break;const bits=lines2[j].trim().match(/^(?:\d[\d,]*(?:\.\d+)?|[—–-])$/);if(bits)nums.push(bits[0]);}}
    const latest=Number(m[1]);if(latest!==Number(reportDate(pages)?.slice(0,4)))continue;
    const dateCfg=FMC_ADAPTERS_BY_KEY[p.key]?.config||{};
    const columns=dateCfg.datedRowIndices||{MER:2,TER:4,PTR:5};
    const raw={MER:nums[columns.MER],TER:nums[columns.TER],PTR:nums[columns.PTR]};
    const values=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,toNumber(v)]));
    // A complete dated current-period row is still a real series even when
    // its MER, TER and PTR are all dashes (null), not numeric zero.
    if(nums.length<(dateCfg.datedRowMin||6))continue;
    const evidence={};for(const [k,v] of Object.entries(values))if(v!==null)evidence[k]={page:page.page,source:k+' (dated ratio row)',method:'native-js'};
    output.push({cls,values,evidence,quality:3});
  }
 }
 return [...new Map(output.map(r=>[r.cls,r])).values()];
}
// ---- BMO-specific extraction (Mutual Funds and ETFs) ----
// Both report types use BMO issuer signatures, but their ratio tables differ:
// Mutual funds have separate sections for each class and can use two columns;
// ETFs have a single "Listed CAD Units" ratio section, sometimes on the right.
// Read the period's *first* column only, and never substitute prior-year figures.
function normalizeExtraText(s){return String(s||'').replace(/\u00a0/g,' ').replace(/\u00ad/g,'').replace(/[ﬁﬂ]/g,c=>c==='ﬁ'?'fi':'fl');}
function firstRatioValue(t){
  t=normalizeExtraText(t).replace(/^[\s+*%():0-9,]*?(?=(?:\d+\.\d+|\.\d+|n\/?a|[—–−-]))/i,'').trim();
  // All reported percentage ratios in supported sample tables contain a decimal.
  // Avoid selecting numeric footnote identifiers preceding the first ratio.
  const m=/(?:^|\s)(n\/?a|[—–−-]|\d+\.\d+|\.\d+)(?=\s|%|$)/i.exec(t);
  return m?toNumber(m[1]):null;
}
function extraRatios(section){
 const lines=normalizeExtraText(section).split(/\r?\n/);let v={MER:null,TER:null,PTR:null},quality=0;
 for(const metric of ['MER','TER','PTR']){
  let match=null;
  for(let i=0;i<lines.length;i++){
   let s=lines[i].trim();
   const r=metric==='MER'?/^(?:Management\s+expense\s+ratio|Management\s+expense\s+ratios?)\b/i:metric==='TER'?/^Trading\s+expense\s+ratio\b/i:/^Portfolio\s+turnover\s+(?:rate|rates|ratio)\b/i;
   const a=r.exec(s);if(!a)continue;
   if(metric==='MER'&&/\bbefore\b/i.test(s))continue;
   const tail=s.slice(a[0].length).replace(/^[⁰¹²³⁴⁵⁶⁷⁸⁹]+/,'').trim();
   const tok=/(?:^|\s)(N\/A|n\/a|[—–−-]|\d+\.\d+|\.\d+)(?=\s|%|$)/i.exec(tail);
   // A blank metric label is allowed as long as the ratio isn't from a footnote.
   if(tok){match=toNumber(tok[1]);quality++;break;}
   if(/^\s*(?:\-\-|n\/a|[—–−-])\s*$/.test(tail)){match=null;quality++;break;}
   // Some labels and values split across PDF text lines.
   if(i+1<lines.length && !/^\s*(?:Management|Trading|Portfolio)/i.test(lines[i+1])){
    const cont=/(?:^|\s)(N\/A|n\/a|[—–−-]|\d+\.\d+|\.\d+)(?=\s|%|$)/i.exec(lines[i+1]);
    if(cont){match=toNumber(cont[1]);quality++;break;}
   }
  }
  v[metric]=match;
 }
 return {values:v,quality,evidence:{}};
}
function parseClassColumns(pages, opts){
 const out=new Map();
 for(const pg of pages){
  const candidates=opts.splitColumns?[pg.leftText,pg.rightText]:[pg.text];
  for(const txt of candidates){
   if(!txt)continue;
   const lines=normalizeExtraText(txt).split(/\r?\n/),heads=[];
   for(let i=0;i<lines.length;i++){
    const cls=opts.heading(lines[i],pg,i,lines);
    if(cls)heads.push({idx:i,cls});
   }
   for(let j=0;j<heads.length;j++){
    const h=heads[j],last=heads[j+1]?.idx??lines.length;
    let text=lines.slice(h.idx,last).join('\n');
    if(opts.requireRatioHeading && !/Ratios?\s+and\s+Supplemental\s+Data|Ratios\/Supplemental\s+Data/i.test(txt))continue;
    // Limit to the Ratio section if financial highlights precedes it.
    if(opts.ratiosAfterHeading){const pos=text.search(/Ratios?\s+and\s+Supplemental\s+Data|Ratios\/Supplemental\s+Data/i);if(pos>=0)text=text.slice(pos);else continue;}
    const vals=extraRatios(text);if(vals.quality<2)continue;
    const old=out.get(h.cls);if(!old||vals.quality>old.quality)out.set(h.cls,{cls:h.cls,...vals});
   }
  }
 }
 return [...out.values()];
}
function v22FirstRatio(line){
 const m=/(?:\d+(?:\.\d+)?|\.\d+)(?:\*+)?%?|[—–−-](?:%)?|n\/?a/i.exec(line);
 return m?toNumber(m[0].replace(/[%*]/g,'')):null;
}
function v22Metrics(text, {includePerformance=false}={}){
 const lines=normalizeExtraText(text).split(/\r?\n/),v={MER:null,TER:null,PTR:null};let quality=0;
 const re={MER:/^\s*Management\s+expense\s+ratio(?:\d+)?\b/i,TER:/^\s*Trading\s+expense\s+ratio(?:\d+)?\b/i,PTR:/^\s*Portfolio\s+turnover\s+(?:rate|ratio)(?:\d+)?\b/i};
 for(const key of ['MER','TER','PTR']){
  for(const line of lines){const m=re[key].exec(line);if(!m)continue;
   const tail=line.slice(m[0].length);
   if(key==='MER' && /^(?:\s+before\b|\s*\(excluding\b)/i.test(tail))continue;
   if(key==='MER' && /\(including\s+performance\s+fees\)/i.test(tail) && !includePerformance)continue;
   const idx=key==='MER'&&includePerformance?tail.search(/\(including\s+performance\s+fees\)/i):-1;
   if(key==='MER'&&includePerformance&&idx<0)continue;
   // Restrict ratios to the current table row. Ignore its footnotes/labels;
   // numbers in the ratio column always have a decimal point in these layouts.
   const percentages=tail.match(/(?:\d*\.\d+)\*?%?|[—–−-]%?|n\/?a/gi)||[];
   if(percentages.length){v[key]=toNumber(percentages[0].replace(/[\*%]/g,''));quality++;break;}
  }
 }
 return {values:v,quality,evidence:{}};
}
function ratioHeadingAudit(pages,p,parsed){
 const adapter=FMC_ADAPTERS_BY_KEY[p.key];
 if(!adapter?.auditRatioHeadings)return null;
 const potential=new Set(),actual=new Set(parsed.map(r=>String(r.cls||'').toLowerCase()));
 for(const pg of pages)adapter.auditRatioHeadings(pg.text,potential);
 const missing=[...potential].filter(x=>!actual.has(x.toLowerCase()));
 return potential.size?{seen:potential.size,extracted:parsed.length,possibleMissing:missing}:null;
}

/* Office TER contract (v6-5): TER = explicitly published TOTAL EXPENSE RATIO.
 * Trading Expense Ratio and FER are never interchangeable with this metric.
 * Strict generic evidence-backed support for single-period/column financial tables.
 * Unrecognized layouts fail closed; issuers can add verified layout support later.
 * This is included in BOTH generated bundles to avoid extraction/locator drift. */
const TOTAL_EXPENSE_RATIO_DEFINITION='total-expense-ratio-v1';
const TOTAL_EXPENSE_RATIO_LABEL=/^total\s+expense\s+ratios?\b/i;
const TOTAL_EXPENSE_LINES_CACHE=new WeakMap();

function totalExpenseNormalize(s){return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function totalExpenseClassHeading(s){
 const t=totalExpenseNormalize(s).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g,'').replace(/(?:\s*\(\d+\))+\s*$/,'').trim();
 const m=/^(?:(?:Series|Class)\s+[A-Z][A-Z0-9-]*|[A-Z][A-Z0-9-]*\s+(?:Shares?|Units?)|(?:ETF|CAD|USD)\s+(?:Series|Units?))\b/i.exec(t);
 if(!m)return null;
 const rest=t.slice(m[0].length).trim();
 return !rest||/^(?:\*+|\(\d+\)|\(\d+\)\s*\(\d+\))$/.test(rest)?m[0].toLowerCase().replace(/\s+/g,' '):null;
}
function totalExpensePageLines(items){
 const result=[];
 for(const it of items||[]){
  if(typeof it.str!=='string'||!it.str.trim()||!Number.isFinite(it.x)||!Number.isFinite(it.y))continue;
  const h=Math.max(5,Number(it.h)||8);
  let line=result.find(l=>Math.abs(l.y-it.y)<Math.max(1.5,Math.min(2.8,h*.25)));
  if(!line){line={y:it.y,items:[]};result.push(line);}
  line.items.push(it);
 }
 for(const l of result){l.items.sort((a,b)=>a.x-b.x);l.text=totalExpenseNormalize(l.items.map(it=>it.str).join(' '));}
 return result.sort((a,b)=>b.y-a.y);
}
function totalExpenseCell(item){
 const raw=String(item.str||'').trim().replace(/\s+/g,'');
 if(/^[-–—−]{1,2}$/.test(raw)||/^n\/?a$/i.test(raw))return {value:null,isMissing:true,raw};
 if(!/^(?:\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)\s*%?$/.test(raw))return null;
 const n=Number(raw.replace(/[,%]/g,''));
 return Number.isFinite(n)&&n>=0&&n<=100?{value:n,isMissing:false,raw}:null;
}
function totalExpenseClassMatches(found,expected){
 const normalize=s=>totalExpenseNormalize(s).toLowerCase().replace(/\s+/g,' ');
 return normalize(found)===normalize(expected);
}
function totalExpenseRatioSource(pages,row){
 const year=Number(String(row?.report_date||'').slice(0,4))||Number(row?.year);
 const className=row?.class_identity||row?.class_name;
 if(!year||year<2000||year>2100||!className)return null;
 const hits=[];
 for(const page of pages||[]){
  if(page?.ocrUsed||!Array.isArray(page?.items)||!page.items.length)continue;
  // Most MRFPs do not publish this metric. Avoid building text geometry
  // repeatedly for every class when the explicit label is not present.
  if(page.text&&!/\btotal\s+expense\s+ratios?\b/i.test(page.text))continue;
  let lines=TOTAL_EXPENSE_LINES_CACHE.get(page);
  if(!lines){lines=totalExpensePageLines(page.items);TOTAL_EXPENSE_LINES_CACHE.set(page,lines);}
  for(let ix=0;ix<lines.length;ix++){
   const metric=lines[ix];
   if(!TOTAL_EXPENSE_RATIO_LABEL.test(metric.text))continue;
   // This must be a named financial-table row, not an explanatory paragraph,
   // a calculated FER, or a before-waivers Total Expense Ratio variant.
   const label=TOTAL_EXPENSE_RATIO_LABEL.exec(metric.text)[0];
   const tail=metric.text.slice(label.length).trim();
   if(/^(?:before|excluding|including|plus|less|and)\b/i.test(tail))continue;
   // Require a physically distinct percentage cell, never a number guessed
   // from a text run containing the entire heading and surrounding prose.
   let accumulated='',labelRight=null;
   for(const it of metric.items){
    accumulated=totalExpenseNormalize(accumulated+' '+it.str);
    if(!TOTAL_EXPENSE_RATIO_LABEL.test(accumulated))continue;
    labelRight=it.x+(Number(it.w)||0);
    break;
   }
   if(!Number.isFinite(labelRight))continue;
   const explicitCells=metric.items.filter(it=>it.x>labelRight+2.5).map(it=>{
    const parsed=totalExpenseCell(it);
    if(!parsed||!Number.isFinite(it.w)||it.w<=0)return null;
    return {...parsed,x:it.x,y:it.y,box:{x:Math.max(0,it.x-1),y:it.y-1,w:it.w+2,h:Math.max(6,it.h||8)+2}};
   }).filter(Boolean);
   if(!explicitCells.length)continue;
   // Determine the NEAREST preceding class or series heading. A different
   // class heading blocks using an identical number from the wrong class.
   const precedingClasses=lines.slice(Math.max(0,ix-45),ix).map(l=>{
    const firstX=l.items[0]?.x??0;
    const headingText=l.items.filter(it=>it.x<firstX+230&&!/^20\d\d$/.test(it.str.trim())).slice(0,6).map(it=>it.str).join(' ');
    return {name:totalExpenseClassHeading(headingText),y:l.y};
   }).filter(x=>x.name&&x.y>metric.y&&x.y-metric.y<310).sort((a,b)=>a.y-b.y);
   if(!precedingClasses.length||!totalExpenseClassMatches(precedingClasses[0].name,className))continue;
   // Require the exact document reporting year printed above the cell in
   // the SAME column. Other-year figures or first-column assumptions fail.
   const printedYears=lines.slice(Math.max(0,ix-45),ix).flatMap(l=>l.items.filter(it=>/^20\d\d$/.test(it.str.trim())&&l.y>metric.y&&l.y-metric.y<310).map(it=>({year:Number(it.str.trim()),x:it.x,y:l.y})));
   for(const cell of explicitCells){
    const yearMarkers=printedYears.filter(it=>Math.abs(it.x-cell.x)<25);
    if(!yearMarkers.length)continue;
    yearMarkers.sort((a,b)=>a.y-b.y);
    // If two year rows share one x, the closest header determines the period.
    if(yearMarkers[0].year!==year)continue;
    hits.push({page:page.page,value:cell.value,box:cell.box,raw:cell.raw,isMissing:cell.isMissing,kind:'strict-total-expense-ratio-cell'});
   }
  }
 }
 // Multiple possible cells are ambiguous. Do not select by number alone.
 return hits.length===1?hits[0]:null;
}

const nbi={
  key:'nbi',label:'National Bank Investments',style:'nbi',
  signatures:[/National Bank Investments|National Bank Investments Advisory Service/i,/www\.nbinvestments\.ca|www\.nbinvestments\.ca/i,/\bNBI Sustainable\b/i],
  title:/^\s*(NBI(?:\s+[A-Za-z][A-Za-z0-9&'’.-]*){2,12}\s+(?:Fund|Portfolio|Class))\s*$/im
};

const fmcConfig_nbi={issuerPrefix:/^NBI\s/i,requireRatioHeading:true};


const desjardins={key:'desjardins',label:'Desjardins Investments',style:'desjardins',signatures:[/\bDESJARDINS FUNDS\b/i,/Desjardins Investments Inc\./i,/desjardinsfunds\.com/i],title:/^\s*(Desjardins\s+[^\n]{4,110}(?:Fund|Portfolio))\s*$/im};

const fmcConfig_desjardins={issuerPrefix:/^Desjardins\s/i,requirePriorRatioHeading:true,retainRatioHeading:true};


const sunLife={key:'sun_life',label:'Sun Life Global Investments',style:'sun_life',signatures:[/SLGI ASSET MANAGEMENT INC/i,/sunlifeglobalinvestments\.com/i,/Sun Life Granite/i],title:/^\s*(Sun Life\s+[^\n]{3,120}(?:Fund|Class|Portfolio))\s*$/im};

const fmcConfig_sun_life={issuerPrefix:/^Sun Life\s/i,splitColumns:true,deduplicate:true,allowMetricWithoutRatioHeading:true};


const franklin={key:'franklin',label:'Franklin Templeton',style:'franklin',signatures:[/franklintempleton\.ca/i,/Franklin Templeton Investments Corp/i,/\bFRANKLIN CANADIAN\b/i],title:/^\s*(FRANKLIN\s+[^\n]{3,130}(?:FUND|PORTFOLIO))\s*$/im};

const fmcConfig_franklin={issuerPrefix:/^Franklin\s/i};


const middlefield={key:'middlefield',label:'Middlefield',style:'middlefield',signatures:[/MIDDLEFIELD CORPORATE PROFILE/i,/\bMIDDLEFIELD\s+(?:MUTUAL FUNDS|GLOBAL|LIMITED)\b/i,/Middlefield Limited/i],title:/^\s*(MIDDLEFIELD\s+[A-Z\s.]{4,100}(?:FUND|CLASS|ETF))\s*$/im};

const fmcConfig_middlefield={issuerPrefix:/^Middlefield\s/i,startAtRatioHeading:true};


const manulife={key:'manulife',label:'Manulife Investment Management',style:'manulife',signatures:[/Manulife Investment Management Limited/i,/manulifeim\.ca/i,/\bManulife\b/i],title:/^\s*(Manulife\s+[^\n]{3,120}(?:Fund|Class|Portfolio))\s*$/im};

const fmcConfig_manulife={issuerPrefix:/^Manulife\s/i,deduplicate:true,waitForRatioHeading:true,stopAtPastPerformance:true};


const dynamic={key:'dynamic',label:'1832 Asset Management (Dynamic)',style:'dynamic',signatures:[/1832 Asset Management L\.P\./i,/www\.dynamic\.ca/i,/\bDynamic Dividend\b/i],title:/^\s*(Dynamic\s+[^\n]{3,110}(?:Fund|Class|Portfolio))\s*$/im};

const fmcConfig_dynamic={issuerPrefix:/^Dynamic\s/i,allowRowFallback:false};


const purpose={key:'purpose',label:'Purpose Investments',style:'purpose',signatures:[/www\.purposeinvest\.com|www\.purposeinvest\.com/i,/PURPOSE ACTIVE BALANCED FUND/i,/Purpose Investments/i],title:/^\s*(PURPOSE\s+[^\n]{3,100}(?:FUND|PORTFOLIO))\s*$/im};

const fmcConfig_purpose={issuerPrefix:/^Purpose\s/i,splitColumns:true,deduplicate:true,startAtRatioHeading:true,retainRatioHeading:true};


const blackrock={key:'blackrock',label:'BlackRock / iShares',style:'blackrock',signatures:[/BlackRock Asset Management Canada Limited/i,/www\.blackrock\.com\/ca/i,/\biShares\b/i],title:/\b(iShares\s+.{5,110}?(?:ETF Portfolio|Index ETF|ETF))\b/i};

const fmcConfig_blackrock={issuerPrefix:/^iShares\s/i,renameEmptyClasses:true};


const rbc={key:'rbc',label:'RBC Global Asset Management',style:'rbc',signatures:[/RBC Global Asset Management Inc/i,/rbcgam\.com/i,/RBC CANADIAN/i],title:/^\s*(RBC\s+[^\n]{3,120}?(?:FUND|PORTFOLIO|SOLUTION\s*[–-]\s*ENHANCED(?:\s+PLUS)?))\s*$/im};
// BMO issues two independent financial-table templates: mutual funds and exchange-traded funds.

const fmcConfig_rbc={issuerPrefix:/^RBC\s/i,datedRowIndices:{MER:3,TER:6,PTR:5},datedRowMin:7,allowRowFallback:false};


const bmo={key:'bmo',label:'BMO',style:'bmo',signatures:[/BMO (?:Asset Management|Investments) Inc\./i,/\bbmogam\.com\b/i,/\bBMO (?:Mutual Funds|Exchange Traded Funds)\b/i],title:/^\s*(BMO\s+[^\n]{4,110}?(?:Fund(?:\s+Ltd\.)?|ETF|Portfolio))\s*$/im};
// BMG bullion reports may be scanned as landscape two-page spreads with rotated PDF text.

const fmcConfig_bmo={issuerPrefix:/^BMO\s/i};


const bmg={key:'bmg',label:'BMG Management Services Inc.',style:'bmg_rotated',
 signatures:[/\bBMG\s+(?:Management Services Inc\.|Gold|Silver|BullionFund)/i,/\bBMG\s+(?:Silver|Gold|Bullion)\s+Bullion\s*Fund\b/i,/\bbmg-group\.com\b/i],
 title:/^\s*(BMG\s+(?:[^\n]{3,110}?\s+)?Bullion\s*Fund)\s*$/im};


// ---- src/fmc/index.mjs ----
// Independent issuer signatures; adding an FMC must be performed here and in its dedicated module.



const fmcConfig_bmg={issuerPrefix:/^BMG\s/i,titleScanPages:6};


const firstTrust={key:'first_trust',label:'First Trust Canada',style:'first_trust_b3',
  signatures:[/FT Portfolios Canada Co\./i,/First Trust AlphaDEX[^\n]{0,160}ETF/i,/www\.firsttrust\.ca/i],
  title:/^\s*(First Trust\s+[^\n]{8,180}?ETF)\s*$/im};

const fmcConfig_first_trust={issuerPrefix:/^First Trust\s/i};


const profile_td={key:'td',label:'TD Asset Management',style:'td',signatures:[/TD (?:Mutual Funds|Exchange-Traded Funds)/i,/TD Asset Management Inc\./i],title:/^\s*(TD\s+[^\n]{3,130}?(?:Fund|ETF))(?:\s*\([A-Z0-9.]+\))?\s*$/im};

const fmcConfig_td={issuerPrefix:/^TD\s/i,preferProfileLineTitle:true};


const profile_lysander={key:'lysander',label:'Lysander Funds',style:'lysander',signatures:[/Lysander-Canso\s+U\.S\.\s+Corporate/i,/Lysander Funds Limited/i],title:/^\s*(Lysander-Canso\s+[^\n]+?Fund)\s*$/im};

const fmcConfig_lysander={issuerPrefix:/^Lysander\s/i,preferProfileLineTitle:true};


const profile_nei={key:'nei',label:'NEI Investments',style:'nei',signatures:[/NEI Global Total Return Bond Fund/i,/Northwest\s*&\s*Ethical Investments/i],title:/^\s*(NEI\s+[^\n]+?Fund)\s*$/im};

const fmcConfig_nei={issuerPrefix:/^NEI\s/i,preferProfileLineTitle:true};


const profile_mackenzie={key:'mackenzie',label:'Mackenzie Investments',style:'mackenzie_new',signatures:[/MACKENZIE PRECIOUS METALS FUND/i,/Mackenzie Financial Corporation/i],title:/^\s*(MACKENZIE\s+[^\n]+?FUND)\s*$/im};

const fmcConfig_mackenzie={issuerPrefix:/^Mackenzie\s/i,preferProfileLineTitle:true};


const profile_ig_mackenzie={key:'ig_mackenzie',label:'IG Wealth Management',style:'mackenzie_new',signatures:[/IG MACKENZIE (?:GLOBAL|[^\n]+) (?:FUND|OF CANADA)/i,/I\.G\. Investment Management/i],title:/^\s*(IG\s+MACKENZIE\s+[^\n]+?(?:FUND|OF CANADA))\s*$/im};

const fmcConfig_ig_mackenzie={issuerPrefix:/^IG Mackenzie\s/i,preferProfileLineTitle:true};


const profile_fidelity={key:'fidelity',label:'Fidelity Investments',style:'fidelity_new',signatures:[/Fidelity Investments Canada ULC|Fidelity Management & Research Canada ULC/i,/Fidelity Investments/i],title:/^\s*(Fidelity\s+[^\n]{4,180}?(?:Fund|ETF|Portfolio|Class)(?:\s+of\s+the\s+Fidelity\s+Capital\s+Structure\s+Corp\.?)?)[®™]?\s*$/im};

const fmcConfig_fidelity={issuerPrefix:/^Fidelity\s/i,preferProfileLineTitle:true};


const profile_pender={key:'pender',label:'PenderFund Capital Management',style:'pender_new',signatures:[/Pender Corporate Bond Fund/i,/PenderFund Capital Management/i],title:/^\s*(Pender\s+[^\n]+?Fund)\s*$/im};

const fmcConfig_pender={issuerPrefix:/^Pender\s/i,preferProfileLineTitle:true};


const profile_brandes={key:'brandes',label:'Bridgehouse / Brandes',style:'brandes_new',signatures:[/Brandes (?:International|Global Small Cap|Emerging Markets).*Fund/i,/Bridgehouse Asset Managers/i],title:/^\s*(Brandes\s+[^\n]+?Fund)\s*$/im};

const fmcConfig_brandes={issuerPrefix:/^Brandes\s/i,preferProfileLineTitle:true};


const profile_agf={key:'agf',label:'AGF Investments',style:'agf_new',signatures:[/AGF (?:Global Convertible Bond Fund|European Equity Class)/i,/AGF Investments Inc\./i],title:/^\s*(AGF\s+[^\n]+?(?:Fund|Class))\s*$/im};

const fmcConfig_agf={issuerPrefix:/^AGF\s/i,preferProfileLineTitle:true};


const profile_harvest={key:'harvest',label:'Harvest ETFs',style:'harvest_new',signatures:[/Harvest Healthcare Leaders Income ETF/i,/Harvest Portfolios Group Inc\./i],title:/^\s*(Harvest\s+[^\n]+?ETF)\s*$/im};

const fmcConfig_harvest={issuerPrefix:/^Harvest\s/i,preferProfileLineTitle:true};


const profile_vanguard={key:'vanguard',label:'Vanguard Investments Canada',style:'vanguard_new',signatures:[/Vanguard Investments Canada Inc/i,/Vanguard FTSE Canadian/i],title:/^\s*(Vanguard[^\n]{5,150}?ETF)\s*$/im};

const fmcConfig_vanguard={issuerPrefix:/^Vanguard\s/i};


const profile_ninepoint={key:'ninepoint',label:'Ninepoint Partners',style:'ninepoint_new',signatures:[/Ninepoint Partners LP/i,/Ninepoint Silver Bullion Fund/i],title:/^\s*(Ninepoint[^\n]{5,140}?Fund)\s*$/im};

const fmcConfig_ninepoint={issuerPrefix:/^Ninepoint\s/i};


const profile_global_x={key:'global_x',label:'Global X Investments Canada',style:'globalx_new',signatures:[/GLOBAL X INVESTMENTS CANADA INC/i,/Global X Canadian Oil and Gas/i],title:/^\s*(Global X[^\n]{5,180}?ETF)\s*$/im};

const fmcConfig_global_x={issuerPrefix:/^Global X\s/i};


const profile_cibc={key:'cibc',label:'CIBC Asset Management',style:'cibc_v22',signatures:[/CIBC Core Fixed Income Pool/i,/CIBC Asset Management Inc\./i],title:/^\s*(CIBC\s+[^\n]{3,140}?(?:Pool|Fund|ETF))\s*$/im};

const fmcConfig_cibc={issuerPrefix:/^CIBC\s/i};


const profile_hamilton={key:'hamilton',label:'Hamilton ETFs',style:'hamilton_v22',signatures:[/Hamilton Capital Partners Inc\./i,/hamiltonetfs\.com/i],title:/^\s*(Hamilton\s+[^\n]{4,140}?ETF)\s*$/im};

const fmcConfig_hamilton={issuerPrefix:/^Hamilton\s/i};


const profile_newgen={key:'newgen',label:'NewGen Asset Management',style:'newgen_v22',signatures:[/NewGen Asset Management Limited/i,/newgenfunds\.com/i],title:/^\s*(NewGen\s+[^\n]{4,140}?Fund)\s*$/im};

const fmcConfig_newgen={issuerPrefix:/^NewGen\s/i};


const profile_rpia={key:'rpia',label:'RP Investment Advisors',style:'rpia_v22',signatures:[/RP Investment Advisors LP/i,/\brpia\.ca\b/i],title:/^\s*(RP\s+[^\n]{4,150}?Fund)\s*$/im};

const fmcConfig_rpia={issuerPrefix:/^RP\s/i};


const profile_leith_wheeler={key:'leith_wheeler',label:'Leith Wheeler',style:'leith_v22',signatures:[/Leith Wheeler Investment Counsel Ltd\./i,/leithwheeler\.com/i],title:/^\s*(Leith Wheeler\s+[^\n]{4,140}?Fund)\s*$/im};

const fmcConfig_leith_wheeler={issuerPrefix:/^Leith Wheeler\s/i};


const profile_ci={key:'ci',label:'CI Global Asset Management',style:'ci_b2',signatures:[/CI Investments Inc\./i,/www\.ci\.com/i],title:/^\s*(CI\s+[^\n]{4,150}?Fund)\s*$/im};

const fmcConfig_ci={issuerPrefix:/^CI\s/i};

// CI-managed Corporate Class funds can have an unprefixed legal product title.
// Only accept the document's own first heading, corroborated by CI's issuer
// signature (which the central registry has already validated).
function identifyFundEarly_ci(pages,profile,head){
 if(!/(?:CI Investments Inc\.|www\.ci\.com|www\.assante\.com)/i.test(head))return undefined;
 for(const pg of pages.slice(0,2)){
  const lines=String(pg.text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const first=lines[0]||'';
  if(first.length>=15&&first.length<150&&/(?:Corporate Class|\bFund)$/i.test(first)
     &&/Management Report of Fund Performance/i.test(lines.slice(1,4).join(' ')))return first;
 }
 return undefined;
}


const profile_scotia={key:'scotia',label:'ScotiaFunds / 1832 Asset Management',style:'scotia_b2',signatures:[/www\.scotiafunds\.com/i,/Scotia\s+U\.S\.\s*\$\s*Balanced Fund/i],title:/^\s*(Scotia\s+[^\n]{5,150}?Fund)\s*$/im};

const fmcConfig_scotia={issuerPrefix:/^Scotia\s/i};


const profile_capital_group={
 key:'capital_group',label:'Capital Group',style:'capital_group',
 signatures:[/Capital\s+International Asset Management\s*\(Canada\),?\s*Inc\.?/i,
             /Capital Group\s+(?:Canadian|Global|International|Multi-Sector)[^\n]*?(?:Fund|ETF)\b/i],
 title:/^\s*(Capital Group\s+[^\n]{5,110}?(?:Fund|ETF)\s*\(Canada\))\s*$/im
};
const fmcConfig_capital_group={allowRowFallback:false};


const profile_arrow_capital={
 key:'arrow_capital',label:'Arrow Capital Management Inc.',style:'arrow_capital',
 signatures:[/Arrow\s+Capital\s+Management\s+Inc\.?/i],
 title:/^\s*([A-Z][A-Z0-9&'’().,\- ]{8,140}\bFUND)\s*$/m
};
const fmcConfig_arrow_capital={allowRowFallback:false,titleScanPages:3};


const profile_guardian={
 key:'guardian',
 label:'Guardian Capital',
 style:'guardian',
 signatures:[/Guardian Capital LP/i,/www\.guardiancapital\.com\/investmentsolutions/i],
 title:/^\s*(GUARDIAN[\s\S]{5,150}?(?:FUND|ETF))\s*$/im
};

const fmcConfig_guardian={issuerPrefix:/^GUARDIAN\s/i,titleScanPages:4};

function identifyFundEarly_guardian(pages,profile,head){
 const dateRx=/^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+20\d{2}$/i;
 for(const pg of pages.slice(0,3)){
  const items=Array.isArray(pg.items)?pg.items.filter(it=>typeof it.str==='string'&&it.str.trim()&&Number.isFinite(it.x)&&Number.isFinite(it.y)):[];
  const report=items.find(it=>/MANAGEMENT REPORT OF FUND PERFORMANCE/i.test(it.str));
  const date=items.find(it=>dateRx.test(String(it.str||'').trim()));
  if(report&&date){
   const region=items.filter(it=>it.y<report.y-5&&it.y>date.y+5);
   const groups=[];
   for(const it of region){
    let line=groups.find(x=>Math.abs(x.y-it.y)<1.8);
    if(!line){line={y:it.y,items:[]};groups.push(line);}
    line.items.push({...it,str:String(it.str).trim()});
   }
   groups.sort((a,b)=>b.y-a.y);
   // PDF.js can place a superscript trademark digit (e.g. the 3 in i3)
   // on a separate baseline. Reattach only a single digit that touches
   // the end of a word on the immediately lower title line.
   for(const line of groups){
    for(const mark of line.items){
     if(!/^\d$/.test(mark.str))continue;
     const below=groups.filter(g=>g.y<line.y&&line.y-g.y<18).sort((a,b)=>b.y-a.y)[0];
     if(!below)continue;
     const owner=below.items.find(it=>Math.abs((it.x+(Number(it.w)||0))-mark.x)<3.5);
     if(owner&&/[A-Za-z]$/.test(owner.str)){owner.str+=mark.str;mark.str='';}
    }
   }
   const title=groups.map(g=>g.items.sort((a,b)=>a.x-b.x)
     .map(it=>it.str).filter(t=>t&&!/^(?:TM|™|®)$/i.test(t)).join(' '))
     .filter(Boolean).join(' ').replace(/\s+/g,' ').replace(/-\s+/g,'-').trim();
   if(/\b(?:FUND|ETF|PORTFOLIO|POOL)\b$/i.test(title)&&title.length>=12&&title.length<190)return title;
  }
  // Text-only fallback for synthetic tests or source pages without PDF.js geometry.
  const lines=String(pg.text||'').split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  const marker=lines.findIndex(x=>/^(?:ANNUAL|INTERIM)\s+MANAGEMENT REPORT OF FUND PERFORMANCE/i.test(x));
  if(marker>=0){
   const parts=[];
   for(const line of lines.slice(marker+1,marker+7)){
    if(dateRx.test(line))break;
    if(/^(?:TM|™|®|\d)$/i.test(line))continue;
    parts.push(line);
    const candidate=parts.join(' ').replace(/\s+/g,' ').replace(/-\s+/g,'-').trim();
    if(/\b(?:FUND|ETF|PORTFOLIO|POOL)\b$/i.test(candidate)&&candidate.length>=12)return candidate;
   }
  }
 }
 return undefined;
}


const profile_beutel_goodman={
 key:'beutel_goodman',label:'Beutel Goodman',style:'beutel_goodman',
 signatures:[/Beutel\s+Goodman\s+Managed\s+Funds/i,/Beutel,\s*Goodman\s*&\s*Company\s+Ltd\.?/i],
 title:/^\s*(Beutel\s+Goodman\s*[^\n]{2,130}?\b(?:Fund|ETF))\s*$/im
};
const fmcConfig_beutel_goodman={allowRowFallback:false,titleScanPages:3};


const profile_canada_life={
 key:'canada_life',
 label:'Canada Life Investment Management Ltd.',
 style:'canada_life',
 signatures:[/Canada\s+Life\s+Investment\s+Management\s+Ltd\.?/i],
 title:null
};
const fmcConfig_canada_life={preferProfileLineTitle:true,titleScanPages:3,allowRowFallback:false};
function identifyFundEarly_canada_life(pages,profile,head){
 const candidates=new Set();
 for(const page of (pages||[]).slice(0,3)){
  for(const raw of String(page.text||'').split(/\r?\n/)){
   const line=canadaLifeNormalize(raw);
   if(line!==line.toUpperCase()||!/^CANADA\s+LIFE\s+[A-Z0-9&'’().,\- ]{5,150}\bFUND$/.test(line))continue;
   candidates.add(line);
  }
 }
 if(candidates.size===1)return [...candidates][0];
 if(candidates.size>1)return 'Unknown Fund';
 return undefined;
}


const profile_ccl={
 key:'ccl',label:'CC&L Funds Inc.',style:'ccl',
 signatures:[/www\.cclfundsinc\.com/i,/CC&L\s+Interim\s+Management\s+Report\s+of\s+Fund\s+Performance/i],
 title:/^\s*(CC&L\s+[^\n]{4,130}?\bFund)\s*$/im
};
const fmcConfig_ccl={issuerPrefix:/^CC&L\s/i,titleScanPages:3,allowRowFallback:false};


const profile_sei={
 key:'sei',label:'SEI Investments Canada Company',style:'sei',
 signatures:[/SEI Investments Canada Company\s*\(\s*the\s*[“\"']?Manager[”\"']?\s*\)/i,/SEI\s+Funds\s+for\s+the\s+period\s+ending/i,/seic\.com\/en-ca/i]
};
const fmcConfig_sei={titleScanPages:3,allowRowFallback:false};



// A combined published series heading represents one Financial Highlights
// table, not two separate sets of financial ratios. Preserve the complete
// label for that table; independently published Series F / Private Series
// headings are still parsed as separate records by the ordinary path.
function combinedPrivateHeading_nbi(line){
 const text=String(line||'').replace(/\u00a0/g,' ').replace(/\*+\s*$/,'').trim();
 const match=/^(Series\s+[A-Z][A-Z0-9-]*)\s*\/\s*(Private\s+Series)$/i.exec(text);
 return match?{first:match[1].replace(/\s+/g,' ').trim(),second:match[2].replace(/\s+/g,' ').trim()}:null;
}
function extract_nbi(pages,p,fund,date){
 return simpleTable(pages,p);
}
// Prefer an explicitly printed Meritage fund title on the cover over a
// different NBI underlying holding mentioned later in the document.
// This branch does not run for existing NBI-branded cover titles.
function identifyFundEarly_nbi(pages,p,head){
 if(p.key!=='nbi'||!pages.length)return;
 const cover=String(pages[0].text||'').split(/\r?\n/).slice(0,16).map(clean);
 if(!cover.some(l=>/^(?:ANNUAL|INTERIM)\s+MANAGEMENT\s+REPORT\s+OF\s+FUND\s+PERFORMANCE$/i.test(l)))return;
 const candidates=cover.filter(l=>/^Meritage(?:\s+[A-Za-z][A-Za-z0-9&'’.-]*){1,15}\s+Portfolio$/i.test(l));
 const confirmed=candidates.filter(name=>pages.slice(1,4).some(pg=>
   String(pg.text||'').split(/\r?\n/).some(line=>clean(line)===name)));
 if(!confirmed.length)return;
 confirmed.sort((a,b)=>b.length-a.length);
 // A tie between differently named longest cover titles is ambiguous.
 if(confirmed.length>1&&confirmed[0].length===confirmed[1].length&&confirmed[0]!==confirmed[1])return;
 return confirmed[0];
}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundFallback_nbi(pages,p,head){
if(p.key==='nbi'){
    const names=[...head.matchAll(/\b(NBI\s+[A-Z][A-Za-z0-9-]*(?:\s+[A-Z][A-Za-z0-9-]*){0,5}\s+(?:Fund|Portfolio|Class))\b/g)].map(x=>x[1]);
    names.sort((a,b)=>a.length-b.length);
    if(names.length)return clean(names[0]);
  }
}

// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_nbi(line){
 const style='nbi';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='nbi'){
  const combined=combinedPrivateHeading_nbi(s);
  if(combined)return combined.first+' / '+combined.second;
  m=nbiClass.exec(s);return m?m[1].replace(/\s+/g,' ').trim():null;
 }
 return null;
}



function extract_desjardins(pages,p,fund,date){return simpleTable(pages,p);}
// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_desjardins(line){
 const style='desjardins';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='desjardins'){m=/^([A-Z][A-Z0-9]{0,3})[–-]CLASS$/i.exec(s);return m?m[1].toUpperCase()+'-Class':null;}
 return null;
}


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



function extract_franklin(pages,p,fund,date){return simpleTable(pages,p);}
// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_franklin(line){
 const style='franklin';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='franklin'){m=/^(?:SERIES\s+([AFO])|ETF\s+SERIES)\s*\(AS AT /i.exec(s);return m?(s.toUpperCase().startsWith('ETF')?'ETF Series':'Series '+m[1]):null;}
 return null;
}


function middlefieldTable(pages){
 const parsed=[];for(const page of pages){const lines=page.text.split(/\r?\n/);for(let i=0;i<lines.length;i++){if(!/Ratios?\s+and\s+Supplemental\s+Data\s*[-–]/i.test(lines[i]))continue;const cls=/Series\s+([AF])\b/i.exec(lines[i]+' '+(lines[i+1]||''));if(!cls)continue;let end=i+100;for(let j=i+1;j<Math.min(i+100,lines.length);j++){if(/Ratios?\s+and\s+Supplemental\s+Data\s*[-–]/i.test(lines[j])){end=j;break;}}const block=lines.slice(i+1,end).join('\n');const raw={};const ev={};let n=0;for(const key of ['MER','TER','PTR']){const m=findMetric(block,key);if(m.found){n++;raw[key]=m.value;if(m.value!==null)ev[key]={page:page.page,source:key+' (ratio table)',method:'native-js'};}}if(n>=2)parsed.push({cls:'Series '+cls[1],values:raw,evidence:ev,quality:n});}}return parsed;
}
// Batch 3 extension: Middlefield mutual-class and single ETF report layouts.
// The original middlefieldTable() remains the primary parser; this supplements
// only missing sections, never overrides an existing verified series row.
function middlefieldReportDate(pages){
 // Cover art states only the report year. The repeated official report
 // heading on later pages carries the exact six-month/year end date.
 const pattern=/\bFOR\s+THE\s+(?:SIX\s+MONTHS|YEAR)\s+ENDED\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i;
 for(const pg of pages.slice(0,12)){
  const m=pattern.exec(String(pg.text||''));if(!m)continue;
  const month=months[m[1].slice(0,3).toLowerCase()];
  return `${m[3]}-${String(month).padStart(2,'0')}-${m[2].padStart(2,'0')}`;
 }
 return reportDate(pages);
}
function middlefieldFallback(pages,fund,date){
 const out=new Map();if(!date)return [];
 const year=date.slice(0,4);
 const percent=/([—–−-]|\d+(?:\.\d+)?|\.\d+)\s*%/;
 function readMetric(lines,metric){
  const re=metric==='MER'?/^\s*Management\s+Expense\s+Ratio\b(?!\s+before)/i:
    metric==='TER'?/^\s*Trading\s+Expense\s+Ratio\b/i:/^\s*Portfolio\s+Turnover\s+(?:Rate|Ratio)\b/i;
  for(let i=0;i<lines.length;i++){
   if(!re.test(lines[i]))continue;
   for(let j=i;j<Math.min(i+5,lines.length);j++){
    // Do not borrow a number from a different metric or the next table.
    if(j>i && /^(?:\s*(?:Management|Trading)\s+Expense\s+Ratio|\s*Portfolio\s+Turnover|\s*MER\s*\()/i.test(lines[j]))break;
    const m=percent.exec(lines[j]);if(m)return {seen:true,value:toNumber(m[1])};
   }
   return {seen:false,value:null};
  }
  return {seen:false,value:null};
 }
 for(const pg of pages){
  const lines=String(pg.text||'').split(/\r?\n/),headings=[];
  for(let i=0;i<lines.length;i++){
   if(!/^\s*Ratios?\s+and\s+Supplemental\s+Data\b(?!\s+are)/i.test(lines[i]))continue;
   // Require actual ratio table context, not narrative mentioning the heading.
   const follow=lines.slice(i+1,i+12).join(' ');
   if(!new RegExp('\\b'+year+'\\b').test(follow))continue;
   const joined=lines.slice(i,i+4).join(' ');
   const series=/\b(Series\s+[A-Z][A-Z0-9]*)\b/i.exec(joined);
   if(!series && !/\bETF\b/i.test(fund))continue;
   headings.push({idx:i,cls:series?clean(series[1]):'ETF Units'});
  }
  for(let j=0;j<headings.length;j++){
   const h=headings[j];const end=headings[j+1]?.idx??lines.length;
   const block=lines.slice(h.idx,end);
   const vals={},evidence={};let quality=0;
   for(const metric of ['MER','TER','PTR']){
    const r=readMetric(block,metric);vals[metric]=r.value;
    if(r.seen){quality++;evidence[metric]={page:pg.page,source:metric+' (Middlefield current-period ratio table)',method:'native-js'};}
   }
   if(quality>=2&&!out.has(h.cls))out.set(h.cls,{cls:h.cls,values:vals,evidence,quality});
  }
 }
 return [...out.values()];
}

// First Trust U.S. technology MRFP has two ticker-specific blocks on the
// same page. The first financial column is the current reported year.

function extract_middlefield(pages,p,fund,date){const parsed=middlefieldTable(pages);const extra=middlefieldFallback(pages,fund,date);const found=new Set(parsed.map(x=>x.cls.toLowerCase()));for(const row of extra)if(!found.has(row.cls.toLowerCase()))parsed.push(row);return parsed;}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundLate_middlefield(pages,p,head){
if(p.key==='middlefield'){
    const m=head.match(/\b(MIDDLEFIELD\s+(?:GLOBAL\s+)?(?:[A-Z]+\s+){0,6}FUND)\b/i);
    if(m)return clean(m[1]).toUpperCase();
    // Middlefield covers often print the official name across 3-4 lines.
    // Only inspect the actual cover, not fund mentions in annual-report prose.
    const cover=String(pages[0]?.text||'').split(/\r?\n/).map(clean);
    for(let i=0;i<Math.min(cover.length,18);i++){
      if(!/^MIDDLEFIELD$/i.test(cover[i]))continue;
      for(let n=1;n<=5;n++){
        const candidate=clean(cover.slice(i,i+n+1).join(' '));
        if(/^MIDDLEFIELD\s+[A-Z0-9 .&'-]{5,120}\s+(?:FUND|CLASS|ETF)$/i.test(candidate))return candidate.toUpperCase();
      }
    }
  }
}

// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_middlefield(line){
 const style='middlefield';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='middlefield'){m=/^Ratios\s+and\s+Supplemental\s+Data\s*[-–]\s*Series\s+([A-Z])/i.exec(s);return m?'Series '+m[1]:null;}
 return null;
}

function selectReportDate_middlefield(pages){return middlefieldReportDate(pages);}



function extract_manulife(pages,p,fund,date){return tableBlocks(pages,p,{allowWithoutRatio:true});}
// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_manulife(line){
 const style='manulife';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='manulife'){m=/^(Advisor Series|Series\s+[A-Z][A-Z0-9]*)$/i.exec(s);return m?m[1]:null;}
 return null;
}


function parse1832Complete(pages){
 const out=new Map(),date=reportDate(pages);if(!date)return [];
 const year=date.slice(0,4), month=Number(date.slice(5,7));let started=false;
 for(const pg of pages){
  let txt=pg.text;
  const at=txt.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
  if(at>=0){started=true;txt=txt.slice(at);}
  else if(!started)continue;
  // Continuing table pages use the same numeric column headings.
  else if(!/\b(?:As\s+at|Portfolio\s+turnover)\b/i.test(txt.slice(0,1200)))continue;
  let series=null;
  for(const raw of txt.split(/\r?\n/)){
   const m=/^\s*(Series\s+[A-Z][A-Z0-9]*|ETF(?:H)?\s+Series)(\s*\(USD\))?(?:\s*[–-]\s*The\s+start\s+date.*)?\s*$/i.exec(raw);
   if(m){series=m[1]+(m[2]||'');continue;}
   if(!series)continue;
   const row=/^\s*(Jun(?:e)?\.?\s+30|Dec(?:ember)?\.?\s+31|Mar(?:ch)?\.?\s+31|Sept?(?:ember)?\.?\s+30),?\s+(20\d{2})\s+(.+)$/i.exec(raw);
   if(!row||row[2]!==year)continue;
   const mm=/^Jun/i.test(row[1])?6:/^Dec/i.test(row[1])?12:/^Mar/i.test(row[1])?3:9;
   if(mm!==month)continue;
   const tokens=row[3].match(/(?:n\/?a|[—–−-]|\d[\d,]*(?:\.\d+)?)/gi)||[];
   if(tokens.length<7)continue;
   out.set(series,{cls:series,values:{MER:toNumber(tokens[2]),TER:toNumber(tokens[4]),PTR:toNumber(tokens[5])},quality:3,evidence:{}});
  }
 }
 return [...out.values()];
}
// v3-1: Dynamic single-class ETFs have 8 financial columns but do not
// have a Series heading. Never invoke this on multi-Series funds.
function parseDynamicSingleEtf(pages,fund,date){
 if(!/\bETF\b/i.test(fund)||!date)return [];
 const [yr,mm,dd]=date.split('-').map(Number);
 for(const pg of pages){
  const txt=String(pg.text||'');const ix=txt.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
  if(ix<0)continue;
  const section=txt.slice(ix,ix+8500);
  if(!/\bAs\s+at\b/i.test(section)||!/MER\b/i.test(section)||!/TER\b/i.test(section)||!/Portfolio\s+turnover/i.test(section))continue;
  const re=/^\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2}),?\s+(20\d{2})\s+(.+)$/gim;
  for(const row of section.matchAll(re)){
   const mo=months[row[1].slice(0,3).toLowerCase()];
   if(mo!==mm||Number(row[2])!==dd||Number(row[3])!==yr)continue;
   // NAV, units outstanding, MER, MER-before-waivers, TER, PTR,
   // unit NAV, closing price. Numeric stars indicate annualization.
   const tokens=row[4].match(/(?:n\/?a|[—–−-]|\d[\d,]*(?:\.\d+)?\*?)/gi)||[];
   if(tokens.length!==8)continue;
   const values={MER:toNumber(tokens[2]),TER:toNumber(tokens[4]),PTR:toNumber(tokens[5])};
   const evidence={};for(const m of ['MER','TER','PTR'])evidence[m]={page:pg.page,source:'Dynamic ETF dated current-period ratio row',method:'native-js'};
   return [{cls:'ETF Units',values,evidence,quality:3}];
  }
 }
 return [];
}

// Vanguard's ratio tables sometimes print footnote digits next to row labels.
// Limit percentages to the actual latest-period table, ignoring citations.

function extract_dynamic(pages,p,fund,date){let parsed=rowTable(pages,p);if(!parsed.length)parsed=parseDynamicSingleEtf(pages,fund,date);const extra=parse1832Complete(pages);const map=new Map(parsed.map(x=>[x.cls,x]));for(const x of extra)if(!map.has(x.cls))map.set(x.cls,x);return [...map.values()];}
// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_dynamic(line){
 const style='dynamic';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='dynamic'){m=/^((?:Series\s+[A-Z][A-Z0-9]*|ETF(?:H)?\s+Series)(?:\s*\(USD\))?)$/i.exec(s);return m?m[1].replace(/\s+/g,' '):null;}
 return null;
}

// Non-mutating series completeness audit for this issuer.
function auditRatioHeadings_dynamic(source,potential){
 let text=source;const ix=text.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
 // Pages without the ratio heading may continue the dated table with
   // 'As at' and a row of management/trading expense labels.
   if(ix<0 && !/\bAs\s+at\b/i.test(text.slice(0,650)))return;
   if(ix>=0)text=text.slice(ix);
   for(const line of text.split(/\r?\n/)){
    const m=/^\s*(Series\s+[A-Z][A-Z0-9]*(?:\s*\(USD\))?|ETF(?:H)?\s+Series)(?:\s*[–-].*)?\s*$/i.exec(line);
    if(m)potential.add(m[1].replace(/\s+/g,' '));
   }
}



function extract_purpose(pages,p,fund,date){return tableBlocks(pages,p,{allowWithoutRatio:true});}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundLate_purpose(pages,p,head){
if(p.key==='purpose'){
    for(const line of head.split(/\r?\n/)){const m=/^\s*(PURPOSE[ \t]+(?:[A-Z]+[ \t]+){1,10}FUND)[ \t]*$/.exec(line);if(m)return clean(m[1]);}
  }
}

// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_purpose(line){
 const style='purpose';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if (style === 'purpose') { m = /^(ETF Units|Class\s+[A-Z]\s*Units)(?:\s+\d+)?(?:\s*\([^)]*\))?(?=\s|$)/i.exec(s); return m ? (m[1].toLowerCase() === 'etf units' ? 'ETF Units': m[1].replace(/\s*Units$/i, '')): null;}
 return null;
}


function parseBlackrockB2(pages){
 const out=new Map();
 for(const pg of pages){const text=pg.text.replace(/\u00a0/g,' ');
  if(!/Ratios\s*and\s*Supplemental\s*Data/i.test(text))continue;
  const start=text.search(/Ratios\s*and\s*Supplemental\s*Data/i);
  const first=text.slice(0,start);const cls=/\b(CAD|USD)\s*Units\b/i.exec(first)?.[0]||null;
  if(!cls)continue;
  const section=text.slice(start).split(/\r?\n/);
  const vals={};let quality=0;
  for(const metric of ['MER','TER','PTR']){
    const re=metric==='MER'?/Management\s*expense\s*ratio/i:metric==='TER'?/Trading\s*expense\s*ratio/i:/Portfolio\s*turnover\s*rate/i;
    const row=section.find(s=>re.test(s));if(!row)continue;
    const cut=row.slice(re.exec(row).index+re.exec(row)[0].length);
    // Skip footnote (h) and dot leaders; take first reported decimal.
    const m=/\b(\d*\.\d+)\s*%/i.exec(cut);
    if(!m)continue;
    vals[metric]=toNumber(m[1]);quality++;
  }
  if(quality===3){const name=/^CAD/i.test(cls)?'CAD Units':'USD Units';out.set(name,{cls:name,values:vals,quality,evidence:{}});}
 }
 return [...out.values()];
}
// v3-1: Single-class iShares ETFs with dotted-leader metric rows.
// In contrast, currency-specific CAD/USD Units reports continue through
// parseBlackrockB2() unchanged. Dashes in the current column stay null.
function parseBlackrockDottedEtf(pages,fund,date){
 if(!/\bETF\b/i.test(fund)||!date)return [];
 const year=date.slice(0,4);
 for(const pg of pages){
  const txt=normalizeExtraText(pg.text||'');const pos=txt.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
  if(pos<0)continue;
  const before=txt.slice(Math.max(0,pos-1200),pos);
  if(/\b(?:CAD|USD)\s+Units\b/i.test(before))continue;
  if(!new RegExp('\\b'+year+'\\b').test(before) && !new RegExp('\\b'+year+'\\b').test(pages.slice(0,2).map(x=>x.text).join(' ')))continue;
  const lines=txt.slice(pos,pos+3500).split(/\r?\n/);const vals={MER:null,TER:null,PTR:null},evidence={};let seen=0;
  for(const metric of ['MER','TER','PTR']){
   const re=metric==='MER'?/^\s*Management\s+expense\s+ratio\b/i:
     metric==='TER'?/^\s*Trading\s+expense\s+ratio\b/i:/^\s*Portfolio\s+turnover\s+(?:rate|ratio)\b/i;
   for(const line of lines){
    const m=re.exec(line);if(!m)continue;
    const tail=line.slice(m[0].length);
    // Dotted leaders identify the layout and keep the first financial
    // cell distinct from footnote markers and descriptive prose.
    const lead=/\.{6,}/.exec(tail);if(!lead)break;
    const valueText=tail.slice(lead.index+lead[0].length).trim();
    const tok=/^(?:\$\s*)?([—–−-]|\d+(?:\.\d+)?)(?=\s|%|$)/.exec(valueText);
    if(!tok)break;
    vals[metric]=toNumber(tok[1]);seen++;
    evidence[metric]={page:pg.page,source:'iShares dotted-leader latest-period ratio table',method:'native-js'};
    break;
   }
  }
  if(seen===3)return [{cls:'ETF Units',values:vals,evidence,quality:3}];
 }
 return [];
}

// Global X runs several financial report templates. Handle both '0.10%'
// and '0. 10%' for numeric fields, not just its legacy narrow regex.

function extract_blackrock(pages,p,fund,date){let parsed=parseBlackrockB2(pages);if(!parsed.length)parsed=parseBlackrockDottedEtf(pages,fund,date);if(!parsed.length)parsed=scanSingleFund(pages,p);return parsed;}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundLate_blackrock(pages,p,head){
if(p.key==='blackrock'){
    for(const pg of pages.slice(0,5))for(const raw of pg.text.split(/\r?\n/)){
      const line=raw.trim();
      if(/^iShares[A-Za-z0-9-]{12,130}ETF$/.test(line)){
        return line.replace(/^iShares/,'iShares ').replace(/(\d)([A-Za-z])/g,'$1 $2')
          .replace(/([A-Z]{2,})([A-Z][a-z])/g,'$1 $2')
          .replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^i Shares\s+/i,'iShares ').replace(/\s+/g,' ').trim();
      }
    }
    let match=head.match(/(?:for the|for an?)\s+(iShares\s+[^\n]{5,130}?(?:ETF Portfolio|Index ETF|ETF))\s*(?:\(|for\s+the)/i);
    if(!match)match=head.match(/\b(iShares\s+[^\n]{5,130}?(?:ETF Portfolio|Index ETF|ETF))\b/i);
    return clean(match?.[1]||'').replace(/ETFPortfolio/g,'ETF Portfolio').replace(/1-5Year/g,'1-5 Year');
  }
}


function parseRbcEtfFallback(pages,reportFund){
 if(!/\bETF\b/i.test(reportFund))return [];
 const date=reportDate(pages);if(!date)return [];
 const [yr,mm,dd]=date.split('-').map(Number);
 const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 for(const pg of pages){
  const text=String(pg.text||'');const ix=text.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
  if(ix<0)continue;
  const block=text.slice(ix,ix+4500);
  if(!/As\s+at/i.test(block)||!/Expense\s+Ratio/i.test(block)||!/Turnover\s+Rate/i.test(block))continue;
  const rowRe=/^\s*([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2})\s+(.+)$/gm;
  for(const m of block.matchAll(rowRe)){
   const month=monthNames.findIndex(x=>m[1].slice(0,3).toLowerCase()===x.toLowerCase())+1;
   if(month!==mm||Number(m[2])!==dd||Number(m[3])!==yr)continue;
   const tokens=m[4].match(/(?:n\/?a|[—–−-]|\d[\d,]*(?:\.\d+)?)/gi)||[];
   // 8 columns: unit NAV, fund NAV, outstanding units, MER, before
   // absorption MER, PTR, TER and closing price, in that order.
   if(tokens.length!==8)continue;
   return [{cls:'ETF Units',values:{MER:toNumber(tokens[3]),TER:toNumber(tokens[6]),PTR:toNumber(tokens[5])},quality:3,evidence:{}}];
  }
 }
 return [];
}


function extract_rbc(pages,p,fund,date){let parsed=rowTable(pages,p);if(!parsed.length)parsed=parseRbcEtfFallback(pages,fund);return parsed;}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundEarly_rbc(pages,p,head){
if(p.key==='rbc'){
    // Phillips, Hager & North is managed by RBC GAM. Its fund title is
    // frequently broken into 2-3 lines on the cover's RIGHT column.
    // Restrict this to the cover and an explicit PH&N issuer prefix.
    const cover=String(pages[0]?.rightText||pages[0]?.text||'').split(/\r?\n/).map(clean);
    for(let i=0;i<Math.min(cover.length,45);i++){
      if(!/^Phillips,?\s+Hager\s*&\s*North\b/i.test(cover[i]))continue;
      for(let n=0;n<=2 && i+n<cover.length;n++){
        const candidate=clean(cover.slice(i,i+n+1).join(' '));
        if(/^Phillips,?\s+Hager\s*&\s*North\s+[A-Za-z0-9 &',.()-]+\s+(?:Fund|ETF|Portfolio)$/i.test(candidate))return candidate;
      }
    }
  }
}

// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_rbc(line){
 const style='rbc';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='rbc'){m=/^((?:Series\s+[A-Z][A-Z0-9]*|ETF(?:H)?\s+Series))$/i.exec(s);return m?m[1]:null;}
 return null;
}


function bmoColumns(page){
  // In the PDF.js reader, columns are reconstructed independently by position.
  // This avoids merging the left and right ratio tables on the same physical line.
  const a=[page.leftText,page.rightText].filter(x=>typeof x==='string' && x.trim());
  return a.length?a:[page.text||''];
}
function bmoMetricValue(lines,key){
  const re=key==='MER'?/^\s*Management\s+expense\s+ratio\b/i:key==='TER'?/^\s*Trading\s+expense\s+ratio\b/i:/^\s*Portfolio\s+turnover\s+(?:rate|ratio)\b/i;
  for(let i=0;i<lines.length;i++){
    const line=lines[i].replace(/\u00a0/g,' ').trim();
    const match=re.exec(line);
    if(!match)continue;
    let tail=line.slice(match[0].length).trim();
    // "Management expense ratio before waivers" is not the reported MER.
    if(key==='MER' && /^before\s+waivers\b/i.test(tail))continue;
    if(key==='MER' && !tail && /^\s*before\s+waivers\b/i.test(lines[i+1]||''))continue;
    // Footnote markers such as (2), superscripts or + precede the % column.
    tail=tail.replace(/^(?:\s*(?:\(\d+\)|[+*]|%|\(%\)))+\s*/,'').trim();
    if(!tail || /^%\s*$/.test(tail)){
      for(let j=i+1;j<Math.min(i+4,lines.length);j++){
        const next=lines[j].trim();
        if(!next || /^(?:\(\d+\)|[+*])$/.test(next))continue;
        if(/before\s+waivers/i.test(next))break;
        if(/^(?:Management|Trading|Portfolio)\s+/i.test(next))break;
        tail+=' '+next;
        if(/(?:[—–-]|\d+\.\d+)/.test(next))break;
      }
    }
    tail=tail.replace(/^(?:\s*(?:\(\d+\)|[+*]|%|\(%\)))+\s*/,'').trim();
    // Expected first value is a decimal percentage or a missing-value dash.
    // Ignore integers in footnote markers and year headers.
    const token=/^(?:%\s*)?([—–-]|\d+(?:\.\d+)?)(?=\s|$)/.exec(tail);
    if(token)return {seen:true,value:toNumber(token[1])};
    if(/^[—–-]$/.test(tail))return {seen:true,value:null};
  }
  return {seen:false,value:null};
}
function bmoCollectRatios(lines,page){
  const values={MER:null,TER:null,PTR:null},evidence={};let quality=0;
  for(const metric of ['MER','TER','PTR']){
    const res=bmoMetricValue(lines,metric);
    if(!res.seen)continue;
    quality++;values[metric]=res.value;
    if(res.value!==null)evidence[metric]={page,source:metric+' (BMO ratio table)',method:'native-js',date_source:'report-header'};
  }
  return {values,evidence,quality};
}
function bmoMutualRows(pages){
  const results=new Map();
  const heading=/^\s*(Advisor\s+Series|Active\s+ETF\s+Series|Series\s+[A-Z][A-Z0-9-]*|Classic\s+Series)\s+(Units|Shares)(?:\s*\(\d+\))?\s*$/i;
  for(const page of pages){
    // BMO mutual ratio tables place some series in the left column, others on
    // the right; the "Ratios and Supplemental Data" title may be on only one.
    for(const col of bmoColumns(page)){
      const lines=col.split(/\r?\n/);let curr=null;
      const sections=[];
      for(let i=0;i<lines.length;i++){
        const m=heading.exec(lines[i].replace(/\u00a0/g,' ').trim());
        if(!m)continue;
        if(curr)curr.end=i;
        curr={cls:m[1].replace(/\s+/g,' ').trim()+' '+m[2],start:i,end:lines.length};
        sections.push(curr);
      }
      for(const sec of sections){
        const sliced=lines.slice(sec.start,sec.end);
        const r=bmoCollectRatios(sliced,page.page);
        if(r.quality<3)continue;
        // Inclusion rule: every explicitly reported series in the current
        // Ratios and Supplemental Data section gets a row, even when its
        // current-year financial values (and total assets) are all dashes.
        // A dash is null, while a reported 0.00 is numeric zero; never
        // substitute a previous-year value to fill a missing latest year.
        // r.quality counts recognized metric labels, not non-null values.
        const old=results.get(sec.cls);
        if(!old||r.quality>old.quality)results.set(sec.cls,{cls:sec.cls,...r});
      }
    }
  }
  return [...results.values()];
}
function bmoEtfRows(pages){
  for(const page of pages){
    for(const col of bmoColumns(page)){
      const start=col.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
      if(start<0)continue;
      let section=col.slice(start);
      const stop=section.slice(25).search(/\b(?:Management Fees|Past Performance|Summary of Investment Portfolio)\b/i);
      if(stop>=0)section=section.slice(0,25+stop);
      if(!/Listed\s+(?:CAD|USD)\s+Units/i.test(section))continue;
      const r=bmoCollectRatios(section.split(/\r?\n/),page.page);
      if(r.quality===3)return [{cls:(section.match(/Listed\s+(?:CAD|USD)\s+Units/i)||['Listed CAD Units'])[0].replace(/\s+/g,' '),...r}];
    }
  }
  return [];
}
// Reusable routing strategy for issuers with multiple report layouts:
// first validate the actual financial-ratio sections, then use the standalone
// cover-title type ONLY as a tie-breaker. ETF names mentioned in holdings,
// management discussion, or sub-fund allocations are not layout evidence.
function chooseTemplateByFinancialEvidence(candidates,preferredKind){
  const usable=candidates.filter(x=>x.rows.length>0);
  if(usable.length===1)return usable[0].rows;
  if(!usable.length)return [];
  const preferred=usable.find(x=>x.kind===preferredKind);
  if(preferred)return preferred.rows;
  usable.sort((a,b)=>{
    const quality=x=>x.rows.reduce((n,r)=>n+(r.quality||0),0);
    return quality(b)-quality(a)||b.rows.length-a.rows.length;
  });
  return usable[0].rows;
}
function bmoTable(pages){
  const cover=issuerTitleCandidate(pages.slice(0,2),bmo)?.text || '';
  const preferredKind=/\bETF\b/i.test(cover)?'etf':/\b(?:Fund|Portfolio)\b/i.test(cover)?'mutual':null;
  return chooseTemplateByFinancialEvidence([
    {kind:'mutual',rows:bmoMutualRows(pages)},
    {kind:'etf',rows:bmoEtfRows(pages)}
  ],preferredKind);
}

// ------- Additional FMC financial-table templates (unseen PDF batch) -------
function parseBmoAccumulating(pages){
 const out=new Map();for(const pg of pages){
  for(const col of [pg.rightText,pg.leftText]){
   if(!col||!/Listed\s+Accumulating\s+Units/i.test(col)||!/Portfolio\s+turnover\s+rate/i.test(col))continue;
   const lines=col.split(/\r?\n/),start=lines.findIndex(s=>/Listed\s+Accumulating\s+Units/i.test(s));
   if(start<0)continue;const r=bmoCollectRatios(lines.slice(start),pg.page);
   if(r.quality===3)out.set('Listed Accumulating Units',{cls:'Listed Accumulating Units',...r});
  }
 }return [...out.values()];
}

function extract_bmo(pages,p,fund,date){const parsed=bmoTable(pages);const more=parseBmoAccumulating(pages);for(const r of more)if(!parsed.some(x=>x.cls===r.cls))parsed.push(r);return parsed;}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundEarly_bmo(pages,p,head){
if(p.key==='bmo'){
    // Only standalone BMO product titles, never ETFs mentioned as holdings.
    // BMO uses Fund, Fund Ltd., ETF and Portfolio naming families.
    for(const page of pages.slice(0,4)){
      for(const raw of page.text.split(/\r?\n/)){
        const line=reportTitleLine(raw);
        const match=/^\s*(BMO(?:\s+[A-Za-z0-9][A-Za-z0-9.&'’/-]*){1,14}\s+(?:Fund(?:\s+Ltd\.)?|ETF|Portfolio))\s*$/i.exec(line);
        if(match)return clean(match[1]);
      }
    }
  }
}

// Non-mutating series completeness audit for this issuer.
function auditRatioHeadings_bmo(source,potential){
 let text=source;const ix=text.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
 if(ix<0)return;
   for(const line of text.slice(ix).split(/\r?\n/)){
    const m=/\b(Listed\s+(?:(?:CAD|USD|Accumulating)\s+)?Units)\b/i.exec(line);
    if(m)potential.add(m[1].replace(/\s+/g,' '));
   }
}


function bmgRotatedTables(pages){
 const date=reportDate(pages),year=Number(date?.slice(0,4));
 if(!year)return [];
 const metricRe={MER:/^Management expense ratio\s*\(%\)/i,
                 TER:/^Trading expense ratio\s*\(%\)/i,
                 PTR:/^Portfolio turnover rate\s*\(%\)/i};
 const out=[];
 for(const pg of pages){
  if(pg.ocrUsed||!Array.isArray(pg.items)||!pg.items.length)continue;
  const items=pg.items.filter(it=>Number.isFinite(it.x)&&Number.isFinite(it.y));
  const heads=items.map(it=>{const m=/^THE FUND[’']S NET ASSETS PER (CLASS\s+[A-Z][A-Z0-9-]*)\s+UNITS?$/i.exec(clean(it.str));
    return m?{cls:m[1],at:it}:null;}).filter(Boolean);
  for(const h of heads){
   const sect=items.filter(it=>/^RATIOS AND SUPPLEMENTAL DATA\s*:/i.test(clean(it.str))
    &&it.x>h.at.x+45&&it.x<h.at.x+230&&Math.abs(it.y-h.at.y)<9);
   if(sect.length!==1)continue;
   const yearHeads=items.filter(it=>clean(it.str)===String(year)&&Math.abs(it.x-h.at.x)<3.5
     &&it.y>h.at.y+80&&it.y<h.at.y+360);
   if(yearHeads.length!==1)continue;
   const yearY=yearHeads[0].y,values={},evidence={};let quality=0,valid=true;
   for(const [key,re] of Object.entries(metricRe)){
    const labels=items.filter(it=>re.test(clean(it.str))&&it.x>sect[0].x+8&&it.x<sect[0].x+56
      &&Math.abs(it.y-sect[0].y)<5);
    if(labels.length!==1){valid=false;break;}
    const label=labels[0];
    // 2020 data lies below that year's printed heading, no fixed pixel positions.
    const candidates=items.filter(it=>Math.abs(it.x-label.x)<1.6&&it.y>=yearY-3&&it.y<yearY+18
      &&/^(?:\d+(?:\.\d+)?|[—–−-]{1,2}|n\/?a)$/i.test(clean(it.str)));
    if(candidates.length!==1){valid=false;break;}
    values[key]=toNumber(candidates[0].str);quality++;
    evidence[key]={page:pg.page,source:key+' (BMG latest-year ratio table)',method:'native-js'};
   }
   if(valid&&quality===3)out.push({cls:h.cls.replace(/^class/i,'Class'),values,evidence,quality});
  }
 }
 return [...new Map(out.map(r=>[r.cls.toLowerCase(),r])).values()];
}
// BMG also publishes upright (single-page) Financial Highlights reports.
// Parse by actual Class heading, current-year column and ratio-row coordinates;
// PDF.js may split years, class headings and decimals into adjacent glyph runs.
// A class table can be followed by explanatory notes on the SAME PAGE with a
// second "Ratios and Supplemental Data" heading. Select the first ratio section
// below the class heading, then stop before the explanatory notes / next section.
// Shared between extraction and evidence to keep their source-cell scopes equal.
function bmgUprightRatioSection(band,titleOf){
 const heading=/^RATIOSANDSUPPLEMENTALDATA/;
 const first=band.findIndex(l=>heading.test(titleOf(l)));
 if(first<0)return null;
 const notes=/^(?:FOREXPLANATORYNOTES|EXPLANATORYNOTESTOFINANCIALHIGHLIGHTS|EXPLANATORYNOTES)/;
 const end=band.findIndex((l,i)=>i>first&&(heading.test(titleOf(l))||notes.test(titleOf(l))));
 return {section:band[first],rows:band.slice(first+1,end<0?band.length:end)};
}
function bmgUprightTables(pages){
 const date=reportDate(pages),year=Number(date?.slice(0,4));
 if(!year)return [];
 const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 const definitions={MER:/^MANAGEMENTEXPENSERATIO(?!BEFORE)/,
  TER:/^TRADINGEXPENSERATIO/,PTR:/^PORTFOLIOTURNOVERRATE/};
 const result=[];
 for(const page of pages){
  if(page.ocrUsed||!Array.isArray(page.items)||!page.items.length)continue;
  const lines=[];
  for(const it of page.items){
   if(typeof it.str!=='string'||!it.str.trim()||!Number.isFinite(it.x)||!Number.isFinite(it.y))continue;
   let l=lines.find(x=>Math.abs(x.y-it.y)<2.4);
   if(!l){l={y:it.y,items:[]};lines.push(l);}l.items.push(it);
  }
  lines.forEach(l=>l.items.sort((a,b)=>a.x-b.x));
  lines.sort((a,b)=>b.y-a.y);
  const titleOf=l=>norm(l.items.filter(i=>i.x<300).map(i=>i.str).join(''));
  const heads=lines.map((l,idx)=>{
   const m=/^THEFUNDSNETASSETSPERCLASS([A-Z][A-Z0-9]*)UNITS?$/.exec(titleOf(l));
   return m?{cls:'Class '+m[1],index:idx,line:l}:null;
  }).filter(Boolean);
  for(let n=0;n<heads.length;n++){
   const h=heads[n],end=heads[n+1]?.index??lines.length,band=lines.slice(h.index+1,end);
   // Detect the first reporting-year column from the header, even if 2019
   // appears as two separately positioned PDF.js tokens: "201" + "9".
   const titleItems=h.line.items.filter(it=>it.x<300);
   const titleEnd=Math.max(...titleItems.map(it=>it.x+it.w));
   const yrItems=h.line.items.filter(it=>it.x>titleEnd+14&&/^\d/.test(it.str)).sort((a,b)=>a.x-b.x);
   if(!yrItems.length)continue;
   const yrStart=yrItems[0].x;
   const firstYearParts=[];let last=null,nextYearX=null;
   for(const it of yrItems){
    if(last&&it.x-(last.x+last.w)>13){nextYearX=it.x;break;}
    firstYearParts.push(it.str.replace(/\D/g,''));last=it;
   }
   if(firstYearParts.join('')!==String(year))continue;
   if(!nextYearX){ // Single-year tables also occur; no adjacent prior-year cell.
    nextYearX=yrStart+Math.max(42,Number(page.width||600)*.07);
   }
   const startX=yrStart-14,stopX=yrStart+(nextYearX-yrStart)/2;
   const ratio=bmgUprightRatioSection(band,titleOf);
   if(!ratio)continue;
   const metrics={},evidence={};let valid=true;
   for(const [metric,re] of Object.entries(definitions)){
    const labelRows=ratio.rows.filter(l=>l.y<ratio.section.y-4&&re.test(titleOf(l)));
    if(labelRows.length!==1){valid=false;break;}
    const l=labelRows[0];
    const parts=l.items.filter(it=>it.x>=startX&&it.x<stopX)
     .sort((a,b)=>a.x-b.x);
    if(!parts.length){valid=false;break;}
    // Join only the validated current-year cell; no cross-column joining.
    const literal=parts.map(it=>it.str.replace(/\s/g,'')).join('');
    if(!/^(?:\d+(?:\.\d+)?|\.\d+|[—–−-]{1,2}|n\/?a)$/i.test(literal)){
     valid=false;break;
    }
    metrics[metric]=toNumber(literal);
    evidence[metric]={page:page.page,source:metric+' (BMG upright latest-year table)',method:'native-js'};
   }
   if(valid)result.push({cls:h.cls,values:metrics,evidence,quality:3});
  }
 }
 return [...new Map(result.map(r=>[r.cls.toLowerCase(),r])).values()];
}

function extract_bmg(pages,p,fund,date){const rotated=bmgRotatedTables(pages),upright=bmgUprightTables(pages);return [...new Map([...rotated,...upright].map(r=>[r.cls.toLowerCase(),r])).values()];}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundEarly_bmg(pages,p,head){
if(p.key==='bmg'){
    // PDF.js can concatenate a BMG cover title with neighboring spread text;
    // the original individual PDF text item retains the real full fund title.
    const name=/^(BMG\s+(?:(?!Fund\b)[A-Za-z0-9 &.'’-]{3,120}?\s+)?Bullion\s*Fund)$/i;
    for(const pg of pages.slice(0,6)){
      for(const item of pg.items||[]){const m=name.exec(clean(item.str));if(m)return m[1];}
      for(const line of String(pg.text||'').split(/\r?\n/)){
        const m=name.exec(clean(line));if(m)return m[1];
      }
    }
  }
}


function parseFirstTrust(pages){
 const date=reportDate(pages);if(!date)return [];
 const year=date.slice(0,4),out=new Map();
 const percent=/([—–−-]|\d+(?:\.\d+)?|\.\d+)\s*%/;
 for(const pg of pages){
  const text=String(pg.text||'');const ix=text.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
  if(ix<0)continue;
  const lines=text.slice(ix).split(/\r?\n/),headers=[];
  for(let i=0;i<lines.length;i++){
   const m=/^\s*([A-Z]{2,7}(?:\.[A-Z])?)\s+(20\d{2})\b/i.exec(lines[i]);
   if(m&&m[2]===year)headers.push({idx:i,cls:m[1]});
  }
  for(let k=0;k<headers.length;k++){
   const h=headers[k],block=lines.slice(h.idx,headers[k+1]?.idx??lines.length);
   const vals={MER:null,TER:null,PTR:null},evidence={};let quality=0;
   for(const metric of ['MER','TER','PTR']){
    const re=metric==='MER'?/^\s*Management\s+expense\s+ratio\b/i:
     metric==='TER'?/^\s*Trading\s+expense\s+ratio\b/i:/^\s*Portfolio\s+turnover\s+rate\b/i;
    for(let i=0;i<block.length;i++){
     const m=re.exec(block[i]);if(!m)continue;
     if(metric==='MER'&&/\bbefore\s+(?:waivers|absorption)/i.test(block[i]))continue;
     const tail=block.slice(i,i+3).join(' '),numeric=percent.exec(tail);
     if(numeric){vals[metric]=toNumber(numeric[1]);quality++;evidence[metric]={page:pg.page,source:metric+' (First Trust current-period ratio table)',method:'native-js'};}
     break;
    }
   }
   if(quality>=2)out.set(h.cls,{cls:h.cls,values:vals,evidence,quality});
  }
 }
 return [...out.values()];
}

// RBC ETF financial table has no Series subheading. This is a guarded
// complement to the existing RBC mutual-fund dated-table implementation.

function extract_first_trust(pages,p,fund,date){return parseFirstTrust(pages);}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundLate_first_trust(pages,p,head){
if(p.key==='first_trust'){
    for(const pg of pages.slice(0,4))for(const raw of String(pg.text||'').split(/\r?\n/)){
      const line=raw.replace(/^[\s®™]+/,'').replace(/\s+/g,' ').trim();
      const m=/^(First Trust\s+.{8,170}?ETF)(?:\s*[•(]|$)/i.exec(line);
      if(m)return clean(m[1]);
    }
  }
}


function tdHeading(line){
 const m=/^\s*((?:(?:Investor|Advisor|Institutional|Private|Premium(?:\s+F)?|F|O|D|H\d*|FT\d*|T\d*)\s*[- ]?\s*Series)|(?:TUSB(?:\.U)?\s*\((?:C|US)\$\)))\s*$/i.exec(normalizeExtraText(line).trim());
 return m?m[1].replace(/\s+/g,' ').replace(/\s*[- ]?\s*Series$/i,' Series').replace(/^([A-Z0-9]+)\s+Series$/,(m,p)=>p.toUpperCase()==='F'?'F-Series':m):null;
}
function parseTd(pages){
 const isEtf=pages.slice(0,2).some(p=>/TD Exchange-Traded Funds/i.test(p.text));
 if(isEtf){
  // The currencies are parallel tables. Use the entire page's aligned rows.
  const p=pages.find(p=>/Ratios and Supplemental Data/i.test(p.text));if(!p)return [];
  const lines=normalizeExtraText(p.text).split('\n');const start=lines.findIndex(s=>/Ratios and Supplemental Data/i.test(s));
  if(start<0)return [];
  const s=lines.slice(start);const indices={};
  const tickerLine=s.find(z=>/\b[A-Z]{2,7}(?:\.U)?\s*\((?:C|US)\$\)/.test(z))||'';
  const tickers=[...tickerLine.matchAll(/([A-Z]{2,7}(?:\.U)?\s*\((?:C|US)\$\))/g)].map(m=>m[1]);
  const y=reportDate(pages)?.slice(0,4);
  const yearLine=s.find(z=>(z.match(/20\d{2}/g)||[]).length>=4)||'';
  const allYears=yearLine.match(/20\d{2}/g)||[];
  const perTicker=tickers.length?Math.floor(allYears.length/tickers.length):0;
  if(!tickers.length||!perTicker||!y)return [];
 
  for(const metric of ['MER','TER','PTR']){
   const regex=metric==='MER'?/^Management Expense Ratio \(%\)/i:metric==='TER'?/^Trading Expense Ratio \(%\)/i:/^Portfolio Turnover Rate \(%\)/i;
   const row=s.find(z=>regex.test(z));if(!row)continue;
   let nums=(row.match(/\d+\.\d+|N\/A|[—–−]/gi)||[]).map(toNumber);
   // Years for each ticker are adjacent, 5 per ticker.
   indices[metric]=nums;
  }
  const out=[];
  for(let i=0;i<tickers.length;i++){
    const ix=allYears.findIndex((val,j)=>j>=perTicker*i && j<perTicker*(i+1)&&val===y);
    if(ix<0)continue;
    let vals={},q=0;for(const m of ['MER','TER','PTR'])if(indices[m]?.length>ix){vals[m]=indices[m][ix];q++;}else vals[m]=null;
    if(q===3)out.push({cls:tickers[i],values:vals,quality:q,evidence:{}});
  }
  return out;
 }
 const main=parseClassColumns(pages,{splitColumns:true,requireRatioHeading:true,heading:(line)=>tdHeading(line)});
 const right=[];
 for(const p of pages){
   if(!/Ratios and Supplemental Data/i.test(p.text))continue;
   const ls=normalizeExtraText(p.rightText).split('\n');const year=reportDate(pages)?.slice(0,4);
   for(let i=0;i<ls.length;i++){
     const cls=tdHeading(ls[i]);if(!cls)continue;
     const years=(ls[i+1]||'').match(/20\d{2}/g)||[],ix=years.indexOf(year);
     if(ix<0)continue;
     const read=(offset)=>{
       const t=ls[i+offset]||'';
       const num=t.match(/N\/?A|[—–−]|\d[\d,]*(?:\.\d+)?/gi)||[];
       return ix<num.length?toNumber(num[ix]):null;
     };
     // After the year header: assets, units, MER, MER before, TER, PTR.
     if(i+7>=ls.length)continue;
     right.push({cls,values:{MER:read(4),TER:read(6),PTR:read(7)},quality:3,evidence:{}});
   }
 }
 const map=new Map([...main,...right].map(r=>[r.cls,r]));
 return [...map.values()];
}
function parseTdEtfFallback(pages){
 const header=pages.slice(0,3).map(x=>x.text).join('\n');if(!/TD\s+[^\n]*ETF\b/i.test(header))return [];
 for(const pg of pages){const start=pg.text.search(/Ratios\s+and\s+Supplemental\s+Data/i);if(start<0)continue;
  let t=pg.text.slice(start);const stop=t.search(/\bNet\s+Asset\s+Value\s+per\s+Unit/i);if(stop>=0)t=t.slice(0,stop);
  const r=v22Metrics(t);if(r.quality===3)return [{cls:'ETF Units',...r}];
 }return [];
}
// Batch 2: CI has a dated *row table* (NOT the typical column MER/TER/PTR
// labels). Use MER AFTER taxes, preserve nil values; never read fee schedules.

function extract_td(pages,p,fund,date){const r=parseTd(pages);return r.length?r:parseTdEtfFallback(pages);}

function parseLysander(pages){
 return parseClassColumns(pages.filter(p=>p.page>=6),{heading:(line)=>{const m=/^\s*(Series\s+[A-Z]|ETF Series)\s*\**\s*$/i.exec(line);return m?m[1]:null;},ratiosAfterHeading:true});
}

function extract_lysander(pages,p,fund,date){return parseLysander(pages);}

function parseNEI(pages){
 const out=[];const date=reportDate(pages);const year=date?.slice(0,4),month=date?.slice(5,7);
 for(const p of pages){
  if(!/Ratios and Supplemental Data/i.test(p.text))continue;
  for(const line of normalizeExtraText(p.text).split('\n')){
   const m=/^\s*([A-Z]{1,3})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(20\d{2})\s+(.+)/i.exec(line);if(!m||m[3]!==year||String(months[m[2].slice(0,3).toLowerCase()]).padStart(2,'0')!==month)continue;
   const parts=m[4].trim().split(/\s{2,}/).map(z=>z.trim()).filter(Boolean);
   // asset value, units, MER, MER before, TER, PTR, NAV
   if(parts.length<6)continue;
   const v={MER:toNumber(parts[2]),TER:toNumber(parts[4]),PTR:toNumber(parts[5])};
   out.push({cls:'Series '+m[1],values:v,quality:3,evidence:{}});
  }
 }
 return out;
}

function extract_nei(pages,p,fund,date){return parseNEI(pages);}

function parseMackenzie(pages){
 const out=[];const targetYear=reportDate(pages)?.slice(0,4);for(const p of pages){
  if(p.page<6)continue;
  for(const col of [p.leftText,p.rightText]){
   if(!col)continue;
   const lines=normalizeExtraText(col).split('\n');
   for(let i=0;i<lines.length;i++){
    const m=/^\s*(Series\s+[A-Z][A-Z0-9]*(?:\s+[A-Z]{2,4})?)\s+(20\d{2})\s+(20\d{2})\b/i.exec(lines[i]);if(!m||m[2]!==targetYear)continue;
    const end=lines.findIndex((s,j)=>j>i&&/^\s*Series\s+[A-Z][A-Z0-9]*(?:\s+[A-Z]{2,4})?\s+20\d{2}\s+20\d{2}\b/i.test(s));
    const text=lines.slice(i,end>i?end:i+25).join('\n');const v=extraRatios(text);
    if(v.quality>=2)out.push({cls:m[1].replace(/\s+/g,' '),...v});
   }
  }
 }
 return [...new Map(out.map(x=>[x.cls,x])).values()];
}
// v3-1: Mackenzie ETFs publish a right-hand ratios table, while mutual
// funds use the existing multi-Series parser. Use this only after the
// mutual-fund parser returns no rows, and only with a titled ETF document.
function parseMackenzieEtfColumns(pages,fund,date){
 if(!/\bETF\b/i.test(fund)||!date)return [];
 const year=date.slice(0,4);
 for(const pg of pages){
  for(const column of [pg.rightText,pg.text]){
   const txt=normalizeExtraText(column||'');
   const ix=txt.search(/Ratios?\s+and\s+Supplemental\s+Data/i);if(ix<0)continue;
   const lines=txt.slice(ix).split(/\r?\n/);
   const head=lines.slice(0,8).join(' ');
   const clsMatch=/\b((?:CAD|USD)\s+Units)(?:\s*\(Ticker:[^)]+\))?\s+(20\d{2})\b/i.exec(head);
   if(!clsMatch || clsMatch[2]!==year)continue;
   // Confirm the time axis: the first year belongs to this report.
   const listedYears=head.match(/20\d{2}/g)||[];
   if(listedYears[0]!==year)continue;
   const values={MER:null,TER:null,PTR:null},evidence={};let quality=0;
   for(const metric of ['MER','TER','PTR']){
    const label=metric==='MER'?/^\s*Management\s+expense\s+ratio\s*\(\s*%\s*\)/i:
      metric==='TER'?/^\s*Trading\s+expense\s+ratio\s*\(\s*%\s*\)/i:
      /^\s*Portfolio\s+turnover\s+rate\s*\(\s*%\s*\)/i;
    for(const line of lines){
     const m=label.exec(line);if(!m)continue;
     const tail=line.slice(m[0].length);
     const token=/^\s*([—–−-]|\d+(?:\.\d+)?)(?=\s|%|$)/.exec(tail);
     if(!token)break;
     values[metric]=toNumber(token[1]);quality++;
     evidence[metric]={page:pg.page,source:'Mackenzie ETF first-period ratio column',method:'native-js'};
     break;
    }
   }
   if(quality===3)return [{cls:clsMatch[1].replace(/\s+/g,' '),values,evidence,quality}];
  }
 }
 return [];
}


function extract_mackenzie(pages,p,fund,date){const r=parseMackenzie(pages);return r.length?r:parseMackenzieEtfColumns(pages,identifyFund(pages,p),reportDate(pages));}

function parseIgUnlabelledLatestColumn(pages){
 const year=Number(reportDate(pages)?.slice(0,4));
 if(!Number.isInteger(year)||year<2000)return [];
 const out=[];
 const heading=/^\s*(Series\s+[A-Z][A-Z0-9]*(?:\s+[A-Z]{2,4})?)\s+((?:20\d{2}\s+){1,7}20\d{2})\s*$/i;
 const ratioRe={
  MER:/^Management\s+expense\s+ratio\s*\(%\)/i,
  TER:/^Trading\s+expense\s+ratio\s*\(%\)/i,
  PTR:/^Portfolio\s+turnover\s+rate\s*\(%\)/i
 };
 for(const pg of pages){
  if(!/RATIOS\s+AND\s+SUPPLEMENTAL\s+DATA/i.test(pg.text||''))continue;
  for(const col of [pg.leftText,pg.rightText]){
   const lines=normalizeExtraText(col||'').split(/\r?\n/);
   const heads=[];
   for(let i=0;i<lines.length;i++){
    const m=heading.exec(lines[i].trim());
    if(!m)continue;
    heads.push({index:i,cls:m[1].replace(/\s+/g,' '),years:m[2].trim().split(/\s+/).map(Number)});
   }
   const normal=heads.some(h=>h.years[0]===year&&h.years[1]===year-1);
   if(!normal)continue;
   for(let k=0;k<heads.length;k++){
    const h=heads[k],oldYears=h.years;
    if(oldYears[0]!==year-1||oldYears.length<2||oldYears.some((y,i)=>i>0&&y!==oldYears[i-1]-1))continue;
    const tail=lines.slice(h.index+1,heads[k+1]?.index??lines.length);
    const metrics={};let valid=true;
    for(const [metric,re] of Object.entries(ratioRe)){
     const matching=tail.filter(line=>re.test(line.trim()));
     if(matching.length!==1){valid=false;break;}
     const label=re.exec(matching[0].trim());
     const cells=matching[0].trim().slice(label[0].length).trim()
      .match(/(?:n\s*\/\s*a|[—–−-]{1,2}|\d+(?:\.\d+)?|\.\d+)(?=\s|$)/gi)||[];
     if(cells.length!==oldYears.length+1){valid=false;break;}
     metrics[metric]=toNumber(cells[0]);
    }
    if(valid)out.push({cls:h.cls,values:metrics,quality:3,evidence:{}});
   }
  }
 }
 return [...new Map(out.map(r=>[r.cls,r])).values()];
}
function parseIgHistorical(pages,p){
 // Include a historically listed series only if no validated current-period
 // source exists; older-year ratios must not masquerade as current values.
 const found=parseMackenzie(pages), existing=new Set(found.map(x=>x.cls));
 for(const candidate of parseIgUnlabelledLatestColumn(pages)){
  if(!existing.has(candidate.cls)){found.push(candidate);existing.add(candidate.cls);}
 }
 for(const pg of pages){
  if(!/RATIOS AND SUPPLEMENTAL DATA/i.test(pg.text))continue;
  for(const col of [pg.leftText,pg.rightText]){
   const lines=normalizeExtraText(col||'').split(/\r?\n/);
   const start=lines.findIndex(x=>/RATIOS AND SUPPLEMENTAL DATA/i.test(x));
   for(const l of lines.slice(Math.max(0,start))){
    const m=/^\s*(Series\s+[A-Z][A-Z0-9]*(?:\s+[A-Z]{2,4})?)\s+(20\d\d)(?=\s)/i.exec(l);
    if(!m||existing.has(m[1])||Number(m[2])>=Number(reportDate(pages)?.slice(0,4)))continue;
    // Evidence must be a metric table, not a footnote sentence.
    found.push({cls:m[1],values:{MER:null,TER:null,PTR:null},quality:3,evidence:{}});
    existing.add(m[1]);
   }
  }
 }
 return found;
}

// New issuer formats (batch 10) are scoped to their own profiles. No ratio
// constants or document filenames are used. A dash/N/A remains a null cell.

function extract_ig_mackenzie(pages,p,fund,date){return parseIgHistorical(pages,p);}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundLate_ig_mackenzie(pages,p,head){
if(p.key==='ig_mackenzie'){
    for(const pg of pages.slice(0,2))for(const raw of pg.text.split(/\r?\n/)){
      const line=raw.trim().replace(/\s+/g,' ');
      if(/^IG\s+(?:Core\s+)?Portfolio\s*[–-]\s*[A-Za-z ]{3,70}$/i.test(line))return line;
    }
  }
}


function parseFidelity(pages){
 return parseClassColumns(pages,{heading:(line)=>{
  const m=/^\s*Fidelity\s+[^\n]{5,190}?\s+(ETF Series|Series\s+[A-Z][A-Z0-9]*)\s*$/i.exec(line.replace(/[®™]/g,''));return m?m[1].replace(/\s+/g,' '):null;
 },ratiosAfterHeading:true});
}

function extract_fidelity(pages,p,fund,date){return parseFidelity(pages);}

function parsePender(pages){
 return parseClassColumns(pages.filter(p=>p.page>=8 && /Ratios and Supplemental Data/i.test(p.text)),{heading:(line)=>{
 const m=/^\s*(Class\s+[A-Z](?:\s*\((?:USD|CAD)\))?)\s*$/i.exec(line);return m?m[1]:null;},requireRatioHeading:true});
}

function extract_pender(pages,p,fund,date){return parsePender(pages);}

function parseBrandes(pages){
 const out=new Map();const year=brandesDate(pages)?.slice(0,4);for(const p of pages){
  if(!/Ratios and Supplemental Data/i.test(p.text))continue;
  const lines=normalizeExtraText(p.text).split('\n');
  for(let i=0;i<lines.length;i++){
   const m=/^\s*(Series\s+[A-Z][A-Z0-9]*)\s*$/i.exec(lines[i]);if(!m)continue;
   // For this tabular layout, a series name is centered vertically among
   // the six-year data rows; its 2026 line appears immediately above it.
   let latest=null;
   for(let j=i-1;j>=Math.max(0,i-12);j--){if(year&&lines[j].startsWith(year+' ')){latest=lines[j];break;}if(/^Series\s/i.test(lines[j]))break;}
   if(!latest)continue;
   let parts=(latest.match(/\b\d[\d,]*(?:\.\d+)?\b|[—–−-]/g)||[]);
   // Year, net assets, units, MER, MER before, PTR, TER, NAV.
   if(parts.length<7)continue;
   const v={MER:toNumber(parts[3]),PTR:toNumber(parts[5]),TER:toNumber(parts[6])};
   out.set(m[1],{cls:m[1],values:v,quality:3,evidence:{}});
  }
 }
 return [...out.values()];
}
function brandesDate(pages){
 const head=normalizeExtraText(pages.slice(0,5).map(x=>x.text).join('\n'));
 const m=/Results\s+of\s+Operations\s+from[\s\S]{0,160}?\bto[\s\S]{0,170}?\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})/i.exec(head);
 if(m){const mm=months[m[1].slice(0,3).toLowerCase()];return `${m[3]}-${String(mm).padStart(2,'0')}-${m[2].padStart(2,'0')}`;}
 return reportDate(pages);
}
// v2-1: New issuer formats. Ratios are read from the latest period's first
// published table column; no amounts are hardcoded for any named fund.

function extract_brandes(pages,p,fund,date){return parseBrandes(pages);}
function selectReportDate_brandes(pages){return brandesDate(pages);}


function parseAGF(pages){
 return parseClassColumns(pages,{splitColumns:true,heading:(line)=>{const m=/^\s*((?:Mutual Fund|Series\s*[A-Z]{1,3})\s+(?:Units|Shares))\s*[-–]\s*Ratios\/Supplemental Data/i.exec(line);return m?m[1].replace(/^Series(?=[A-Z])/i,'Series '):null;}});
}

function extract_agf(pages,p,fund,date){return parseAGF(pages);}

function parseHarvest(pages){
 return parseClassColumns(pages,{heading:(line)=>{const m=/^\s*(Class\s+[A-Z](?:\s*\((?:USD|CAD)\))?)\s*$/i.exec(line);return m?m[1]:null;},ratiosAfterHeading:true});
}

function extract_harvest(pages,p,fund,date){return parseHarvest(pages);}

function parseVanguard(pages){
 for(const page of pages){
  const pos=page.text.search(/Ratios and Supplemental Data/i);
  if(pos<0)continue;
  const block=page.text.slice(pos,pos+4500);
  const r=extraRatios(block);
  if(r.quality>=3)return [{cls:'ETF Units',...r}];
 }
 return [];
}
function parseVanguardB2(pages){
 for(const pg of pages){let pos=pg.text.search(/Ratios\s+and\s+Supplemental\s+Data/i);if(pos<0)continue;
  const lines=pg.text.slice(pos).split(/\r?\n/);let v={},seen=0;
  for(const m of ['MER','TER','PTR']){
   const re=m==='MER'?/^\s*Management\s+expense\s+ratio(?!\s+before)/i:m==='TER'?/^\s*Trading\s+expense\s+ratio/i:/^\s*Portfolio\s+turnover\s+rate/i;
   const row=lines.find(x=>re.test(x));if(!row)continue;
   const label=re.exec(row),tail=row.slice(label[0].length).replace(/^(?:\d+|\s|\([^)]*\))*(?=\s+\d+\.\d+%|\s+[—–−-])/,'');
   const values=[...tail.matchAll(/(?:\d*\.\d+|[—–−-])%?/g)];
   if(!values.length)continue;
   v[m]=toNumber(values[0][0].replace(/%/g,''));seen++;
  }
  if(seen===3)return [{cls:'ETF Units',values:v,quality:3,evidence:{}}];
 }
 return [];
}
// BlackRock has a family of condensed text PDFs, with collapsed spaces like
// 'RatiosandSupplementalData(g)' and separate CAD/USD units per page.

function extract_vanguard(pages,p,fund,date){const r=parseVanguard(pages);return r.length?r:parseVanguardB2(pages);}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundLate_vanguard(pages,p,head){
if(p.key==='vanguard'){
    const lines=pages.slice(0,2).flatMap(pg=>pg.text.split(/\r?\n/));
    for(let i=0;i<lines.length;i++){
      let line=lines[i].trim();if(!/^Vanguard\s+FTSE\b/i.test(line))continue;
      if(!/\bETF\b/i.test(line))line+=' '+(lines[i+1]||'').trim();
      const found=/(Vanguard\s+[^\n]{5,160}?ETF(?:\s*\(CAD-hedged\))?)/i.exec(line);
      if(found)return clean(found[1]);
    }
  }
}


function parseNinepoint(pages){
 const results=new Map();
 for(const page of pages){
  if(!/Ratios and Supplemental Data/i.test(page.text))continue;
  const txt=normalizeExtraText(page.text),lines=txt.split(/\r?\n/),headings=[];
  for(let i=0;i<lines.length;i++){
   const m=/^\s*(Series\s+(?:ETF|[A-Z]))(?:\s+20\d{2}(?:\s+20\d{2})*)?\s*$/i.exec(lines[i]);
   if(m)headings.push({cls:m[1].replace(/\s+/g,' '),idx:i});
  }
  for(let i=0;i<headings.length;i++){
   const h=headings[i];
   const r=extraRatios(lines.slice(h.idx,headings[i+1]?.idx??lines.length).join('\n'));
   if(r.quality>=3)results.set(h.cls,{cls:h.cls,...r});
  }
 }
 return [...results.values()];
}

function extract_ninepoint(pages,p,fund,date){return parseNinepoint(pages);}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundEarly_ninepoint(pages,p,head){
if(p.key==='ninepoint'){
    const datedTitle=/^(Ninepoint\s+.{4,130}?\bFund)(?:\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+20\d{2})?$/i;

    for(const pg of pages.slice(0,3)){
      for(const raw of String(pg.text||'').split(/\r?\n/).slice(0,25)){
        const m=datedTitle.exec(reportTitleLine(raw));

        if(m)return clean(m[1]);
      }
    }

    const cover=String(pages[0]?.text||'')
      .split(/\r?\n/)
      .slice(0,15)
      .map(reportTitleLine);

    for(let i=0;i<cover.length;i++){
      if(!/^Ninepoint$/i.test(cover[i]))continue;

      for(let n=3;n<=6 && i+n<=cover.length;n++){
        const m=/^(Ninepoint\s+.{4,130}?\bFund)$/i.exec(
          clean(cover.slice(i,i+n).join(' '))
        );

        if(m)return clean(m[1]);
      }
    }
  }
}


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


function parseCibc(pages){
 const out=new Map();
 for(const pg of pages){const lines=pg.text.split(/\r?\n/);for(let i=0;i<lines.length;i++){
  const m=/^\s*Ratios\s+and\s+Supplemental\s+Data\s*[-–]\s*((?:ETF\s+Series|Series\s+[A-Z][A-Z0-9-]*)\s+Units)\b/i.exec(lines[i]);
  if(!m)continue;
  let end=i+1;while(end<lines.length && !/^\s*(?:Ratios\s+and\s+Supplemental\s+Data\s*[-–]|The\s+Pool.s\s+Net\s+Assets\s+per\s+Unit|Past\s+Performance)/i.test(lines[end]))end++;
  const r=v22Metrics(lines.slice(i+1,end).join('\n'));if(r.quality===3)out.set(m[1],{cls:m[1],...r});
 }}return [...out.values()];
}

function extract_cibc(pages,p,fund,date){return parseCibc(pages);}

function parseHamilton(pages){
 for(const pg of pages){let text=pg.text;const pos=text.search(/Ratios\s+and\s+Supplemental\s+Data/i);if(pos<0)continue;
  text=text.slice(pos);const lines=text.split(/\r?\n/);
  const yrLine=lines.find(x=>/^\s*Year\b.*\b20\d{2}\b/i.test(x))||'';
  const count=(yrLine.match(/20\d\d/g)||[]).length;if(count<1)continue;
  const v={MER:null,TER:null,PTR:null};let quality=0;
  for(const metric of ['MER','TER','PTR']){
   const re=metric==='MER'?/^\s*Management\s+expense\s+ratio\b(?!\s+before)/i:metric==='TER'?/^\s*Trading\s+expense\s+ratio\b/i:/^\s*Portfolio\s+turnover\s+rate\b/i;
   const row=lines.find(x=>re.test(x));if(!row)continue;
   // Hamilton annotates rows with long 'Footnote' text embedded in a
   // single PDF.js line. Only the rightmost N year-column percentages
   // belong to the table; earlier figures may be in the annotation.
   const pct=[...row.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(x=>x[1]);
   if(pct.length<count)continue;
   v[metric]=toNumber(pct[pct.length-count]);quality++;
  }
  if(quality===3)return [{cls:'Class E',values:v,quality,evidence:{}}];
 }return [];
}

function extract_hamilton(pages,p,fund,date){return parseHamilton(pages);}

function parseNewGen(pages){
 const out=new Map();
 for(const pg of pages){const lines=pg.text.split(/\r?\n/);const positions=[];
  for(let i=0;i<lines.length;i++){let m=/The\s+Fund.s\s+Net\s+Asset\s+Value\s*\(NAV\)\s+per\s+(Class\s+[FGI](?:\s*\(USD\))?)\s+Unit/i.exec(lines[i]);if(m)positions.push({cls:m[1],i});}
  for(let k=0;k<positions.length;k++){const h=positions[k];let t=lines.slice(h.i,positions[k+1]?.i??lines.length).join('\n');
   if(!/Ratios\s+and\s+Supplemental\s+Data/i.test(t))continue;
   t=t.slice(t.search(/Ratios\s+and\s+Supplemental\s+Data/i));const r=v22Metrics(t,{includePerformance:true});
   if(r.quality===3)out.set(h.cls,{cls:h.cls,...r});
  }
 }return [...out.values()];
}

function extract_newgen(pages,p,fund,date){return parseNewGen(pages);}

function parseRP(pages){
 const out=new Map(),target=reportDate(pages);
 for(const pg of pages){const txt=pg.text;const pos=txt.search(/Ratios\s+and\s+supplemental\s+data/i);if(pos<0)continue;
  const lines=txt.slice(pos).split(/\r?\n/);let cls=null;
  for(const raw of lines){const heading=/^\s*(Class\s+[A-Z][A-Z0-9]*(?:-USD)?)(?:\*+)?\s*$/i.exec(raw);if(heading){cls=heading[1];continue;}
   if(!cls||!/\bJun(?:e)?\.?\s+30,?\s+20\d{2}/i.test(raw))continue;
   const m=/^\s*Jun(?:e)?\.?\s+30,?\s+(20\d{2})\*{0,8}\s*(.*)$/i.exec(raw);if(!m||target&&m[1]!==target.slice(0,4))continue;
   const matches=m[2].match(/(?:\d[\d,]*\.\d+|\d[\d,]*|[—–−-])%?/g)||[];
   if(matches.length<7)continue;
   out.set(cls,{cls,values:{MER:toNumber(matches[2]),TER:toNumber(matches[4]),PTR:toNumber(matches[5])},quality:3,evidence:{}});
  }
 }return [...out.values()];
}

function extract_rpia(pages,p,fund,date){return parseRP(pages);}

function parseLeith(pages){
 const out=new Map();for(const pg of pages){const pos=pg.text.search(/Ratios\s+and\s+Supplemental\s+Data/i);if(pos<0)continue;
  const lines=pg.text.slice(pos).split(/\r?\n/);let heads=[];
  for(let i=0;i<lines.length;i++){const m=/^\s*(Series\s+[A-Z][A-Z0-9]*)(?:\s*\(\d+\))?\s+(?:(?:202[0-9]|\bJune\b)|$)/i.exec(lines[i]);if(m)heads.push({cls:m[1],i});}
  for(let j=0;j<heads.length;j++){const h=heads[j],text=lines.slice(h.i,heads[j+1]?.i??lines.length).join('\n');const r=v22Metrics(text);
   if(r.quality===3)out.set(h.cls,{cls:h.cls,...r});
  }
 }return [...out.values()];
}

function extract_leith_wheeler(pages,p,fund,date){return parseLeith(pages);}

function parseCI(pages){
 const out=new Map(),date=reportDate(pages);if(!date)return [];
 const year=date.slice(0,4),month=Number(date.slice(5,7)),day=Number(date.slice(8,10));
 // CI prints the footnotes beside a series name, but PDF.js sometimes
 // orders those fragments as TWO lines (footnotes BEFORE the series).
 // Accept either order without relying on the sample's series count.
 // Keep the original CI Series parser; add a second heading style for the
 // Corporate Class Shares format. Neither path accepts arbitrary prose.
 const seriesHeading=/^\s*(Series\s+[A-Z][A-Z0-9]*|[A-Z][A-Z0-9]*\s+Shares)(?:\s*\(\d+\))*\s*$/i;
 const dateRow=/^\s*(Mar(?:ch)?\.?\s+31|Sept?(?:ember)?\.?\s+30|Jun(?:e)?\.?\s+30|Dec(?:ember)?\.?\s+31),?\s+(20\d{2})(?:\s+|$)(.*)$/i;
 for(const pg of pages){
  const pos=String(pg.text||'').search(/Ratios\s+and\s+Supplemental\s+Data/i);
  if(pos<0)continue; // Never harvest figures from non-financial tables.
  const lines=pg.text.slice(pos).split(/\r?\n/);let series=null;
  for(let i=0;i<lines.length;i++){
   const heading=seriesHeading.exec(lines[i]);
   if(heading){
    // Within a CI ratio table, the next line normally gives the start
    // date. Requiring that context avoids accepting prose references.
    const next=lines.slice(i+1,i+4).join(' ');
    series=/\bCommencement\s+of\s+operations\b/i.test(next)?heading[1].replace(/\s+/g,' ').trim():null;
    continue;
   }
   if(!series)continue;
   const row=dateRow.exec(lines[i]);if(!row||row[2]!==year)continue;
   const mm=/^Mar/i.test(row[1])?3:/^Sept?/i.test(row[1])?9:/^Jun/i.test(row[1])?6:12;
   const dd=mm===3||mm===12?31:30;
   if(mm!==month||dd!==day)continue;
   // Eight columns: net assets, units, MER before tax, sales tax,
   // MER AFTER tax, effective HST, TER, PTR. Dashes stay null.
   // Some PDFs wrap the numeric cells onto the next physical text line.
   let data=row[3];let tokens=[];
   for(let j=0;j<3;j++){
    tokens=data.match(/(?:n\/?a|[—–−-]|\d[\d,]*(?:\.\d+)?)/gi)||[];
    if(tokens.length>=8)break;
    const cont=lines[i+j+1]||'';
    if(!cont.trim()||seriesHeading.test(cont)||dateRow.test(cont)||/\b(?:Commencement|Footnotes|Financial\s+Highlights|Ratios\s+and)\b/i.test(cont))break;
    data+=' '+cont;
   }
   if(tokens.length!==8)continue; // No guesses from partial/shifted columns.
   out.set(series,{cls:series,values:{MER:toNumber(tokens[4]),TER:toNumber(tokens[6]),PTR:toNumber(tokens[7])},quality:3,evidence:{}});
  }
 }
 return [...out.values()];
}
// Recover a current-year row from a Dynamic/Scotia ratio table even when the
// table carries on to the next page without repeating 'Ratios and ...'.
// USD identifiers and new 2-letter series are not collapsed into Series A.

function extract_ci(pages,p,fund,date){return parseCI(pages);}
// Non-mutating series completeness audit for this issuer.
function auditRatioHeadings_ci(source,potential){
 let text=source;const ix=text.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
 if(ix<0)return;
   for(const line of text.slice(ix).split(/\r?\n/)){
    const m=/^\s*(Series\s+[A-Z][A-Z0-9]*|[A-Z][A-Z0-9]*\s+Shares)(?:\s*\(\d+\))*\s*$/i.exec(line);
    if(m)potential.add(m[1]);
   }
}



function extract_scotia(pages,p,fund,date){return parse1832Complete(pages);}
// Non-mutating series completeness audit for this issuer.
function auditRatioHeadings_scotia(source,potential){
 let text=source;const ix=text.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
 // Pages without the ratio heading may continue the dated table with
   // 'As at' and a row of management/trading expense labels.
   if(ix<0 && !/\bAs\s+at\b/i.test(text.slice(0,650)))return;
   if(ix>=0)text=text.slice(ix);
   for(const line of text.split(/\r?\n/)){
    const m=/^\s*(Series\s+[A-Z][A-Z0-9]*(?:\s*\(USD\))?|ETF(?:H)?\s+Series)(?:\s*[–-].*)?\s*$/i.exec(line);
    if(m)potential.add(m[1].replace(/\s+/g,' '));
   }
}


// Prefer the full publication footer over a multi-line graphic cover or
// narrative references to underlying investments. Both footer orientations
// ("4 Capital Group ..." and "Capital Group ... 5") are supported.
function identifyFundEarly_capital_group(pages,profile,head){
 const names=new Set();
 for(const page of pages.slice(1,9)){
  for(const raw of String(page.text||'').split(/\r?\n/)){
   const candidate=raw.trim().replace(/^\d{1,2}\s+/,'').replace(/\s+\d{1,2}$/,'').replace(/[®™]/g,'').replace(/\s+/g,' ');
   if(/^Capital Group\s+[A-Za-z][\w\s-]{7,115}\s+(?:Fund|ETF)\s*\(Canada\)$/i.test(candidate))names.add(candidate);
  }
  if(names.size===1)return [...names][0];
  if(names.size>1)return 'Unknown Fund';
 }
 return undefined;
}
function selectReportDate_capital_group(pages){
 // Reporting periods on cover and in ratio table must agree; the generic
 // date reader prioritizes the cover's "Six Months Ended" headline.
 const date=reportDate(pages);
 return date;
}
function capitalGroupFinancialRowTokens(tail,isEtf){
 const cells=String(tail||'').match(/(?:\$\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?|[—–−-]/g)||[];
 if(cells.length!==(isEtf?8:7))return null;
 // Assets, units, actual MER, before-waivers MER, Trading expenses,
 // portfolio turnover, NAV, [ETF closing market price].
 const parse=s=>toNumber(s.replace(/^\$\s*/,''));
 const values=cells.map(parse);
 if(values[0]===null||values[1]===null||values[6]===null||
    values.some(v=>v!==null&&(!Number.isFinite(v)||v<0))||
    values[2]!==null&&values[2]>100||values[5]!==null&&values[5]>1000)return null;
 return {MER:values[2],TER:null,PTR:values[5]};
}
function extract_capital_group(pages,profile,fund,date){
 if(!/^Capital Group\s+.+\s+(?:Fund|ETF)\s*\(Canada\)$/i.test(fund||'')||
    !/^20\d\d-\d\d-\d\d$/.test(date||''))return [];
 const isEtf=/\bETF\s*\(Canada\)$/i.test(fund),out=new Map(),conflicts=new Set();
 for(const pg of pages){
  const text=String(pg.text||'');
  if(!/\bRatios and Supplemental Data\b/i.test(text)||
     !text.toLowerCase().includes(fund.toLowerCase()))continue;
  const lines=text.split(/\r?\n/);
  const index=lines.findIndex(l=>/^Ratios and Supplemental Data\b/i.test(l.trim()));
  if(index<0)continue;
  const header=lines.slice(index,index+12).join(' ');
  // Verify the complete printed column order. The MER and the second MER
  // before waivers may have identical numbers but are NOT interchangeable.
  if(!/Management\s+Before Waivers or\s+Trading\s+Portfolio\s+Net Asset/i.test(header)||
     !/Expense Ratio\s+Absorptions\s+Expense Ratio\s+Turnover Rate/i.test(header))continue;
  let cls=isEtf?'ETF Units':null;
  for(let i=index+1;i<lines.length;i++){
   const s=lines[i].trim();
   if(/^Refer to page\b/i.test(s)||/^(?:Management Fees|Past Performance)\b/i.test(s))break;
   const heading=/^Series\s+([A-Z](?:\d+)?)(?:\s*\d+(?:,\d+)*)?\s*$/i.exec(s);
   if(heading){cls=isEtf?null:'Series '+heading[1].toUpperCase();continue;}
   const m=/^(?:Period|Year) ended\s+(\d{1,2})\/(\d{1,2})\/(20\d{2})\s+(.+)$/i.exec(s);
   if(!m||!cls)continue;
   const printed=`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
   if(printed!==date)continue;
   const values=capitalGroupFinancialRowTokens(m[4],isEtf);
   if(!values)continue;
   const found={cls,values,quality:3,evidence:{
     ...(values.MER!==null?{MER:{page:pg.page,source:'Current-period Management Expense Ratio column',method:'native-js'}}:{}),
     ...(values.PTR!==null?{PTR:{page:pg.page,source:'Current-period Portfolio Turnover Rate column',method:'native-js'}}:{})
   }};
   if(out.has(cls)&&JSON.stringify(out.get(cls).values)!==JSON.stringify(found.values))conflicts.add(cls);
   else out.set(cls,found);
  }
 }
 for(const cls of conflicts)out.delete(cls); // Conflicting disclosures fail closed.
 return [...out.values()];
}
function auditRatioHeadings_capital_group(pageText,potential){
 const text=String(pageText||'');if(!/Ratios and Supplemental Data/i.test(text))return;
 const section=text.slice(text.search(/Ratios and Supplemental Data/i));
 const series=[...section.matchAll(/^Series\s+([A-Z](?:\d+)?)(?:\s*\d+(?:,\d+)*)?\s*$/gim)];
 if(series.length)for(const m of series)potential.add('Series '+m[1].toUpperCase());
 else if(/\b(?:Period|Year) ended\s+\d{1,2}\/\d{1,2}\/20\d\d/i.test(section))potential.add('ETF Units');
}


function arrowCapitalNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-')
  .replace(/\s*-\s*/g,'-').replace(/\s+/g,' ').trim();
}
function arrowCapitalCompact(value){
 return arrowCapitalNormalize(value).toLowerCase().replace(/[^a-z0-9]/g,'');
}
function arrowCapitalTitleCase(value){
 const lower=String(value||'').toLowerCase();
 return lower.replace(/\b[a-z][a-z0-9']*/g,word=>
  /^(?:and|of|the|for|in|on|to|at|by)$/i.test(word)?word:word.charAt(0).toUpperCase()+word.slice(1));
}
function identifyFundEarly_arrow_capital(pages,profile,head){
 const candidates=new Set();
 for(const page of pages.slice(0,3)){
  for(const raw of String(page.text||'').split(/\r?\n/)){
   const line=String(raw||'').trim().replace(/\s+/g,' ');
   if(!/^[A-Z][A-Z0-9&'’().,\- ]{8,140}\bFUND$/.test(line))continue;
   if(/\b(?:ANNUAL|SEMI-ANNUAL|MANAGEMENT REPORT|FUND PERFORMANCE|FINANCIAL STATEMENTS|FINANCIAL HIGHLIGHTS)\b/.test(line))continue;
   candidates.add(line);
  }
 }
 if(candidates.size===1)return arrowCapitalTitleCase([...candidates][0]);
 if(candidates.size>1)return 'Unknown Fund';
 return undefined;
}
function selectReportDate_arrow_capital(pages){
 const text=pages.slice(0,6).map(page=>String(page.text||'')).join('\n');
 const monthMap={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
 const match=/\b(?:year|period)\s+ended\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(text);
 if(match)return `${match[3]}-${monthMap[match[1].slice(0,3).toLowerCase()]}-${match[2].padStart(2,'0')}`;
 return reportDate(pages);
}
function arrowCapitalSeriesHeading(line){
 const text=arrowCapitalNormalize(line).toUpperCase();
 const match=/^SERIES\s+([A-Z][A-Z0-9]*)\s*(?:\(\s*RE-DESIGNATED\s+FROM\s+([A-Z0-9][A-Z0-9 ]*?)\s*\))?$/.exec(text);
 if(!match)return null;
 const code=match[1].toUpperCase();
 const canonical=`Series ${code}`;
 const alias=match[2]?match[2].trim().replace(/\s+/g,' ').replace(/\bSERIES\b/i,'Series'):null;
 const display=alias?`${canonical} (re-designated from ${alias})`:canonical;
 return {cls:canonical,displayCls:display,aliases:alias?[alias]:[]};
}
function arrowCapitalYearHeader(lines,sectionIndex,year){
 const candidates=lines.slice(Math.max(0,sectionIndex-9),sectionIndex)
  .map(line=>({line,years:[...String(line).matchAll(/\b(20\d{2})\b/g)].map(match=>Number(match[1]))}))
  .filter(item=>item.years.length&&item.years[0]===year);
 return candidates.length?candidates[candidates.length-1].line:null;
}
function arrowCapitalFirstRatioCell(line,labelPattern){
 const text=arrowCapitalNormalize(line);
 const label=labelPattern.exec(text);
 if(!label)return {found:false,value:null};
 let tail=text.slice(label[0].length);
 // PDF.js may put a superscript footnote marker into the flattened row text.
 // Remove only a standalone small integer; never strip the leading ratio.
 tail=tail.replace(/^\s*(?:\(?\d{1,2}\)?)(?=\s|$)\s*/,'');
 const cell=/^\s*(N\/?A|[—–−-]{1,2}|(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?\s*%\*?)/i.exec(tail);
 if(!cell)return {found:false,value:null};
 const raw=cell[1].replace(/\s+/g,'');
 if(/^(?:N\/?A|[—–−-]{1,2})$/i.test(raw))return {found:true,value:null};
 // MER and PTR must be explicitly published as percentages in this table.
 if(!/%/.test(raw))return {found:false,value:null};
 const value=Number(raw.replace(/[,%*]/g,''));
 return {found:Number.isFinite(value)&&value>=0,value:Number.isFinite(value)&&value>=0?value:null};
}
function arrowCapitalRatioPage(page,fund,date){
 const text=String(page.text||'');
 if(!arrowCapitalCompact(text).includes(arrowCapitalCompact(fund))||
    !/Ratios\s+and\s+Supplemental\s+Data/i.test(text))return null;
 const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const sectionIndex=lines.findIndex(line=>/^Ratios\s+and\s+Supplemental\s+Data\b/i.test(line));
 if(sectionIndex<0)return null;
 const year=Number(String(date||'').slice(0,4));
 if(!year||!arrowCapitalYearHeader(lines,sectionIndex,year))return null;
 let heading=null;
 for(let i=sectionIndex-1;i>=Math.max(0,sectionIndex-10);i--){
  const parsed=arrowCapitalSeriesHeading(lines[i]);
  if(parsed){heading=parsed;break;}
 }
 if(!heading)return null;
 const merLine=lines.slice(sectionIndex+1).find(line=>
  /^Management\s+expense\s+ratio(?=\s|$|\d)(?!\s+before\b)/i.test(line));
 const ptrLine=lines.slice(sectionIndex+1).find(line=>/^Portfolio\s+turnover\s+rate(?=\s|$|\d)/i.test(line));
 const mer=merLine?arrowCapitalFirstRatioCell(merLine,/^Management\s+expense\s+ratio(?=\s|$|\d)(?!\s+before\b)/i):{found:false,value:null};
 const ptr=ptrLine?arrowCapitalFirstRatioCell(ptrLine,/^Portfolio\s+turnover\s+rate(?=\s|$|\d)/i):{found:false,value:null};
 if(!mer.found&&!ptr.found)return null;
 return {cls:heading.cls,displayCls:heading.displayCls,aliases:heading.aliases,quality:3,
  values:{MER:mer.found?mer.value:null,TER:null,PTR:ptr.found?ptr.value:null},
  evidence:{
   ...(mer.found&&mer.value!==null?{MER:{page:page.page,source:'Current-period Management Expense Ratio (MER) row',method:'native-js'}}:{}),
   ...(ptr.found&&ptr.value!==null?{PTR:{page:page.page,source:'Current-period Portfolio Turnover Rate row',method:'native-js'}}:{})
  }};
}
function extract_arrow_capital(pages,profile,fund,date){
 if(!fund||fund==='Unknown Fund'||!/^20\d\d-\d\d-\d\d$/.test(date||''))return [];
 const bySeries=new Map(),conflicts=new Set();
 for(const page of pages){
  const found=arrowCapitalRatioPage(page,fund,date);if(!found)continue;
  const old=bySeries.get(found.cls);
  if(!old)bySeries.set(found.cls,found);
  else if(JSON.stringify(old.values)!==JSON.stringify(found.values)||old.displayCls!==found.displayCls)conflicts.add(found.cls);
 }
 for(const cls of conflicts)bySeries.delete(cls);
 return [...bySeries.values()];
}
function auditRatioHeadings_arrow_capital(pageText,potential){
 const text=String(pageText||'');if(!/Ratios\s+and\s+Supplemental\s+Data/i.test(text))return;
 for(const line of text.split(/\r?\n/)){
  const heading=arrowCapitalSeriesHeading(line.trim());
  if(heading)potential.add(heading.cls);
 }
}


// Normalize text without changing the class identity or collapsing combined headings.
function guardianNormalize(s){return String(s||'').normalize('NFKC').replace(/\u00ad/g,'').replace(/\s+/g,' ').trim();}
function guardianCompact(s){return guardianNormalize(s).toLowerCase().replace(/[^a-z0-9]/g,'');}
function guardianClassName(s){
 let value=guardianNormalize(s).replace(/^(?:Series|Class)\s+/i,m=>m[0].toUpperCase()+m.slice(1));
 // Parenthetical "formerly ..." text is a product alias, not a second class.
 value=value.replace(/\s*\(formerly\b[^)]*\)\s*$/i,'').trim();
 return value;
}
function guardianClassFromHeading(line){
 const text=guardianNormalize(line);
 const m=/^Ratios?\s+(?:and|&)\s+Supplemental\s+Data\s*\((.+)\)\s*$/i.exec(text);
 if(!m)return null;
 const cls=guardianClassName(m[1]);
 return cls||null;
}
function classHeading_guardian(line){
 const t=guardianNormalize(line);
 const m=/^((?:Series|Class)\s+[A-Z0-9][A-Z0-9\s&/'-]*|(?:ETF|CAD|USD)\s+(?:Units?|Series)|[A-Z][A-Z0-9-]*\s+(?:Shares?|Units?))(?:\s+\(formerly\b.*\))?$/i.exec(t);
 return m?guardianClassName(m[1]):null;
}
function guardianClassNearHeading(lines,index){
 for(let i=index-1;i>=Math.max(0,index-10);i--){
  const m=/Net Assets per Unit\s*\((.+)\)\s*$/i.exec(guardianNormalize(lines[i]));
  if(m){const cls=guardianClassName(m[1]);if(cls)return cls;}
 }
 for(let i=index+1;i<Math.min(lines.length,index+4);i++){
  const cls=classHeading_guardian(lines[i]);
  if(cls)return cls;
 }
 return null;
}
function guardianMetric(line,key){
 const t=guardianNormalize(line);
 const label=key==='MER'?/^Management\s+expense\s+ratio\b/i:/^Portfolio\s+turnover\s+(?:rate|ratio)\b/i;
 const m=label.exec(t);if(!m)return {found:false,value:null};
 if(key==='MER'&&/\bbefore\s+waivers\b|\babsorptions\b/i.test(t))return {found:false,value:null};
 let tail=t.slice(m[0].length).replace(/^\s*(?:(?:\[\d+\])|(?:\(\d+\))|(?:\(\s*%\s*\)))\s*/,'').trim();
 const token=/(?:N\/?A|[—–−-]{1,2}|-?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*%?)/i.exec(tail);
 if(token){
  const raw=token[0].replace(/\s/g,'');
  if(/^(?:N\/?A|[—–−-]{1,2})$/i.test(raw))return {found:true,value:null};
  const n=Number(raw.replace(/[,%]/g,''));
  return {found:true,value:Number.isFinite(n)?n:null};
 }
 return {found:false,value:null};
}
function guardianDateText(date){
 const m=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(date||'');if(!m)return null;
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 return `${months[Number(m[2])-1]} ${Number(m[3])}, ${m[1]}`;
}
function guardianDateColumnCenter(items,sectionY,iso){
 if(!Array.isArray(items))return null;
 const month=['January','February','March','April','May','June','July','August','September','October','November','December'][Number(iso[2])-1];
 const monthPrefix=month.slice(0,3)+'[a-z]*';
 const day=Number(iso[3]),year=iso[1];
 const fullRx=new RegExp('^'+monthPrefix+'\\.?\\s+'+day+',?\\s+'+year+'$','i');
 const monthDayRx=new RegExp('^'+monthPrefix+'\\.?\\s+'+day+',?$','i');
 const monthOnlyRx=new RegExp('\\b'+monthPrefix+'\\b','i');
 const dayYearRx=new RegExp('^'+day+',?\\s+'+year+'$','i');
 const yearRx=new RegExp('^'+year+'$');
 const nearby=items.filter(it=>Number.isFinite(it.x)&&Number.isFinite(it.y)&&it.y<sectionY&&sectionY-it.y<145);
 const center=it=>it.x+(Number(it.w)||0)/2;
 const direct=nearby.filter(it=>fullRx.test(guardianNormalize(it.str)));
 if(direct.length===1)return center(direct[0]);
 if(direct.length>1)return null;
 const dateItems=nearby.filter(it=>monthDayRx.test(guardianNormalize(it.str)));
 const monthItems=nearby.filter(it=>monthOnlyRx.test(guardianNormalize(it.str)));
 const dayYearItems=nearby.filter(it=>dayYearRx.test(guardianNormalize(it.str)));
 const yearItems=nearby.filter(it=>yearRx.test(guardianNormalize(it.str)));
 const centers=[];
 for(const d of dateItems)for(const y of yearItems)
  if(Math.abs(center(d)-center(y))<22&&Math.abs(d.y-y.y)<40)centers.push(center(y));
 for(const m of monthItems)for(const dy of dayYearItems)
  if(Math.abs(center(m)-center(dy))<22&&Math.abs(m.y-dy.y)<40)centers.push(center(dy));
 const unique=[...new Set(centers.map(x=>Math.round(x*10)/10))];
 return unique.length===1?unique[0]:null;
}
function guardianHasCurrentPeriod(block,date,page,sectionHeading){
 const wanted=guardianDateText(date);
 if(!wanted)return false;
 const compact=s=>guardianNormalize(s).replace(/[,]/g,'').toLowerCase();
 if(compact(block).includes(compact(wanted)))return true;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(date||'');
 if(!iso||!Array.isArray(page?.items))return false;
 const month=['January','February','March','April','May','June','July','August','September','October','November','December'][Number(iso[2])-1];
 const heading=guardianNormalize(sectionHeading||'');
 const section=page.items.find(it=>guardianNormalize(it.str)===heading&&/Ratios?\s+(?:and|&)\s+Supplemental\s+Data/i.test(it.str))
  ||page.items.find(it=>/Ratios?\s+(?:and|&)\s+Supplemental\s+Data/i.test(String(it.str||'')));
 if(section&&Number.isFinite(guardianDateColumnCenter(page.items,section.y,iso)))return true;
 // Some multi-column annual headers interleave text from adjacent columns,
 // so month/day and year are not contiguous in the flattened text stream.
 // Keep this fallback scoped to the same ratio-table block and the report's
 // exact month/day/year; evidence still requires an aligned source column.
 const blockText=guardianNormalize(block);
 const monthDayRx=new RegExp(month.slice(0,3)+'[a-z]*\\.?\\s+'+Number(iso[3])+',?','i');
 return monthDayRx.test(blockText)&&new RegExp('\\b'+iso[1]+'\\b').test(blockText);
}
function guardianRatioSections(pages,fund,date){
 const sections=[];
 for(const page of pages){
  const lines=String(page.text||'').split(/\r?\n/).map(guardianNormalize);
  for(let i=0;i<lines.length;i++){
   if(!/^Ratios?\s+(?:and|&)\s+Supplemental\s+Data\b/i.test(lines[i]))continue;
   const next=i+1;let end=next;
   while(end<lines.length&&!/^Ratios?\s+(?:and|&)\s+Supplemental\s+Data\b/i.test(lines[end]))end++;
   const block=lines.slice(i,end).join('\n');
   if(!guardianHasCurrentPeriod(block,date,page,lines[i]))continue;
   let cls=guardianClassFromHeading(lines[i])||guardianClassNearHeading(lines,i);
   sections.push({page,lines,headingIndex:i,endIndex:end,block,cls});
  }
 }
 // A genuine single fund-level ratio table may omit any Series/Class heading.
 // Do not invent a class when a multi-table document makes the identity ambiguous.
 if(sections.length===1&&!sections[0].cls)sections[0].cls='Fund';
 return sections.filter(s=>s.cls);
}
function extract_guardian(pages,p,fund,date){
 const reportDateValue=date||reportDate(pages);
 if(!reportDateValue||!fund||fund==='Unknown Fund')return [];
 const sections=guardianRatioSections(pages,fund,reportDateValue);
 const byClass=new Map();
 for(const section of sections){
  const values={MER:null,TER:null,PTR:null},evidence={};
  let seen=0;
  for(const key of ['MER','PTR']){
   const labelRx=key==='MER'?/^Management\s+expense\s+ratio\b/i:/^Portfolio\s+turnover\s+(?:rate|ratio)\b/i;
   const line=section.lines.slice(section.headingIndex+1,section.endIndex)
    .find(t=>labelRx.test(t)&&!(key==='MER'&&/\bbefore\s+waivers\b|\babsorptions\b/i.test(t)));
   if(!line)continue;
   const parsed=guardianMetric(line,key);
   if(!parsed.found)continue;
   values[key]=parsed.value;seen++;
   evidence[key]={page:section.page.page,source:`${key} (Guardian current-period ratio table)`,method:'native-js'};
  }
  if(!seen)continue;
  const old=byClass.get(section.cls);
  if(!old)byClass.set(section.cls,{cls:section.cls,values,evidence,quality:3});
  else{
   for(const key of ['MER','PTR']){
    if(!Object.hasOwn(old.evidence,key)&&Object.hasOwn(evidence,key)){
     old.values[key]=values[key];old.evidence[key]=evidence[key];
    }else if(Object.hasOwn(old.evidence,key)&&Object.hasOwn(evidence,key)&&old.values[key]!==values[key]){
     delete old.evidence[key];old.values[key]=null;
    }
   }
  }
 }
 return [...byClass.values()];
}
function auditRatioHeadings_guardian(source,potential){
 const lines=String(source||'').split(/\r?\n/);
 for(const line of lines){
  const cls=guardianClassFromHeading(line);
  if(cls)potential.add(cls);
 }
}


function beutelGoodmanNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();
}
function beutelGoodmanCompact(value){
 return beutelGoodmanNormalize(value).toLowerCase().replace(/[^a-z0-9]/g,'');
}
function beutelGoodmanClassHeading(line){
 const match=/^Class\s+([A-Z0-9][A-Z0-9-]*)\s+Units?$/i.exec(beutelGoodmanNormalize(line));
 return match?'Class '+match[1].toUpperCase():null;
}
function classHeading_beutel_goodman(line){return beutelGoodmanClassHeading(line);}
function identifyFundEarly_beutel_goodman(pages,profile,head){
 const candidates=new Set();
 for(const page of (pages||[]).slice(0,3)){
  for(const raw of String(page.text||'').split(/\r?\n/)){
   const line=beutelGoodmanNormalize(raw);
   const match=/^Beutel\s+Goodman\s*(.{2,130}\b(?:Fund|ETF))$/i.exec(line);
   if(match&&!/^Managed\s+Funds$/i.test(match[1].trim()))candidates.add('Beutel Goodman '+match[1].trim());
  }
 }
 if(candidates.size===1)return [...candidates][0];
 if(candidates.size>1)return 'Unknown Fund';
 return undefined;
}
function selectReportDate_beutel_goodman(pages){
 const text=(pages||[]).slice(0,9).map(page=>String(page.text||'')).join('\n');
 const match=/\b(?:Interim|Annual)\s+Management\s+Report\s+of\s+Fund\s+Performance\s+as\s+of\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(text);
 if(match){
  const months={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};
  return `${match[3]}-${months[match[1].toLowerCase()]}-${match[2].padStart(2,'0')}`;
 }
 return reportDate(pages);
}
function beutelGoodmanCurrentHeader(lines,index,date){
 const match=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(date||'');
 if(!match)return null;
 const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const month=monthNames[Number(match[2])-1];
 if(!month)return null;
 for(let i=index+1;i<Math.min(lines.length,index+9);i++){
  const line=beutelGoodmanNormalize(lines[i]);
  const dateRx=new RegExp('\\b'+month+'\\s+'+match[1]+'\\b','i');
  if(!dateRx.test(line))continue;
  const years=[...line.matchAll(/\b(20\d{2})\b/g)].map(item=>Number(item[1]));
  if(!years.length||years[0]!==Number(match[1]))continue;
  // The header must include the current period and historical year columns.
  if(years.length<2||years.slice(1).some((year,i)=>year>=years[i]))continue;
  return {line,index:i,yearCount:years.length};
 }
 return null;
}
function beutelGoodmanRatioTokens(text){
 const tokens=[];
 const rx=/(?:^|\s)(N\/?A|[—–−-]{1,2}|(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?\s*%)(?=\s|$)/gi;
 let match;
 while((match=rx.exec(String(text||''))))tokens.push(match[1].replace(/\s+/g,''));
 return tokens;
}
function beutelGoodmanReadMetric(lines,index,expectedCount,key){
 const labelRx=key==='MER'?/^Management\s+expense\s+ratio\b(?!\s+before\b)/i:/^Portfolio\s+turnover\s+rate\b/i;
 if(!labelRx.test(beutelGoodmanNormalize(lines[index])))return {found:false,value:null};
 let combined=beutelGoodmanNormalize(lines[index]);
 let tokens=beutelGoodmanRatioTokens(combined.replace(labelRx,''));
 // A few PDF.js versions may place the row's cells on the following text line.
 for(let i=index+1;tokens.length<expectedCount&&i<Math.min(lines.length,index+4);i++){
  if(/^(?:Management\s+expense\s+ratio|Portfolio\s+turnover\s+rate|Trading\s+expense\s+ratio)\b/i.test(beutelGoodmanNormalize(lines[i])))break;
  combined+=' '+beutelGoodmanNormalize(lines[i]);
  tokens=beutelGoodmanRatioTokens(combined.replace(labelRx,''));
 }
 if(tokens.length!==expectedCount)return {found:false,value:null};
 const first=tokens[0];
 if(/^(?:N\/?A|[—–−-]{1,2})$/i.test(first))return {found:true,value:null};
 const value=Number(first.replace(/[,%]/g,''));
 return {found:Number.isFinite(value)&&value>=0, value:Number.isFinite(value)&&value>=0?value:null};
}
function beutelGoodmanRatioPage(page,fund,date){
 const text=String(page.text||'');
 if(!beutelGoodmanCompact(text).includes(beutelGoodmanCompact(fund))||
    !/Ratios\s+and\s+Supplemental\s+Data/i.test(text))return null;
 const lines=text.split(/\r?\n/).map(beutelGoodmanNormalize).filter(Boolean);
 const sectionIndexes=[];
 for(let i=0;i<lines.length;i++)if(/^Ratios\s+and\s+Supplemental\s+Data$/i.test(lines[i]))sectionIndexes.push(i);
 if(sectionIndexes.length!==1)return null;
 const sectionIndex=sectionIndexes[0];
 let cls=null;
 for(let i=sectionIndex+1;i<Math.min(lines.length,sectionIndex+6);i++){
  cls=beutelGoodmanClassHeading(lines[i]);
  if(cls)break;
  if(/^\(/.test(lines[i]))continue;
 }
 if(!cls)return null;
 const header=beutelGoodmanCurrentHeader(lines,sectionIndex,date);
 if(!header)return null;
 const merIndexes=[],ptrIndexes=[];
 for(let i=header.index+1;i<Math.min(lines.length,header.index+18);i++){
  if(/^Management\s+expense\s+ratio\b(?!\s+before\b)/i.test(lines[i]))merIndexes.push(i);
  if(/^Portfolio\s+turnover\s+rate\b/i.test(lines[i]))ptrIndexes.push(i);
 }
 if(merIndexes.length!==1||ptrIndexes.length!==1)return null;
 const mer=beutelGoodmanReadMetric(lines,merIndexes[0],header.yearCount,'MER');
 const ptr=beutelGoodmanReadMetric(lines,ptrIndexes[0],header.yearCount,'PTR');
 if(!mer.found&&!ptr.found)return null;
 return {cls,quality:3,values:{MER:mer.found?mer.value:null,TER:null,PTR:ptr.found?ptr.value:null},
  evidence:{
   ...(mer.found&&mer.value!==null?{MER:{page:page.page,source:'Current-period Management Expense Ratio row',method:'native-js'}}:{}),
   ...(ptr.found&&ptr.value!==null?{PTR:{page:page.page,source:'Current-period Portfolio Turnover Rate row',method:'native-js'}}:{})
  }};
}
function extract_beutel_goodman(pages,profile,fund,date){
 if(!fund||fund==='Unknown Fund'||!/^20\d\d-\d\d-\d\d$/.test(date||''))return [];
 const byClass=new Map(),conflicts=new Set();
 for(const page of pages||[]){
  const found=beutelGoodmanRatioPage(page,fund,date);if(!found)continue;
  const old=byClass.get(found.cls);
  if(!old)byClass.set(found.cls,found);
  else if(JSON.stringify(old.values)!==JSON.stringify(found.values))conflicts.add(found.cls);
 }
 for(const cls of conflicts)byClass.delete(cls);
 return [...byClass.values()];
}
function auditRatioHeadings_beutel_goodman(pageText,potential){
 const lines=String(pageText||'').split(/\r?\n/).map(beutelGoodmanNormalize);
 for(let i=0;i<lines.length;i++){
  if(!/^Ratios\s+and\s+Supplemental\s+Data$/i.test(lines[i]))continue;
  for(let j=i+1;j<Math.min(lines.length,i+6);j++){
   const cls=beutelGoodmanClassHeading(lines[j]);if(cls){potential.add(cls);break;}
  }
 }
}


function canadaLifeNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00a0\u200b\u00ad]/g,' ').replace(/\s+/g,' ').trim();
}
function canadaLifeCompact(value){
 return canadaLifeNormalize(value).toLowerCase().replace(/[^a-z0-9]/g,'');
}
function canadaLifeClassFromHeader(line){
 const text=canadaLifeNormalize(line?.text||'');
 const match=/^(Premium\s+Series|[A-Z][A-Z0-9]{0,4}\s+Series|Series\s+[A-Z][A-Z0-9]{0,3})(?=\s+20\d{2}\b)/i.exec(text);
 return match?canadaLifeNormalize(match[1]):null;
}
function canadaLifeDateParts(value){
 const match=/^\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})\s*$/i.exec(canadaLifeNormalize(value));
 if(!match)return null;
 const months={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
 return {month:months[match[1].slice(0,3).toLowerCase()],day:Number(match[2])};
}
function canadaLifeTokenCenter(item){return Number(item?.x)+(Number(item?.w)||0)/2;}
function canadaLifeCurrentHeader(lines,header,yearItems,date){
 if(!yearItems.length||Number(yearItems[0].str.trim())!==Number(String(date||'').slice(0,4)))return null;
 const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date||'');if(!iso)return null;
 const month=iso[2],day=Number(iso[3]),year=Number(iso[1]);
 const candidates=lines.filter(line=>line.y>=header.y&&line.y-header.y<=20)
  .flatMap(line=>line.items)
  .map(item=>({item,parts:canadaLifeDateParts(item.str)}))
  .filter(entry=>entry.parts&&entry.parts.month===month&&entry.parts.day===day
    &&Math.abs(canadaLifeTokenCenter(entry.item)-canadaLifeTokenCenter(yearItems[0]))<22);
 return candidates.length===1?{x:canadaLifeTokenCenter(yearItems[0]),year}:null;
}
function canadaLifeTextLines(items){
 const output=[];
 for(const item of items||[]){
  if(typeof item.str!=='string'||!item.str.trim()||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;
  const height=Math.max(5,Number(item.h)||8);
  let line=output.find(candidate=>Math.abs(candidate.y-item.y)<Math.max(1.5,Math.min(2.8,height*.25)));
  if(!line){line={y:item.y,items:[]};output.push(line);}
  line.items.push({...item,h:height});
 }
 output.sort((a,b)=>b.y-a.y);
 for(const line of output){line.items.sort((a,b)=>a.x-b.x);line.text=line.items.map(item=>item.str).join(' ').replace(/\s+/g,' ').trim();}
 return output;
}
function canadaLifeMetricCells(line){
 const found=[];
 for(const item of line.items||[]){
  const raw=canadaLifeNormalize(item.str).replace(/\s+/g,'');
  if(!(Number(item.w)>0))continue;
  const missing=/^(?:n\/?a|[-–—−]{1,2})$/i.test(raw);
  const numeric=/^(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(raw);
  if(!missing&&!numeric)continue;
  const value=missing?null:Number(raw.replace('%',''));
  if(!missing&&!Number.isFinite(value))continue;
  found.push({value,isMissing:missing,raw,x:item.x,
   box:{x:Math.max(0,item.x-1),y:line.y-1,w:item.w+2,h:Math.max(6,item.h||8)+2}});
 }
 return found.sort((a,b)=>a.x-b.x);
}
function canadaLifeCellAtColumn(line,columnX){
 if(!line||!Number.isFinite(columnX))return null;
 const candidates=canadaLifeMetricCells(line).filter(cell=>{
  const center=cell.box?cell.box.x+cell.box.w/2:Number(cell.x);
  return Number.isFinite(center)&&Math.abs(center-columnX)<19;
 });
 return candidates.length===1?candidates[0]:null;
}
function canadaLifePageTables(page,fund,date){
 if(!page||!Array.isArray(page.items)||!page.items.length||page.ocrUsed)return [];
 if(!/RATIOS\s+AND\s+SUPPLEMENTAL\s+DATA/i.test(page.text||''))return [];
 const compactFund=canadaLifeCompact(fund);
 if(compactFund.length<12||!canadaLifeCompact((page.text||'').slice(0,900)).includes(compactFund))return [];
 const width=Number(page.width)||612,split=width/2,output=[];
 for(const [minX,maxX] of [[0,split-3],[split-3,width+3]]){
  const columnItems=page.items.filter(item=>Number.isFinite(item.x)&&item.x>=minX&&item.x<maxX);
  const lines=canadaLifeTextLines(columnItems);
  const headers=lines.map(line=>{
   const cls=canadaLifeClassFromHeader(line);
   const years=line.items.filter(item=>/^20\d{2}$/.test(String(item.str||'').trim())).sort((a,b)=>a.x-b.x);
   return cls&&years.length>=2?{line,cls,years}:null;
  }).filter(Boolean).filter(header=>canadaLifeCurrentHeader(lines,header.line,header.years,date));
  headers.sort((a,b)=>b.line.y-a.line.y);
  for(let index=0;index<headers.length;index++){
   const header=headers[index],next=headers[index+1];
   const lowerY=next?next.line.y:Math.max(0,header.line.y-175);
   const block=lines.filter(line=>line.y<header.line.y-2&&line.y>lowerY+2&&line.y>header.line.y-175);
   const merLines=block.filter(line=>/^Management\s+expense\s+ratio\s*\(\s*%\s*\)/i.test(line.text));
   const ptrLines=block.filter(line=>/^Portfolio\s+turnover\s+rate\s*\(\s*%\s*\)/i.test(line.text));
   if(merLines.length!==1||ptrLines.length!==1)continue;
   const currentX=canadaLifeTokenCenter(header.years[0]);
   const merCell=canadaLifeCellAtColumn(merLines[0],currentX);
   const ptrCell=canadaLifeCellAtColumn(ptrLines[0],currentX);
   if(!merCell||!ptrCell)continue;
   output.push({
    cls:header.cls,
    page:page.page,
    currentX,
    merLine:merLines[0],ptrLine:ptrLines[0],
    values:{MER:merCell.value??null,TER:null,PTR:ptrCell.value??null},
    evidence:{
     MER:{page:page.page,source:'Canada Life current-period Management Expense Ratio row',method:'native-js'},
     PTR:{page:page.page,source:'Canada Life current-period Portfolio Turnover Rate row',method:'native-js'}
    },
    quality:2
   });
  }
 }
 return output;
}
function extract_canada_life(pages,profile,fund,date){
 if(!fund||fund==='Unknown Fund'||!/^20\d{2}-\d{2}-\d{2}$/.test(date||''))return [];
 const rows=[],conflicts=new Set();
 for(const page of pages||[]){
  for(const found of canadaLifePageTables(page,fund,date)){
   const old=rows.find(row=>row.cls===found.cls);
   if(!old)rows.push(found);
   else if(old.values.MER!==found.values.MER||old.values.PTR!==found.values.PTR||old.page!==found.page)conflicts.add(found.cls);
  }
 }
 return rows.filter(row=>!conflicts.has(row.cls));
}


function cclNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();
}
function identifyFundEarly_ccl(pages,profile,head){
 const names=new Set();
 const rx=/\b(CC&L\s+[^()]{4,130}?\bFund)\s*\(\s*the\s+[“"']?Fund[”"']?\s*\)/gi;
 for(const page of (pages||[]).slice(0,4)){
  const text=String(page.text||'').replace(/\s+/g,' ');let m;
  while((m=rx.exec(text)))names.add(cclNormalize(m[1]));
 }
 if(names.size===1)return [...names][0];
 if(names.size>1)return 'Unknown Fund';
 // Cover-title fallback for future CC&L templates whose body omits the
 // conventional '(the Fund)' definition.
 const candidates=new Set();
 for(const page of (pages||[]).slice(0,3)){
  const lines=String(page.text||'').split(/\r?\n/).map(cclNormalize).filter(Boolean);
  for(let i=0;i<lines.length;i++){
   if(!/^CC&L\s+/i.test(lines[i]))continue;
   let candidate=lines[i];
   if(!/\bFund$/i.test(candidate)&&/^Fund$/i.test(lines[i+1]||''))candidate+=' Fund';
   if(/^CC&L\s+.{4,120}\bFund$/i.test(candidate))candidates.add(candidate);
  }
 }
 if(candidates.size===1)return [...candidates][0];
 return candidates.size>1?'Unknown Fund':undefined;
}
function selectReportDate_ccl(pages){return reportDate(pages);}

// The source PDFs contain a second, slightly offset text layer. Collapse only
// near-identical glyph runs; different columns and repeated historical values
// remain separate because their x positions differ.
function cclDeduplicateItems(items){
 const out=[];
 for(const item of (items||[])){
  if(typeof item.str!=='string'||!item.str.trim()||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;
  const normalized=cclNormalize(item.str).toLowerCase();
  const duplicate=out.find(old=>cclNormalize(old.str).toLowerCase()===normalized&&
   Math.abs(old.x-item.x)<1.15&&Math.abs(old.y-item.y)<2.25);
  if(!duplicate)out.push({...item,str:cclNormalize(item.str),h:Math.max(5,Number(item.h)||8),w:Math.max(0,Number(item.w)||0)});
 }
 return out.sort((a,b)=>b.y-a.y||a.x-b.x);
}
function cclBuildLines(items){
 const lines=[];
 for(const item of cclDeduplicateItems(items)){
  const h=Math.max(5,Number(item.h)||8);
  let line=lines.find(row=>Math.abs(row.y-item.y)<Math.max(1.0,Math.min(1.3,h*.15)));
  if(!line){line={y:item.y,items:[]};lines.push(line);}
  line.items.push(item);
 }
 for(const line of lines){
  line.items.sort((a,b)=>a.x-b.x);
  line.text=line.items.map(item=>item.str).join(' ').replace(/\s+/g,' ').trim();
  line.minX=Math.min(...line.items.map(item=>item.x));
  line.maxX=Math.max(...line.items.map(item=>item.x+item.w));
 }
 return lines.sort((a,b)=>b.y-a.y);
}
function cclSeriesFromLine(line){
 const left=line.items.filter(item=>item.x<285).map(item=>item.str).join(' ');
 const text=cclNormalize(left);
 const match=/^(Series|Class)\s+(.+)$/i.exec(text);
 if(!match||/\b(?:inception|date|units?|outstanding)\b/i.test(match[2]))return null;
 const suffix=cclNormalize(match[2]).replace(/\s*\(\d+\)\s*$/,'').trim();
 if(!suffix||suffix.length>45||/\b20\d{2}\b/.test(suffix))return null;
 return match[1][0].toUpperCase()+match[1].slice(1).toLowerCase()+' '+suffix;
}
function cclParseDateLabel(value){
 const match=/^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2}),?$/i.exec(cclNormalize(value));
 if(!match)return null;
 const months={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
 const month=months[match[1].slice(0,3).toLowerCase()];
 return {month,day:match[2].padStart(2,'0')};
}
function cclCenter(item){return item.x+(Number(item.w)||0)/2;}
function cclHeaderColumns(lines,heading){
 const years=heading.items.filter(item=>item.x>285&&/^20\d{2}$/.test(item.str.trim()));
 const dateItems=lines.filter(line=>line.y>heading.y+2&&line.y-heading.y<18)
  .flatMap(line=>line.items).map(item=>({item,date:cclParseDateLabel(item.str)})).filter(x=>x.date);
 const columns=[];
 for(const entry of dateItems){
  const center=cclCenter(entry.item);
  const nearby=years.map(item=>({item,distance:Math.abs(cclCenter(item)-center)})).filter(x=>x.distance<6).sort((a,b)=>a.distance-b.distance);
  if(nearby.length!==1)continue;
  const year=nearby[0].item.str.trim();
  const iso=`${year}-${entry.date.month}-${entry.date.day}`;
  if(!columns.some(column=>column.date===iso))columns.push({date:iso,center});
 }
 return columns.sort((a,b)=>a.center-b.center);
}
function cclSelectColumn(columns,reportDate){
 if(reportDate)return columns.find(column=>column.date===reportDate)||null;
 return [...columns].sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
}
function cclMetricLabel(line,key){
 const patterns={
  MER:/^Management\s+expense\s+ratio(?:\s*\(\d+\))?$/i,
  TER:/^Total\s+expense\s+ratio(?:s)?(?:\s*\(\d+\))?$/i,
  PTR:/^Portfolio\s+turnover\s+(?:rate|ratio)(?:\s*\(\d+\))?$/i
 };
 return line.items.find(item=>item.x<285&&patterns[key]?.test(cclNormalize(item.str)));
}
function cclCellTokens(item){
 const raw=cclNormalize(item.str).replace(/\s+/g,'');
 if(/^[—–−-]{1,2}$/.test(raw)||/^n\/?a$/i.test(raw))return [{value:null,isMissing:true,raw:raw||item.str,item}];
 const matches=[];
 const rx=/(?:^|[^\w.])((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?%)(?=$|[^\w])/g;
 let match;
 while((match=rx.exec(raw))){
  const token=match[1],value=Number(token.replace(/[,%]/g,''));
  if(!Number.isFinite(value)||value<0||value>1000)continue;
  const start=match.index+(match[0].length-token.length);
  const width=(Number(item.w)||raw.length*item.h*.45)*token.length/Math.max(1,raw.length);
  const x=item.x+(Number(item.w)||raw.length*item.h*.45)*start/Math.max(1,raw.length);
  matches.push({value,isMissing:false,raw:token,item,box:{x:Math.max(0,x-1),y:item.y-1,w:Math.max(1,width)+2,h:item.h+2},x});
 }
 return matches;
}
function cclMetricCell(line,label,column){
 if(!label||!column)return null;
 const candidates=line.items.filter(item=>item.x>label.x+label.w+5).flatMap(cclCellTokens)
  .filter(cell=>Math.abs((cell.x??cell.item.x+(cell.item.w||0)/2)-column.center)<24);
 if(candidates.length!==1)return null;
 const cell=candidates[0];
 if(cell.isMissing)return {...cell,box:{x:Math.max(0,cell.item.x-1),y:cell.item.y-1,w:Math.max(2,cell.item.w)+2,h:cell.item.h+2}};
 return cell;
}
function cclFindMetric(block,key){
 // Prefer the first (uppermost) correctly labelled row in this series block.
 // Some CC&L PDFs contain a second offset text layer; later copies can sit
 // lower on the page and must not override the visible current table row.
 for(const line of block){const label=cclMetricLabel(line,key);if(label)return {line,label};}
 return null;
}
function cclParseFinancialPage(page,reportDate){
 if(!Array.isArray(page.items)||!page.items.length||page.ocrUsed)return [];
 const lines=cclBuildLines(page.items);
 const sections=lines.filter(line=>/^Ratios\s*(?:&|and)\s*Supplemental\s+Data\s*:?$/i.test(line.text));
 if(sections.length!==1)return [];
 const section=sections[0];
 const headings=lines.filter(line=>line.y<section.y&&section.y-line.y<520&&cclSeriesFromLine(line))
  .map(line=>({line,cls:cclSeriesFromLine(line),columns:cclHeaderColumns(lines,line)}))
  .filter(item=>cclSelectColumn(item.columns,reportDate))
  .sort((a,b)=>b.line.y-a.line.y);
 const out=[];
 for(let i=0;i<headings.length;i++){
  const current=headings[i],next=headings[i+1];
  const block=lines.filter(line=>line.y<current.line.y-2&&(!next||line.y>next.line.y+2));
  const columns=cclHeaderColumns(lines,current.line);
  const column=cclSelectColumn(columns,reportDate);
  if(!column)continue;
  const merLine=cclFindMetric(block,'MER'),ptrLine=cclFindMetric(block,'PTR');
  if(!merLine&&!ptrLine)continue;
  const mer=merLine?cclMetricCell(merLine.line,merLine.label,column):null;
  const ptr=ptrLine?cclMetricCell(ptrLine.line,ptrLine.label,column):null;
  out.push({cls:current.cls,quality:merLine&&ptrLine?3:2,values:{MER:mer?.value??null,TER:null,PTR:ptr?.value??null},evidence:{
   ...(merLine?{MER:{page:page.page,source:'Current-period Management Expense Ratio row',method:'native-js'}}:{}),
   ...(ptrLine?{PTR:{page:page.page,source:'Current-period Portfolio Turnover Rate row',method:'native-js'}}:{})
  }});
 }
 return out;
}
function extract_ccl(pages,profile,fund,date){
 if(!fund||fund==='Unknown Fund'||!/^20\d{2}-\d{2}-\d{2}$/.test(date||''))return [];
 const bySeries=new Map(),conflicts=new Set();
 for(const page of pages||[]){
  if(!/Ratios\s*(?:&|and)\s*Supplemental\s+Data/i.test(page.text||''))continue;
  for(const row of cclParseFinancialPage(page,date)){
   const previous=bySeries.get(row.cls);
   if(!previous)bySeries.set(row.cls,row);
   else if(JSON.stringify(previous.values)!==JSON.stringify(row.values))conflicts.add(row.cls);
  }
 }
 for(const cls of conflicts)bySeries.delete(cls);
 return [...bySeries.values()];
}
function auditRatioHeadings_ccl(pageText,potential){
 const text=String(pageText||'');
 const ix=text.search(/Ratios\s*(?:&|and)\s*Supplemental\s+Data/i);if(ix<0)return;
 for(const line of text.slice(ix).split(/\r?\n/)){
  if(/inception|date:/i.test(line))continue;
  const prefix=/^\s*(Series|Class)\s+/i.exec(line);if(!prefix)continue;
  // PDF.js can duplicate the heading text on the same line (for example,
  // 'Series A Series A 2026 ...'). Stop at the first repeated heading token.
  const beforeYear=line.split(/\s+20\d{2}\b/)[0]||'';
  let suffix=cclNormalize(beforeYear.slice(prefix[0].length)).replace(/(?:Series|Class)\s+.*$/i,'').trim();
  suffix=suffix.replace(/\s*\(\d+\)\s*$/,'').trim();
  if(suffix&&suffix.length<=45)potential.add(prefix[1][0].toUpperCase()+prefix[1].slice(1).toLowerCase()+' '+suffix);
 }
}


function seiNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();
}
function identifyFundEarly_sei(pages){
 const first=String(pages?.[0]?.text||'').split(/\r?\n/).map(seiNormalize).filter(Boolean);
 if(first.length<2||!/(?:semi-annual|annual|interim)\s+management\s+report\s+of\s+fund\s+performance/i.test(first.slice(0,4).join(' ')))return undefined;
 const title=first[0];
 return /^[A-Z][A-Za-z0-9&'’()., /-]{3,120}\bFund$/i.test(title)?title:undefined;
}
function selectReportDate_sei(pages){return reportDate(pages);}
function seiDeduplicateItems(items){
 const out=[];
 for(const item of items||[]){
  if(typeof item.str!=='string'||!item.str.trim()||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;
  const normalized=seiNormalize(item.str).toLowerCase();
  if(out.some(old=>seiNormalize(old.str).toLowerCase()===normalized&&Math.abs(old.x-item.x)<1.15&&Math.abs(old.y-item.y)<2.25))continue;
  out.push({...item,str:seiNormalize(item.str),h:Math.max(5,Number(item.h)||8),w:Math.max(0,Number(item.w)||0)});
 }
 return out.sort((a,b)=>b.y-a.y||a.x-b.x);
}
function seiBuildLines(items){
 const lines=[];
 for(const item of seiDeduplicateItems(items)){
  let line=lines.find(row=>Math.abs(row.y-item.y)<Math.max(1.0,Math.min(1.5,item.h*.18)));
  if(!line){line={y:item.y,items:[]};lines.push(line);}
  line.items.push(item);
 }
 for(const line of lines){
  line.items.sort((a,b)=>a.x-b.x);
  line.text=line.items.map(item=>item.str).join(' ').replace(/\s+/g,' ').trim();
 }
 return lines.sort((a,b)=>b.y-a.y);
}
function seiClassFromLine(line){
 const left=seiNormalize((line.items||[]).filter(item=>item.x<190).map(item=>item.str).join(' '));
 const match=/^Class\s+([A-Za-z0-9][A-Za-z0-9 &/().-]{0,35}?)\s*\**$/i.exec(left);
 if(!match)return null;
 const suffix=seiNormalize(match[1]).replace(/\s+Units?$/i,'').trim();
 if(!suffix||suffix.length>35||/\b(?:inception|date|outstanding|units?)\b/i.test(suffix))return null;
 return 'Class '+suffix;
}
function seiYearItems(line){
 return (line.items||[]).filter(item=>item.x>200&&/^20\d{2}$/.test(seiNormalize(item.str)));
}
function seiIsRatioHeading(line){return /^RATIOS\s+AND\s+SUPPLEMENTAL\s+DATA\s*:?$/i.test(seiNormalize(line.text));}
function seiClassBlocks(lines,reportYear){
 const headings=lines.map(line=>({line,cls:seiClassFromLine(line)})).filter(item=>item.cls&&item.line.items.some(it=>it.x<150));
 const blocks=[];
 for(let i=0;i<headings.length;i++){
  const current=headings[i],next=headings[i+1],lower=next?.line.y??20;
  const header=lines.filter(line=>line.y<current.line.y&&line.y>lower&&current.line.y-line.y<45&&seiYearItems(line).length>=2)
   .sort((a,b)=>b.y-a.y)[0];
  if(!header)continue;
  const yearHits=seiYearItems(header).filter(item=>Number(seiNormalize(item.str))===reportYear);
  if(yearHits.length!==1)continue;
  const yearItem=yearHits[0],center=yearItem.x+(Number(yearItem.w)||0)/2;
  const section=lines.filter(line=>line.y<header.y&&line.y>lower&&seiIsRatioHeading(line)).sort((a,b)=>b.y-a.y)[0];
  if(!section)continue;
  blocks.push({cls:current.cls,heading:current.line,next:next?.line||null,lower,header,yearItem,center,section,
   metricLines:lines.filter(line=>line.y<section.y&&line.y>lower)});
 }
 return blocks;
}
function seiMetricLabel(line,key){
 const patterns={
  MER:/^Management\s+expense\s+ratio(?:\s*\([a-z0-9]{1,3}\))?$/i,
  PTR:/^Portfolio\s+turnover\s+(?:rate|ratio)(?:\s*\([a-z0-9]{1,3}\))?$/i
 };
 return (line.items||[]).find(item=>item.x<250&&patterns[key]?.test(seiNormalize(item.str)));
}
function seiValueTokens(item){
 const raw=seiNormalize(item.str).replace(/\s+/g,'');
 if(/^[—–−-]{1,2}$/.test(raw)||/^n\/?a$/i.test(raw))return [{value:null,isMissing:true,raw:raw||item.str,item,x:item.x+(Number(item.w)||0)/2,box:{x:Math.max(0,item.x-1),y:item.y-1,w:Math.max(2,item.w)+2,h:item.h+2}}];
 const out=[],rx=/(?:^|[^\w.])((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?%?)(?=$|[^\w])/g;let match;
 while((match=rx.exec(raw))){
  const token=match[1],value=Number(token.replace(/[,%]/g,''));
  if(!Number.isFinite(value)||value<0||value>1000)continue;
  const start=match.index+(match[0].length-token.length),width=(Number(item.w)||raw.length*item.h*.45)*token.length/Math.max(1,raw.length);
  const x=item.x+(Number(item.w)||raw.length*item.h*.45)*start/Math.max(1,raw.length);
  out.push({value,isMissing:false,raw:token,item,x:x+width/2,box:{x:Math.max(0,x-1),y:item.y-1,w:Math.max(1,width)+2,h:item.h+2}});
 }
 return out;
}
function seiMetricCell(line,label,center){
 if(!label||!Number.isFinite(center))return null;
 const hits=(line.items||[]).filter(item=>item.x>label.x+label.w+5).flatMap(seiValueTokens)
  .filter(cell=>Math.abs(cell.x-center)<16);
 if(hits.length!==1)return null;
 return hits[0];
}
function seiFindMetric(block,key){
 for(const line of block.metricLines){const label=seiMetricLabel(line,key);if(label)return {line,label};}
 return null;
}
function seiParseFinancialPage(page,reportYear){
 if(!Array.isArray(page.items)||!page.items.length||page.ocrUsed)return [];
 const lines=seiBuildLines(page.items);
 if(!lines.some(seiIsRatioHeading))return [];
 const out=[];
 for(const block of seiClassBlocks(lines,reportYear)){
  const merLine=seiFindMetric(block,'MER'),ptrLine=seiFindMetric(block,'PTR');
  if(!merLine&&!ptrLine)continue;
  const mer=merLine?seiMetricCell(merLine.line,merLine.label,block.center):null;
  const ptr=ptrLine?seiMetricCell(ptrLine.line,ptrLine.label,block.center):null;
  out.push({cls:block.cls,quality:merLine&&ptrLine?3:2,values:{MER:mer?.value??null,TER:null,PTR:ptr?.value??null},evidence:{
   ...(merLine?{MER:{page:page.page,source:'Latest-year Management Expense Ratio row',method:'native-js'}}:{}),
   ...(ptrLine?{PTR:{page:page.page,source:'Latest-year Portfolio Turnover Rate row',method:'native-js'}}:{})
  }});
 }
 return out;
}
function extract_sei(pages,profile,fund,date){
 if(!fund||fund==='Unknown Fund'||!/^20\d{2}-\d{2}-\d{2}$/.test(date||''))return [];
 const reportYear=Number(date.slice(0,4)),byClass=new Map(),conflicts=new Set();
 for(const page of pages||[]){
  if(!/Financial\s+Highlights|Ratios\s+and\s+Supplemental\s+Data/i.test(page.text||''))continue;
  for(const row of seiParseFinancialPage(page,reportYear)){
   const previous=byClass.get(row.cls);
   if(!previous)byClass.set(row.cls,row);
   else if(JSON.stringify(previous.values)!==JSON.stringify(row.values))conflicts.add(row.cls);
  }
 }
 for(const cls of conflicts)byClass.delete(cls);
 return [...byClass.values()];
}
function auditRatioHeadings_sei(pageText,potential){
 const lines=String(pageText||'').split(/\r?\n/).map(seiNormalize);
 for(let i=0;i<lines.length;i++){
  const match=/^Class\s+([A-Za-z0-9][A-Za-z0-9 &/().-]{0,35}?)\s*\**$/i.exec(lines[i]);
  if(!match)continue;
  let end=lines.length;
  for(let j=i+1;j<lines.length;j++)if(/^Class\s+[A-Za-z0-9]/i.test(lines[j])){end=j;break;}
  if(lines.slice(i+1,end).some(line=>/^RATIOS\s+AND\s+SUPPLEMENTAL\s+DATA\s*:?$/i.test(line))){
   const suffix=seiNormalize(match[1]).replace(/\s+Units?$/i,'').trim();
   if(suffix)potential.add('Class '+suffix);
  }
 }
}



const FMC_ADAPTERS=[
{key:"nbi",profile:nbi,extract:extract_nbi,config:fmcConfig_nbi,identifyFundEarly:identifyFundEarly_nbi,identifyFundLate:null,identifyFundFallback:identifyFundFallback_nbi,selectReportDate:null,auditRatioHeadings:null},
{key:"desjardins",profile:desjardins,extract:extract_desjardins,config:fmcConfig_desjardins,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"sun_life",profile:sunLife,extract:extract_sun_life,config:fmcConfig_sun_life,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"franklin",profile:franklin,extract:extract_franklin,config:fmcConfig_franklin,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"middlefield",profile:middlefield,extract:extract_middlefield,config:fmcConfig_middlefield,identifyFundEarly:null,identifyFundLate:identifyFundLate_middlefield,identifyFundFallback:null,selectReportDate:selectReportDate_middlefield,auditRatioHeadings:null},
{key:"manulife",profile:manulife,extract:extract_manulife,config:fmcConfig_manulife,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"dynamic",profile:dynamic,extract:extract_dynamic,config:fmcConfig_dynamic,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:auditRatioHeadings_dynamic},
{key:"purpose",profile:purpose,extract:extract_purpose,config:fmcConfig_purpose,identifyFundEarly:null,identifyFundLate:identifyFundLate_purpose,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"blackrock",profile:blackrock,extract:extract_blackrock,config:fmcConfig_blackrock,identifyFundEarly:null,identifyFundLate:identifyFundLate_blackrock,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"rbc",profile:rbc,extract:extract_rbc,config:fmcConfig_rbc,identifyFundEarly:identifyFundEarly_rbc,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"bmo",profile:bmo,extract:extract_bmo,config:fmcConfig_bmo,identifyFundEarly:identifyFundEarly_bmo,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:auditRatioHeadings_bmo},
{key:"bmg",profile:bmg,extract:extract_bmg,config:fmcConfig_bmg,identifyFundEarly:identifyFundEarly_bmg,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"first_trust",profile:firstTrust,extract:extract_first_trust,config:fmcConfig_first_trust,identifyFundEarly:null,identifyFundLate:identifyFundLate_first_trust,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"td",profile:profile_td,extract:extract_td,config:fmcConfig_td,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"lysander",profile:profile_lysander,extract:extract_lysander,config:fmcConfig_lysander,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"nei",profile:profile_nei,extract:extract_nei,config:fmcConfig_nei,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"mackenzie",profile:profile_mackenzie,extract:extract_mackenzie,config:fmcConfig_mackenzie,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"ig_mackenzie",profile:profile_ig_mackenzie,extract:extract_ig_mackenzie,config:fmcConfig_ig_mackenzie,identifyFundEarly:null,identifyFundLate:identifyFundLate_ig_mackenzie,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"fidelity",profile:profile_fidelity,extract:extract_fidelity,config:fmcConfig_fidelity,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"pender",profile:profile_pender,extract:extract_pender,config:fmcConfig_pender,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"brandes",profile:profile_brandes,extract:extract_brandes,config:fmcConfig_brandes,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:selectReportDate_brandes,auditRatioHeadings:null},
{key:"agf",profile:profile_agf,extract:extract_agf,config:fmcConfig_agf,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"harvest",profile:profile_harvest,extract:extract_harvest,config:fmcConfig_harvest,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"vanguard",profile:profile_vanguard,extract:extract_vanguard,config:fmcConfig_vanguard,identifyFundEarly:null,identifyFundLate:identifyFundLate_vanguard,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"ninepoint",profile:profile_ninepoint,extract:extract_ninepoint,config:fmcConfig_ninepoint,identifyFundEarly:identifyFundEarly_ninepoint,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"global_x",profile:profile_global_x,extract:extract_global_x,config:fmcConfig_global_x,identifyFundEarly:null,identifyFundLate:identifyFundLate_global_x,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"cibc",profile:profile_cibc,extract:extract_cibc,config:fmcConfig_cibc,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"hamilton",profile:profile_hamilton,extract:extract_hamilton,config:fmcConfig_hamilton,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"newgen",profile:profile_newgen,extract:extract_newgen,config:fmcConfig_newgen,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"rpia",profile:profile_rpia,extract:extract_rpia,config:fmcConfig_rpia,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"leith_wheeler",profile:profile_leith_wheeler,extract:extract_leith_wheeler,config:fmcConfig_leith_wheeler,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"ci",profile:profile_ci,extract:extract_ci,config:fmcConfig_ci,identifyFundEarly:identifyFundEarly_ci,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:auditRatioHeadings_ci},
{key:"scotia",profile:profile_scotia,extract:extract_scotia,config:fmcConfig_scotia,identifyFundEarly:null,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:auditRatioHeadings_scotia},
{key:"capital_group",profile:profile_capital_group,extract:extract_capital_group,config:fmcConfig_capital_group,identifyFundEarly:identifyFundEarly_capital_group,identifyFundLate:null,identifyFundFallback:null,selectReportDate:selectReportDate_capital_group,auditRatioHeadings:auditRatioHeadings_capital_group},
{key:"arrow_capital",profile:profile_arrow_capital,extract:extract_arrow_capital,config:fmcConfig_arrow_capital,identifyFundEarly:identifyFundEarly_arrow_capital,identifyFundLate:null,identifyFundFallback:null,selectReportDate:selectReportDate_arrow_capital,auditRatioHeadings:auditRatioHeadings_arrow_capital},
{key:"guardian",profile:profile_guardian,extract:extract_guardian,config:fmcConfig_guardian,identifyFundEarly:identifyFundEarly_guardian,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:auditRatioHeadings_guardian},
{key:"beutel_goodman",profile:profile_beutel_goodman,extract:extract_beutel_goodman,config:fmcConfig_beutel_goodman,identifyFundEarly:identifyFundEarly_beutel_goodman,identifyFundLate:null,identifyFundFallback:null,selectReportDate:selectReportDate_beutel_goodman,auditRatioHeadings:auditRatioHeadings_beutel_goodman},
{key:"canada_life",profile:profile_canada_life,extract:extract_canada_life,config:fmcConfig_canada_life,identifyFundEarly:identifyFundEarly_canada_life,identifyFundLate:null,identifyFundFallback:null,selectReportDate:null,auditRatioHeadings:null},
{key:"ccl",profile:profile_ccl,extract:extract_ccl,config:fmcConfig_ccl,identifyFundEarly:identifyFundEarly_ccl,identifyFundLate:null,identifyFundFallback:null,selectReportDate:selectReportDate_ccl,auditRatioHeadings:auditRatioHeadings_ccl},
{key:"sei",profile:profile_sei,extract:extract_sei,config:fmcConfig_sei,identifyFundEarly:identifyFundEarly_sei,identifyFundLate:null,identifyFundFallback:null,selectReportDate:selectReportDate_sei,auditRatioHeadings:auditRatioHeadings_sei}
];
const FMC_ADAPTERS_BY_KEY=Object.fromEntries(FMC_ADAPTERS.map(x=>[x.key,x]));
const FMC_CLASS_HEADING_BY_STYLE=Object.fromEntries([[nbi.style,classHeading_nbi],[desjardins.style,classHeading_desjardins],[sunLife.style,classHeading_sun_life],[franklin.style,classHeading_franklin],[middlefield.style,classHeading_middlefield],[manulife.style,classHeading_manulife],[dynamic.style,classHeading_dynamic],[purpose.style,classHeading_purpose],[rbc.style,classHeading_rbc],[profile_guardian.style,classHeading_guardian],[profile_beutel_goodman.style,classHeading_beutel_goodman]]);
const REGISTRY=FMC_ADAPTERS.map(x=>x.profile);
/* Generated-build input: keep declaration order in dev-tools/fmc-manifest.json. */
// Many issuers append an explanatory alias to the printed product title,
// e.g. 'Portfolio (the “Fund”)'. Normalize ONLY a trailing alias, never
// arbitrary report prose or securities mentioned in the holdings section.
function reportTitleLine(raw){
  return String(raw||'').trim().replace(/\s+/g,' ')
    .replace(/\s*\(\s*(?:the|this)\s+[“”"'‘’]?(?:Fund|ETF|Portfolio|Pool)[“”"'‘’]?\s*\)\s*$/i,'')
    .trim();
}
function issuerTitleCandidate(pages,profile){
  const re=profile.title&&new RegExp(profile.title.source,profile.title.flags.replace(/g/g,''));
  const adapter=FMC_ADAPTERS_BY_KEY[profile.key];
  const prefix=adapter?.config?.issuerPrefix;
  const genericEnd=/(?:\bFund|\bPortfolio|\bETF|\bClass|\bPool)(?:[®™]|\.)?$/i;
  for(const pg of pages.slice(0,adapter?.config?.titleScanPages??3)){
    for(const raw of String(pg.text||'').split(/\r?\n/).slice(0,100)){
      const line=reportTitleLine(raw);
      if(line.length<12||line.length>190)continue;
      const m=re&&re.exec(line);
      if(m&&m[1]&&m[0].trim().length===line.length&&m[1].trim().length>=12)
        return {text:m[1].trim(),kind:'profile'};
      // The generic path insists on a complete branded product title, never
      // arbitrary mention of an issuer or a generic manager address.
      if(prefix?.test(line)&&genericEnd.test(line)&&!/(?:management\s+report|fund\s+performance|fund\s+facts|(?:the|this)\s+fund)/i.test(line))
        return {text:line,kind:'branded-title'};
    }
  }
  return null;
}
function detectFmc(pages){
  const head=pages.slice(0,3).map(p=>p.text).join('\n');
  const scores=REGISTRY.map(p=>({profile:p,signatureScore:p.signatures.reduce((s,x,i)=>s+(x.test(head)?(i?2:5):0),0)}));
  const strongOwners=scores.filter(s=>s.signatureScore>=5);
  const sorted=scores.map(({profile,signatureScore})=>{
    // A standalone issuer-branded product title is strong supporting evidence.
    // If a different manager is already strongly identified, don't let a
    // fund mentioned in its portfolio falsely take ownership of the report.
    // A zero-signature issuer cannot win against a different strongly matched manager.
    // Skip the otherwise wasted title scan, retaining identical detection scores.
    const canWin=signatureScore>0||strongOwners.length===0;
    const hasTitle=canWin&&Boolean(issuerTitleCandidate(pages,profile));
    const titleScore=hasTitle&&(signatureScore>0||!strongOwners.some(x=>x.profile.key!==profile.key))?5:0;
    return {profile,score:signatureScore+titleScore};
  }).sort((a,b)=>b.score-a.score);
  return sorted[0].score>=5 && sorted[0].score!==sorted[1]?.score ? sorted[0].profile : null;
}


// ---- src/shared/period.mjs ----
/* v6 FMC-dispatch extraction. The original fallback and row-shaping behavior are retained. */
function analyzePages(pages,{onProgress=()=>{}}={}){
 const p=detectFmc(pages);
 if(!p)return {results:[],diagnostics:[{warning:'Unrecognized or ambiguous FMC; no financial values guessed.'}],raw:[],profile:null};
 const fund=identifyFund(pages,p);
 const adapter=FMC_ADAPTERS_BY_KEY[p.key];
 const date=adapter?.selectReportDate?adapter.selectReportDate(pages):reportDate(pages);
 let parsed=adapter?adapter.extract(pages,p,fund,date):[];
 if(adapter?.config?.renameEmptyClasses&&!parsed.some(r=>/^(?:CAD|USD) Units$/i.test(r.cls||'')))parsed.forEach(r=>{if(!r.cls)r.cls=fund;});
 if(adapter?.config?.deduplicate)parsed=[...new Map(parsed.map(x=>[x.cls,x])).values()];
 if(!parsed.length&&adapter?.config?.allowRowFallback!==false)parsed=rowTable(pages,p);
 // TER has changed meaning at the office level: the legacy adapters' TER
 // cells are Trading Expense Ratios. Never expose them as Total Expense Ratio.
 // Re-detect only explicitly labelled, class/year-bound TOTAL expense cells.
 const rows=parsed.filter(r=>r.cls&&r.quality>=2).map(r=>{
  const values={...r.values,TER:null},evidence={...r.evidence};
  delete evidence.TER;
  const total=totalExpenseRatioSource(pages,{class_name:r.cls,fund_name:fund,report_date:date});
  if(total){
   values.TER=total.value;
   evidence.TER={page:total.page,source:'Total Expense Ratio (verified class and reporting-year column)',method:'native-js',totalExpenseValidated:true};
  }
  return makeRow(r.cls,p,fund,date,values,evidence,fund==='Unknown Fund',
   r.displayCls?{displayClassName:r.displayCls,classAliases:r.aliases||[]}:null);
 });
 const audit=ratioHeadingAudit(pages,p,parsed);
 const diagnostics=[{fmc_detection:{status:'matched',fmc_key:p.key},report_date:date,extraction_method:'native-js',fund_name:fund,fmc_label:p.label,classes:rows.length,...(audit?{series_completeness:audit}:{})},...pages.map(x=>({page:x.page,mode:x.ocrUsed?'ocr-fallback':'native-pdfjs'}))];
 return {results:rows,diagnostics,raw:[],profile:p};
}

global.MRFP_ENGINE={analyzePages,detectFmc,reportDate,REGISTRY,groupLines:undefined};
})(globalThis);
