/* FMC adapter: bmo. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const bmo={key:'bmo',label:'BMO',style:'bmo',signatures:[/BMO (?:Asset Management|Investments) Inc\./i,/\bbmogam\.com\b/i,/\bBMO (?:Mutual Funds|Exchange Traded Funds)\b/i],title:/^\s*(BMO\s+[^\n]{4,110}?(?:Fund(?:\s+Ltd\.)?|ETF|Portfolio))\s*$/im};
// BMG bullion reports may be scanned as landscape two-page spreads with rotated PDF text.

const fmcConfig_bmo={issuerPrefix:/^BMO\s/i};

// @mrfp:extraction
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

// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_bmo={stamps:{bmoAgfLocatorVersion:1}};


function locateCell_bmo(page,lines,row,key,value,context){const selected=issuerPeriodBandCell(page,row,key,value,row.fmc_key);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'}:null;}
