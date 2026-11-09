/* GENERATED from js/core + js/fmc via dev-tools/build.cjs. DO NOT EDIT DIRECTLY. Browser file:// safe. */
(function(global){
'use strict';
/* Shared PDF evidence geometry and numeric validation from v5. */
const METRICS=['MER','TER','PTR'];
const LABELS={
 MER:/\b(?:management\s+(?:expense|expenses)\s+ratio|management\s+expense|MER)\b/i,
 TER:/\btotal\s+expense\s+ratio\b/i,
 PTR:/\b(?:portfolio\s+turnover(?:\s+(?:rate|ratio))?|turnover\s+(?:rate|ratio)|PTR)\b/i
};
const RATIO_SECTION=/ratios?\s+(?:and|&)\s+supplemental|financial\s+(?:highlights|ratios)|management\s+expense|trading\s+expense|total\s+expense\s+ratio|portfolio\s+turnover|\bMER\b|\bTER\b/i;
const clean=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
const almost=(a,b)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<.000001;
const category=s=>/ETF|Units/i.test(s||'')?'units':'series';
function clsPatterns(s){
 const name=clean(s).replace(/[–—]/g,'-'), escape=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const patterns=[new RegExp('(?:^|[^a-z0-9])'+escape(name).replace(/\s+/g,'\\s+')+'(?=$|[^a-z0-9])','i')];
 if(/^series\s+/i.test(name))patterns.push(new RegExp('(?:^|[^a-z0-9])'+escape(name.replace(/^series\s+/,''))+'(?=$|[^a-z0-9])','i'));
 return patterns;
}
function textLines(items){
 const arr=[];
 for(const it of (items||[])){
  if(typeof it.str!=='string'||!it.str.trim()||!Number.isFinite(it.x)||!Number.isFinite(it.y))continue;
  const h=Math.max(5,Number(it.h)||8);
  let line=arr.find(l=>Math.abs(l.y-it.y)<Math.max(1.5,Math.min(2.8,h*.25)));
  if(!line){line={y:it.y,items:[]};arr.push(line);}
  line.items.push({...it,h});
 }
 arr.sort((a,b)=>b.y-a.y);
 for(const line of arr){line.items.sort((a,b)=>a.x-b.x);line.text=line.items.map(i=>i.str).join(' ').replace(/\s+/g,' ').trim();line.minX=Math.min(...line.items.map(i=>i.x));line.maxX=Math.max(...line.items.map(i=>i.x+i.w));}
 return arr;
}
// Individual PDF.js fragments may contain "23 . 46%", "0 . 10%" or "23.46%".
// Match entire decimal and percent, NEVER the prefix 23 from 23 . 46.
function numbers(line){
 const items=line.items, chars=[];
 // Bridge only typographic gaps within a plausible decimal number; keep wide columns separate.
 for(let i=0;i<items.length;i++){
  const it=items[i],text=String(it.str||'');
  const width=Math.max(0.1,Number(it.w)||text.length*it.h*.45);
  for(let j=0;j<text.length;j++)chars.push({c:text[j],x:it.x+width*j/Math.max(1,text.length),right:it.x+width*(j+1)/Math.max(1,text.length),y:it.y,h:it.h,item:i});
  if(i+1<items.length){const next=items[i+1],gap=next.x-(it.x+it.w);
   chars.push({c:gap<=Math.max(4,it.h*.85)?' ':'|',x:it.x+it.w,right:next.x,y:it.y,h:it.h,item:-1});
  }
 }
 const s=chars.map(c=>c.c).join(''),out=[];
 // Captures decimals separated by whitespace and punctuation without swallowing adjacent columns.
 const re=/(^|[^\w.])(-?\d{1,3}(?:,\d{3})*(?:\s*\.\s*\d+)?|-?\d+(?:\s*\.\s*\d+)?)(?:\s*%)?(?![\w.])/g;
 let m;while((m=re.exec(s))){
  const raw=m[2],val=Number(raw.replace(/[\s,]/g,''));if(!Number.isFinite(val))continue;
  const start=m.index+m[1].length,stop=start+raw.length;
  const span=chars.slice(start,stop).filter(c=>c.item>=0);if(!span.length)continue;
  const x=Math.min(...span.map(c=>c.x)),right=Math.max(...span.map(c=>c.right)),h=Math.max(...span.map(c=>c.h));
  // Some PDF.js glyphs use the same x position, or number is part of a combined run;
  // never promise a box if width or coordinates are unusable.
  if(!(right>x&&h>0))continue;
  out.push({value:val,box:{x:Math.max(0,x-1),y:line.y-1,w:right-x+2,h:h+2},x,raw});
 }
 // Some PDFs omit the decimal glyph from PDF.js text entirely: "23" + "46%".
 // A glued pair (<4pt gap) with a percent suffix is usable ONLY after a
 // date-column/metric-row validation by a caller; the candidate is not proof.
 for(let i=0;i<items.length-1;i++){
  const a=items[i],b=items[i+1],left=a.str.trim(),right=b.str.trim();
  const gap=b.x-(a.x+a.w);
  if(!/^\d{1,3}$/.test(left)||!/^\d{1,2}%$/.test(right)||gap<-.5||gap>4.5)continue;
  const val=Number(left+'.'+right.replace('%',''));
  out.push({value:val,x:a.x,raw:left+'.'+right,box:{x:a.x-1,y:line.y-1,w:b.x+b.w-a.x+2,h:Math.max(a.h,b.h)+2},fragmented:true});
 }
 return out;
}
// Printed em/en dashes, double hyphens and standalone hyphens are a
// *visible missing-data cell*, not numeric zero and not a fabricated value.
// Use PDF.js glyph coordinates only; never create boxes for blank cells.
function missingMarks(line){
 const parts=[];
 for(const it of line.items){
  const str=String(it.str||'');
  // A PDF.js item may hold several separated cells. Accept only dash runs
  // bounded by whitespace, or standalone dash items.
  const re=/(^|\s)([-–—−]{1,})(?=\s|$)/g;
  let match;
  while((match=re.exec(str))){
   const raw=match[2],start=match.index+match[1].length;
   const glyphWidth=Math.max(.1,Number(it.w)||str.length*it.h*.45);
   const x=it.x+glyphWidth*start/Math.max(1,str.length);
   const width=Math.max(1,glyphWidth*raw.length/Math.max(1,str.length));
   if(!Number.isFinite(x)||!Number.isFinite(width)||width<=0)continue;
   parts.push({raw,x,right:x+width,h:it.h});
  }
 }
 parts.sort((a,b)=>a.x-b.x);
 const out=[];
 for(let i=0;i<parts.length;i++){
  let p={...parts[i]};
  // PDF.js sometimes splits "--" into two distinct, touching text items.
  // Merge ONLY adjacent literal hyphens so they don't become two ambiguous
  // candidates for one actual source cell.
  while(p.raw.endsWith('-')&&i+1<parts.length&&parts[i+1].raw.startsWith('-')
   &&parts[i+1].x-p.right>=-0.5&&parts[i+1].x-p.right<=3.5){
   const next=parts[++i];p.raw+=next.raw;p.right=next.right;p.h=Math.max(p.h,next.h);
  }
  // A standalone minus glyph immediately before numeric characters is a
  // signed number, not a missing-value marker.
  if(p.raw==='-'&&line.items.some(it=>/^\s*\d/.test(String(it.str||''))
   &&it.x-p.right>=-0.5&&it.x-p.right<3.5))continue;
  out.push({value:null,isMissing:true,raw:p.raw,x:p.x,box:{x:Math.max(0,p.x-1),y:line.y-1,w:p.right-p.x+2,h:p.h+2}});
 }
 return out;
}
function cells(line){return [...numbers(line),...missingMarks(line)].sort((a,b)=>a.x-b.x);}
function matchesCell(cell,value){return value===null||value===undefined ? cell.isMissing===true : !cell.isMissing&&almost(cell.value,value);}
function classLine(line,row){
 const t=clean(line.text),p=clsPatterns(row.class_name||'');
 if(p[0].test(t))return true;
 // An abbreviated single-letter column heading is not sufficient to establish a class.
 return false;
}
function nearestClassAbove(lines,target,row){
 const earlier=lines.filter(l=>l.y>=target.y-.75&&l.y-target.y<245).sort((a,b)=>a.y-b.y);
 const matching=earlier.filter(l=>classLine(l,row));
 if(!matching.length)return null;
 const best=matching[0];
 // A closer DIFFERENT class heading prevents assigning all subsequent metrics to one class.
 for(const candidate of earlier){
  if(candidate.y>=best.y-1)break;
  if(/\b(?:series|class)\s+[A-Z][A-Z0-9-]*\b|\b(?:ETF|CAD|USD)\s+(?:series|units)\b/i.test(candidate.text)&&!classLine(candidate,row))return null;
 }
 return best;
}
function pageContext(page,lines){
 const header=(page.text||lines.map(x=>x.text).join('\n')).slice(0,22000);
 return RATIO_SECTION.test(header);
}
// FMC-aware dated ratio-table adapters. Each adapter must validate the actual
// PDF header structure before choosing a cell. A matching number alone is not
// evidence, especially where MER and MER Before Absorption are identical.
// Reusable geometric utilities are shared by all adapters.
function tokenCenter(item){return item.x+(Number(item.w)||0)/2;}
// Dispatch actual header/column validation to the corresponding issuer.
function ratioHeader(lines,rowY,fmc){
 const handler=FMC_RATIO_HEADER_HANDLERS[fmc];
 return handler?handler(lines,rowY):null;
}

function datedFmcCell(lines,row,key,value,fmc){
 const iso=/^(\d{4})-(\d\d)-(\d\d)$/.exec(row.report_date||'');
 if(!iso)return null;
 const month={1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'May',6:'Jun',7:'Jul',8:'Aug',9:'Sep',10:'Oct',11:'Nov',12:'Dec'}[Number(iso[2])];
 const dateRx=new RegExp('^'+month+'[a-z]*\\.?\\s+'+Number(iso[3])+'[,\\s]+'+Number(iso[1])+'\\b','i');
 const results=[];
 for(const line of lines){
  if(!dateRx.test(line.text)||!nearestClassAbove(lines,line,row))continue;
  const header=ratioHeader(lines,line.y,fmc);if(!header)continue;
  const target=header[key];
  const markers=cells(line).filter(c=>c.x>Math.max(120,line.minX+100));
  if(!markers.length)continue;
  // Find a cell using the ACTUAL labelled-column center, not a fixed numeric
  // array index. Use neighboring columns as mutually exclusive boundaries.
  const anchors=Object.entries(header).filter(([k,v])=>k!=='section'&&Number.isFinite(v)).sort((a,b)=>a[1]-b[1]);
  const idx=anchors.findIndex(([k])=>k===key);if(idx<0)continue;
  const left=idx>0?(anchors[idx-1][1]+target)/2:-Infinity;
  const right=idx+1<anchors.length?(target+anchors[idx+1][1])/2:Infinity;
  const candidates=markers.filter(n=>n.x>left&&n.x<right&&Math.abs(n.x-target)<29&&matchesCell(n,value));
  if(candidates.length===1)results.push(candidates[0]);
 }
 const unique=new Map(results.map(n=>[`${n.box.x.toFixed(1)}:${n.box.y.toFixed(1)}`,n]));
 return unique.size===1?[...unique.values()][0]:null;
}
// Fidelity's native-text MRFPs use repeating per-series Financial Highlights
// blocks: fund + exact Series heading -> dated columns -> Ratios and
// Supplemental Data -> labelled MER / TER / PTR rows. Columns are identified
// from the CURRENT document, not from hardcoded x positions or fund names.
// No fallback to a matching number in a different class or reporting period.
const compactName=s=>clean(s).replace(/[^a-z0-9]+/g,'');
function fundOnPage(page,row){
 const name=compactName(row.fund_name),header=compactName((page.text||'').slice(0,650));
 return name.length>12&&header.includes(name);
}
function labelledMetricLine(line,key,style){
 const labels=FMC_EVIDENCE_LAYOUTS[style]?.preciseLabelStyle?{
  MER:/^Management Expense Ratio\s*\(%\)/i,
  TER:/^Trading Expense Ratio\s*\(%\)/i,
  PTR:/^Portfolio Turnover Rate\s*\(%\)/i
 }:{MER:/^Management expense ratio\b/i,TER:/^Trading expense ratio\b/i,PTR:/^Portfolio turnover rate\b/i};
 // Must be an explicit row label in the LEFT label column, not explanatory
 // footnotes or a generic mention of MER/TER/PTR elsewhere on the page.
 return labels[key].test(line.items.filter(t=>t.x<195).map(t=>t.str.trim()).join(' ').replace(/\s+/g,' ').trim());
}
function yearTokens(line){
 return line.items.filter(i=>/^20\d{2}$/.test(i.str.trim())).sort((a,b)=>a.x-b.x);
}
function issuerPeriodBandCell(page,row,key,value,issuer){
 if(!fundOnPage(page,row))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso)return null;
 const targetYear=Number(iso[1]), width=page.width||612,mid=width/2;
 const target=clean(row.class_name).replace(/\s*[-–—]\s*/g,'-');
 if(!target)return null;
 const possible=[];
 for(const [lo,hi] of [[0,mid-3],[mid-3,width+5]]){
  const lines=textLines(page.items.filter(it=>it.x>=lo&&it.x<hi));
  // Headers are read from THIS page and from one physical table column.
  const titles=[];
  for(const l of lines){
   const normalized=clean(l.text).replace(/\s*[-–—]\s*/g,'-');
   if(FMC_EVIDENCE_LAYOUTS[issuer]?.issuerPeriodBandAgf){
    if(normalized===target+'-ratios/supplemental data')titles.push(l);
   }else{
    // BMO has plain Series headings, sometimes followed on the same line
    // by a current-date heading (e.g. "Listed CAD Units Jun. 30, 2026").
    if(normalized===target||normalized.startsWith(target+' ')
       &&/^(?:20\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s|period\b)/i.test(normalized.slice(target.length).trim()))titles.push(l);
   }
  }
  for(const title of titles){
   const dateLines=lines.filter(l=>l.y<=title.y+1&&title.y-l.y<67);
   // Prefer the nearest row with at least two distinct date columns.
   const yearLists=dateLines.map(l=>({line:l,years:l.items.filter(it=>/(?:19|20)\d{2}/.test(it.str))
    .map(it=>({it,year:Number((it.str.match(/(?:19|20)\d{2}/)||[])[0])}))
    .filter(it=>it.year>=1990&&it.year<=2100)}))
    .filter(x=>x.years.some(it=>it.year===targetYear)&&
     // New-launch series can legitimately have only the current-year column.
     (new Set(x.years.map(it=>it.year)).size>=2||x.years.length===1))
    .sort((a,b)=>b.line.y-a.line.y);
   // Date/year labels must belong to this series, not another table lower down.
   const heading=yearLists[0];if(!heading)continue;
   const targetHeader=heading.years.find(it=>it.year===targetYear);
   const headX=tokenCenter(targetHeader.it);
   const nextHeads=lines.filter(l=>l.y<title.y-5&&l.y>=title.y-280&&
     (FMC_EVIDENCE_LAYOUTS[issuer]?.issuerPeriodBandAgf?/\b-ratios\s*\/\s*supplemental\s+data\b/i.test(l.text)
        :/^(?:(?:advisor|classic|active\s+etf|listed\s+cad|listed\s+accumulating|series\s+\S+)(?:\s+series)?\s+(?:shares|units)\b)/i.test(l.text)))
     .sort((a,b)=>b.y-a.y);
   const bottom=nextHeads.length?nextHeads[0].y:title.y-280;
   // Each candidate metric row is *physically* between the matching title
   // and next series. Reject "MER before waivers/absorptions" completely.
   const labelRx={MER:/^management\s+expense\s+ratio\b/i,TER:/^trading\s+expense\s+ratio\b/i,PTR:/^portfolio\s+turnover\s+rate\b/i}[key];
   const metricLines=lines.filter(l=>l.y<heading.line.y-3&&l.y>bottom+2&&labelRx.test(l.text)
      &&(key!=='MER'||!/\bbefore\b|\bwaivers\b|\babsorptions\b/i.test(l.text)));
   for(const metricLine of metricLines){
    const firstLabel=metricLine.items.find(it=>/management|trading|portfolio/i.test(it.str));
    if(!firstLabel)continue;
    const sourceCells=cells(metricLine).concat(metricLine.items.filter(it=>/^n\s*\/?\s*a$/i.test(it.str.trim()))
     .map(it=>({value:null,isMissing:true,raw:it.str,x:it.x,box:{x:it.x-1,y:it.y-1,w:it.w+2,h:it.h+2}})));
    const matches=sourceCells.filter(cell=>cell.x>firstLabel.x+65&&matchesCell(cell,value)
      &&Math.abs(cell.x+cell.box.w/2-headX)<17);
    for(const hit of matches)possible.push(hit);
   }
  }
 }
 const unique=new Map(possible.map(m=>[m.box.x.toFixed(2)+':'+m.box.y.toFixed(2),m]));
 return unique.size===1?[...unique.values()][0]:null;
}

// Desjardins: each Class has its own Ratios and Supplemental Data block.
// The period header can contain either five annual columns or only the
// current-period column for newly launched classes. Locate the physical cell
// by the labelled ratio row AND actual date-column RIGHT EDGE. Never accept
// matching ratios from a neighboring class or MER-before-waivers row.
function annualEtfCell(page,lines,row,key,value){
 const validate=FMC_ANNUAL_ETF_VALIDATORS[row.fmc_key];
 if(validate&&!validate(page,row))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso||iso[2]!=='12'||iso[3]!=='31')return null;
 const yr=Number(iso[1]);


 const sections=lines.filter(l=>/^Ratios and Supplemental Data\s*$/i.test(l.text));
 if(sections.length!==1)return null;
 const section=sections[0];
 const years=lines.filter(l=>l.y<section.y&&section.y-l.y<55)
  .filter(l=>l.items.filter(it=>/^20\d{2}$/.test(it.str.trim())).length>=2);
 if(years.length!==1)return null;
 const headers=years[0].items.filter(it=>/^20\d{2}$/.test(it.str.trim())).sort((a,b)=>a.x-b.x);
 if(headers.filter(it=>Number(it.str)===yr).length!==1||Number(headers[0].str)!==yr)return null;
 if(!headers.every((it,i)=>i===0||Number(it.str)===Number(headers[i-1].str)-1))return null;
 const center=tokenCenter(headers[0]);
 const limit=(tokenCenter(headers[0])+tokenCenter(headers[1]))/2;
 const rx={MER:/^Management expense ratio\s*$/i,
           TER:/^Trading expense ratio\s*$/i,
           PTR:/^Portfolio turnover rate\s*$/i}[key];
 const band=lines.filter(l=>l.y<years[0].y-1&&years[0].y-l.y<175);
 const rowLines=band.filter(l=>l.items.some(it=>rx.test(it.str.trim())));
 if(rowLines.length!==1)return null;
 const metric=rowLines[0];
 // Require all three explicitly labelled ratio rows in this one table band.
 const distinct=['Management expense ratio','Trading expense ratio','Portfolio turnover rate'];
 if(!distinct.every(label=>band.filter(l=>l.items.some(it=>clean(it.str)===clean(label))).length===1))return null;
 const vals=cells(metric).filter(c=>c.x>center-21&&c.x<limit&&matchesCell(c,value));
 if(vals.length!==1)return null;
 // On multi-year annual tables, the candidate must sit inside the labelled
 // first-year column (not on the adjacent MER-before-waivers line).
 if(Math.abs(vals[0].x-center)>26)return null;
 return vals[0];
}

// Franklin semi-annual series blocks. The current date is printed inside
// the 'Ratios and supplemental data' header, not as a bare year token.
function nextBatchFmcCell(page,lines,row,key,value){
 const fmc=row.fmc_key;
 const layout=FMC_EVIDENCE_LAYOUTS[fmc];
 if(!layout?.newBatch)return null;
 // Some Purpose title fonts emit a '2' separator between uppercase words.
 // Only normalize the printed FIRST title line; all other FMCs keep the
 // ordinary strict fund-on-page test.
 const titleLine=compactName((page.text||'').split('\n')[0]);
 const purposeTitle=layout.normalizePurposeTitle&&titleLine.replace(/2(?=[a-z])/g,'')===compactName(row.fund_name);
 if(!fundOnPage(page,row)&&!purposeTitle)return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso)return null;
 const year=Number(iso[1]);
 const targetClass=compactName(row.class_name).replace(/units?$/,'');
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const month=months[Number(iso[2])-1];if(!month)return null;
 const day=Number(iso[3]);
 const body=page.text||'';
 // Require an independently printed period reference. In Manulife's layout
 // April 30 and its year may occupy distinct text items/lines.
 const periodRx=new RegExp(month+'\\s+'+day+',?\\s*'+year,'i');
 const splittedRx=new RegExp(month+'\\s+'+day+',?\\s*(?:\\n[^\\n]{0,70})?\\s*'+year,'i');
 if(!layout.flexibleDate&&!periodRx.test(body))return null;
 if(layout.flexibleDate&&!((new RegExp(month+'\\s+'+day,'i')).test(body)&&body.includes(String(year))))return null;
 const panelWidths=layout.splitPanels?[[0,page.width/2],[page.width/2,page.width+1]]:[[0,page.width+1]];
 const chosen=[];
 const metricRx={MER:/^Management\s+expense\s+ratio\b/i,TER:/^Trading\s+expense\s+ratio\b/i,PTR:/^Portfolio\s+turnover\s+rate\b/i}[key];
 for(const [left,right] of panelWidths){
  const panelLines=lines.map(l=>{
   const items=l.items.filter(i=>i.x>=left&&i.x<right);
   return {...l,items,text:items.map(i=>i.str).join(' ').replace(/\s+/g,' ').trim()};
  }).filter(l=>l.items.length);
  const headings=[];
  for(const l of panelLines){
   let name=null;
   if(layout.newgenClassHeading){
    // The full NAV heading is the scope of each separate Class ratio table.
    const m=/\bper\s+(Class\s+[A-Z][A-Z0-9]*(?:\s*\(\s*USD\s*\))?)\s+Unit\b/i.exec(l.text);
    name=m?.[1]||null;
   }else if(layout.purposeClassHeading){
    const m=/\b((?:Class\s+[A-Z][A-Z0-9]*|ETF)\s*Units?)\b/i.exec(l.text);
    if(m&&l.items.some(i=>new RegExp('\\b'+year+'\\b').test(i.str.trim())))name=m[1];
   }else{
    const raw=l.items.filter(i=>i.x<left+170).map(i=>i.str).join(' ').trim();
    if(/^(?:Series\s+[A-Za-z0-9-]+|Advisor\s+Series)$/i.test(raw))name=raw;
   }
   if(!name)continue;
   name=name.replace(/\s*Units?\s*$/i,'');
   headings.push({y:l.y,line:l,name});
  }
  headings.sort((a,b)=>b.y-a.y);
  for(let h=0;h<headings.length;h++){
   const head=headings[h],next=headings[h+1];
   if(compactName(head.name)!==targetClass)continue;
   const low=next?.y??Math.max(20,head.y-(layout.shortClassBand?155:265));
   const band=panelLines.filter(l=>l.y<=head.y+1&&l.y>low+1);
   // A table has its own printed year header. In Leith Wheeler the latest
   // year is on a SECOND line beneath the series heading, unlike 2024..2020.
   const yearHeaders=band.filter(l=>head.y-l.y<37).flatMap(l=>l.items.filter(it=>/^20\d{2}$/.test(it.str.trim()))).sort((a,b)=>a.x-b.x);
   if(!yearHeaders.length||Number(yearHeaders[0].str.trim())!==year||
    !yearHeaders.every((it,i)=>Number(it.str.trim())===year-i))continue;
   const yearX=tokenCenter(yearHeaders[0]);
   const matching=band.filter(l=>{
    const label=l.items.filter(it=>it.x<yearX-35).map(it=>it.str).join(' ').replace(/\s+/g,' ').replace(/^P\s+ortfolio\b/i,'Portfolio').trim();
    if(!metricRx.test(label))return false;
    if(key==='MER'&&/\bbefore\b|\bexcluding\b|allocation/i.test(label))return false;
    if(key==='MER'&&layout.requirePerformanceFee&&!/including\s+performance\s+fees/i.test(label))return false;
    return true;
   });
   if(matching.length!==1)continue;
   const metric=matching[0];
   const marks=cells(metric).concat(metric.items.filter(it=>/^n\s*\/?\s*a$/i.test(it.str.trim())).map(it=>({value:null,isMissing:true,raw:it.str,x:it.x,box:{x:it.x-1,y:it.y-1,w:it.w+2,h:Math.max(6,it.h)+2}})));
   const found=marks.filter(c=>c.x>yearX-29&&c.x<yearX+21&&c.x>=left&&c.x<right&&matchesCell(c,value));
   if(found.length===1)chosen.push(found[0]);
  }
 }
 const unique=new Map(chosen.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return unique.size===1?[...unique.values()][0]:null;
}

// BMG landscape two-page spreads: PDF.js text runs along +y and the
// physical table rows progress along +x. Use the exact printed year and
// metric label. Never select adjacent historical/before-waivers cells.
// Dated locators are invoked directly by their FMC adapters.
// GAP_FMCS is populated from the actual registered FMC gap handlers at build time.
function exactGapLabel(line,key,fmc){
 const t=clean(line.items.filter(i=>i.x<190).map(i=>i.str).join(' '));
 if(key==='MER'){
  if(/before|excluding|waivers|absorptions|taxes|financing/i.test(t))return false;
  return /^management expense ratio/.test(t);
 }
 if(key==='TER')return /^trading expense ratio(?:\s*\(\d+\))?$/.test(t);
 return /^(?:portfolio turnover (?:rate|ratio))/.test(t);
}
function gapValueRow(lines,label,key,fmc){
 // Middlefield's quoted ("MER") is on the next line; all other ratio
 // labels already contain the associated latest-year cells on the same line.
 if(FMC_EVIDENCE_LAYOUTS[fmc]?.gapMerContinuation&&key==='MER')return lines.filter(l=>l.y<=label.y+.8&&label.y-l.y<17);
 return [label];
}
function gapYearColumn(lines,ratio,year,contextFloor){
 // Find a printed year header just above the ratio, not an unrelated year
 // in the footnote, performance section, or on another page.
 const head=lines.filter(l=>l.y>ratio.y+3&&l.y-ratio.y<190&&l.y<contextFloor)
  .filter(l=>l.items.some(i=>new RegExp('\\b'+year+'\\b').test(i.str.trim())))
  .sort((a,b)=>a.y-b.y)[0];
 if(!head)return null;
 const years=head.items.filter(i=>/^20\d{2}$/.test(i.str.trim())).sort((a,b)=>a.x-b.x);
 const current=years.filter(i=>+i.str.trim()===year);
 if(!current.length&&head.items.some(i=>new RegExp('\\b'+year+'\\b').test(i.str.trim()))){
  const dateToken=head.items.filter(i=>new RegExp('\\b'+year+'\\b').test(i.str.trim()));
  if(dateToken.length===1)return dateToken[0].x;
 }
 if(current.length!==1||years.some(i=>+i.str.trim()>year))return null;
 return current[0].x;
}
function gapSeriesYearCell(page,lines,row,key,value){
 const fmc=row.fmc_key,year=Number(row.report_date?.slice(0,4));
 const titles=lines.filter(l=>{
  const t=clean(l.items.filter(i=>i.x<180).map(i=>i.str).join(' '));
  if(FMC_EVIDENCE_LAYOUTS[fmc]?.gapTickerCaption)return /^(?:fhq(?:\.f)?)$/.test(t);
  return /^(?:series\s+\w+(?:\s+\w+)?|class\s+[a-z](?:\s*\(cad\))?)$/.test(t);
 });
 const target=clean(row.class_name);
 const candidates=[];
 for(const label of lines.filter(l=>exactGapLabel(l,key,fmc))){
  const title=titles.filter(t=>t.y>label.y&&t.y-label.y<260).sort((a,b)=>a.y-b.y)[0];
  if(!title||clean(title.items.filter(i=>i.x<180).map(i=>i.str).join(' '))!==target)continue;
  // Require actual Ratios and Supplemental Data heading, with either a
  // dedicated heading per series or a shared one on the same source page.
  if(!lines.some(l=>/ratios?\s+(?:and|&)\s+supplemental/i.test(l.text)&&l.y>label.y))continue;
  const headerX=gapYearColumn(lines,label,year,title.y+3);
  if(headerX===null)continue;
  const matches=[];
  for(const metricLine of gapValueRow(lines,label,key,fmc)){
   for(const cell of cells(metricLine)){
    if(Math.abs(cell.x-headerX)<25&&matchesCell(cell,value)&&cell.x>180)matches.push(cell);
   }
  }
  const unique=new Map(matches.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
  if(unique.size===1)candidates.push(...unique.values());
 }
 const unique=new Map(candidates.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return unique.size===1?[...unique.values()][0]:null;
}
function gapEtfYearCell(page,lines,row,key,value){
 const fmc=row.fmc_key,year=Number(row.report_date?.slice(0,4));
 if(!/^(?:ETF|CAD|USD)\s+Units$/i.test(row.class_name))return null;
 const sections=lines.filter(l=>/ratios?\s+(?:and|&)\s+supplemental/i.test(l.text));
 const candidates=[];
 for(const section of sections){
  const labels=lines.filter(l=>l.y<section.y&&section.y-l.y<220&&exactGapLabel(l,key,fmc));
  if(labels.length!==1)continue;
  const label=labels[0];
  const h=gapYearColumn(lines,label,year,section.y+1);
  if(h===null)continue;
  const found=[];
  for(const l of gapValueRow(lines,label,key,fmc)){
   for(const c of cells(l))if(c.x>170&&Math.abs(c.x-h)<25&&matchesCell(c,value))found.push(c);
  }
  const unique=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
  if(unique.size===1)candidates.push(...unique.values());
 }
 const unique=new Map(candidates.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return unique.size===1?[...unique.values()][0]:null;
}
function gapDocIdentity(pages,row){
 if(!Array.isArray(pages)||!pages.length||!row.fund_name)return false;
 const simplify=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
 const name=simplify(row.fund_name);
 if(name.length<10)return false;
 if(!pages.some(p=>simplify(p.text).includes(name)))return false;
 const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso)return false;
 const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const nameMonth=months[Number(iso[2])-1];if(!nameMonth)return false;
 const monthRx=nameMonth.slice(0,3)+'(?:'+nameMonth.slice(3)+')?';
 const dateRx=new RegExp('\\b'+monthRx+'\\.?\\s*'+Number(iso[3])+'\\s*[,]?[\\s]+('+iso[1]+')\\b','i');
 const reverseRx=new RegExp('\\b'+Number(iso[3])+'\\s+'+monthRx+'\\.?[,]?\\s*'+iso[1]+'\\b','i');
 return pages.some(p=>dateRx.test(p.text)||reverseRx.test(p.text));
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

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_nbi={stamps:{fmcEvidenceVersion:1}};
function nbiCell(page,lines,row,key,value){
 const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(row.report_date||'');if(!iso)return null;
 const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const month=months[Number(iso[2])-1];if(!month)return null;
 if(!clean(page.text||'').includes(clean(row.fund_name)))return null;
 const canonical=s=>clean(s).replace(/[†*®™]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 const expected=canonical(row.class_name);
 const normalizedHeading=t=>String(t||'').replace(/[†*]/g,'').replace(/\s+/g,' ').trim();
 const sharedHeadingParts=t=>{
  const match=/^(Series\s+[a-z][a-z0-9-]*)\s*\/\s*(Private\s+Series)$/i.exec(normalizedHeading(t));
  return match?[match[1],match[2]]:[];
 };
 const seriesHeading=t=>/^(?:(?:investor(?:-\d+)?\s*\/\s*advisor(?:-\d+)?\s+series)|(?:(?:investor|advisor)(?:-\d+)?\s+series)|(?:private\s+series)|(?:series\s+[a-z][a-z0-9-]*)|(?:etfh?\s+series))$/i.test(normalizedHeading(t))||sharedHeadingParts(t).length>0;
 const headings=lines.filter(l=>seriesHeading(l.text));
 const label={MER:/^Management\s+expense\s+ratio\s*\(%\)$/i,TER:/^Trading\s+expense\s+ratio\s*\(%\)$/i,PTR:/^Portfolio\s+turnover\s+rate\s*\(%\)$/i}[key];
 const output=[];
 for(const section of lines.filter(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data\s*$/i.test(l.text))){
  const prev=headings.filter(l=>l.y>section.y&&l.y-section.y<520).sort((a,b)=>a.y-b.y)[0];
  if(!prev||![normalizedHeading(prev.text),...sharedHeadingParts(prev.text)].some(t=>canonical(t)===expected))continue;
  const end=Math.max(section.y-130,0);
  const block=lines.filter(l=>l.y<section.y&&l.y>end);
  const periods=block.filter(l=>/\bAccounting\s+Period\s+Ended\b/i.test(l.text));
  if(periods.length!==1)continue;
  const period=periods[0];
  const years=period.items.filter(i=>/^20\d{2}$/.test(i.str.trim())).sort((a,b)=>a.x-b.x);
  if(!years.length)continue;
  const dates=block.filter(l=>l.y<period.y&&period.y-l.y<14).flatMap(l=>l.items)
   .filter(i=>/^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}$/i.test(i.str.trim())).sort((a,b)=>a.x-b.x);
  if(dates.length!==years.length)continue;
  const yearIndexes=years.map((i,n)=>Number(i.str.trim())===Number(iso[1])&&new RegExp('^'+month+'\\s+'+Number(iso[3])+'$','i').test(dates[n].str.trim())&&Math.abs(i.x-dates[n].x)<28?n:-1).filter(n=>n>=0);
  if(yearIndexes.length!==1)continue;
  const matching=block.filter(l=>l.items.some(i=>i.x<265&&label.test(i.str.trim())));
  if(matching.length!==1)continue;
  const line=matching[0];
  const rowCells=line.items.filter(i=>i.x>265).flatMap(i=>{
    const raw=i.str.trim();const dash=/^[-–—−]{1,2}%?$/.test(raw);
    if(!dash&&!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(raw))return [];
    const n=dash?null:Number(raw.replace('%',''));
    if(!dash&&!Number.isFinite(n))return [];
    if(!(Number(i.w)>0&&Number(i.h)>0))return [];
    return [{value:n,raw,isMissing:dash,x:i.x,box:{x:Math.max(0,i.x-1),y:line.y-1,w:i.w+2,h:i.h+2}}];
  }).sort((a,b)=>a.x-b.x);
  if(rowCells.length!==years.length)continue;
  const index=yearIndexes[0],selected=rowCells[index];
  if(!selected||!matchesCell(selected,value)||Math.abs(selected.x-years[index].x)>32)continue;
  output.push(selected);
 }
 const unique=new Map(output.map(n=>[n.box.x.toFixed(1)+':'+n.box.y.toFixed(1),n]));
 return unique.size===1?[...unique.values()][0]:null;
}


// TD Asset Management: Year headings are aligned with one or two class
// headings per ratio block. Locate the ORIGINAL metric row and the report-
// period year inside the selected class band. Never use the before-waivers row.
// All x positions and column counts are read from the active PDF page.


function locateCell_nbi(page,lines,row,key,value,context){const selected=nbiCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-period-series-column'}:null;}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_desjardins={stamps:{desjardinsLocatorVersion:1}};
function desjardinsCell(page,lines,row,key,value){
 if(!fundOnPage(page,row))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(String(row.report_date||''));
 if(!iso)return null;
 const year=Number(iso[1]),month=Number(iso[2]),day=Number(iso[3]);
 const mon=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][month-1];
 if(!mon||day<1||day>31)return null;
 const className=clean(row.class_name).replace(/[–—]/g,'-');
 if(!/^[a-z][a-z0-9]{0,3}-class$/.test(className))return null;
 const datePattern=new RegExp('^'+mon+'[a-z]*\\.?\\s+'+day+'\\s*,?\\s*'+year+'$','i');
 const segments=lines.filter(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data$/i.test(l.text.trim()))
  .sort((a,b)=>b.y-a.y);
 const found=[];
 for(let j=0;j<segments.length;j++){
  const start=segments[j],bottom=segments[j+1]?.y??start.y-320;
  const block=lines.filter(l=>l.y<start.y-1&&l.y>bottom+1);
  const classes=block.filter(l=>l.items.some(it=>it.x<170&&
    /^[A-Z][A-Z0-9]{0,3}[-–—]CLASS$/i.test(it.str.trim())));
  if(classes.length!==1)continue;
  const classItem=classes[0].items.find(it=>it.x<170&&
    /^[A-Z][A-Z0-9]{0,3}[-–—]CLASS$/i.test(it.str.trim()));
  if(clean(classItem.str).replace(/[–—]/g,'-')!==className)continue;
  // Header must belong to this block and be above its Class label.
  const headers=block.filter(l=>l.y>classes[0].y&&l.y-classes[0].y<55);
  const tokens=headers.flatMap(l=>l.items.filter(it=>datePattern.test(it.str.trim())));
  if(tokens.length!==1)continue;
  const headRight=tokens[0].x+tokens[0].w;
  const rx={MER:/^Management expense ratio\s*\(\s*%\s*\)/i,
   TER:/^Trading expense ratio\s*\(\s*%\s*\)/i,
   PTR:/^Portfolio turnover rate\s*\(\s*%\s*\)/i}[key];
  if(!rx)continue;
  const rows=block.filter(l=>l.y<classes[0].y-2&&l.items.some(it=>it.x<200&&rx.test(it.str.trim()))
   &&(key!=='MER'||!/before\s+(?:waivers|absorptions)|before\s+waivers/i.test(l.text)));
  if(rows.length!==1)continue;
  const line=rows[0];
  // Cell right edges align with the PDF's printed period-header right edge.
  const marks=cells(line).concat(line.items.filter(it=>/^n\s*\/?\s*a$/i.test(it.str.trim()))
   .map(it=>({value:null,isMissing:true,raw:it.str,x:it.x,box:{x:it.x-1,y:it.y-1,w:it.w+2,h:it.h+2}})));
  const candidates=marks.filter(c=>c.x>250&&matchesCell(c,value)
   &&Math.abs(c.x+c.box.w-2-headRight)<7);
  if(candidates.length===1)found.push(candidates[0]);
 }
 const unique=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return unique.size===1?[...unique.values()][0]:null;
}


// Brandes: group consecutive current-year rows into physical Series bands. The
// Series label is printed in the middle of its year block, not before its first
// row. Derive ratio columns from PDF headers, never from matching numbers alone.


function locateCell_desjardins(page,lines,row,key,value,context){const selected=desjardinsCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:'desjardins-verified-class-period-ratio-cell'}:null;}

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

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_franklin={stamps:{franklinLocatorVersion:1}};
function franklinCell(page,lines,row,key,value){
 if(!clean(page.text).includes(clean(row.fund_name)))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso)return null;
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const date=months[Number(iso[2])-1]+' '+Number(iso[3])+', '+iso[1];
 const heads=lines.filter(l=>l.items.some(i=>/^Ratios and supplemental data:?$/i.test(i.str.trim())) &&
  l.items.some(i=>clean(i.str)===clean(date)));
 if(heads.length!==1)return null;
 const h=heads[0],dateCell=h.items.find(i=>clean(i.str)===clean(date));
 const laterYears=h.items.filter(i=>/^20\d{2}$/.test(i.str.trim())).sort((a,b)=>a.x-b.x);
 if(!dateCell||laterYears.length<1||Number(laterYears[0].str)!==Number(iso[1])-1||
    dateCell.x>=laterYears[0].x||!laterYears.every((i,j)=>Number(i.str)===Number(iso[1])-1-j))return null;
 const headings=lines.filter(l=>l.y>h.y&&l.y-h.y<250 && l.items.some(i=>clean(i.str)===clean(row.class_name)));
 if(headings.length!==1)return null;
 const band=lines.filter(l=>l.y<h.y&&h.y-l.y<95);
 const patterns={MER:/^Management expense ratio(?:\s*\(\d+\))?$/i,
                 TER:/^Trading expense ratio(?:\s*\(\d+\))?$/i,
                 PTR:/^Portfolio turnover rate(?:\s*\(\d+\))?$/i};
 if(!Object.values(patterns).every(rx=>band.filter(l=>l.items.some(i=>rx.test(i.str.trim()))).length===1))return null;
 const targetRows=band.filter(l=>l.items.some(i=>patterns[key].test(i.str.trim())));
 if(targetRows.length!==1)return null;
 const targetX=tokenCenter(dateCell);
 const rightBound=(targetX+tokenCenter(laterYears[0]))/2;
 const hits=cells(targetRows[0]).filter(c=>c.x>targetX-25&&c.x<rightBound&&matchesCell(c,value));
 return hits.length===1?hits[0]:null;
}

// Lysander-Canso: per-Series ratios with full or single-year columns.
// The current year is identified independently inside each physical Series
// band, even when its location differs (ETF Series starts in a far-right band).


function locateCell_franklin(page,lines,row,key,value,context){const selected=franklinCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:'franklin-verified-series-date-ratio-cell'}:null;}

const evidenceLayout_middlefield={gapMerContinuation:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_middlefield={stamps:{lastGapLocatorVersion:1}};


function locateGap_middlefield(page,lines,row,key,value){return gapEtfYearCell(page,lines,row,key,value);}

const evidenceLayout_manulife={newBatch:true,flexibleDate:true,shortClassBand:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_manulife={stamps:{nextFmcLocatorVersion:1}};


function locateCell_manulife(page,lines,row,key,value,context){const selected=nextBatchFmcCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'}:null;}

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

const evidenceLayout_purpose={newBatch:true,normalizePurposeTitle:true,splitPanels:true,purposeClassHeading:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_purpose={stamps:{nextFmcLocatorVersion:1}};


function locateCell_purpose(page,lines,row,key,value,context){const selected=nextBatchFmcCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'}:null;}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_blackrock={stamps:{tdBlackrockLocatorVersion:1}};
function blackrockCell(page,lines,row,key,value){
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');if(!iso)return null;
 const reportMonth=({ '06':'June','12':'December'})[iso[2]];
 if(!reportMonth)return null;
 // Some PDFs duplicate text glyphs, but the fund name tokens still appear.
 const firstLines=lines.slice(0,3).map(l=>l.text).join(' '),fundWords=clean(row.fund_name).replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>1);
 if(!fundWords.length||fundWords.filter(w=>new RegExp('(?:^|\\W)'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|\\W)','i').test(firstLines)).length<Math.ceil(fundWords.length*.85))return null;
 const periodText=lines.slice(0,6).map(l=>l.text).join(' ');
 if(!new RegExp('\\b'+reportMonth+'\\s+'+Number(iso[3])+'\\s*,?\\s*'+iso[1]+'\\b','i').test(periodText))return null;
 const section=lines.filter(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data\b/i.test(l.text));
 const found=[];
 for(const sec of section){
  const yearLines=lines.filter(l=>l.y>sec.y&&l.y-sec.y<260&&yearTokens(l).length>=2).sort((a,b)=>a.y-b.y);
  if(!yearLines.length)continue;
  const yearLine=yearLines[0],years=yearTokens(yearLine);
  if(years.some((yr,i)=>i&&Number(yr.str)>=Number(years[i-1].str)))continue;
  const targetIndex=years.findIndex(i=>Number(i.str)===Number(iso[1]));
  if(targetIndex<0)continue;
  // Require the date headings from THIS table, not only the page report date.
  const aboveYear=lines.filter(l=>l.y>yearLine.y&&l.y-yearLine.y<40);
  if(!aboveYear.some(l=>new RegExp('\\b'+reportMonth+'\\s+'+Number(iso[3])+'\\b','i').test(l.text)))continue;
  const units=yearLine.items.filter(i=>i.x<250).map(i=>i.str.trim()).join(' ').match(/\b(CAD|USD)\s+Units\b/i);
  if(/^\s*(?:CAD|USD)\s+Units\s*$/i.test(row.class_name||'')){
   if(!units||compactName(units[0])!==compactName(row.class_name))continue;
  }else if(units)continue; // A single ETF row must not steal CAD/USD evidence.
  else if(compactName(row.class_name)!==compactName(row.fund_name)&&!/^ETF\s+Units$/i.test(row.class_name||''))continue;
  const ratioRows=lines.filter(l=>l.y<sec.y&&sec.y-l.y<90&&labelledMetricLine(l,key,'blackrock'));
  if(ratioRows.length!==1)continue;
  const metric=ratioRows[0];
  const candidates=cells(metric).filter(n=>n.x>years[0].x-35);
  if(candidates.length!==years.length)continue;
  const chosen=candidates[targetIndex];
  if(!chosen||Math.abs(chosen.x-years[targetIndex].x)>25||!matchesCell(chosen,value))continue;
  found.push(chosen);
 }
 const uniq=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return uniq.size===1?[...uniq.values()][0]:null;
}


// Mackenzie / IG Mackenzie financial-highlight evidence: each page may have
// two independent, side-by-side series tables. Read the *printed* class,
// year/date headings and the labelled ratio row within that same column band.
// No fixed year, page, fund, series or ratio-coordinate mapping.


function locateCell_blackrock(page,lines,row,key,value,context){const selected=blackrockCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-fund-period-series-header-cell'}:null;}

// Adapter-owned dated-ratio header validation. Do not infer a column from values.
function ratioHeader_rbc(lines,rowY){
 const sections=lines.filter(l=>l.y>rowY&&l.y-rowY<590&&/ratios?\s+(?:and|&)\s+supplemental\s+data/i.test(l.text))
  .sort((a,b)=>a.y-b.y);
 for(const section of sections){
  const top=lines.filter(l=>l.y<section.y&&section.y-l.y<70&&l.y>rowY+6);
  if(!top.length)continue;
   const heads=top.filter(l=>l.items.some(i=>/^Management$/i.test(i.str.trim()))&&l.items.some(i=>/^MER Before$/i.test(i.str.trim()))&&l.items.some(i=>/^Portfolio$/i.test(i.str.trim()))&&l.items.some(i=>/^Trading$/i.test(i.str.trim())));
   if(heads.length!==1)continue;
   const h=heads[0],a=h.items.find(i=>/^Management$/i.test(i.str.trim())),b=h.items.find(i=>/^MER Before$/i.test(i.str.trim())),c=h.items.find(i=>/^Portfolio$/i.test(i.str.trim())),d=h.items.find(i=>/^Trading$/i.test(i.str.trim()));
   if(!(a.x<b.x&&b.x<c.x&&c.x<d.x))continue;
   const lower=top.filter(l=>l.y<h.y&&h.y-l.y<18).flatMap(l=>l.items);
   const close=(rx,head)=>lower.some(i=>rx.test(i.str.trim())&&Math.abs(i.x-head.x)<33);
   if(!(close(/^Expense Ratio\s*\(%\)/i,a)&&close(/^Absorption\s*\(%\)/i,b)&&close(/^Turnover Rate/i,c)&&close(/^Expense Ratio\s*\(%\)/i,d)))continue;
   return {MER:tokenCenter(a),before:tokenCenter(b),PTR:tokenCenter(c),TER:tokenCenter(d),section:section.y};
   }
 return null;
}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_rbc={stamps:{lastGapLocatorVersion:1}};
function gapRbcEtfCell(page,lines,row,key,value){
 if(!/^(?:ETF|CAD|USD)\s+Units$/i.test(row.class_name))return null;
 const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(row.report_date||'');if(!iso)return null;
 const header=lines.find(l=>l.items.some(i=>i.str.trim()==='Management')&&l.items.some(i=>i.str.trim()==='MER Before')&&l.items.some(i=>i.str.trim()==='Portfolio')&&l.items.some(i=>i.str.trim()==='Trading'));
 if(!header||!lines.some(l=>/ratios and supplemental data/i.test(l.text)&&l.y>header.y&&l.y-header.y<40))return null;
 const labels={MER:'Management',TER:'Trading',PTR:'Portfolio'};
 const target=header.items.find(i=>i.str.trim()===labels[key]);const before=header.items.find(i=>i.str.trim()==='MER Before');
 if(!target||!before||!(header.items.find(i=>i.str.trim()==='Management').x<before.x))return null;
 const lower=lines.filter(l=>l.y<header.y&&header.y-l.y<19).flatMap(l=>l.items);
 if(!lower.some(i=>(key==='PTR'?/Turnover Rate/:/Expense Ratio/).test(i.str)&&Math.abs(i.x-target.x)<35))return null;
 const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+iso[2]-1];
 const date=new RegExp('^'+month+'[a-z]*\\.?\\s+'+Number(iso[3])+'[,\\s]+'+iso[1]+'\\b','i');
 const vals=[];
 const x=target.x;
 for(const l of lines.filter(l=>date.test(l.text)&&l.y<header.y&&header.y-l.y<55)){
  const found=cells(l).filter(c=>Math.abs(c.x-x)<38&&matchesCell(c,value));
  if(found.length===1)vals.push(found[0]);
 }
 return vals.length===1?vals[0]:null;
}


function locateCell_rbc(page,lines,row,key,value,context){const selected=datedFmcCell(lines,row,key,value,row.fmc_key);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-header-validated-dated-cell'}:null;}

function locateGap_rbc(page,lines,row,key,value){return gapRbcEtfCell(page,lines,row,key,value);}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_bmo={stamps:{bmoAgfLocatorVersion:1}};


function locateCell_bmo(page,lines,row,key,value,context){const selected=issuerPeriodBandCell(page,row,key,value,row.fmc_key);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'}:null;}

// Extraction and evidence are emitted to separate classic-script bundles.
// Keep the exact same table-boundary selector in both generated bundles.
function bmgUprightRatioSection(band,titleOf){
 const heading=/^RATIOSANDSUPPLEMENTALDATA/;
 const first=band.findIndex(l=>heading.test(titleOf(l)));
 if(first<0)return null;
 const notes=/^(?:FOREXPLANATORYNOTES|EXPLANATORYNOTESTOFINANCIALHIGHLIGHTS|EXPLANATORYNOTES)/;
 const end=band.findIndex((l,i)=>i>first&&(heading.test(titleOf(l))||notes.test(titleOf(l))));
 return {section:band[first],rows:band.slice(first+1,end<0?band.length:end)};
}
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_bmg={stamps:{bmgLocatorVersion:2},refreshOnMismatch:false};
function bmgRotatedCell(page,row,key,value){
 const items=page.items||[],year=Number((row.report_date||'').slice(0,4));
 if(!year||!/^BMG\s/i.test(row.fund_name||''))return null;
 const heads=items.filter(it=>{
  const m=/^THE FUND[’']S NET ASSETS PER (CLASS\s+[A-Z][A-Z0-9-]*)\s+UNITS?$/i.exec(String(it.str||'').replace(/\s+/g,' ').trim());
  return m&&clean(m[1])===clean(row.class_name);
 });
 if(heads.length!==1)return null;
 const h=heads[0],section=items.filter(it=>/^RATIOS AND SUPPLEMENTAL DATA\s*:/i.test(it.str||'')
  &&it.x>h.x+45&&it.x<h.x+230&&Math.abs(it.y-h.y)<9);
 if(section.length!==1)return null;
 const yearHeads=items.filter(it=>String(it.str||'').trim()===String(year)
  &&Math.abs(it.x-h.x)<3.5&&it.y>h.y+80&&it.y<h.y+360);
 if(yearHeads.length!==1)return null;
 const labels={MER:/^Management expense ratio\s*\(%\)/i,
  TER:/^Trading expense ratio\s*\(%\)/i,
  PTR:/^Portfolio turnover rate\s*\(%\)/i};
 const lab=items.filter(it=>labels[key].test(it.str||'')&&it.x>section[0].x+8
  &&it.x<section[0].x+56&&Math.abs(it.y-section[0].y)<5);
 if(lab.length!==1)return null;
 const candidates=items.filter(it=>Math.abs(it.x-lab[0].x)<1.6&&it.y>=yearHeads[0].y-3
  &&it.y<yearHeads[0].y+18&&/^(?:\d+(?:\.\d+)?|[—–−-]{1,2}|n\/?a)$/i.test(String(it.str||'').trim()));
 if(candidates.length!==1)return null;
 const glyph=candidates[0],raw=glyph.str.trim();
 const isMissing=/^(?:[—–−-]{1,2}|n\/?a)$/i.test(raw);
 const actual=isMissing?null:Number(raw);
 if(value==null?!isMissing:!(Number.isFinite(actual)&&almost(actual,value)))return null;
 const height=Math.max(5,Number(glyph.h)||6),len=Math.max(1,Number(glyph.w)||0);
 return {x:glyph.x,y:glyph.y,raw,isMissing,value:actual,
  box:{x:Math.max(0,glyph.x-height-1),y:Math.max(0,glyph.y-1),w:height+3,h:len+2}};
}
// Upright BMG annual/interim Financial Highlights: current year is the first
// year on the class header; metric cells must be found on their own rows.
function bmgUprightCell(page,row,key,value){
 const year=Number((row.report_date||'').slice(0,4));if(!year)return null;
 const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 const lines=[];
 for(const it of page.items||[]){
  if(typeof it.str!=='string'||!it.str.trim()||!Number.isFinite(it.x)||!Number.isFinite(it.y))continue;
  let l=lines.find(x=>Math.abs(x.y-it.y)<2.4);
  if(!l){l={y:it.y,items:[]};lines.push(l);}l.items.push(it);
 }
 lines.forEach(l=>l.items.sort((a,b)=>a.x-b.x));lines.sort((a,b)=>b.y-a.y);
 const titleOf=l=>norm(l.items.filter(i=>i.x<300).map(i=>i.str).join(''));
 const heads=lines.map((l,i)=>{
  const m=/^THEFUNDSNETASSETSPERCLASS([A-Z][A-Z0-9]*)UNITS?$/.exec(titleOf(l));
  return m?{cls:'Class '+m[1],index:i,line:l}:null;
 }).filter(Boolean);
 const matches=[];
 for(let i=0;i<heads.length;i++){
  const head=heads[i];if(clean(head.cls)!==clean(row.class_name))continue;
  const band=lines.slice(head.index+1,heads[i+1]?.index??lines.length);
  const titleItems=head.line.items.filter(it=>it.x<300);
  const titleEnd=Math.max(...titleItems.map(it=>it.x+it.w));
  const years=head.line.items.filter(it=>it.x>titleEnd+14&&/^\d/.test(it.str)).sort((a,b)=>a.x-b.x);
  if(!years.length)continue;
  const start=years[0].x;let last=null,second=null,first=[];
  for(const it of years){
   if(last&&it.x-(last.x+last.w)>13){second=it.x;break;}
   first.push(it.str.replace(/\D/g,''));last=it;
  }
  if(first.join('')!==String(year))continue;
  if(!second)second=start+Math.max(42,Number(page.width||600)*.07);
  const ratio=bmgUprightRatioSection(band,titleOf);
  if(!ratio)continue;
  const labels={MER:/^MANAGEMENTEXPENSERATIO(?!BEFORE)/,
   TER:/^TRADINGEXPENSERATIO/,PTR:/^PORTFOLIOTURNOVERRATE/};
  const rows=ratio.rows.filter(l=>l.y<ratio.section.y-4&&labels[key].test(titleOf(l)));
  if(rows.length!==1)continue;
  const parts=rows[0].items.filter(it=>it.x>=start-14&&it.x<start+(second-start)/2)
   .sort((a,b)=>a.x-b.x);
  if(!parts.length)continue;
  const raw=parts.map(it=>it.str.replace(/\s/g,'')).join('');
  if(!/^(?:\d+(?:\.\d+)?|\.\d+|[—–−-]{1,2}|n\/?a)$/i.test(raw))continue;
  const missing=/^(?:[—–−-]{1,2}|n\/?a)$/i.test(raw),number=missing?null:Number(raw);
  if(value==null?!missing:!(Number.isFinite(number)&&almost(number,value)))continue;
  const x=Math.min(...parts.map(it=>it.x)),right=Math.max(...parts.map(it=>it.x+it.w));
  const height=Math.max(6,...parts.map(it=>Number(it.h)||6));
  if(!(right>x))continue;
  matches.push({x,raw,isMissing:missing,value:number,
   box:{x:Math.max(0,x-1),y:rows[0].y-1,w:right-x+2,h:height+2}});
 }
 return matches.length===1?matches[0]:null;
}
function bmgIdentity(pages,row){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(row.report_date||''));
 if(!m||!/^BMG\s+.{3,120}Fund$/i.test(row.fund_name||''))return false;
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const month=months[Number(m[2])-1];if(!month)return false;
 const rx=new RegExp('(?:period|six.month|year)\\s+ended\\s+'+month+'\\s+'+Number(m[3])+',?\\s+'+m[1],'i');
 const first=pages.slice(0,5);
 const docText=first.map(p=>(p.items||[]).map(i=>i.str).join(' ')+' '+(p.text||'')).join(' ');
 // Validate the fund using a real report title token, not a portfolio holding.
 const claimed=clean(row.fund_name);
 const title=first.some(p=>(p.items||[]).some(it=>clean(it.str)===claimed)) ||
  first.some(p=>String(p.text||'').split(/\r?\n/).some(t=>clean(t)===claimed));
 return title&&rx.test(docText);
}



function locateCell_bmg(page,lines,row,key,value,context){const rotated=bmgRotatedCell(page,row,key,value);const selected=rotated||bmgUprightCell(page,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:rotated?'bmg-verified-rotated-year-class-ratio-cell':'bmg-verified-upright-year-class-ratio-cell'}:null;}
function validateDocumentEvidence_bmg(pages,row){return bmgIdentity(pages,row);}


const evidenceLayout_first_trust={gapTickerCaption:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_first_trust={stamps:{lastGapLocatorVersion:1}};


function locateGap_first_trust(page,lines,row,key,value){return gapSeriesYearCell(page,lines,row,key,value);}

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

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_lysander={stamps:{lysanderLocatorVersion:1}};
function lysanderCell(page,lines,row,key,value){
 if(!clean(page.text).includes(clean(row.fund_name)))return null;
 const year=Number((row.report_date||'').slice(0,4));
 if(!Number.isInteger(year)||year<2000)return null;
 const cls=clean(row.class_name).replace(/\*+$/,'');
 const normalizeHeading=s=>clean(s).replace(/\*+$/,'');
 const heads=lines.filter(l=>/^((?:ETF|Series)\s+(?:Series|[A-Z][A-Z0-9-]*))\*?$/i.test(l.text.trim())||/^Series\s+[A-Z][A-Z0-9-]*\*?$/i.test(l.text.trim()));
 const matchingHeads=heads.filter(l=>normalizeHeading(l.text)===cls);
 if(matchingHeads.length!==1)return null;
 const title=matchingHeads[0];
 const next=heads.filter(l=>l.y<title.y-1).sort((a,b)=>b.y-a.y)[0];
 const minY=next?next.y:title.y-230;
 const segment=lines.filter(l=>l.y<title.y&&l.y>minY);
 const sections=segment.filter(l=>/^Ratios and supplemental data$/i.test(l.text));
 if(sections.length!==1)return null;
 const section=sections[0];
 const yearLines=segment.filter(l=>l.y>section.y&&l.y-section.y<57&&l.items.some(i=>new RegExp('\\b'+year+'\\b').test(i.str.trim())));
 if(yearLines.length!==1)return null;
 const years=yearLines[0].items.filter(i=>/^20\d{2}$/.test(i.str.trim())).sort((a,b)=>a.x-b.x);
 const yearIndex=years.findIndex(i=>Number(i.str)===year);
 if(yearIndex===-1||years.filter(i=>Number(i.str)===year).length!==1)return null;
 const current=years[yearIndex],currentX=tokenCenter(current);
 if(years.length>1&&yearIndex!==0)return null;
 const lower=segment.filter(l=>l.y<section.y&&section.y-l.y<115);
 const rx={MER:/^Management expense ratio[⁰¹²³⁴⁵⁶⁷⁸⁹\d]*$/i,
           TER:/^Trading expense ratio[⁰¹²³⁴⁵⁶⁷⁸⁹\d]*$/i,
           PTR:/^Portfolio turnover rate[⁰¹²³⁴⁵⁶⁷⁸⁹\d]*$/i}[key];
 const labels=lower.filter(l=>rx.test(l.text.split(/\s{2,}/)[0].trim())||
  l.items.some(i=>rx.test(i.str.trim())) ||
  // Layout splits 'Management expense' / 'ratio⁵' into separate PDF.js tokens.
  new RegExp('^'+(key==='MER'?'Management expense ratio':key==='TER'?'Trading expense ratio':'Portfolio turnover rate'),'i').test(l.text));
 const valid=labels.filter(l=>key!=='MER'||!/\bbefore\b/i.test(l.text));
 if(valid.length!==1)return null;
 // The available years determine mutually-exclusive column boundaries.
 const nextX=years[yearIndex+1]&&tokenCenter(years[yearIndex+1]);
 const right=nextX?(currentX+nextX)/2:currentX+29;
 const hits=cells(valid[0]).filter(c=>matchesCell(c,value)&&c.x>currentX-24&&c.x<right&&Math.abs(c.x-currentX)<25);
 return hits.length===1?hits[0]:null;
}


// Manulife, NewGen, Purpose and Leith Wheeler: table-bound, current-year
// source-cell location. All series, years, panels and cells are read from the
// current PDF; no fund-specific numbers, filenames or page positions are used.


function locateCell_lysander(page,lines,row,key,value,context){const selected=lysanderCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:'lysander-verified-series-year-metric-cell'}:null;}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_nei={stamps:{brandesNeiLocatorVersion:1}};
function neiCell(page,lines,row,key,value){
 if(!fundOnPage(page,row))return null;
 const date=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 const cls=/^Series\s+([A-Za-z0-9-]+)$/i.exec(row.class_name||'');
 if(!date||!cls)return null;
 const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][Number(date[2])-1];
 if(!month)return null;
 const section=lines.find(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data$/i.test(l.text.trim()));
 if(!section)return null;
 const allHeader=lines.filter(l=>l.y<section.y&&section.y-l.y<70).flatMap(l=>l.items);
 const find=rx=>allHeader.filter(i=>rx.test(i.str.trim()));
 const mgmt=find(/^Management$/i),expense=find(/^Expense Ratio$/i),before=find(/^before Waivers$/i);
 const trading=find(/^Trading Expense$/i),turn=find(/^Turnover Rate$/i);
 if(mgmt.length!==2||expense.length!==2||before.length!==1||trading.length!==1||turn.length!==1)return null;
 const e=expense.sort((a,b)=>a.x-b.x),a={MER:tokenCenter(e[0]),TER:tokenCenter(trading[0]),PTR:tokenCenter(turn[0])};
 if(!(a.MER<tokenCenter(before[0])&&tokenCenter(before[0])<a.TER&&a.TER<a.PTR))return null;
 if(!mgmt.some(it=>Math.abs(it.x-e[0].x)<14)||!mgmt.some(it=>Math.abs(it.x-e[1].x)<14))return null;
 // PDF headers here print a month/year, not the day. The exact report date
 // is still supplied independently by the extractor; only matching month and
 // year may be treated as current-period source evidence.
 const rxDate=new RegExp('^'+month+'[a-z]*\\.?\\s+'+date[1]+'$','i');
 const target=lines.filter(l=>l.y<section.y-42&&l.y>section.y-520&&
  l.items.some(i=>i.x<70&&i.str.trim().toUpperCase()===cls[1].toUpperCase())&&
  l.items.some(i=>i.x>60&&i.x<140&&rxDate.test(i.str.trim())));
 const found=[];
 for(const line of target){
  const marks=cells(line).concat(line.items.filter(i=>/^N\s*\/?\s*A$/i.test(i.str.trim())).map(i=>({value:null,isMissing:true,raw:i.str,x:i.x,box:{x:i.x-1,y:i.y-1,w:i.w+2,h:i.h+2}})));
  const match=marks.filter(c=>matchesCell(c,value)&&Math.abs(c.x+c.box.w/2-a[key])<28&&
   (key==='MER'?c.x<tokenCenter(before[0])-12:key==='TER'?c.x>a.MER+75&&c.x<a.PTR-15:c.x>a.TER+38));
  if(match.length===1)found.push(match[0]);
 }
 const unique=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return unique.size===1?[...unique.values()][0]:null;
}


// Pender: financial-ratio data are printed in one independent Class block per
// physical page band, under annual year columns. Reject the before-absorptions
// row even when it has the same value as the true MER.


function locateCell_nei(page,lines,row,key,value,context){const selected=neiCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-class-period-column'}:null;}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_mackenzie={stamps:{mackenzieLocatorVersion:1}};
function mackenzieCell(page,row,key,value){
 if(!fundOnPage(page,row))return null;
 const match=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!match||!/RATIOS\s+AND\s+SUPPLEMENTAL\s+DATA/i.test(page.text||''))return null;
 const targetYear=Number(match[1]),targetMonth=Number(match[2]),targetDay=Number(match[3]);
 const monthNames=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
 const expected=clean(row.class_name).replace(/\s+/g,' ');
 const width=Number(page.width)||612,split=width/2;
 const source=[];
 const labelRe={
  MER:/^Management expense ratio\s*\(%\)/i,
  TER:/^Trading expense ratio\s*\(%\)/i,
  PTR:/^Portfolio turnover rate\s*\(%\)/i
 }[key];
 for(const [minX,maxX] of [[0,split-3],[split-3,width+3]]){
  const column=textLines(page.items.filter(i=>i.x>=minX&&i.x<maxX));
  const headings=column.filter(line=>line.items.some(i=>/^20\d{2}$/.test(i.str.trim()))
    &&line.items.some(i=>{
      const title=clean(i.str).replace(/[\u00ae\u2122]/g,'').replace(/\s+/g,' ');
      return title===expected || (/^cad units$|^usd units$|^etf units$/i.test(expected)&&title.startsWith(expected+' (ticker:'));
    }));
  for(const title of headings){
   let years=title.items.filter(i=>/^20\d{2}$/.test(i.str.trim())).sort((a,b)=>a.x-b.x);
   if(years.length<2||years.length>8)continue;
   // Date labels can be printed in their own line directly above the year
   // headings. Require a real date, especially when the year is repeated
   // (September and March 2025 in interim reports).
   const dates=column.filter(l=>l.y>=title.y&&l.y-title.y<45).flatMap(l=>l.items)
     .filter(it=>/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{1,2}\b/i.test(it.str));
   let dateTokens=dates.sort((a,b)=>a.x-b.x);
   // IG continuation-table variation: the *header* can omit the first
   // reporting year while the first numeric ratio column is still printed.
   // Infer its location only from an adjacent same-band series with an
   // explicit target-year heading at the same X column. A year alone in
   // the page footer or an older-year value never qualifies.
   if(row.fmc_key==='ig_mackenzie'&&years.length>=2&&years.length===dateTokens.length
      &&Number(years[0].str.trim())===targetYear-1
      &&years.every((it,j)=>Number(it.str.trim())===targetYear-1-j)){
    const gaps=years.slice(1).map((it,j)=>it.x-years[j].x);
    const step=gaps.reduce((a,b)=>a+b,0)/gaps.length;
    const virtualX=years[0].x-step;
    const preceding=column.some(other=>other.y>title.y&&other.y-title.y<200
      &&other.items.some(it=>/^Series\s+[A-Z]/i.test(it.str.trim()))
      &&other.items.some(it=>it.str.trim()===String(targetYear)&&Math.abs(it.x-virtualX)<5)
      &&other.items.some(it=>it.str.trim()===String(targetYear-1)&&Math.abs(it.x-years[0].x)<5));
    const validDates=dateTokens.every(it=>{
      const d=/\b([A-Za-z]+)\.?\s*(\d{1,2})\b/.exec(it.str);
      return !!d&&d[1].toLowerCase().startsWith(monthNames[targetMonth-1])&&Number(d[2])===targetDay;
    });
    if(step>=15&&step<=45&&virtualX>minX+110&&preceding&&validDates){
      years=[{str:String(targetYear),x:virtualX},...years];
      dateTokens=[{str:dateTokens[0].str,x:virtualX},...dateTokens];
    }
   }
   const yearsWanted=years.map((it,i)=>Number(it.str.trim())===targetYear?i:-1).filter(i=>i>=0);
   if(!yearsWanted.length)continue;
   const dateValid=(yearIndex)=>{
    if(dateTokens.length!==years.length)return false;
    const yr=years[yearIndex],d=dateTokens[yearIndex];
    if(Math.abs(d.x-yr.x)>27)return false;
    const date=/\b([A-Za-z]+)\.?\s*(\d{1,2})\b/.exec(d.str);
    return !!date&&date[1].toLowerCase().startsWith(monthNames[targetMonth-1])&&Number(date[2])===targetDay;
   };
   const indices=yearsWanted.filter(dateValid);
   if(indices.length!==1)continue;
   const index=indices[0];
   const next=column.filter(l=>l.y<title.y&&l.y>title.y-230&&l.items.some(i=>/^(?:Series\s+[A-Z][A-Z0-9-]*(?:\s+[A-Z0-9-]+)*|(?:CAD|USD|ETF)\s+Units(?:\s*\(Ticker:.*?)?)$/i.test(i.str.trim())&&l.items.some(y=>/^20\d{2}$/.test(y.str.trim())))).sort((a,b)=>b.y-a.y)[0];
   const lower=next?next.y:title.y-175;
   const metrics=column.filter(l=>l.y<title.y-5&&l.y>lower+2&&l.items.some(i=>i.x<minX+155&&labelRe.test(i.str.trim())));
   if(metrics.length!==1)continue;
   const line=metrics[0];
   const rawValues=line.items.filter(it=>it.x>years[0].x-17).flatMap(it=>{
    const raw=it.str.trim(), missing=/^(?:n\s*\/\s*a|[-–—−]{1,2})$/i.test(raw);
    const numeric=/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(raw);
    if(!missing&&!numeric)return [];
    const number=missing?null:Number(raw.replace('%',''));
    if(!missing&&!Number.isFinite(number))return [];
    const w=Number(it.w),h=Number(it.h);if(!(w>0&&h>0))return [];
    return [{value:number,isMissing:missing,x:it.x,raw,box:{x:Math.max(0,it.x-1),y:line.y-1,w:w+2,h:h+2}}];
   }).sort((a,b)=>a.x-b.x);
   if(rawValues.length!==years.length)continue;
   const chosen=rawValues[index];
   if(chosen&&matchesCell(chosen,value)&&Math.abs(chosen.x-years[index].x)<24)source.push(chosen);
  }
 }
 const unique=new Map(source.map(c=>[c.box.x.toFixed(1)+':'+c.box.y.toFixed(1),c]));
 return unique.size===1?[...unique.values()][0]:null;
}

// BMO and AGF: locate values within an actual Class/Series + reporting-year
// ratio table band. Both issuers print two independent side-by-side tables,
// so page-wide year/value matching is unsafe. This routine discovers the
// current layout from the PDF, not from fixed pages, fund names or ratios.


function locateCell_mackenzie(page,lines,row,key,value,context){const selected=mackenzieCell(page,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:'mackenzie-verified-series-date-ratio-cell'}:null;}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_ig_mackenzie={stamps:{mackenzieLocatorVersion:1}};


function locateCell_ig_mackenzie(page,lines,row,key,value,context){const selected=mackenzieCell(page,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:'mackenzie-verified-series-date-ratio-cell'}:null;}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_fidelity={stamps:{fidelityLocatorVersion:1}};
function fidelityCell(lines,row,key,value){
 const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(row.report_date||''));
 if(!iso)return null;
 const year=Number(iso[1]),month=Number(iso[2]),day=Number(iso[3]);
 const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 if(month<1||month>12||day<1||day>31)return null;
 const series=clean(row.class_name);
 const fund=clean(row.fund_name).replace(/[^\p{L}\p{N} ]/gu,'').replace(/\s+/g,' ').trim();
 if(!fund||!series)return null;
 // Exact suffix match avoids Series F being confused with F5, F8 or FT5.
 const validTitle=(l)=>{
  const s=clean(l.text).replace(/[®™]/g,'').replace(/\s+/g,' ');
  if(!s.endsWith(' '+series))return false;
  const prefix=s.slice(0,-series.length).trim();
  // Some headings append the legal share-class corporation description.
  const normalized=prefix.replace(/[^\p{L}\p{N} ]/gu,'').replace(/\s+/g,' ').trim();
  return normalized.startsWith(fund);
 };
 const titles=lines.filter(validTitle).sort((a,b)=>b.y-a.y);
 if(titles.length!==1)return null;
 const title=titles[0];
 const nextTitle=lines.filter(l=>l.y<title.y&&l.y>title.y-580&&/\b(?:series\s+[A-Z][A-Z0-9-]*|ETF Series)\s*$/i.test(l.text)&&/fidelity/i.test(l.text))
  .sort((a,b)=>b.y-a.y)[0];
 const lowerBound=nextTitle?nextTitle.y:title.y-580;
 const inside=lines.filter(l=>l.y<title.y&&l.y>lowerBound);
 const section=inside.filter(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data\b/i.test(l.text));
 if(section.length!==1)return null;
 const ratioY=section[0].y;
 const headArea=inside.filter(l=>l.y>ratioY&&l.y<title.y);
 const allYearLines=headArea.filter(l=>l.items.some(i=>/^20\d{2}$/.test(i.str.trim()))).sort((a,b)=>a.y-b.y);
 if(allYearLines.length!==1)return null;
 const years=allYearLines[0].items.filter(i=>/^20\d{2}$/.test(i.str.trim())).sort((a,b)=>a.x-b.x);
 if(!years.length||years.some((it,i)=>i>0&&it.x<=years[i-1].x))return null;
 // Require actual printed reporting-month and day, not just year equality.
 const dateLines=headArea.filter(l=>new RegExp('\\b'+months[month-1]+'\\s+'+day+'\\s*,?', 'i').test(l.text));
 if(dateLines.length===0)return null;
 const matchingYears=years.filter(i=>Number(i.str.trim())===year);
 if(!matchingYears.length)return null;
 let yearItem=null;
 if(matchingYears.length===1){
  // In normal tables the year headings share one date heading. In mixed
  // annual/semiannual tables, the month/day heading must also cover the cell.
  yearItem=matchingYears[0];
 }else{
  // A year can appear twice (e.g. Dec 31, 2025 and Jun 30, 2025).
  // Compare the actual date-heading x location to each year heading, and
  // decline ambiguous/tied matches instead of guessing the left column.
  const candidates=dateLines.flatMap(l=>l.items.filter(i=>new RegExp('\\b'+months[month-1]+'\\s+'+day+'\\s*,?', 'i').test(i.str)));
  if(!candidates.length)return null;
  const distances=matchingYears.map(yr=>({yr,d:Math.min(...candidates.map(h=>Math.abs(h.x-yr.x)))})).sort((a,b)=>a.d-b.d);
  if(distances.length>1&&distances[1].d-distances[0].d<9)return null;
  yearItem=distances[0].yr;
 }
 // The labelled metric row must belong to the current class/table block.
 const ratioRows=inside.filter(l=>l.y<ratioY&&ratioY-l.y<115);
 const exactLabel={MER:/^Management\s+expense\s+ratio\s*$/i,TER:/^Trading\s+expense\s+ratio\s*$/i,PTR:/^Portfolio\s+turnover\s+rates?\s*$/i}[key];
 const metricRows=ratioRows.filter(l=>l.items.some(it=>it.x<225&&exactLabel.test(it.str.trim())));
 if(metricRows.length!==1)return null;
 const metricLine=metricRows[0];
 // Parse literal PDF glyphs including leading-dot decimals (.35%) and
 // printed missing markers (–%, -%, —, --). Never turn null into zero.
 const metricCells=metricLine.items.filter(it=>it.x>250).flatMap(it=>{
  const raw=String(it.str).trim().replace(/\s+/g,'');
  if(!raw)return [];
  const dash=/^[-–—−]{1,2}%?$/.test(raw);
  const number=/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(raw);
  if(!dash&&!number)return [];
  const parsed=dash?null:Number(raw.replace('%',''));
  if(!dash&&!Number.isFinite(parsed))return [];
  const w=Number(it.w),h=Number(it.h);
  if(!Number.isFinite(w)||w<=0||!Number.isFinite(h)||h<=0)return [];
  return [{value:parsed,isMissing:dash,raw,x:it.x,box:{x:Math.max(0,it.x-1),y:metricLine.y-1,w:w+2,h:h+2}}];
 }).sort((a,b)=>a.x-b.x);
 // The ratio row and the printed years must have exactly the same number of
 // year-columns; align ordinally, not by repeated numeric values. This also
 // handles same-valued TER/PTR across all series/years.
 if(metricCells.length!==years.length)return null;
 const idx=years.indexOf(yearItem);
 const selected=metricCells[idx];
 if(!selected||!matchesCell(selected,value))return null;
 // Guard against accidental column shifts if the PDF has unusual spacing.
 const yx=yearItem.x;
 if(selected.x<yx-13||Math.abs(selected.x-yx)>60)return null;
 for(let i=1;i<metricCells.length;i++){
  if(metricCells[i].x<=metricCells[i-1].x||metricCells[i].x<years[i-1].x) return null;
 }
 return selected;
}


// DYNAMIC: actual dated series rows, with required PDF column headings.
// These rules depend on table structure, NOT fund name, date, page or x-coordinate.


function locateCell_fidelity(page,lines,row,key,value,context){const selected=fidelityCell(lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:'fidelity-period-series-labelled-column'}:null;}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_pender={stamps:{penderScotiaLocatorVersion:1}};
function penderCell(page,lines,row,key,value){
 if(!fundOnPage(page,row))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso||!/^Class\s+[A-Za-z0-9]+(?:\s*\(USD\))?$/i.test(row.class_name||''))return null;
 const year=Number(iso[1]);
 const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const month=months[Number(iso[2])-1];if(!month)return null;
 const periodRx=new RegExp('For\\s+the\\s+(?:year|period)\\s+ended\\s+'+month+'\\s+'+Number(iso[3])+',?\\s*'+year,'i');
 if(!periodRx.test((page.text||'').slice(0,500)))return null;
 const section=lines.find(l=>/^Ratios?\s+(?:and|&)\s+Supplemental\s+Data\b/i.test(l.text.trim()));
 if(!section)return null;
 // Read current-year coordinate directly from the header immediately below section.
 const yearLines=lines.filter(l=>l.y<section.y&&section.y-l.y<44)
  .filter(l=>l.items.some(it=>it.str.trim()===String(year)));
 if(yearLines.length!==1)return null;
 const yearTokens=yearLines[0].items.filter(it=>/^20\d{2}$/.test(it.str.trim())).sort((a,b)=>a.x-b.x);
 if(yearTokens.length<1||Number(yearTokens[0].str.trim())!==year||
  !yearTokens.every((it,i)=>Number(it.str.trim())===year-i))return null;
 const targetX=tokenCenter(yearTokens[0]);
 const classes=lines.filter(l=>l.y<yearLines[0].y&&l.items.some(it=>it.x<120&&
  /^Class\s+[A-Za-z0-9]+(?:\s*\(USD\))?$/i.test(it.str.trim())))
  .sort((a,b)=>b.y-a.y);
 const found=[];
 for(let i=0;i<classes.length;i++){
  const cls=classes[i],label=cls.items.find(it=>it.x<120&&/^Class\s+/i.test(it.str.trim()));
  if(clean(label?.str)!==clean(row.class_name))continue;
  const lower=classes[i+1]?.y??Math.max(35,cls.y-140);
  const band=lines.filter(l=>l.y<cls.y-1&&l.y>lower+1);
  const rx={MER:/^Management expense ratio\s*\(\w+\)/i,
   TER:/^Trading expense ratio\s*\(\w+\)/i,
   PTR:/^Portfolio turnover rate\s*\(\w+\)/i}[key];
  const matching=band.filter(l=>l.items.some(it=>it.x<250&&rx.test(it.str.trim())) &&
   (key!=='MER'||!/before\s+(?:waivers|absorptions)/i.test(l.text)));
  if(matching.length!==1)continue;
  const marks=cells(matching[0]).concat(matching[0].items.filter(it=>/^n\s*\/?\s*a$/i.test(it.str.trim())).map(it=>({value:null,isMissing:true,raw:it.str,x:it.x,box:{x:it.x-1,y:it.y-1,w:it.w+2,h:it.h+2}})));
  const hits=marks.filter(c=>c.x>225&&Math.abs(c.x+c.box.w/2-targetX)<22&&matchesCell(c,value));
  if(hits.length===1)found.push(hits[0]);
 }
 const uniq=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return uniq.size===1?[...uniq.values()][0]:null;
}

// Scotia: the header has MER, MER-before-waivers, TER, and PTR in adjacent
// columns. Use the physical column header alignment AND the exact dated row
// under the selected Series, never just equal numeric text.


function locateCell_pender(page,lines,row,key,value,context){const selected=penderCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-period-header-cell'}:null;}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_brandes={stamps:{brandesNeiLocatorVersion:1}};
function brandesCell(page,lines,row,key,value){
 // Brandes ratio pages identify the fund in a letter-spaced footer, not a title.
 // Verify the entire page's printed fund identifier, never assume a filename.
 if(!compactName(page.text).includes(compactName(row.fund_name)))return null;
 const targetYear=Number((row.report_date||'').slice(0,4));
 if(!targetYear||!/^Series\s+[A-Za-z0-9-]+$/i.test(row.class_name||''))return null;
 const section=lines.find(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data$/i.test(l.text.trim()));
 if(!section)return null;
 const headerItems=lines.filter(l=>l.y<section.y&&section.y-l.y<65).flatMap(l=>l.items);
 const findUnique=rx=>headerItems.filter(i=>rx.test(i.str.trim()));
 const mer=findUnique(/^ratio\s*\(MER\)$/i),before=findUnique(/^MER before waivers$/i);
 const turn=findUnique(/^turnover rate$/i),trading=findUnique(/^expense ratio$/i);
 if([mer,before,turn,trading].some(a=>a.length!==1))return null;
 const anchors={MER:tokenCenter(mer[0]),PTR:tokenCenter(turn[0]),TER:tokenCenter(trading[0])};
 if(!(anchors.MER<tokenCenter(before[0])&&tokenCenter(before[0])<anchors.PTR&&anchors.PTR<anchors.TER))return null;
 const current=lines.filter(l=>l.y<section.y-20&&l.items.some(i=>i.x<180&&i.x>65&&i.str.trim()===String(targetYear)))
  .sort((a,b)=>b.y-a.y);
 const found=[];
 for(let j=0;j<current.length;j++){
  const top=current[j],bottom=current[j+1]?.y??top.y-100;
  // A full series contains its own physical Series caption, usually beside
  // the third historical year. Never infer a class from a prior page.
  const captions=lines.filter(l=>l.y<top.y&&l.y>bottom&&l.items.some(i=>i.x<125&&/^Series\s+[A-Za-z0-9-]+$/i.test(i.str.trim())));
  if(captions.length!==1||clean(captions[0].text)!==clean(row.class_name))continue;
  const years=lines.filter(l=>l.y<=top.y&&l.y>bottom&&l.items.some(i=>i.x<180&&i.x>65&&/^20\d{2}$/.test(i.str.trim())))
   .sort((a,b)=>b.y-a.y);
  if(years.length<1||!years[0].items.some(i=>i.x<180&&i.str.trim()===String(targetYear)))continue;
  // Historical rows must be chronologically descending when present.
  if(!years.every((l,i)=>l.items.some(it=>it.x<180&&it.str.trim()===String(targetYear-i))))continue;
  // Require the target-year printed cell to be inside the metric's header
  // column band, excluding adjacent MER-before-waivers even if identical.
  const targetX=anchors[key];
  const marks=cells(top);
  const selected=marks.filter(c=>matchesCell(c,value)&&c.x>290&&Math.abs(c.x+c.box.w/2-targetX)<28);
  // A tighter band excludes the neighboring MER-before-waivers value.
  const restrict=key==='MER'?selected.filter(c=>c.x<tokenCenter(before[0])-12):
   key==='PTR'?selected.filter(c=>c.x>tokenCenter(before[0])+15&&c.x<anchors.TER-20):
   selected.filter(c=>c.x>anchors.PTR+25);
  if(restrict.length===1)found.push(restrict[0]);
 }
 const unique=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return unique.size===1?[...unique.values()][0]:null;
}

// NEI: date/class live in one physical row, while the actual MER and the
// before-waivers MER have separate adjacent header columns. Derive anchors
// from printed column titles; missing N/A is a real source glyph, not zero.


function locateCell_brandes(page,lines,row,key,value,context){const selected=brandesCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-class-period-column'}:null;}

const evidenceLayout_agf={issuerPeriodBandAgf:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_agf={stamps:{bmoAgfLocatorVersion:1}};


function locateCell_agf(page,lines,row,key,value,context){const selected=issuerPeriodBandCell(page,row,key,value,row.fmc_key);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'}:null;}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_harvest={stamps:{lastGapLocatorVersion:1}};


function locateGap_harvest(page,lines,row,key,value){return gapSeriesYearCell(page,lines,row,key,value);}

function validateAnnualEtfRow_vanguard(page,row){return /^ETF Units$/i.test(row.class_name||'');}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_vanguard={stamps:{annualEtfLocatorVersion:1}};


function locateCell_vanguard(page,lines,row,key,value,context){const selected=annualEtfCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-year-ratio-cell'}:null;}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_ninepoint={stamps:{lastGapLocatorVersion:1}};


function locateGap_ninepoint(page,lines,row,key,value){return gapSeriesYearCell(page,lines,row,key,value);}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_global_x={stamps:{lastGapLocatorVersion:1}};


function locateGap_global_x(page,lines,row,key,value){return gapEtfYearCell(page,lines,row,key,value);}



function validateAnnualEtfRow_hamilton(page,row){return clean(page.text).includes(clean(row.fund_name)) && /^Class E$/i.test(row.class_name||'');}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_hamilton={stamps:{annualEtfLocatorVersion:1}};


function locateCell_hamilton(page,lines,row,key,value,context){const selected=annualEtfCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-year-ratio-cell'}:null;}

const evidenceLayout_newgen={newBatch:true,newgenClassHeading:true,requirePerformanceFee:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_newgen={stamps:{nextFmcLocatorVersion:1}};


function locateCell_newgen(page,lines,row,key,value,context){const selected=nextBatchFmcCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'}:null;}


// Exact dated-year Class source locator moved from the shared core, unchanged.
function locateCell_rpia(page,lines,row,key,value,{hint=false,year}={}){
 function choose(candidates,kind){
  const unique=new Map(candidates.map(m=>[`${m.box.x.toFixed(1)}:${m.box.y.toFixed(1)}`,{...m,page:page.page,metric:key,kind}]));
  return unique.size===1?[...unique.values()][0]:null;
 }
{
  const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateRx=iso?new RegExp('^'+months[Number(iso[2])-1]+'(?:e)?\\.?\\s+'+Number(iso[3])+'[,\\s]+'+year+'\\b','i'):null;
  const normalizeClass=s=>clean(s).replace(/\*+$/,'').trim();
  const found=[];
  for(const l of lines){
   if(!dateRx||!dateRx.test(l.text))continue;
   // Only the closest class heading applies to a dated row; importantly,
   // "Class A" is not the same as "Class A-USD**".
   const heading=lines.filter(x=>x.y>l.y&&x.y-l.y<245&&/^class\s+[a-z][a-z0-9]*(?:-usd)?\**$/i.test(x.text.trim()))
     .sort((a,b)=>a.y-b.y)[0];
   if(!heading||normalizeClass(heading.text)!==normalizeClass(row.class_name))continue;
   const main=lines.filter(x=>x.y>l.y&&x.y-l.y<570&&x.items.some(i=>/^management expense$/i.test(i.str.trim()))&&x.items.some(i=>/^trading$/i.test(i.str.trim()))&&x.items.some(i=>/^portfolio$/i.test(i.str.trim())))
     .sort((a,b)=>a.y-b.y)[0];
   if(!main)continue;
   const xBefore=main.items.find(i=>/^management expense$/i.test(i.str.trim()))?.x;
   const xTrade=main.items.find(i=>/^trading$/i.test(i.str.trim()))?.x;
   const xTurn=main.items.find(i=>/^portfolio$/i.test(i.str.trim()))?.x;
   const xNAV=main.items.find(i=>/^net asset$/i.test(i.str.trim()))?.x;
   const firstHeader=lines.some(x=>x.y<=main.y&&main.y-x.y<20&&x.items.some(i=>/^management$/i.test(i.str.trim())&&i.x<xBefore-15));
   if(!firstHeader||![xBefore,xTrade,xTurn,xNAV].every(Number.isFinite)||!(xBefore<xTrade&&xTrade<xTurn&&xTurn<xNAV))continue;
   const values=cells(l);
   const candidates=values.filter(n=>{
    if(key==='MER')return n.x>xBefore-95&&n.x<xBefore-1;
    if(key==='TER')return n.x>xTrade-5&&n.x<xTurn-1;
    return n.x>xTurn-5&&n.x<xNAV-1;
   }).filter(n=>matchesCell(n,value));
   if(candidates.length===1)found.push(candidates[0]);
  }
  const selected=choose(found,'rpia-dated-class-column');if(selected)return selected;
 }
 return null;
}


const evidenceLayout_leith_wheeler={newBatch:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_leith_wheeler={stamps:{nextFmcLocatorVersion:1}};


function locateCell_leith_wheeler(page,lines,row,key,value,context){const selected=nextBatchFmcCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'}:null;}

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

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_scotia={stamps:{penderScotiaLocatorVersion:1}};
function scotiaCell(page,lines,row,key,value){
 if(!compactName(page.text).includes(compactName(row.fund_name)))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso||!/^Series\s+[A-Za-z0-9-]+$/i.test(row.class_name||''))return null;
 const year=Number(iso[1]),month=Number(iso[2]),day=Number(iso[3]);
 const mon=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][month-1];
 if(!mon||day<1||day>31)return null;
 const dateRx=new RegExp('^'+mon+'[a-z]*\\.?\\s+'+day+',?\\s*'+year+'$','i');
 const sections=lines.filter(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data\s*$/i.test(l.text.trim()));
 const found=[];
 for(const section of sections){
  const headers=lines.filter(l=>l.y<section.y&&section.y-l.y<55).flatMap(l=>l.items);
  const find=rx=>headers.filter(it=>rx.test(it.str.trim()));
  const mgmt=find(/^Management$/i),before=find(/^MER before$/i),trading=find(/^Trading$/i),ptr=find(/^Portfolio turnover$/i);
  const expense=find(/^expense ratio$/i);
  if(mgmt.length!==1||before.length!==1||trading.length!==1||ptr.length!==1||expense.length!==2)continue;
  const anchors={MER:tokenCenter(mgmt[0]),TER:tokenCenter(trading[0]),PTR:tokenCenter(ptr[0])};
  if(!(anchors.MER<tokenCenter(before[0])&&tokenCenter(before[0])<anchors.TER&&anchors.TER<anchors.PTR))continue;
  if(!expense.some(it=>Math.abs(it.x-mgmt[0].x)<12)||!expense.some(it=>Math.abs(it.x-trading[0].x)<24))continue;
  const series=lines.filter(l=>l.y<section.y-22&&l.y>Math.max(section.y-410,40)&&
   l.items.some(it=>it.x<140&&/^Series\s+[A-Za-z0-9-]+$/i.test(it.str.trim())))
   .sort((a,b)=>b.y-a.y);
  for(let i=0;i<series.length;i++){
   const label=series[i].items.find(it=>it.x<140&&/^Series\s+/i.test(it.str.trim()));
   if(clean(label?.str)!==clean(row.class_name))continue;
   const bottom=series[i+1]?.y??Math.max(section.y-410,40);
   const dated=lines.filter(l=>l.y<series[i].y-1&&l.y>bottom+1&&
    l.items.some(it=>it.x<140&&dateRx.test(it.str.trim())));
   if(dated.length!==1)continue;
   const marks=cells(dated[0]).concat(dated[0].items.filter(it=>/^n\s*\/?\s*a$/i.test(it.str.trim())).map(it=>({value:null,isMissing:true,raw:it.str,x:it.x,box:{x:it.x-1,y:it.y-1,w:it.w+2,h:it.h+2}})));
   const targetX=anchors[key],otherX=tokenCenter(before[0]);
   const hits=marks.filter(c=>matchesCell(c,value)&&
    Math.abs(c.x+c.box.w/2-targetX)<24&&
    (key!=='MER'||c.x+c.box.w/2<(targetX+otherX)/2));
   if(hits.length===1)found.push(hits[0]);
  }
 }
 const uniq=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return uniq.size===1?[...uniq.values()][0]:null;
}

// Hamilton and Vanguard annual ETF tables: a single explicitly labelled
// financial-ratio block with year columns, independent of fund-specific pages
// or numerical values. Never identify MER by matching the adjacent waiver row.


function locateCell_scotia(page,lines,row,key,value,context){const selected=scotiaCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-period-header-cell'}:null;}

// New FMC-local stamp; no changes to other managers' History/Restore policies.
const evidencePolicy_capital_group={stamps:{capitalGroupRatioLocatorVersion:1}};
function validateDocumentEvidence_capital_group(pages,row){
 const name=String(row?.fund_name||'').toLowerCase();
 return /^capital group\s+.+\s+(?:fund|etf)\s*\(canada\)$/.test(name)&&
   pages.some(p=>String(p.text||'').toLowerCase().includes(name));
}
function locateCell_capital_group(page,lines,row,key,value,context){
 if(key!=='MER'&&key!=='PTR'||value===null||value===undefined||
    !String(page.text||'').toLowerCase().includes(String(row.fund_name||'').toLowerCase()))return null;
 const r=/^(20\d\d)-(\d\d)-(\d\d)$/.exec(row.report_date||'');
 if(!r)return null;
 const targetDate=`${Number(r[2])}/${Number(r[3])}/${r[1]}`;
 const sections=lines.filter(l=>/^Ratios and Supplemental Data\b/i.test(l.text));
 if(sections.length!==1)return null;
 const section=sections[0];
 const headers=lines.filter(l=>l.y<section.y&&section.y-l.y<85)
  .filter(l=>/Management\s+Before Waivers or\s+Trading\s+Portfolio\s+Net Asset/i.test(l.text));
 if(headers.length!==1)return null;
 const head=headers[0];
 const anchor=t=>head.items.filter(it=>it.str.trim()===t);
 const management=anchor('Management'),before=anchor('Before Waivers or'),trading=anchor('Trading'),portfolio=anchor('Portfolio'),nav=anchor('Net Asset');
 if([management,before,trading,portfolio,nav].some(a=>a.length!==1))return null;
 const [mx,bx,tx,px,nx]=[management[0],before[0],trading[0],portfolio[0],nav[0]].map(it=>it.x);
 if(!(mx+25<bx&&bx+25<tx&&tx+25<px&&px+25<nx))return null;
 const expectedClass=String(row.class_name||'');
 const isEtf=/^ETF Units$/i.test(expectedClass)&&/\bETF\s*\(Canada\)$/i.test(row.fund_name||'');
 if(!isEtf&&!/^Series\s+[A-Z](?:\d+)?$/i.test(expectedClass))return null;
 const dated=lines.filter(l=>l.y<headers[0].y&&
   new RegExp('^(?:Period|Year) ended\\s+'+targetDate.replaceAll('/','\\/')+'(?:\\s|$)','i').test(l.text));
 const matches=[];
 for(const current of dated){
  if(current.y<20||current.y>section.y-45)continue;
  const preceding=lines.filter(l=>l.y>current.y&&l.y<section.y&&
     /^Series\s+[A-Z](?:\d+)?\s*$/i.test(l.text.trim())).sort((a,b)=>a.y-b.y);
  if(isEtf){if(preceding.length)continue;}
  else if(!preceding.length||preceding[0].text.trim().toLowerCase()!==expectedClass.toLowerCase())continue;
  const lower=key==='MER'?mx-5:px-5;
  const upper=key==='MER'?bx-10:nx-10;
  const c=cells(current).filter(c=>c.x>=lower&&c.x<upper&&matchesCell(c,value));
  if(c.length!==1)continue;
  // Require adjacent printed ratio columns, not just an isolated number.
  const ratioVals=cells(current);
  if(!ratioVals.some(z=>z.x>=bx-5&&z.x<tx-10)||
     !ratioVals.some(z=>z.x>=tx-5&&z.x<px-10))continue;
  matches.push(c[0]);
 }
 const unique=new Map(matches.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 if(unique.size!==1)return null;
 return {...[...unique.values()][0],page:page.page,metric:key,kind:'capital-group-verified-current-series-and-metric-column'};
}

const evidencePolicy_arrow_capital={stamps:{arrowCapitalEvidenceVersion:1}};
function arrowCapitalEvidenceNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s*-\s*/g,'-').replace(/\s+/g,' ').trim();
}
function arrowCapitalEvidenceCompact(value){
 return arrowCapitalEvidenceNormalize(value).toLowerCase().replace(/[^a-z0-9]/g,'');
}
function arrowCapitalEvidenceSeriesHeading(line){
 const text=arrowCapitalEvidenceNormalize(line).toUpperCase();
 const match=/^SERIES\s+([A-Z][A-Z0-9]*)\s*(?:\(\s*RE-DESIGNATED\s+FROM\s+([A-Z0-9][A-Z0-9 ]*?)\s*\))?$/.exec(text);
 return match?{cls:`Series ${match[1].toUpperCase()}`}:null;
}
function validateDocumentEvidence_arrow_capital(pages,row){
 const manager=(pages||[]).slice(0,3).some(page=>/Arrow\s+Capital\s+Management\s+Inc\.?/i.test(page.text||''));
 const fund=arrowCapitalEvidenceCompact(row?.fund_name);
 return manager&&fund&&pages.some(page=>arrowCapitalEvidenceCompact(page.text||'').includes(fund));
}
function locateCell_arrow_capital(page,lines,row,key,value,context){
 if(!['MER','PTR'].includes(key)||value===null||value===undefined||
    !arrowCapitalEvidenceCompact(page.text||'').includes(arrowCapitalEvidenceCompact(row.fund_name)))return null;
 const year=Number(String(row.report_date||'').slice(0,4));if(!year)return null;
 const sections=lines.filter(line=>/^Ratios\s+and\s+Supplemental\s+Data\b/i.test(line.text));
 if(sections.length!==1)return null;
 const section=sections[0];
 const yearLines=lines.filter(line=>line.y>section.y&&line.y-section.y<42&&
  line.items.some(item=>new RegExp('^'+year+'(?:†)?$').test(String(item.str||'').trim())));
 if(yearLines.length!==1)return null;
 const yearItem=yearLines[0].items.find(item=>new RegExp('^'+year+'(?:†)?$').test(String(item.str||'').trim()));
 if(!yearItem)return null;
 const yearCenter=yearItem.x+(Number(yearItem.w)||0)/2;
 const headings=lines.filter(line=>line.y>yearLines[0].y&&line.y-yearLines[0].y<48)
  .map(line=>({line,heading:arrowCapitalEvidenceSeriesHeading(line.text)})).filter(item=>item.heading);
 if(headings.length!==1)return null;
 const expected=String(row.class_identity||row.class_name||'').trim().toLowerCase();
 if(headings[0].heading.cls.toLowerCase()!==expected)return null;
 const labelPattern=key==='MER'?/^Management\s+expense\s+ratio\b(?!\s+before\b)/i:/^Portfolio\s+turnover\s+rate\b/i;
 const metricLines=lines.filter(line=>line.y<section.y&&section.y-line.y<165&&labelPattern.test(line.text));
 if(metricLines.length!==1)return null;
 const line=metricLines[0];
 const candidates=cells(line).filter(cell=>matchesCell(cell,value)&&
  Math.abs((cell.box.x+cell.box.w/2)-yearCenter)<20);
 if(candidates.length!==1)return null;
 return {...candidates[0],page:page.page,metric:key,kind:'arrow-capital-current-period-series-ratio-cell'};
}

function guardianEvidenceNormalize(s){return String(s||'').normalize('NFKC').replace(/\u00ad/g,'').replace(/™|®|\bTM\b|TM(?=\s)/gi,'').replace(/\s+/g,' ').trim();}
function guardianEvidenceCompact(s){return guardianEvidenceNormalize(s).toLowerCase().replace(/[^a-z0-9]/g,'');}
function guardianEvidenceClassFromHeading(line){
 const text=guardianEvidenceNormalize(line);
 const m=/^Ratios?\s+(?:and|&)\s+Supplemental\s+Data\s*\((.+)\)\s*$/i.exec(text);
 if(!m)return null;
 return guardianEvidenceNormalize(m[1]).replace(/\s*\(formerly\b[^)]*\)\s*$/i,'').trim();
}
function guardianEvidenceFundMatches(text,fundName){
 const source=guardianEvidenceCompact(String(text||'').slice(0,2800));
 const target=guardianEvidenceCompact(fundName);
 if(target&&source.includes(target))return true;
 // Some PDF.js builds place a one-digit superscript in a separate text run.
 const targetLetters=target.replace(/\d/g,'');
 const sourceLetters=source.replace(/\d/g,'');
 const digits=String(fundName||'').match(/\d+/g)||[];
 return targetLetters.length>12&&sourceLetters.includes(targetLetters)&&digits.every(d=>source.includes(d));
}
function guardianEvidenceDateCenter(lines,section,iso){
 const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const month=monthNames[Number(iso[2])-1],day=Number(iso[3]),year=iso[1],prefix=month.slice(0,3)+'[a-z]*';
 const fullRx=new RegExp('^'+prefix+'\\.?\\s+'+day+',?\\s+'+year+'$','i');
 const monthDayRx=new RegExp('^'+prefix+'\\.?\\s+'+day+',?$','i');
 const monthOnlyRx=new RegExp('\\b'+prefix+'\\b','i');
 const dayYearRx=new RegExp('^'+day+',?\\s+'+year+'$','i');
 const yearRx=new RegExp('^'+year+'$');
 const nearby=lines.filter(l=>l.y<section.y&&section.y-l.y<145).flatMap(l=>l.items);
 const center=it=>tokenCenter(it);
 const direct=nearby.filter(it=>fullRx.test(guardianEvidenceNormalize(it.str)));
 if(direct.length===1)return center(direct[0]);
 if(direct.length>1)return null;
 const dateItems=nearby.filter(it=>monthDayRx.test(guardianEvidenceNormalize(it.str)));
 const monthItems=nearby.filter(it=>monthOnlyRx.test(guardianEvidenceNormalize(it.str)));
 const dayYearItems=nearby.filter(it=>dayYearRx.test(guardianEvidenceNormalize(it.str)));
 const yearItems=nearby.filter(it=>yearRx.test(guardianEvidenceNormalize(it.str)));
 const centers=[];
 for(const d of dateItems)for(const y of yearItems)
  if(Math.abs(center(d)-center(y))<22&&Math.abs(d.y-y.y)<40)centers.push(center(y));
 for(const m of monthItems)for(const dy of dayYearItems)
  if(Math.abs(center(m)-center(dy))<22&&Math.abs(m.y-dy.y)<40)centers.push(center(dy));
 const unique=[...new Set(centers.map(x=>Math.round(x*10)/10))];
 return unique.length===1?unique[0]:null;
}
const evidencePolicy_guardian={stamps:{guardianRatioLocatorVersion:1}};
function validateDocumentEvidence_guardian(pages,row){
 return pages.slice(0,5).some(p=>guardianEvidenceFundMatches(p.text,row?.fund_name));
}
function locateCell_guardian(page,lines,row,key,value,context){
 if(key!=='MER'&&key!=='PTR'||!Array.isArray(page.items)||page.ocrUsed)return null;
 if(!guardianEvidenceFundMatches(page.text,row.fund_name))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso)return null;
 const compactClass=s=>guardianEvidenceNormalize(s).toLowerCase();
 const sectionLines=lines.filter(l=>/^Ratios?\s+(?:and|&)\s+Supplemental\s+Data\b/i.test(l.text));
 const found=[];
 for(const section of sectionLines){
  const cls=guardianEvidenceClassFromHeading(section.text)||null;
  if(!cls||compactClass(cls)!==compactClass(row.class_name))continue;
  // Match the latest date by its actual date/year header cells. Annual
  // reports may split "December 31," and "2025" onto separate PDF.js lines.
  const target=guardianEvidenceDateCenter(lines,section,iso);
  if(!Number.isFinite(target))continue;
  const metricRx=key==='MER'?/^Management\s+expense\s+ratio\b/i:/^Portfolio\s+turnover\s+(?:rate|ratio)\b/i;
  const nextSection=sectionLines.filter(l=>l.y<section.y).sort((a,b)=>b.y-a.y)[0];
  const lowerBound=nextSection?nextSection.y+2:section.y-285;
  const metricLines=lines.filter(l=>l.y<section.y-2&&l.y>lowerBound&&section.y-l.y<285&&metricRx.test(l.text)
    &&!(key==='MER'&&/\bbefore\s+waivers\b|\babsorptions\b/i.test(l.text)));
  if(metricLines.length!==1)continue;
  const line=metricLines[0];
  const candidates=cells(line).filter(c=>matchesCell(c,value)&&
    Math.abs((c.x+c.box.w/2)-target)<19);
  if(candidates.length===1)found.push(candidates[0]);
 }
 const unique=new Map(found.map(c=>[`${c.box.x.toFixed(2)}:${c.box.y.toFixed(2)}`,c]));
 if(unique.size!==1)return null;
 const hit=[...unique.values()][0];
 return {...hit,page:page.page,metric:key,kind:'guardian-current-period-class-and-metric-cell'};
}

const evidencePolicy_beutel_goodman={stamps:{beutelGoodmanRatioLocatorVersion:2}};
function beutelGoodmanEvidenceNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();
}
function beutelGoodmanEvidenceClass(line){
 const match=/^Class\s+([A-Z0-9][A-Z0-9-]*)\s+Units?$/i.exec(beutelGoodmanEvidenceNormalize(line));
 return match?'Class '+match[1].toUpperCase():null;
}
function beutelGoodmanEvidenceDateHeader(line,iso){
 const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const month=monthNames[Number(iso[2])-1];if(!month||!Array.isArray(line.items))return null;
 const rx=new RegExp('^'+month+'\\s+'+iso[1]+'$','i');
 const dates=line.items.filter(item=>rx.test(beutelGoodmanEvidenceNormalize(item.str)));
 const years=line.items.filter(item=>/^20\d{2}$/.test(beutelGoodmanEvidenceNormalize(item.str)));
 if(dates.length!==1||years.length<2||Number(years[0].str)!==Number(iso[1])-1||years.slice(1).some((item,index)=>Number(item.str)>=Number(years[index].str)))return null;
 const item=dates[0];
 return item.x+(Number(item.w)||0)/2;
}
function validateDocumentEvidence_beutel_goodman(pages,row){
 const manager=(pages||[]).slice(0,5).some(page=>/Beutel\s+Goodman\s+Managed\s+Funds/i.test(page.text||'')||/Beutel,\s*Goodman\s*&\s*Company\s+Ltd\.?/i.test(page.text||''));
 const fund=beutelGoodmanEvidenceNormalize(row?.fund_name).toLowerCase().replace(/[^a-z0-9]/g,'');
 return manager&&fund&&(pages||[]).some(page=>beutelGoodmanEvidenceNormalize(page.text||'').toLowerCase().replace(/[^a-z0-9]/g,'').includes(fund));
}
function locateCell_beutel_goodman(page,lines,row,key,value,context){
 if((key!=='MER'&&key!=='PTR')||value===null||value===undefined||!Array.isArray(page.items)||page.ocrUsed)return null;
 const fund=beutelGoodmanEvidenceNormalize(row?.fund_name).toLowerCase().replace(/[^a-z0-9]/g,'');
 if(!fund||!beutelGoodmanEvidenceNormalize(page.text||'').toLowerCase().replace(/[^a-z0-9]/g,'').includes(fund))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');if(!iso)return null;
 const sections=lines.filter(line=>/^Ratios\s+and\s+Supplemental\s+Data$/i.test(line.text));
 if(sections.length!==1)return null;
 const section=sections[0];
 const expectedClass=String(row.class_identity||row.class_name||'');
 const classes=lines.filter(line=>line.y<section.y&&section.y-line.y<28&&
  beutelGoodmanEvidenceClass(line.text)===expectedClass);
 if(classes.length!==1)return null;
 const classLine=classes[0];
 const headers=lines.filter(line=>line.y<classLine.y&&classLine.y-line.y<48&&
  Number.isFinite(beutelGoodmanEvidenceDateHeader(line,iso)));
 if(headers.length!==1)return null;
 const header=headers[0],target=beutelGoodmanEvidenceDateHeader(header,iso);
 const labelRx=key==='MER'?/^Management\s+expense\s+ratio\b(?!\s+before\b)/i:/^Portfolio\s+turnover\s+rate\b/i;
 const metricLines=lines.filter(line=>line.y<header.y&&header.y-line.y<115&&labelRx.test(line.text));
 if(metricLines.length!==1)return null;
 const candidates=cells(metricLines[0]).filter(cell=>matchesCell(cell,value)&&
  Math.abs((cell.box.x+cell.box.w/2)-target)<18);
 if(candidates.length!==1)return null;
 return {...candidates[0],page:page.page,kind:'beutel-goodman-current-period-class-ratio-cell'};
}

const evidencePolicy_canada_life={stamps:{canadaLifeRatioLocatorVersion:1}};
function canadaLifeNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00a0\u200b\u00ad]/g,' ').replace(/\s+/g,' ').trim();
}
function canadaLifeCompact(value){return canadaLifeNormalize(value).toLowerCase().replace(/[^a-z0-9]/g,'');}
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
 const candidates=lines.filter(line=>line.y>=header.y&&line.y-header.y<=20).flatMap(line=>line.items)
  .map(item=>({item,parts:canadaLifeDateParts(item.str)}))
  .filter(entry=>entry.parts&&entry.parts.month===iso[2]&&entry.parts.day===Number(iso[3])
    &&Math.abs(canadaLifeTokenCenter(entry.item)-canadaLifeTokenCenter(yearItems[0]))<22);
 return candidates.length===1?{x:canadaLifeTokenCenter(yearItems[0]),year:Number(iso[1])}:null;
}
function canadaLifeEvidenceMetricCells(line){
 const found=cells(line).map(cell=>({...cell}));
 for(const item of line.items||[]){
  const raw=canadaLifeNormalize(item.str);
  if(!/^n\s*\/?\s*a$/i.test(raw)||!(Number(item.w)>0))continue;
  found.push({value:null,isMissing:true,raw,x:item.x,
   box:{x:Math.max(0,item.x-1),y:line.y-1,w:item.w+2,h:Math.max(6,item.h||8)+2}});
 }
 return found.sort((a,b)=>a.x-b.x);
}
function canadaLifeEvidenceCellAtColumn(line,columnX){
 if(!line||!Number.isFinite(columnX))return null;
 const candidates=canadaLifeEvidenceMetricCells(line).filter(cell=>{
  const center=cell.box?cell.box.x+cell.box.w/2:Number(cell.x);
  return Number.isFinite(center)&&Math.abs(center-columnX)<19;
 });
 return candidates.length===1?candidates[0]:null;
}
function canadaLifeEvidencePageTables(page,fund,date){
 if(!page||!Array.isArray(page.items)||!page.items.length||page.ocrUsed)return [];
 if(!/RATIOS\s+AND\s+SUPPLEMENTAL\s+DATA/i.test(page.text||''))return [];
 const compactFund=canadaLifeCompact(fund);
 if(compactFund.length<12||!canadaLifeCompact((page.text||'').slice(0,900)).includes(compactFund))return [];
 const width=Number(page.width)||612,split=width/2,output=[];
 for(const [minX,maxX] of [[0,split-3],[split-3,width+3]]){
  const columnItems=page.items.filter(item=>Number.isFinite(item.x)&&item.x>=minX&&item.x<maxX);
  const lines=textLines(columnItems);
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
   const merCell=canadaLifeEvidenceCellAtColumn(merLines[0],currentX);
   const ptrCell=canadaLifeEvidenceCellAtColumn(ptrLines[0],currentX);
   if(!merCell||!ptrCell)continue;
   output.push({cls:header.cls,page:page.page,currentX,merLine:merLines[0],ptrLine:ptrLines[0],
    values:{MER:merCell.value??null,TER:null,PTR:ptrCell.value??null}});
  }
 }
 return output;
}
function locateCell_canada_life(page,lines,row,key,value,context){
 if(!['MER','PTR'].includes(key)||!canadaLifeCompact(page.text||'').includes(canadaLifeCompact(row.fund_name)))return null;
 const expected=canadaLifeNormalize(row.class_identity||row.class_name).toLowerCase();
 const tables=canadaLifeEvidencePageTables(page,row.fund_name,row.report_date).filter(table=>table.cls.toLowerCase()===expected);
 if(tables.length!==1)return null;
 const table=tables[0],line=key==='MER'?table.merLine:table.ptrLine;
 const cell=canadaLifeEvidenceCellAtColumn(line,table.currentX);
 if(!cell||!matchesCell(cell,value))return null;
 return {...cell,page:page.page,metric:key,kind:'canada-life-current-period-series-ratio-cell'};
}

// Keep the evidence policy adapter-local. The central viewer and shared
// evidence engine remain FMC-independent.
const evidencePolicy_ccl={stamps:{cclRatioLocatorVersion:1}};
function cclEvidenceNormalize(value){return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();}
function cclEvidenceCompact(value){return cclEvidenceNormalize(value).toLowerCase().replace(/[^a-z0-9]/g,'');}
function cclEvidenceItems(items){
 const out=[];
 for(const item of (items||[])){
  if(typeof item.str!=='string'||!item.str.trim()||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;
  const normalized=cclEvidenceNormalize(item.str).toLowerCase();
  if(out.some(old=>cclEvidenceNormalize(old.str).toLowerCase()===normalized&&Math.abs(old.x-item.x)<1.15&&Math.abs(old.y-item.y)<2.25))continue;
  out.push({...item,str:cclEvidenceNormalize(item.str),h:Math.max(5,Number(item.h)||8),w:Math.max(0,Number(item.w)||0)});
 }
 return out.sort((a,b)=>b.y-a.y||a.x-b.x);
}
function cclEvidenceLines(items){
 const lines=[];
 for(const item of cclEvidenceItems(items)){
  let line=lines.find(row=>Math.abs(row.y-item.y)<Math.max(1.0,Math.min(1.3,item.h*.15)));
  if(!line){line={y:item.y,items:[]};lines.push(line);}
  line.items.push(item);
 }
 for(const line of lines){line.items.sort((a,b)=>a.x-b.x);line.text=line.items.map(x=>x.str).join(' ').replace(/\s+/g,' ').trim();}
 return lines.sort((a,b)=>b.y-a.y);
}
function cclEvidenceSeries(line){
 const text=cclEvidenceNormalize(line.items.filter(item=>item.x<285).map(item=>item.str).join(' '));
 const match=/^(Series|Class)\s+(.+)$/i.exec(text);
 if(!match||/\b(?:inception|date|units?|outstanding)\b/i.test(match[2]))return null;
 const suffix=cclEvidenceNormalize(match[2]).replace(/\s*\(\d+\)\s*$/,'').trim();
 return suffix&&suffix.length<=45&&!/\b20\d{2}\b/.test(suffix)?match[1][0].toUpperCase()+match[1].slice(1).toLowerCase()+' '+suffix:null;
}
function cclEvidenceDateLabel(value){
 const match=/^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2}),?$/i.exec(cclEvidenceNormalize(value));
 if(!match)return null;
 const months={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
 return {month:months[match[1].slice(0,3).toLowerCase()],day:match[2].padStart(2,'0')};
}
function cclEvidenceCenter(item){return item.x+(Number(item.w)||0)/2;}
function cclEvidenceColumns(lines,heading){
 const years=heading.items.filter(item=>item.x>285&&/^20\d{2}$/.test(item.str.trim()));
 const dates=lines.filter(line=>line.y>heading.y+2&&line.y-heading.y<18).flatMap(line=>line.items)
  .map(item=>({item,date:cclEvidenceDateLabel(item.str)})).filter(x=>x.date);
 const columns=[];
 for(const entry of dates){
  const center=cclEvidenceCenter(entry.item);
  const nearby=years.map(item=>({item,distance:Math.abs(cclEvidenceCenter(item)-center)})).filter(x=>x.distance<6).sort((a,b)=>a.distance-b.distance);
  if(nearby.length!==1)continue;
  const date=`${nearby[0].item.str.trim()}-${entry.date.month}-${entry.date.day}`;
  if(!columns.some(x=>x.date===date))columns.push({date,center});
 }
 return columns;
}
function cclEvidenceLabel(line,key){
 const patterns={MER:/^Management\s+expense\s+ratio(?:\s*\(\d+\))?$/i,PTR:/^Portfolio\s+turnover\s+(?:rate|ratio)(?:\s*\(\d+\))?$/i};
 return line.items.find(item=>item.x<285&&patterns[key]?.test(cclEvidenceNormalize(item.str)));
}
function cclEvidenceCellTokens(item){
 const raw=cclEvidenceNormalize(item.str).replace(/\s+/g,'');
 if(/^[—–−-]{1,2}$/.test(raw)||/^n\/?a$/i.test(raw))return [{value:null,isMissing:true,raw,item,x:item.x+(Number(item.w)||0)/2,box:{x:Math.max(0,item.x-1),y:item.y-1,w:Math.max(2,item.w)+2,h:item.h+2}}];
 const out=[],rx=/(?:^|[^\w.])((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?%)(?=$|[^\w])/g;let m;
 while((m=rx.exec(raw))){
  const token=m[1],value=Number(token.replace(/[,%]/g,''));if(!Number.isFinite(value)||value<0||value>1000)continue;
  const start=m.index+(m[0].length-token.length),width=(Number(item.w)||raw.length*item.h*.45)*token.length/Math.max(1,raw.length);
  const x=item.x+(Number(item.w)||raw.length*item.h*.45)*start/Math.max(1,raw.length);
  out.push({value,isMissing:false,raw:token,item,x,box:{x:Math.max(0,x-1),y:item.y-1,w:Math.max(1,width)+2,h:item.h+2}});
 }
 return out;
}
function cclEvidenceFindCell(page,row,key,value){
 if(!Array.isArray(page.items)||!page.items.length||page.ocrUsed)return null;
 const lines=cclEvidenceLines(page.items);
 const sections=lines.filter(line=>/^Ratios\s*(?:&|and)\s*Supplemental\s+Data\s*:?$/i.test(line.text));
 if(sections.length!==1)return null;
 const section=sections[0],rawHeadings=lines.filter(line=>line.y<section.y&&section.y-line.y<520&&cclEvidenceSeries(line))
  .map(line=>({line,cls:cclEvidenceSeries(line),columns:cclEvidenceColumns(lines,line)}));
 const headings=rawHeadings.filter(item=>item.columns.some(column=>column.date===row.report_date)).sort((a,b)=>b.line.y-a.line.y);
 const expected=cclEvidenceNormalize(row.class_identity||row.class_name).toLowerCase();
 const matching=headings.filter(item=>cclEvidenceNormalize(item.cls).toLowerCase()===expected);
 if(matching.length!==1)return null;
 const current=matching[0],index=headings.indexOf(current),next=headings[index+1];
 const block=lines.filter(line=>line.y<current.line.y-2&&(!next||line.y>next.line.y+2));
 const columns=cclEvidenceColumns(lines,current.line),target=columns.find(column=>column.date===row.report_date);
 if(!target)return null;
 let selected=null;
 for(const candidate of block){const label=cclEvidenceLabel(candidate,key);if(label){selected={line:candidate,label};break;}}
 if(!selected)return null;
 const {line,label}=selected;
 const cells=line.items.filter(item=>item.x>label.x+label.w+5).flatMap(cclEvidenceCellTokens)
  .filter(cell=>Math.abs((cell.x??cell.item.x+(cell.item.w||0)/2)-target.center)<24&&
    (value===null||value===undefined?cell.isMissing:!cell.isMissing&&Math.abs(cell.value-Number(value))<.000001));
 if(cells.length!==1)return null;
 return {box:cells[0].box,page:page.page,metric:key,kind:'ccl-current-period-series-ratio-cell',raw:cells[0].raw,isMissing:!!cells[0].isMissing};
}
function validateDocumentEvidence_ccl(pages,row){
 const branded=(pages||[]).slice(0,3).some(page=>/www\.cclfundsinc\.com/i.test(page.text||'')&&/CC&L/i.test(page.text||''));
 const fund=cclEvidenceCompact(row?.fund_name);
 return branded&&fund.length>12&&(pages||[]).some(page=>cclEvidenceCompact(page.text||'').includes(fund));
}
function locateCell_ccl(page,lines,row,key,value,context){
 if(!['MER','PTR'].includes(key))return null;
 return cclEvidenceFindCell(page,row,key,value);
}

const evidencePolicy_sei={stamps:{seiFinancialHighlightsLocatorVersion:1}};
function seiEvidenceNormalize(value){return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();}
function seiEvidenceItems(items){
 const out=[];
 for(const item of items||[]){
  if(typeof item.str!=='string'||!item.str.trim()||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;
  const normalized=seiEvidenceNormalize(item.str).toLowerCase();
  if(out.some(old=>seiEvidenceNormalize(old.str).toLowerCase()===normalized&&Math.abs(old.x-item.x)<1.15&&Math.abs(old.y-item.y)<2.25))continue;
  out.push({...item,str:seiEvidenceNormalize(item.str),h:Math.max(5,Number(item.h)||8),w:Math.max(0,Number(item.w)||0)});
 }
 return out.sort((a,b)=>b.y-a.y||a.x-b.x);
}
function seiEvidenceLines(items){
 const lines=[];
 for(const item of seiEvidenceItems(items)){
  let line=lines.find(row=>Math.abs(row.y-item.y)<Math.max(1.0,Math.min(1.5,item.h*.18)));
  if(!line){line={y:item.y,items:[]};lines.push(line);}
  line.items.push(item);
 }
 for(const line of lines){line.items.sort((a,b)=>a.x-b.x);line.text=line.items.map(item=>item.str).join(' ').replace(/\s+/g,' ').trim();}
 return lines.sort((a,b)=>b.y-a.y);
}
function seiEvidenceClass(line){
 const left=seiEvidenceNormalize((line.items||[]).filter(item=>item.x<190).map(item=>item.str).join(' '));
 const match=/^Class\s+([A-Za-z0-9][A-Za-z0-9 &/().-]{0,35}?)\s*\**$/i.exec(left);
 if(!match)return null;
 const suffix=seiEvidenceNormalize(match[1]).replace(/\s+Units?$/i,'').trim();
 return suffix&&suffix.length<=35&&!/\b(?:inception|date|outstanding|units?)\b/i.test(suffix)?'Class '+suffix:null;
}
function seiEvidenceYears(line){return (line.items||[]).filter(item=>item.x>200&&/^20\d{2}$/.test(seiEvidenceNormalize(item.str)));}
function seiEvidenceRatioHeading(line){return /^RATIOS\s+AND\s+SUPPLEMENTAL\s+DATA\s*:?$/i.test(seiEvidenceNormalize(line.text));}
function seiEvidenceBlocks(lines,reportYear){
 const headings=lines.map(line=>({line,cls:seiEvidenceClass(line)})).filter(item=>item.cls&&item.line.items.some(it=>it.x<150));
 const blocks=[];
 for(let i=0;i<headings.length;i++){
  const current=headings[i],next=headings[i+1],lower=next?.line.y??20;
  const header=lines.filter(line=>line.y<current.line.y&&line.y>lower&&current.line.y-line.y<45&&seiEvidenceYears(line).length>=2).sort((a,b)=>b.y-a.y)[0];
  if(!header)continue;
  const yearHits=seiEvidenceYears(header).filter(item=>Number(seiEvidenceNormalize(item.str))===reportYear);
  if(yearHits.length!==1)continue;
  const yearItem=yearHits[0],center=yearItem.x+(Number(yearItem.w)||0)/2;
  const section=lines.filter(line=>line.y<header.y&&line.y>lower&&seiEvidenceRatioHeading(line)).sort((a,b)=>b.y-a.y)[0];
  if(!section)continue;
  blocks.push({cls:current.cls,next:next?.line||null,lower,center,section,metricLines:lines.filter(line=>line.y<section.y&&line.y>lower)});
 }
 return blocks;
}
function seiEvidenceLabel(line,key){
 const patterns={MER:/^Management\s+expense\s+ratio(?:\s*\([a-z0-9]{1,3}\))?$/i,PTR:/^Portfolio\s+turnover\s+(?:rate|ratio)(?:\s*\([a-z0-9]{1,3}\))?$/i};
 return (line.items||[]).find(item=>item.x<250&&patterns[key]?.test(seiEvidenceNormalize(item.str)));
}
function seiEvidenceTokens(item){
 const raw=seiEvidenceNormalize(item.str).replace(/\s+/g,'');
 if(/^[—–−-]{1,2}$/.test(raw)||/^n\/?a$/i.test(raw))return [{value:null,isMissing:true,raw:raw||item.str,item,x:item.x+(Number(item.w)||0)/2,box:{x:Math.max(0,item.x-1),y:item.y-1,w:Math.max(2,item.w)+2,h:item.h+2}}];
 const out=[],rx=/(?:^|[^\w.])((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?%?)(?=$|[^\w])/g;let match;
 while((match=rx.exec(raw))){
  const token=match[1],n=Number(token.replace(/[,%]/g,''));if(!Number.isFinite(n)||n<0||n>1000)continue;
  const start=match.index+(match[0].length-token.length),width=(Number(item.w)||raw.length*item.h*.45)*token.length/Math.max(1,raw.length);
  const x=item.x+(Number(item.w)||raw.length*item.h*.45)*start/Math.max(1,raw.length);
  out.push({value:n,isMissing:false,raw:token,item,x:x+width/2,box:{x:Math.max(0,x-1),y:item.y-1,w:Math.max(1,width)+2,h:item.h+2}});
 }
 return out;
}
function seiEvidenceFindCell(page,row,key,value){
 if(!Array.isArray(page.items)||!page.items.length||page.ocrUsed||!['MER','PTR'].includes(key))return null;
 const reportYear=Number(String(row.report_date||'').slice(0,4));if(!reportYear)return null;
 const lines=seiEvidenceLines(page.items),blocks=seiEvidenceBlocks(lines,reportYear);
 const expected=seiEvidenceNormalize(row.class_identity||row.class_name).toLowerCase();
 const matching=blocks.filter(block=>seiEvidenceNormalize(block.cls).toLowerCase()===expected);
 if(matching.length!==1)return null;
 const block=matching[0];let selected=null;
 for(const line of block.metricLines){const label=seiEvidenceLabel(line,key);if(label){selected={line,label};break;}}
 if(!selected)return null;
 const hits=selected.line.items.filter(item=>item.x>selected.label.x+selected.label.w+5).flatMap(seiEvidenceTokens)
  .filter(cell=>Math.abs(cell.x-block.center)<16&&(value===null||value===undefined?cell.isMissing:!cell.isMissing&&Math.abs(cell.value-Number(value))<0.000001));
 if(hits.length!==1)return null;
 return {box:hits[0].box,page:page.page,metric:key,kind:'sei-latest-reporting-year-class-ratio-cell',raw:hits[0].raw,isMissing:!!hits[0].isMissing};
}
function validateDocumentEvidence_sei(pages,row){
 const head=(pages||[]).slice(0,3).map(page=>page.text||'').join('\n');
 const fund=seiEvidenceNormalize(row?.fund_name).toLowerCase();
 return /SEI Investments Canada Company/i.test(head)&&/seic\.com\/en-ca/i.test(head)&&fund.length>7&&seiEvidenceNormalize(head).toLowerCase().includes(fund);
}
function locateCell_sei(page,lines,row,key,value,context){
 if(!['MER','PTR'].includes(key))return null;
 return seiEvidenceFindCell(page,row,key,value);
}

const FMC_EVIDENCE_HANDLERS={"nbi":locateCell_nbi,"desjardins":locateCell_desjardins,"franklin":locateCell_franklin,"manulife":locateCell_manulife,"dynamic":locateCell_dynamic,"purpose":locateCell_purpose,"blackrock":locateCell_blackrock,"rbc":locateCell_rbc,"bmo":locateCell_bmo,"bmg":locateCell_bmg,"td":locateCell_td,"lysander":locateCell_lysander,"nei":locateCell_nei,"mackenzie":locateCell_mackenzie,"ig_mackenzie":locateCell_ig_mackenzie,"fidelity":locateCell_fidelity,"pender":locateCell_pender,"brandes":locateCell_brandes,"agf":locateCell_agf,"vanguard":locateCell_vanguard,"hamilton":locateCell_hamilton,"newgen":locateCell_newgen,"rpia":locateCell_rpia,"leith_wheeler":locateCell_leith_wheeler,"ci":locateCell_ci,"scotia":locateCell_scotia,"capital_group":locateCell_capital_group,"arrow_capital":locateCell_arrow_capital,"guardian":locateCell_guardian,"beutel_goodman":locateCell_beutel_goodman,"canada_life":locateCell_canada_life,"ccl":locateCell_ccl,"sei":locateCell_sei};
const FMC_GAP_HANDLERS={"sun_life":locateGap_sun_life,"middlefield":locateGap_middlefield,"rbc":locateGap_rbc,"first_trust":locateGap_first_trust,"harvest":locateGap_harvest,"ninepoint":locateGap_ninepoint,"global_x":locateGap_global_x,"ci":locateGap_ci};
const FMC_EVIDENCE_POLICIES={"nbi":evidencePolicy_nbi,"desjardins":evidencePolicy_desjardins,"sun_life":evidencePolicy_sun_life,"franklin":evidencePolicy_franklin,"middlefield":evidencePolicy_middlefield,"manulife":evidencePolicy_manulife,"dynamic":evidencePolicy_dynamic,"purpose":evidencePolicy_purpose,"blackrock":evidencePolicy_blackrock,"rbc":evidencePolicy_rbc,"bmo":evidencePolicy_bmo,"bmg":evidencePolicy_bmg,"first_trust":evidencePolicy_first_trust,"td":evidencePolicy_td,"lysander":evidencePolicy_lysander,"nei":evidencePolicy_nei,"mackenzie":evidencePolicy_mackenzie,"ig_mackenzie":evidencePolicy_ig_mackenzie,"fidelity":evidencePolicy_fidelity,"pender":evidencePolicy_pender,"brandes":evidencePolicy_brandes,"agf":evidencePolicy_agf,"harvest":evidencePolicy_harvest,"vanguard":evidencePolicy_vanguard,"ninepoint":evidencePolicy_ninepoint,"global_x":evidencePolicy_global_x,"hamilton":evidencePolicy_hamilton,"newgen":evidencePolicy_newgen,"leith_wheeler":evidencePolicy_leith_wheeler,"ci":evidencePolicy_ci,"scotia":evidencePolicy_scotia,"capital_group":evidencePolicy_capital_group,"arrow_capital":evidencePolicy_arrow_capital,"guardian":evidencePolicy_guardian,"beutel_goodman":evidencePolicy_beutel_goodman,"canada_life":evidencePolicy_canada_life,"ccl":evidencePolicy_ccl,"sei":evidencePolicy_sei};
const FMC_DOCUMENT_IDENTITIES={"bmg":validateDocumentEvidence_bmg,"capital_group":validateDocumentEvidence_capital_group,"arrow_capital":validateDocumentEvidence_arrow_capital,"guardian":validateDocumentEvidence_guardian,"beutel_goodman":validateDocumentEvidence_beutel_goodman,"ccl":validateDocumentEvidence_ccl,"sei":validateDocumentEvidence_sei};
const FMC_EVIDENCE_LAYOUTS={"middlefield":evidenceLayout_middlefield,"manulife":evidenceLayout_manulife,"purpose":evidenceLayout_purpose,"first_trust":evidenceLayout_first_trust,"td":evidenceLayout_td,"agf":evidenceLayout_agf,"newgen":evidenceLayout_newgen,"leith_wheeler":evidenceLayout_leith_wheeler};
const FMC_ANNUAL_ETF_VALIDATORS={"vanguard":validateAnnualEtfRow_vanguard,"hamilton":validateAnnualEtfRow_hamilton};
const FMC_RATIO_HEADER_HANDLERS={"rbc":ratioHeader_rbc,"ci":ratioHeader_ci};
const GAP_FMCS=new Set(Object.keys(FMC_GAP_HANDLERS));
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

global.MRFP_EVIDENCE={GAP_FMCS:[...GAP_FMCS],LOCATOR_VERSION,needsRefresh,emptyRecord,locateLastGap,locate,locateInPage,textLines,numbers,missingMarks,cells,sourcePages,initialPage};
})(globalThis);
