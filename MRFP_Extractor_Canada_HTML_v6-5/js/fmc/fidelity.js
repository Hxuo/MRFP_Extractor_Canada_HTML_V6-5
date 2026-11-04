/* FMC adapter: fidelity. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_fidelity={key:'fidelity',label:'Fidelity Investments',style:'fidelity_new',signatures:[/Fidelity Investments Canada ULC|Fidelity Management & Research Canada ULC/i,/Fidelity Investments/i],title:/^\s*(Fidelity\s+[^\n]{4,180}?(?:Fund|ETF|Portfolio|Class)(?:\s+of\s+the\s+Fidelity\s+Capital\s+Structure\s+Corp\.?)?)[®™]?\s*$/im};

const fmcConfig_fidelity={issuerPrefix:/^Fidelity\s/i,preferProfileLineTitle:true};

// @mrfp:extraction
function parseFidelity(pages){
 return parseClassColumns(pages,{heading:(line)=>{
  const m=/^\s*Fidelity\s+[^\n]{5,190}?\s+(ETF Series|Series\s+[A-Z][A-Z0-9]*)\s*$/i.exec(line.replace(/[®™]/g,''));return m?m[1].replace(/\s+/g,' '):null;
 },ratiosAfterHeading:true});
}

function extract_fidelity(pages,p,fund,date){return parseFidelity(pages);}
// @mrfp:evidence
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
