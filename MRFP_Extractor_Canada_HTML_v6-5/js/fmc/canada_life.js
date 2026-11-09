/* FMC adapter: Canada Life Investment Management Ltd.
 * Canada Life MRFPs use per-Series ratio tables arranged in two page columns.
 * The first reporting-period column is identified from its printed month/day
 * AND year header; MER and PTR cells are read from that exact column only.
 * Trading Expense Ratio is intentionally not parsed as TER. The shared
 * office rule permits TER only from a separately labelled Total Expense Ratio.
 */
// @mrfp:profile
const profile_canada_life={
 key:'canada_life',
 label:'Canada Life Investment Management Ltd.',
 style:'canada_life',
 signatures:[/Canada\s+Life\s+Investment\s+Management\s+Ltd\.?/i],
 title:null
};
const fmcConfig_canada_life={preferProfileLineTitle:true,titleScanPages:3,allowRowFallback:false};
function identifyFundEarly_canada_life(pages,profile,head){
 const candidates=new Set();
 for(const page of (pages||[]).slice(0,3)){
  for(const raw of String(page.text||'').split(/\r?\n/)){
   const line=canadaLifeNormalize(raw);
   if(line!==line.toUpperCase()||!/^CANADA\s+LIFE\s+[A-Z0-9&'’().,\- ]{5,150}\bFUND$/.test(line))continue;
   candidates.add(line);
  }
 }
 if(candidates.size===1)return [...candidates][0];
 if(candidates.size>1)return 'Unknown Fund';
 return undefined;
}

// @mrfp:extraction
function canadaLifeNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00a0\u200b\u00ad]/g,' ').replace(/\s+/g,' ').trim();
}
function canadaLifeCompact(value){
 return canadaLifeNormalize(value).toLowerCase().replace(/[^a-z0-9]/g,'');
}
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
 const month=iso[2],day=Number(iso[3]),year=Number(iso[1]);
 const candidates=lines.filter(line=>line.y>=header.y&&line.y-header.y<=20)
  .flatMap(line=>line.items)
  .map(item=>({item,parts:canadaLifeDateParts(item.str)}))
  .filter(entry=>entry.parts&&entry.parts.month===month&&entry.parts.day===day
    &&Math.abs(canadaLifeTokenCenter(entry.item)-canadaLifeTokenCenter(yearItems[0]))<22);
 return candidates.length===1?{x:canadaLifeTokenCenter(yearItems[0]),year}:null;
}
function canadaLifeTextLines(items){
 const output=[];
 for(const item of items||[]){
  if(typeof item.str!=='string'||!item.str.trim()||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;
  const height=Math.max(5,Number(item.h)||8);
  let line=output.find(candidate=>Math.abs(candidate.y-item.y)<Math.max(1.5,Math.min(2.8,height*.25)));
  if(!line){line={y:item.y,items:[]};output.push(line);}
  line.items.push({...item,h:height});
 }
 output.sort((a,b)=>b.y-a.y);
 for(const line of output){line.items.sort((a,b)=>a.x-b.x);line.text=line.items.map(item=>item.str).join(' ').replace(/\s+/g,' ').trim();}
 return output;
}
function canadaLifeMetricCells(line){
 const found=[];
 for(const item of line.items||[]){
  const raw=canadaLifeNormalize(item.str).replace(/\s+/g,'');
  if(!(Number(item.w)>0))continue;
  const missing=/^(?:n\/?a|[-–—−]{1,2})$/i.test(raw);
  const numeric=/^(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(raw);
  if(!missing&&!numeric)continue;
  const value=missing?null:Number(raw.replace('%',''));
  if(!missing&&!Number.isFinite(value))continue;
  found.push({value,isMissing:missing,raw,x:item.x,
   box:{x:Math.max(0,item.x-1),y:line.y-1,w:item.w+2,h:Math.max(6,item.h||8)+2}});
 }
 return found.sort((a,b)=>a.x-b.x);
}
function canadaLifeCellAtColumn(line,columnX){
 if(!line||!Number.isFinite(columnX))return null;
 const candidates=canadaLifeMetricCells(line).filter(cell=>{
  const center=cell.box?cell.box.x+cell.box.w/2:Number(cell.x);
  return Number.isFinite(center)&&Math.abs(center-columnX)<19;
 });
 return candidates.length===1?candidates[0]:null;
}
function canadaLifePageTables(page,fund,date){
 if(!page||!Array.isArray(page.items)||!page.items.length||page.ocrUsed)return [];
 if(!/RATIOS\s+AND\s+SUPPLEMENTAL\s+DATA/i.test(page.text||''))return [];
 const compactFund=canadaLifeCompact(fund);
 if(compactFund.length<12||!canadaLifeCompact((page.text||'').slice(0,900)).includes(compactFund))return [];
 const width=Number(page.width)||612,split=width/2,output=[];
 for(const [minX,maxX] of [[0,split-3],[split-3,width+3]]){
  const columnItems=page.items.filter(item=>Number.isFinite(item.x)&&item.x>=minX&&item.x<maxX);
  const lines=canadaLifeTextLines(columnItems);
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
   const merCell=canadaLifeCellAtColumn(merLines[0],currentX);
   const ptrCell=canadaLifeCellAtColumn(ptrLines[0],currentX);
   if(!merCell||!ptrCell)continue;
   output.push({
    cls:header.cls,
    page:page.page,
    currentX,
    merLine:merLines[0],ptrLine:ptrLines[0],
    values:{MER:merCell.value??null,TER:null,PTR:ptrCell.value??null},
    evidence:{
     MER:{page:page.page,source:'Canada Life current-period Management Expense Ratio row',method:'native-js'},
     PTR:{page:page.page,source:'Canada Life current-period Portfolio Turnover Rate row',method:'native-js'}
    },
    quality:2
   });
  }
 }
 return output;
}
function extract_canada_life(pages,profile,fund,date){
 if(!fund||fund==='Unknown Fund'||!/^20\d{2}-\d{2}-\d{2}$/.test(date||''))return [];
 const rows=[],conflicts=new Set();
 for(const page of pages||[]){
  for(const found of canadaLifePageTables(page,fund,date)){
   const old=rows.find(row=>row.cls===found.cls);
   if(!old)rows.push(found);
   else if(old.values.MER!==found.values.MER||old.values.PTR!==found.values.PTR||old.page!==found.page)conflicts.add(found.cls);
  }
 }
 return rows.filter(row=>!conflicts.has(row.cls));
}

// @mrfp:evidence
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
