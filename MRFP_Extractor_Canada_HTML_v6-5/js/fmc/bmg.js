/* FMC adapter: bmg. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const bmg={key:'bmg',label:'BMG Management Services Inc.',style:'bmg_rotated',
 signatures:[/\bBMG\s+(?:Management Services Inc\.|Gold|Silver|BullionFund)/i,/\bBMG\s+(?:Silver|Gold|Bullion)\s+Bullion\s*Fund\b/i,/\bbmg-group\.com\b/i],
 title:/^\s*(BMG\s+(?:[^\n]{3,110}?\s+)?Bullion\s*Fund)\s*$/im};


// ---- src/fmc/index.mjs ----
// Independent issuer signatures; adding an FMC must be performed here and in its dedicated module.



const fmcConfig_bmg={issuerPrefix:/^BMG\s/i,titleScanPages:6};

// @mrfp:extraction
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

// @mrfp:evidence
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

