/* FMC adapter: ci. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
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

// @mrfp:extraction
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

// @mrfp:evidence
// Adapter-owned dated-ratio header validation. Do not infer a column from values.
function ratioHeader_ci(lines,rowY){
 const sections=lines.filter(l=>l.y>rowY&&l.y-rowY<590&&/ratios?\s+(?:and|&)\s+supplemental\s+data/i.test(l.text))
  .sort((a,b)=>a.y-b.y);
 for(const section of sections){
  const top=lines.filter(l=>l.y<section.y&&section.y-l.y<70&&l.y>rowY+6);
  if(!top.length)continue;
   const mgmt=top.flatMap(l=>l.items.filter(i=>/^Management$/i.test(i.str.trim())));
   const before=top.flatMap(l=>l.items.filter(i=>/^ratio before$/i.test(i.str.trim())));
   const after=top.flatMap(l=>l.items.filter(i=>/^ratio after$/i.test(i.str.trim())));
   const trade=top.flatMap(l=>l.items.filter(i=>/^Trading$/i.test(i.str.trim())));
   const turnover=top.flatMap(l=>l.items.filter(i=>/^Portfolio$/i.test(i.str.trim())));
   if(mgmt.length!==2||before.length!==1||after.length!==1||trade.length!==1||turnover.length!==1)continue;
   const sorted=mgmt.sort((x,y)=>x.x-y.x);
   if(!(sorted[0].x<before[0].x+13&&sorted[1].x<after[0].x+13&&
     sorted[1].x<trade[0].x&&trade[0].x<turnover[0].x&&
     Math.abs(sorted[0].x-before[0].x)<24&&Math.abs(sorted[1].x-after[0].x)<24))continue;
   const lower=top.flatMap(l=>l.items);
   const near=(rx,head)=>lower.some(i=>rx.test(i.str.trim())&&Math.abs(i.x-head.x)<25);
   if(!(near(/^expense$/i,sorted[0])&&near(/^expense$/i,sorted[1])&&near(/^expense$/i,trade[0])&&near(/^turnover$/i,turnover[0])))continue;
   // CI reports 'MER before taxes' alongside 'MER after taxes'. The financial
   // extractor's management expense ratio is the after-tax figure.
   return {MER:tokenCenter(sorted[1]),before:tokenCenter(sorted[0]),TER:tokenCenter(trade[0]),PTR:tokenCenter(turnover[0]),section:section.y};
   }
 return null;
}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_ci={stamps:{lastGapLocatorVersion:1}};
function gapCiMissingCell(page,lines,row,key,value){
 if(key!=='MER'||value!=null)return null;
 const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(row.report_date||'');if(!iso)return null;
 const section=lines.find(l=>/ratios? and supplemental data/i.test(l.text));
 const header=section?ratioHeader(lines,section.y-110,'ci'):null;
 if(!header)return null;
 const mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+iso[2]-1];
 const rx=new RegExp('^'+mon+'[a-z]*\\.?\\s+'+Number(iso[3])+'[,\\s]+'+iso[1]+'\\b','i');
 const result=[];
 for(const l of lines.filter(l=>rx.test(l.text)&&l.y<header.section)){
  const title=lines.filter(h=>h.y>l.y&&h.y-l.y<45&&/^series\s+[a-z0-9]+$/i.test(h.text.trim())).sort((a,b)=>a.y-b.y)[0];
  if(!title||clean(title.text)!==clean(row.class_name))continue;
  const after=header.MER;
  // The after-tax management-expense column is immediately left of HST.
  const cs=cells(l).filter(c=>c.isMissing&&Math.abs(c.x-after)<23&&c.x>header.before+20);
  if(cs.length===1)result.push(cs[0]);
 }
 return result.length===1?result[0]:null;
}


// Shares-specific dated source locator. Unlike the standard Series locator,
// this validates the nearest physical "X Shares" heading *before* looking at
// the metric cell. It never infers source coordinates from extraction indices.
function ciSharesDatedCell(page,lines,row,key,value){
 if(!/^[A-Z][A-Z0-9]* Shares$/i.test(row.class_name||'')||!fundOnPage(page,row))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso)return null;
 const monthNames={3:'Mar',6:'Jun',9:'Sept',12:'Dec'};
 const mon=monthNames[Number(iso[2])];if(!mon)return null;
 const dateRx=new RegExp('^'+mon+'[a-z]*\\.?\\s+'+Number(iso[3])+'[,\\s]+'+iso[1]+'\\b','i');
 const headingRx=/^[A-Z][A-Z0-9]*\s+Shares(?:\s*\(\d+\))*$/i;
 const targetName=clean(row.class_name);
 const located=[];
 for(const line of lines){
  if(!dateRx.test(line.text))continue;
  const nearby=lines.filter(l=>l.y>line.y+1&&l.y-line.y<240&&headingRx.test(l.text))
    .sort((a,b)=>a.y-b.y);
  // The first class heading above this date row owns the row. A different
  // Share heading between it and the date is an absolute mismatch.
  if(!nearby.length||clean(nearby[0].text)!==targetName)continue;
  const header=ratioHeader_ci(lines,line.y);
  if(!header||!Number.isFinite(header[key]))continue;
  const target=header[key];
  const anchors=Object.entries(header).filter(([k,v])=>k!=='section'&&Number.isFinite(v)).sort((a,b)=>a[1]-b[1]);
  const idx=anchors.findIndex(([k])=>k===key);if(idx<0)continue;
  const left=idx>0?(anchors[idx-1][1]+target)/2:-Infinity;
  const right=idx+1<anchors.length?(target+anchors[idx+1][1])/2:Infinity;
  const valid=cells(line).filter(c=>c.x>Math.max(120,line.minX+100)&&c.x>left&&c.x<right
    &&Math.abs(c.x-target)<29&&(key!=='MER'||c.x>target-5)
    &&matchesCell(c,value));
  if(valid.length===1)located.push(valid[0]);
 }
 const unique=new Map(located.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return unique.size===1?[...unique.values()][0]:null;
}

function locateCell_ci(page,lines,row,key,value,context){
 const selected=/\bShares$/i.test(row.class_name||'')
   ?ciSharesDatedCell(page,lines,row,key,value)
   :datedFmcCell(lines,row,key,value,row.fmc_key);
 return selected?{...selected,box:selected.box,page:page.page,metric:key,kind:row.fmc_key+'-header-validated-dated-cell'}:null;
}

function locateGap_ci(page,lines,row,key,value){
 if(/\bShares$/i.test(row.class_name||''))return ciSharesDatedCell(page,lines,row,key,value);
 return gapCiMissingCell(page,lines,row,key,value);
}
