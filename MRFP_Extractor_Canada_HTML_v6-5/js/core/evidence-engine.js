/* Strict v5 source-page and coordinate locator / map public API. */
function locateInPage(page,row,key,value,{hint=false,preparedLines=null}={}){
 if(!Array.isArray(page.items)||!page.items.length||page.ocrUsed)return null;
 const lines=preparedLines||textLines(page.items),year=Number((row.report_date||'').slice(0,4))||row.year;
 const fundTitle=clean(row.fund_name),headerText=clean((page.text||'').slice(0,1300));
 const namedEtf=/^(?:ETF|CAD|USD)\s+Units$/i.test(row.class_name||'')&&fundTitle.length>13&&headerText.includes(fundTitle);
 if(!year||!pageContext(page,lines))return null;
 if(key==='TER'){
  // Do not let older FMC locators return Trading Expense Ratio cells.
  if(row.evidence?.TER?.totalExpenseValidated!==true)return null;
  const source=totalExpenseRatioSource([page],row);
  if(!source||!matchesCell({value:source.value,isMissing:source.isMissing},value))return null;
  return {...source,metric:'TER'};
 }
 const matches=[];
 function choose(candidates,kind){
  const unique=new Map(candidates.map(m=>[`${m.box.x.toFixed(1)}:${m.box.y.toFixed(1)}`,{...m,page:page.page,metric:key,kind}]));
  return unique.size===1?[...unique.values()][0]:null;
 }
 // Dispatch strict, issuer-specific source validation to the selected FMC adapter.
 // An unavailable cell stays unavailable; never fall back to an unrelated number.
 const fmcHandler=FMC_EVIDENCE_HANDLERS[row.fmc_key];
 if(fmcHandler)return fmcHandler(page,lines,row,key,value,{hint,year});
 // B. Current-period multi-year ratios with the year above the numeric cells.
 // The year must be printed in a financial highlights table and cell x aligned
 // with the LATEST year, rather than merely appearing somewhere on the page.
 const yearHeaders=lines.filter(l=>/\b(?:period|financial|20\d{2})\b/i.test(l.text)).flatMap(l=>numbers(l).filter(n=>n.value===year).map(n=>({x:n.x,y:l.y})));
 const metricLines=lines.filter(l=>LABELS[key].test(l.text));
 if(yearHeaders.length){
  const found=[];
  for(const lab of metricLines){
   if(key==='MER'&&/\bbefore\b/i.test(lab.text))continue;
   // Ignore a second, separately labelled "MER before waivers" row when
   // its heading is split over multiple PDF.js lines (BMO ETF tables).
   if(key==='MER'&&/management\s+expense/i.test(lab.text)&&!/\bratio\b/i.test(lab.text)
      &&lines.some(next=>next.y<lab.y&&lab.y-next.y<22&&/\bratio\s+before\b/i.test(next.text)))continue;
   const rightSide=lab.items.some(i=>i.x>310&&LABELS[key].test(i.str));
   // Reassembled labels may span 2–3 lines. The value row can be below the
   // metric heading, but cannot be under the next ratio type heading.
   const candidates=lines.filter(l=>l.y<=lab.y+1&&lab.y-l.y<23);
   for(const line of candidates){
    // Do not extend one metric's cell onto a different ratio heading/table row.
    if(lines.some(mid=>mid!==lab&&mid.y<lab.y-.5&&mid.y>line.y+.5&&LABELS[key].test(mid.text)))continue;
    const nums=cells(line).filter(n=>matchesCell(n,value));
    for(const n of nums){
     // Restrict to matching latest-year column AND same column band as label.
     const headers=yearHeaders.filter(h=>h.y>=line.y&&h.y-line.y<310&&Math.abs(h.x-n.x)<15);
     if(!headers.length)continue;
     const nearestYear=Math.min(...headers.map(h=>h.y-line.y));
     if(!Number.isFinite(nearestYear))continue;
     if(rightSide){
      if(n.x<315)continue;
      const heading=lines.filter(l=>l.y>=line.y&&l.y-line.y<240&&l.items.some(i=>i.x>300&&clsPatterns(row.class_name)[0].test(clean(i.str)))).sort((a,b)=>a.y-b.y)[0];
      if(!heading&&!(namedEtf||(/^ETF\s+Units$/i.test(row.class_name)&&hint)))continue;
      const inBetween=lines.some(l=>l.y>line.y+1&&l.y<(heading?.y||line.y+240)-1&&l.items.some(i=>i.x>300&&/\b(?:series|class)\s+[A-Z](?:\d+)?\b/i.test(i.str)&&!clsPatterns(row.class_name)[0].test(clean(i.str))));
      if(inBetween)continue;
     }else if(!(namedEtf||(/^(?:ETF|CAD|USD)\s+Units$/i.test(row.class_name)&&hint))){
      const heading=nearestClassAbove(lines,line,row);if(!heading)continue;
     }
     found.push(n);
    }
   }
  }
  const uniqueCandidates=found.some(n=>n.fragmented)?found.filter(n=>n.fragmented):found;
  const selected=choose(uniqueCandidates,'latest-year-ratio-cell');if(selected)return selected;
 }
 // C. General series-by-metric single-current-period row. Only one candidate
 // and class heading immediately preceding the matched metric row is accepted.
 if(!hint)return null;
 const found=[];
 for(const lab of metricLines){
  const header=nearestClassAbove(lines,lab,row);if(!header)continue;
  for(const l of lines.filter(x=>x.y<=lab.y+1&&lab.y-x.y<12)){
   const vals=cells(l).filter(n=>matchesCell(n,value)&&n.x>lab.minX+20);
   if(vals.length===1)found.push(vals[0]);
  }
 }
 return choose(found,'class-metric-row');
}


// Last-gap adapters: used ONLY if the established FMC locator returned no cell.
// Match the original metric label, source reporting-year column, and physical
// series block. Never choose another column merely because its value matches.
function locateLastGap(page,row,key,value,pages,preparedLines=null){
 if(key==='TER')return null; // Legacy gap locators map Trading, not Total Expense Ratio.
 if(!gapDocIdentity(pages,row))return null;
 if(!FMC_GAP_HANDLERS[row.fmc_key]||!Array.isArray(page.items)||page.ocrUsed)return null;
 const lines=preparedLines||textLines(page.items);
 const handler=FMC_GAP_HANDLERS[row.fmc_key];
 const c=handler?handler(page,lines,row,key,value):null;
 return c?{...c,page:page.page,metric:key,kind:row.fmc_key+'-strict-source-gap-v1'}:null;
}

// Central evidence contract. The viewer has no FMC-specific refresh rules.
// Preserve the v5/v6 locatorVersion and all issuer-specific legacy stamps exactly
// so saved History evidence remains compatible across this architectural patch.
const LOCATOR_VERSION=4;
function evidenceStamps(fmcKey){
 const policy=FMC_EVIDENCE_POLICIES[fmcKey];
 return policy?{...policy.stamps}:{};
}
function needsRefresh(row,record){
 if(!record||record.locatorVersion!==LOCATOR_VERSION)return true;
 const policy=FMC_EVIDENCE_POLICIES[row?.fmc_key];
 if(!policy||policy.refreshOnMismatch===false)return false;
 return Object.entries(policy.stamps).some(([field,version])=>record[field]!==version);
}
function emptyRecord(row){
 return {locatorVersion:LOCATOR_VERSION,...evidenceStamps(row?.fmc_key),pages:[],metrics:{},originalValues:{}};
}
function sourcePages(row){return [...new Set(METRICS.map(k=>row.evidence?.[k]?.page).filter(p=>Number.isInteger(p)&&p>0))];}
function locate(pages,rows){
 const output={version:LOCATOR_VERSION,rows:{}};
 // Cache native text/geometry grouping within this document only. No persistent
 // references to PDF contents, preventing browser memory buildup across uploads.
 const groupedLines=new WeakMap();
 function linesFor(page){
  if(!Array.isArray(page.items)||page.ocrUsed)return null;
  let lines=groupedLines.get(page);
  if(!lines){lines=textLines(page.items);groupedLines.set(page,lines);}
  return lines;
 }
 for(const row of rows||[]){
  const key=row.row_id||row.class_name;
  const record={...emptyRecord(row),pages:sourcePages(row)};
  for(const metric of METRICS){
   if(metric==='TER'&&row.evidence?.TER?.totalExpenseValidated!==true){record.originalValues.TER=null;continue;}
   const value=Object.hasOwn(row.originalValues||{},metric)?row.originalValues[metric]:row[metric];
   record.originalValues[metric]=value??null;
   if(row.evidence?.[metric]?.method==='manual'&&!Object.hasOwn(row.originalValues||{},metric))continue;
   const hinted=row.evidence?.[metric]?.page;
   const identity=FMC_DOCUMENT_IDENTITIES[row.fmc_key];
   const candidates=identity&&!identity(pages,row)?[]:(Number.isInteger(hinted)&&hinted>0?pages.filter(p=>p.page===hinted):pages);
   const found=[];
   for(const p of candidates){const preparedLines=linesFor(p);const hit=locateInPage(p,row,metric,value,{hint:!!hinted,preparedLines})||locateLastGap(p,row,metric,value,pages,preparedLines);if(hit)found.push(hit);}
   // When hints are absent, page ambiguity must also fail closed.
   if(found.length===1){const f=found[0];record.metrics[metric]={page:f.page,box:f.box,kind:f.kind,value:value??null,sourceText:f.raw,isMissing:!!f.isMissing};record.pages.push(f.page);}
  }
  record.pages=[...new Set(record.pages)].sort((a,b)=>a-b);
  output.rows[key]=record;
 }
 return output;
}
function initialPage(doc){
 const all=[];for(const row of doc?.results||[]){
  const record=doc.evidenceMap?.rows?.[row.row_id||row.class_name];
  if(record?.locatorVersion===LOCATOR_VERSION&&record?.pages?.length)all.push(...record.pages);
  else all.push(...sourcePages(row));
 }
 return all.length?Math.min(...all.filter(Number.isInteger)):null;
}
