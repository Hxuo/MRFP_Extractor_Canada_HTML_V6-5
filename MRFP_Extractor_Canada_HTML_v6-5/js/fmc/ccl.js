/* CC&L Funds Inc. adapter.
 * One structure-driven strategy for all CC&L funds and series. Fund names and
 * series are discovered from each report; neither fund category nor a fixed
 * fund/series allow-list controls extraction.
 * Build browser bundles with `node dev-tools/build.cjs`.
 */
// @mrfp:profile
const profile_ccl={
 key:'ccl',label:'CC&L Funds Inc.',style:'ccl',
 signatures:[/www\.cclfundsinc\.com/i,/CC&L\s+Interim\s+Management\s+Report\s+of\s+Fund\s+Performance/i],
 title:/^\s*(CC&L\s+[^\n]{4,130}?\bFund)\s*$/im
};
const fmcConfig_ccl={issuerPrefix:/^CC&L\s/i,titleScanPages:3,allowRowFallback:false};

// @mrfp:extraction
function cclNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();
}
function identifyFundEarly_ccl(pages,profile,head){
 const names=new Set();
 const rx=/\b(CC&L\s+[^()]{4,130}?\bFund)\s*\(\s*the\s+[“"']?Fund[”"']?\s*\)/gi;
 for(const page of (pages||[]).slice(0,4)){
  const text=String(page.text||'').replace(/\s+/g,' ');let m;
  while((m=rx.exec(text)))names.add(cclNormalize(m[1]));
 }
 if(names.size===1)return [...names][0];
 if(names.size>1)return 'Unknown Fund';
 // Cover-title fallback for future CC&L templates whose body omits the
 // conventional '(the Fund)' definition.
 const candidates=new Set();
 for(const page of (pages||[]).slice(0,3)){
  const lines=String(page.text||'').split(/\r?\n/).map(cclNormalize).filter(Boolean);
  for(let i=0;i<lines.length;i++){
   if(!/^CC&L\s+/i.test(lines[i]))continue;
   let candidate=lines[i];
   if(!/\bFund$/i.test(candidate)&&/^Fund$/i.test(lines[i+1]||''))candidate+=' Fund';
   if(/^CC&L\s+.{4,120}\bFund$/i.test(candidate))candidates.add(candidate);
  }
 }
 if(candidates.size===1)return [...candidates][0];
 return candidates.size>1?'Unknown Fund':undefined;
}
function selectReportDate_ccl(pages){return reportDate(pages);}

// The source PDFs contain a second, slightly offset text layer. Collapse only
// near-identical glyph runs; different columns and repeated historical values
// remain separate because their x positions differ.
function cclDeduplicateItems(items){
 const out=[];
 for(const item of (items||[])){
  if(typeof item.str!=='string'||!item.str.trim()||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;
  const normalized=cclNormalize(item.str).toLowerCase();
  const duplicate=out.find(old=>cclNormalize(old.str).toLowerCase()===normalized&&
   Math.abs(old.x-item.x)<1.15&&Math.abs(old.y-item.y)<2.25);
  if(!duplicate)out.push({...item,str:cclNormalize(item.str),h:Math.max(5,Number(item.h)||8),w:Math.max(0,Number(item.w)||0)});
 }
 return out.sort((a,b)=>b.y-a.y||a.x-b.x);
}
function cclBuildLines(items){
 const lines=[];
 for(const item of cclDeduplicateItems(items)){
  const h=Math.max(5,Number(item.h)||8);
  let line=lines.find(row=>Math.abs(row.y-item.y)<Math.max(1.0,Math.min(1.3,h*.15)));
  if(!line){line={y:item.y,items:[]};lines.push(line);}
  line.items.push(item);
 }
 for(const line of lines){
  line.items.sort((a,b)=>a.x-b.x);
  line.text=line.items.map(item=>item.str).join(' ').replace(/\s+/g,' ').trim();
  line.minX=Math.min(...line.items.map(item=>item.x));
  line.maxX=Math.max(...line.items.map(item=>item.x+item.w));
 }
 return lines.sort((a,b)=>b.y-a.y);
}
function cclSeriesFromLine(line){
 const left=line.items.filter(item=>item.x<285).map(item=>item.str).join(' ');
 const text=cclNormalize(left);
 const match=/^(Series|Class)\s+(.+)$/i.exec(text);
 if(!match||/\b(?:inception|date|units?|outstanding)\b/i.test(match[2]))return null;
 const suffix=cclNormalize(match[2]).replace(/\s*\(\d+\)\s*$/,'').trim();
 if(!suffix||suffix.length>45||/\b20\d{2}\b/.test(suffix))return null;
 return match[1][0].toUpperCase()+match[1].slice(1).toLowerCase()+' '+suffix;
}
function cclParseDateLabel(value){
 const match=/^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2}),?$/i.exec(cclNormalize(value));
 if(!match)return null;
 const months={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
 const month=months[match[1].slice(0,3).toLowerCase()];
 return {month,day:match[2].padStart(2,'0')};
}
function cclCenter(item){return item.x+(Number(item.w)||0)/2;}
function cclHeaderColumns(lines,heading){
 const years=heading.items.filter(item=>item.x>285&&/^20\d{2}$/.test(item.str.trim()));
 const dateItems=lines.filter(line=>line.y>heading.y+2&&line.y-heading.y<18)
  .flatMap(line=>line.items).map(item=>({item,date:cclParseDateLabel(item.str)})).filter(x=>x.date);
 const columns=[];
 for(const entry of dateItems){
  const center=cclCenter(entry.item);
  const nearby=years.map(item=>({item,distance:Math.abs(cclCenter(item)-center)})).filter(x=>x.distance<6).sort((a,b)=>a.distance-b.distance);
  if(nearby.length!==1)continue;
  const year=nearby[0].item.str.trim();
  const iso=`${year}-${entry.date.month}-${entry.date.day}`;
  if(!columns.some(column=>column.date===iso))columns.push({date:iso,center});
 }
 return columns.sort((a,b)=>a.center-b.center);
}
function cclSelectColumn(columns,reportDate){
 if(reportDate)return columns.find(column=>column.date===reportDate)||null;
 return [...columns].sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
}
function cclMetricLabel(line,key){
 const patterns={
  MER:/^Management\s+expense\s+ratio(?:\s*\(\d+\))?$/i,
  TER:/^Total\s+expense\s+ratio(?:s)?(?:\s*\(\d+\))?$/i,
  PTR:/^Portfolio\s+turnover\s+(?:rate|ratio)(?:\s*\(\d+\))?$/i
 };
 return line.items.find(item=>item.x<285&&patterns[key]?.test(cclNormalize(item.str)));
}
function cclCellTokens(item){
 const raw=cclNormalize(item.str).replace(/\s+/g,'');
 if(/^[—–−-]{1,2}$/.test(raw)||/^n\/?a$/i.test(raw))return [{value:null,isMissing:true,raw:raw||item.str,item}];
 const matches=[];
 const rx=/(?:^|[^\w.])((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?%)(?=$|[^\w])/g;
 let match;
 while((match=rx.exec(raw))){
  const token=match[1],value=Number(token.replace(/[,%]/g,''));
  if(!Number.isFinite(value)||value<0||value>1000)continue;
  const start=match.index+(match[0].length-token.length);
  const width=(Number(item.w)||raw.length*item.h*.45)*token.length/Math.max(1,raw.length);
  const x=item.x+(Number(item.w)||raw.length*item.h*.45)*start/Math.max(1,raw.length);
  matches.push({value,isMissing:false,raw:token,item,box:{x:Math.max(0,x-1),y:item.y-1,w:Math.max(1,width)+2,h:item.h+2},x});
 }
 return matches;
}
function cclMetricCell(line,label,column){
 if(!label||!column)return null;
 const candidates=line.items.filter(item=>item.x>label.x+label.w+5).flatMap(cclCellTokens)
  .filter(cell=>Math.abs((cell.x??cell.item.x+(cell.item.w||0)/2)-column.center)<24);
 if(candidates.length!==1)return null;
 const cell=candidates[0];
 if(cell.isMissing)return {...cell,box:{x:Math.max(0,cell.item.x-1),y:cell.item.y-1,w:Math.max(2,cell.item.w)+2,h:cell.item.h+2}};
 return cell;
}
function cclFindMetric(block,key){
 // Prefer the first (uppermost) correctly labelled row in this series block.
 // Some CC&L PDFs contain a second offset text layer; later copies can sit
 // lower on the page and must not override the visible current table row.
 for(const line of block){const label=cclMetricLabel(line,key);if(label)return {line,label};}
 return null;
}
function cclParseFinancialPage(page,reportDate){
 if(!Array.isArray(page.items)||!page.items.length||page.ocrUsed)return [];
 const lines=cclBuildLines(page.items);
 const sections=lines.filter(line=>/^Ratios\s*(?:&|and)\s*Supplemental\s+Data\s*:?$/i.test(line.text));
 if(sections.length!==1)return [];
 const section=sections[0];
 const headings=lines.filter(line=>line.y<section.y&&section.y-line.y<520&&cclSeriesFromLine(line))
  .map(line=>({line,cls:cclSeriesFromLine(line),columns:cclHeaderColumns(lines,line)}))
  .filter(item=>cclSelectColumn(item.columns,reportDate))
  .sort((a,b)=>b.line.y-a.line.y);
 const out=[];
 for(let i=0;i<headings.length;i++){
  const current=headings[i],next=headings[i+1];
  const block=lines.filter(line=>line.y<current.line.y-2&&(!next||line.y>next.line.y+2));
  const columns=cclHeaderColumns(lines,current.line);
  const column=cclSelectColumn(columns,reportDate);
  if(!column)continue;
  const merLine=cclFindMetric(block,'MER'),ptrLine=cclFindMetric(block,'PTR');
  if(!merLine&&!ptrLine)continue;
  const mer=merLine?cclMetricCell(merLine.line,merLine.label,column):null;
  const ptr=ptrLine?cclMetricCell(ptrLine.line,ptrLine.label,column):null;
  out.push({cls:current.cls,quality:merLine&&ptrLine?3:2,values:{MER:mer?.value??null,TER:null,PTR:ptr?.value??null},evidence:{
   ...(merLine?{MER:{page:page.page,source:'Current-period Management Expense Ratio row',method:'native-js'}}:{}),
   ...(ptrLine?{PTR:{page:page.page,source:'Current-period Portfolio Turnover Rate row',method:'native-js'}}:{})
  }});
 }
 return out;
}
function extract_ccl(pages,profile,fund,date){
 if(!fund||fund==='Unknown Fund'||!/^20\d{2}-\d{2}-\d{2}$/.test(date||''))return [];
 const bySeries=new Map(),conflicts=new Set();
 for(const page of pages||[]){
  if(!/Ratios\s*(?:&|and)\s*Supplemental\s+Data/i.test(page.text||''))continue;
  for(const row of cclParseFinancialPage(page,date)){
   const previous=bySeries.get(row.cls);
   if(!previous)bySeries.set(row.cls,row);
   else if(JSON.stringify(previous.values)!==JSON.stringify(row.values))conflicts.add(row.cls);
  }
 }
 for(const cls of conflicts)bySeries.delete(cls);
 return [...bySeries.values()];
}
function auditRatioHeadings_ccl(pageText,potential){
 const text=String(pageText||'');
 const ix=text.search(/Ratios\s*(?:&|and)\s*Supplemental\s+Data/i);if(ix<0)return;
 for(const line of text.slice(ix).split(/\r?\n/)){
  if(/inception|date:/i.test(line))continue;
  const prefix=/^\s*(Series|Class)\s+/i.exec(line);if(!prefix)continue;
  // PDF.js can duplicate the heading text on the same line (for example,
  // 'Series A Series A 2026 ...'). Stop at the first repeated heading token.
  const beforeYear=line.split(/\s+20\d{2}\b/)[0]||'';
  let suffix=cclNormalize(beforeYear.slice(prefix[0].length)).replace(/(?:Series|Class)\s+.*$/i,'').trim();
  suffix=suffix.replace(/\s*\(\d+\)\s*$/,'').trim();
  if(suffix&&suffix.length<=45)potential.add(prefix[1][0].toUpperCase()+prefix[1].slice(1).toLowerCase()+' '+suffix);
 }
}

// @mrfp:evidence
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
