/* FMC adapter: ig_mackenzie. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_ig_mackenzie={key:'ig_mackenzie',label:'IG Wealth Management',style:'mackenzie_new',signatures:[/IG MACKENZIE (?:GLOBAL|[^\n]+) (?:FUND|OF CANADA)/i,/I\.G\. Investment Management/i],title:/^\s*(IG\s+MACKENZIE\s+[^\n]+?(?:FUND|OF CANADA))\s*$/im};

const fmcConfig_ig_mackenzie={issuerPrefix:/^IG Mackenzie\s/i,preferProfileLineTitle:true};

// @mrfp:extraction
function parseIgUnlabelledLatestColumn(pages){
 const year=Number(reportDate(pages)?.slice(0,4));
 if(!Number.isInteger(year)||year<2000)return [];
 const out=[];
 const heading=/^\s*(Series\s+[A-Z][A-Z0-9]*(?:\s+[A-Z]{2,4})?)\s+((?:20\d{2}\s+){1,7}20\d{2})\s*$/i;
 const ratioRe={
  MER:/^Management\s+expense\s+ratio\s*\(%\)/i,
  TER:/^Trading\s+expense\s+ratio\s*\(%\)/i,
  PTR:/^Portfolio\s+turnover\s+rate\s*\(%\)/i
 };
 for(const pg of pages){
  if(!/RATIOS\s+AND\s+SUPPLEMENTAL\s+DATA/i.test(pg.text||''))continue;
  for(const col of [pg.leftText,pg.rightText]){
   const lines=normalizeExtraText(col||'').split(/\r?\n/);
   const heads=[];
   for(let i=0;i<lines.length;i++){
    const m=heading.exec(lines[i].trim());
    if(!m)continue;
    heads.push({index:i,cls:m[1].replace(/\s+/g,' '),years:m[2].trim().split(/\s+/).map(Number)});
   }
   const normal=heads.some(h=>h.years[0]===year&&h.years[1]===year-1);
   if(!normal)continue;
   for(let k=0;k<heads.length;k++){
    const h=heads[k],oldYears=h.years;
    if(oldYears[0]!==year-1||oldYears.length<2||oldYears.some((y,i)=>i>0&&y!==oldYears[i-1]-1))continue;
    const tail=lines.slice(h.index+1,heads[k+1]?.index??lines.length);
    const metrics={};let valid=true;
    for(const [metric,re] of Object.entries(ratioRe)){
     const matching=tail.filter(line=>re.test(line.trim()));
     if(matching.length!==1){valid=false;break;}
     const label=re.exec(matching[0].trim());
     const cells=matching[0].trim().slice(label[0].length).trim()
      .match(/(?:n\s*\/\s*a|[—–−-]{1,2}|\d+(?:\.\d+)?|\.\d+)(?=\s|$)/gi)||[];
     if(cells.length!==oldYears.length+1){valid=false;break;}
     metrics[metric]=toNumber(cells[0]);
    }
    if(valid)out.push({cls:h.cls,values:metrics,quality:3,evidence:{}});
   }
  }
 }
 return [...new Map(out.map(r=>[r.cls,r])).values()];
}
function parseIgHistorical(pages,p){
 // Include a historically listed series only if no validated current-period
 // source exists; older-year ratios must not masquerade as current values.
 const found=parseMackenzie(pages), existing=new Set(found.map(x=>x.cls));
 for(const candidate of parseIgUnlabelledLatestColumn(pages)){
  if(!existing.has(candidate.cls)){found.push(candidate);existing.add(candidate.cls);}
 }
 for(const pg of pages){
  if(!/RATIOS AND SUPPLEMENTAL DATA/i.test(pg.text))continue;
  for(const col of [pg.leftText,pg.rightText]){
   const lines=normalizeExtraText(col||'').split(/\r?\n/);
   const start=lines.findIndex(x=>/RATIOS AND SUPPLEMENTAL DATA/i.test(x));
   for(const l of lines.slice(Math.max(0,start))){
    const m=/^\s*(Series\s+[A-Z][A-Z0-9]*(?:\s+[A-Z]{2,4})?)\s+(20\d\d)(?=\s)/i.exec(l);
    if(!m||existing.has(m[1])||Number(m[2])>=Number(reportDate(pages)?.slice(0,4)))continue;
    // Evidence must be a metric table, not a footnote sentence.
    found.push({cls:m[1],values:{MER:null,TER:null,PTR:null},quality:3,evidence:{}});
    existing.add(m[1]);
   }
  }
 }
 return found;
}

// New issuer formats (batch 10) are scoped to their own profiles. No ratio
// constants or document filenames are used. A dash/N/A remains a null cell.

function extract_ig_mackenzie(pages,p,fund,date){return parseIgHistorical(pages,p);}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundLate_ig_mackenzie(pages,p,head){
if(p.key==='ig_mackenzie'){
    for(const pg of pages.slice(0,2))for(const raw of pg.text.split(/\r?\n/)){
      const line=raw.trim().replace(/\s+/g,' ');
      if(/^IG\s+(?:Core\s+)?Portfolio\s*[–-]\s*[A-Za-z ]{3,70}$/i.test(line))return line;
    }
  }
}

// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_ig_mackenzie={stamps:{mackenzieLocatorVersion:1}};


function locateCell_ig_mackenzie(page,lines,row,key,value,context){const selected=mackenzieCell(page,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:'mackenzie-verified-series-date-ratio-cell'}:null;}
