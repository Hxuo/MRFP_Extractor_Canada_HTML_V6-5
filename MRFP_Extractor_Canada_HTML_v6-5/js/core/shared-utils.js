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

function makeRow(cls,p,fund,date,vals,ev,needsReview=false){
 const year=date?Number(date.slice(0,4)):null;
 const fid=createHash('sha256').update(p.key+'\0'+fund.toLowerCase()).digest('hex').slice(0,20);
 const cid=createHash('sha256').update(fid+'\0'+cls.toLowerCase()).digest('hex').slice(0,20);
 return {class_name:cls,fund_name:fund,fmc:p.label,fmc_key:p.key,fund_id:fid,class_id:cid,row_id:cid+':'+(date||year||'unknown'),report_date:date,year,MER:vals.MER??null,TER:vals.TER??null,PTR:vals.PTR??null,evidence:ev,needs_review:needsReview||!date};
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
