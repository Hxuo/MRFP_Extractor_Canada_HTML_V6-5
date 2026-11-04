/* FMC adapter: nbi. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const nbi={
  key:'nbi',label:'National Bank Investments',style:'nbi',
  signatures:[/National Bank Investments|National Bank Investments Advisory Service/i,/www\.nbinvestments\.ca|www\.nbinvestments\.ca/i,/\bNBI Sustainable\b/i],
  title:/^\s*(NBI(?:\s+[A-Za-z][A-Za-z0-9&'’.-]*){2,12}\s+(?:Fund|Portfolio|Class))\s*$/im
};

const fmcConfig_nbi={issuerPrefix:/^NBI\s/i,requireRatioHeading:true};

// @mrfp:extraction

function extract_nbi(pages,p,fund,date){return simpleTable(pages,p);}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundFallback_nbi(pages,p,head){
if(p.key==='nbi'){
    const names=[...head.matchAll(/\b(NBI\s+[A-Z][A-Za-z0-9-]*(?:\s+[A-Z][A-Za-z0-9-]*){0,5}\s+(?:Fund|Portfolio|Class))\b/g)].map(x=>x[1]);
    names.sort((a,b)=>a.length-b.length);
    if(names.length)return clean(names[0]);
  }
}

// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_nbi(line){
 const style='nbi';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='nbi'){m=nbiClass.exec(s);return m?m[1].replace(/\s+/g,' ').trim():null;}
 return null;
}

// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_nbi={stamps:{fmcEvidenceVersion:1}};
function nbiCell(page,lines,row,key,value){
 const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(row.report_date||'');if(!iso)return null;
 const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const month=months[Number(iso[2])-1];if(!month)return null;
 if(!clean(page.text||'').includes(clean(row.fund_name)))return null;
 const canonical=s=>clean(s).replace(/[†*®™]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 const expected=canonical(row.class_name);
 const seriesHeading=t=>/^(?:(?:investor(?:-\d+)?\s*\/\s*advisor(?:-\d+)?\s+series)|(?:(?:investor|advisor)(?:-\d+)?\s+series)|(?:private\s+series)|(?:series\s+[a-z][a-z0-9-]*)|(?:etfh?\s+series))$/i.test(t.trim().replace(/[†*]/g,''));
 const headings=lines.filter(l=>seriesHeading(l.text));
 const label={MER:/^Management\s+expense\s+ratio\s*\(%\)$/i,TER:/^Trading\s+expense\s+ratio\s*\(%\)$/i,PTR:/^Portfolio\s+turnover\s+rate\s*\(%\)$/i}[key];
 const output=[];
 for(const section of lines.filter(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data\s*$/i.test(l.text))){
  const prev=headings.filter(l=>l.y>section.y&&l.y-section.y<520).sort((a,b)=>a.y-b.y)[0];
  if(!prev||canonical(prev.text)!==expected)continue;
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
