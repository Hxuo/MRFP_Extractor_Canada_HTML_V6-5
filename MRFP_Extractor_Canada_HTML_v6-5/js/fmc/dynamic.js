/* FMC adapter: dynamic. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const dynamic={key:'dynamic',label:'1832 Asset Management (Dynamic)',style:'dynamic',signatures:[/1832 Asset Management L\.P\./i,/www\.dynamic\.ca/i,/\bDynamic Dividend\b/i],title:/^\s*(Dynamic\s+[^\n]{3,110}(?:Fund|Class|Portfolio))\s*$/im};

const fmcConfig_dynamic={issuerPrefix:/^Dynamic\s/i,allowRowFallback:false};

// @mrfp:extraction
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

// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_dynamic={stamps:{fmcEvidenceVersion:1}};
function dynamicCell(page,lines,row,key,value){
 const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso)return null;
 const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
 const mon=months[Number(iso[2])-1];if(!mon)return null;
 const dateRx=new RegExp('^'+mon+'(?:e)?\\.?\\s+'+Number(iso[3])+'[,\\s]+'+iso[1]+'\\b','i');
 const expected=clean(row.class_name).replace(/\s+/g,' ');
 const hasFund=clean(page.text||'').includes(clean(row.fund_name));
 if(!hasFund)return null; // protects against highlights on a different fund
 const output=[];
 // Header is the source of truth, not the positions of identical numbers.
 const headers=lines.filter(l=>l.items.some(i=>/^As at$/i.test(i.str.trim()))
   &&l.items.some(i=>/MER[”")]*\s*\(%\)/i.test(i.str.trim()))
   &&l.items.some(i=>/TER[”")]*\s*\(%\)/i.test(i.str.trim())));
 for(const head of headers){
  // Continuation pages may repeat the lower two header lines but not the
  // 'Management / MER before / Trading' top line. Both are sufficient when
  // explicit MER, absorptions, TER, PTR, NAV and date labels are present.
  const label=i=>head.items.find(t=>i.test(t.str.trim()));
  const merLabel=label(/MER[”")]*\s*\(%\)/i),beforeLabel=label(/^absorptions\s*\(%\)$/i),
        terLabel=label(/TER[”")]*\s*\(%\)/i);
  const upper=lines.filter(l=>l.y>head.y&&l.y-head.y<20);
  const upperItems=upper.flatMap(l=>l.items);
  const pt=upperItems.find(i=>/^Portfolio turnover$/i.test(i.str.trim()));
  const nav=upperItems.find(i=>/^Net asset value$/i.test(i.str.trim()));
  const hasWaivers=upperItems.some(i=>/^waivers or$/i.test(i.str.trim()));
  const hasRatios=upperItems.filter(i=>/^expense ratio$/i.test(i.str.trim())).length>=2;
  if(!merLabel||!beforeLabel||!terLabel||!pt||!nav||!hasWaivers||!hasRatios
   ||!(merLabel.x<beforeLabel.x&&beforeLabel.x<terLabel.x&&terLabel.x<pt.x&&pt.x<nav.x))continue;
  const bounds={MER:[merLabel.x,beforeLabel.x],TER:[terLabel.x,pt.x],PTR:[pt.x,nav.x]};
  for(const l of lines){
   if(l.y>=head.y||head.y-l.y>520||!dateRx.test(l.text))continue;
   const titles=lines.filter(t=>t.y>l.y&&t.y<head.y&&/^(?:Series\s+[A-Z][A-Z0-9]*(?:\s*\(USD\))?|ETF Series)$/i.test(t.text.trim()))
     .sort((x,y)=>x.y-y.y);
   if(/^ETF\s+Units$/i.test(row.class_name||'')){
    // One dated ETF table with no per-series headings; never assign an ETF
    // highlight to the table of a mutual-fund series.
    if(titles.length)continue;
   }else{
    if(!titles.length||clean(titles[0].text)!==expected)continue;
   }
   const [left,right]=bounds[key];
   const candidates=cells(l).filter(n=>n.x>left&&n.x<right&&matchesCell(n,value));
   if(candidates.length===1)output.push(candidates[0]);
  }
 }
 const unique=new Map(output.map(n=>[n.box.x.toFixed(1)+':'+n.box.y.toFixed(1),n]));
 return unique.size===1?[...unique.values()][0]:null;
}
// NBI: repeating per-series tables with Accounting Period Ended year and
// month/day columns. Match the exact printed ratio label and date column.
// Do not use 'before waivers' as MER; do not inherit periods between blocks.


function locateCell_dynamic(page,lines,row,key,value,context){const selected=dynamicCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-period-series-column'}:null;}
