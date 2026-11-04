/* FMC adapter: scotia. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_scotia={key:'scotia',label:'ScotiaFunds / 1832 Asset Management',style:'scotia_b2',signatures:[/www\.scotiafunds\.com/i,/Scotia\s+U\.S\.\s*\$\s*Balanced Fund/i],title:/^\s*(Scotia\s+[^\n]{5,150}?Fund)\s*$/im};

const fmcConfig_scotia={issuerPrefix:/^Scotia\s/i};

// @mrfp:extraction

function extract_scotia(pages,p,fund,date){return parse1832Complete(pages);}
// Non-mutating series completeness audit for this issuer.
function auditRatioHeadings_scotia(source,potential){
 let text=source;const ix=text.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
 // Pages without the ratio heading may continue the dated table with
   // 'As at' and a row of management/trading expense labels.
   if(ix<0 && !/\bAs\s+at\b/i.test(text.slice(0,650)))return;
   if(ix>=0)text=text.slice(ix);
   for(const line of text.split(/\r?\n/)){
    const m=/^\s*(Series\s+[A-Z][A-Z0-9]*(?:\s*\(USD\))?|ETF(?:H)?\s+Series)(?:\s*[–-].*)?\s*$/i.exec(line);
    if(m)potential.add(m[1].replace(/\s+/g,' '));
   }
}

// @mrfp:evidence
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
