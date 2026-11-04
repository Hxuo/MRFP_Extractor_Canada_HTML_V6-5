/* FMC adapter: desjardins. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const desjardins={key:'desjardins',label:'Desjardins Investments',style:'desjardins',signatures:[/\bDESJARDINS FUNDS\b/i,/Desjardins Investments Inc\./i,/desjardinsfunds\.com/i],title:/^\s*(Desjardins\s+[^\n]{4,110}(?:Fund|Portfolio))\s*$/im};

const fmcConfig_desjardins={issuerPrefix:/^Desjardins\s/i,requirePriorRatioHeading:true,retainRatioHeading:true};

// @mrfp:extraction

function extract_desjardins(pages,p,fund,date){return simpleTable(pages,p);}
// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_desjardins(line){
 const style='desjardins';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='desjardins'){m=/^([A-Z][A-Z0-9]{0,3})[–-]CLASS$/i.exec(s);return m?m[1].toUpperCase()+'-Class':null;}
 return null;
}

// @mrfp:evidence
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
