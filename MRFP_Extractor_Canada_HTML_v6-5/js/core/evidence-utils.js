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
