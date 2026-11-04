/* FMC adapter: td. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_td={key:'td',label:'TD Asset Management',style:'td',signatures:[/TD (?:Mutual Funds|Exchange-Traded Funds)/i,/TD Asset Management Inc\./i],title:/^\s*(TD\s+[^\n]{3,130}?(?:Fund|ETF))(?:\s*\([A-Z0-9.]+\))?\s*$/im};

const fmcConfig_td={issuerPrefix:/^TD\s/i,preferProfileLineTitle:true};

// @mrfp:extraction
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
// @mrfp:evidence
const evidenceLayout_td={preciseLabelStyle:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_td={stamps:{tdBlackrockLocatorVersion:1}};
function tdCell(page,lines,row,key,value){
 if(!fundOnPage(page,row))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');if(!iso)return null;
 const targetYear=Number(iso[1]),expected=compactName(row.class_name);
 if(!expected)return null;
 // TD MRFPs may continue Ratios and Supplemental Data onto a following page.
 const sections=lines.filter(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data\b/i.test(l.text));
 const found=[];
 for(const section of sections){
  // Dated report period must occur on this PDF page; do not mistake a 2025
  // year column for a 2025 report when the actual latest report is June 2026.
  const period=(iso[2]==='06'?'June':iso[2]==='12'?'December':null);
  if(!period||!new RegExp('\\b'+period+'\\s+'+Number(iso[3])+'\\s*,?\\s*'+targetYear+'\\b','i').test(page.text||''))continue;
  const below=lines.filter(l=>l.y<section.y&&section.y-l.y<550);
  for(const yearsLine of below){
   const years=yearTokens(yearsLine);
   if(years.length<2||years.length>14||years.some((i,k)=>k&&i.x<=years[k-1].x))continue;
   const header=below.filter(l=>l.y>yearsLine.y&&l.y-yearsLine.y<25).sort((a,b)=>a.y-b.y)[0];
   // ETF-only tables have no class heading between section and year labels.
   // Class-bearing tables must still match an explicit printed heading.
   if(!header&& !/^ETF\s+Units$/i.test(row.class_name||''))continue;
   // Each year's sequence MUST be decreasing, restarting only when a new
   // horizontally adjacent class starts (e.g. 2025...2021, 2025...2021).
   const groups=[];let current=[];
   for(const yr of years){
    if(current.length&&Number(yr.str)>=Number(current[current.length-1].str)){groups.push(current);current=[];}
    current.push(yr);
   }
   if(current.length)groups.push(current);
   if(groups.some(g=>g.some((t,i)=>i&&Number(t.str)>=Number(g[i-1].str))))continue;
   const titles=(header?.items||[]).filter(i=>i.str.trim()&&i.x>=150&&i.x<Math.max(...years.map(t=>t.x))+12)
     .sort((a,b)=>a.x-b.x);
   let group=null;
   if(header&&titles.length===groups.length){
    const matches=titles.map((h,i)=>compactName(h.str)===expected?i:-1).filter(i=>i>=0);
    if(matches.length!==1)continue;
    group=groups[matches[0]];
    if(Math.abs(titles[matches[0]].x-group[0].x)>95)continue;
   }else if(groups.length===1&&/^ETF\s+Units$/i.test(row.class_name||'')&&
    (!header||!header.items.some(i=>/\b(?:SERIES|UNITS)\b/i.test(i.str)))){
    group=groups[0];
   }else continue;
   const columns=group.filter(i=>Number(i.str)===targetYear);
   if(columns.length!==1)continue;
   const year=columns[0];
   const ratioRows=below.filter(l=>l.y<yearsLine.y&&yearsLine.y-l.y<90&&labelledMetricLine(l,key,'td'));
   if(ratioRows.length!==1)continue;
   const metricLine=ratioRows[0];
   const n=cells(metricLine).filter(c=>c.x>=group[0].x-17&&c.x<group[group.length-1].x+40);
   // A series may start later than the oldest year: older TD columns print
   // literal N/A instead of a number. Validate every printed column against
   // the year header; never shift the remaining values left by ordinal.
   const byYear=new Map();let aligned=true;
   for(const y of group){
    const candidates=n.filter(c=>Math.abs(c.x-y.x)<18);
    const na=metricLine.items.filter(i=>i.x>group[0].x-17&&Math.abs(i.x-y.x)<18&&/^(?:N\/A|N\.A\.)$/i.test(i.str.trim()));
    if(candidates.length===1&&na.length===0)byYear.set(y,candidates[0]);
    else if(candidates.length===0&&na.length===1)continue;
    else{aligned=false;break;}
   }
   if(!aligned)continue;
   const chosen=byYear.get(year);
   if(!chosen||!matchesCell(chosen,value))continue;
   found.push(chosen);
  }
 }
 const uniq=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return uniq.size===1?[...uniq.values()][0]:null;
}
// BlackRock / iShares: verify full report period, exact fund header, optional
// CAD/USD unit heading, current year, and the original labelled financial-
// highlights metric row. The dotted-leader text is NOT a numeric source cell.


function locateCell_td(page,lines,row,key,value,context){const selected=tdCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-fund-period-series-header-cell'}:null;}
