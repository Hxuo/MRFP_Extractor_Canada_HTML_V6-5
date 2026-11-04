/* FMC adapter: mackenzie. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_mackenzie={key:'mackenzie',label:'Mackenzie Investments',style:'mackenzie_new',signatures:[/MACKENZIE PRECIOUS METALS FUND/i,/Mackenzie Financial Corporation/i],title:/^\s*(MACKENZIE\s+[^\n]+?FUND)\s*$/im};

const fmcConfig_mackenzie={issuerPrefix:/^Mackenzie\s/i,preferProfileLineTitle:true};

// @mrfp:extraction
function parseMackenzie(pages){
 const out=[];const targetYear=reportDate(pages)?.slice(0,4);for(const p of pages){
  if(p.page<6)continue;
  for(const col of [p.leftText,p.rightText]){
   if(!col)continue;
   const lines=normalizeExtraText(col).split('\n');
   for(let i=0;i<lines.length;i++){
    const m=/^\s*(Series\s+[A-Z][A-Z0-9]*(?:\s+[A-Z]{2,4})?)\s+(20\d{2})\s+(20\d{2})\b/i.exec(lines[i]);if(!m||m[2]!==targetYear)continue;
    const end=lines.findIndex((s,j)=>j>i&&/^\s*Series\s+[A-Z][A-Z0-9]*(?:\s+[A-Z]{2,4})?\s+20\d{2}\s+20\d{2}\b/i.test(s));
    const text=lines.slice(i,end>i?end:i+25).join('\n');const v=extraRatios(text);
    if(v.quality>=2)out.push({cls:m[1].replace(/\s+/g,' '),...v});
   }
  }
 }
 return [...new Map(out.map(x=>[x.cls,x])).values()];
}
// v3-1: Mackenzie ETFs publish a right-hand ratios table, while mutual
// funds use the existing multi-Series parser. Use this only after the
// mutual-fund parser returns no rows, and only with a titled ETF document.
function parseMackenzieEtfColumns(pages,fund,date){
 if(!/\bETF\b/i.test(fund)||!date)return [];
 const year=date.slice(0,4);
 for(const pg of pages){
  for(const column of [pg.rightText,pg.text]){
   const txt=normalizeExtraText(column||'');
   const ix=txt.search(/Ratios?\s+and\s+Supplemental\s+Data/i);if(ix<0)continue;
   const lines=txt.slice(ix).split(/\r?\n/);
   const head=lines.slice(0,8).join(' ');
   const clsMatch=/\b((?:CAD|USD)\s+Units)(?:\s*\(Ticker:[^)]+\))?\s+(20\d{2})\b/i.exec(head);
   if(!clsMatch || clsMatch[2]!==year)continue;
   // Confirm the time axis: the first year belongs to this report.
   const listedYears=head.match(/20\d{2}/g)||[];
   if(listedYears[0]!==year)continue;
   const values={MER:null,TER:null,PTR:null},evidence={};let quality=0;
   for(const metric of ['MER','TER','PTR']){
    const label=metric==='MER'?/^\s*Management\s+expense\s+ratio\s*\(\s*%\s*\)/i:
      metric==='TER'?/^\s*Trading\s+expense\s+ratio\s*\(\s*%\s*\)/i:
      /^\s*Portfolio\s+turnover\s+rate\s*\(\s*%\s*\)/i;
    for(const line of lines){
     const m=label.exec(line);if(!m)continue;
     const tail=line.slice(m[0].length);
     const token=/^\s*([—–−-]|\d+(?:\.\d+)?)(?=\s|%|$)/.exec(tail);
     if(!token)break;
     values[metric]=toNumber(token[1]);quality++;
     evidence[metric]={page:pg.page,source:'Mackenzie ETF first-period ratio column',method:'native-js'};
     break;
    }
   }
   if(quality===3)return [{cls:clsMatch[1].replace(/\s+/g,' '),values,evidence,quality}];
  }
 }
 return [];
}


function extract_mackenzie(pages,p,fund,date){const r=parseMackenzie(pages);return r.length?r:parseMackenzieEtfColumns(pages,identifyFund(pages,p),reportDate(pages));}
// @mrfp:evidence
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
