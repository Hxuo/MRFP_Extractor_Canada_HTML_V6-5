/* SEI Investments Canada Company adapter.
 * One structure-driven strategy for SEI MRFPs. Fund titles and Class names are
 * discovered from each report; reporting years are selected dynamically from
 * the shared reportDate() result. No fund-name, class-name, or year allow-list.
 * Build browser bundles with `node dev-tools/build.cjs`.
 */
// @mrfp:profile
const profile_sei={
 key:'sei',label:'SEI Investments Canada Company',style:'sei',
 signatures:[/SEI Investments Canada Company\s*\(\s*the\s*[“\"']?Manager[”\"']?\s*\)/i,/SEI\s+Funds\s+for\s+the\s+period\s+ending/i,/seic\.com\/en-ca/i]
};
const fmcConfig_sei={titleScanPages:3,allowRowFallback:false};

// @mrfp:extraction
function seiNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();
}
function identifyFundEarly_sei(pages){
 const first=String(pages?.[0]?.text||'').split(/\r?\n/).map(seiNormalize).filter(Boolean);
 if(first.length<2||!/(?:semi-annual|annual|interim)\s+management\s+report\s+of\s+fund\s+performance/i.test(first.slice(0,4).join(' ')))return undefined;
 const title=first[0];
 return /^[A-Z][A-Za-z0-9&'’()., /-]{3,120}\bFund$/i.test(title)?title:undefined;
}
function selectReportDate_sei(pages){return reportDate(pages);}
function seiDeduplicateItems(items){
 const out=[];
 for(const item of items||[]){
  if(typeof item.str!=='string'||!item.str.trim()||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;
  const normalized=seiNormalize(item.str).toLowerCase();
  if(out.some(old=>seiNormalize(old.str).toLowerCase()===normalized&&Math.abs(old.x-item.x)<1.15&&Math.abs(old.y-item.y)<2.25))continue;
  out.push({...item,str:seiNormalize(item.str),h:Math.max(5,Number(item.h)||8),w:Math.max(0,Number(item.w)||0)});
 }
 return out.sort((a,b)=>b.y-a.y||a.x-b.x);
}
function seiBuildLines(items){
 const lines=[];
 for(const item of seiDeduplicateItems(items)){
  let line=lines.find(row=>Math.abs(row.y-item.y)<Math.max(1.0,Math.min(1.5,item.h*.18)));
  if(!line){line={y:item.y,items:[]};lines.push(line);}
  line.items.push(item);
 }
 for(const line of lines){
  line.items.sort((a,b)=>a.x-b.x);
  line.text=line.items.map(item=>item.str).join(' ').replace(/\s+/g,' ').trim();
 }
 return lines.sort((a,b)=>b.y-a.y);
}
function seiClassFromLine(line){
 const left=seiNormalize((line.items||[]).filter(item=>item.x<190).map(item=>item.str).join(' '));
 const match=/^Class\s+([A-Za-z0-9][A-Za-z0-9 &/().-]{0,35}?)\s*\**$/i.exec(left);
 if(!match)return null;
 const suffix=seiNormalize(match[1]).replace(/\s+Units?$/i,'').trim();
 if(!suffix||suffix.length>35||/\b(?:inception|date|outstanding|units?)\b/i.test(suffix))return null;
 return 'Class '+suffix;
}
function seiYearItems(line){
 return (line.items||[]).filter(item=>item.x>200&&/^20\d{2}$/.test(seiNormalize(item.str)));
}
function seiIsRatioHeading(line){return /^RATIOS\s+AND\s+SUPPLEMENTAL\s+DATA\s*:?$/i.test(seiNormalize(line.text));}
function seiClassBlocks(lines,reportYear){
 const headings=lines.map(line=>({line,cls:seiClassFromLine(line)})).filter(item=>item.cls&&item.line.items.some(it=>it.x<150));
 const blocks=[];
 for(let i=0;i<headings.length;i++){
  const current=headings[i],next=headings[i+1],lower=next?.line.y??20;
  const header=lines.filter(line=>line.y<current.line.y&&line.y>lower&&current.line.y-line.y<45&&seiYearItems(line).length>=2)
   .sort((a,b)=>b.y-a.y)[0];
  if(!header)continue;
  const yearHits=seiYearItems(header).filter(item=>Number(seiNormalize(item.str))===reportYear);
  if(yearHits.length!==1)continue;
  const yearItem=yearHits[0],center=yearItem.x+(Number(yearItem.w)||0)/2;
  const section=lines.filter(line=>line.y<header.y&&line.y>lower&&seiIsRatioHeading(line)).sort((a,b)=>b.y-a.y)[0];
  if(!section)continue;
  blocks.push({cls:current.cls,heading:current.line,next:next?.line||null,lower,header,yearItem,center,section,
   metricLines:lines.filter(line=>line.y<section.y&&line.y>lower)});
 }
 return blocks;
}
function seiMetricLabel(line,key){
 const patterns={
  MER:/^Management\s+expense\s+ratio(?:\s*\([a-z0-9]{1,3}\))?$/i,
  PTR:/^Portfolio\s+turnover\s+(?:rate|ratio)(?:\s*\([a-z0-9]{1,3}\))?$/i
 };
 return (line.items||[]).find(item=>item.x<250&&patterns[key]?.test(seiNormalize(item.str)));
}
function seiValueTokens(item){
 const raw=seiNormalize(item.str).replace(/\s+/g,'');
 if(/^[—–−-]{1,2}$/.test(raw)||/^n\/?a$/i.test(raw))return [{value:null,isMissing:true,raw:raw||item.str,item,x:item.x+(Number(item.w)||0)/2,box:{x:Math.max(0,item.x-1),y:item.y-1,w:Math.max(2,item.w)+2,h:item.h+2}}];
 const out=[],rx=/(?:^|[^\w.])((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?%?)(?=$|[^\w])/g;let match;
 while((match=rx.exec(raw))){
  const token=match[1],value=Number(token.replace(/[,%]/g,''));
  if(!Number.isFinite(value)||value<0||value>1000)continue;
  const start=match.index+(match[0].length-token.length),width=(Number(item.w)||raw.length*item.h*.45)*token.length/Math.max(1,raw.length);
  const x=item.x+(Number(item.w)||raw.length*item.h*.45)*start/Math.max(1,raw.length);
  out.push({value,isMissing:false,raw:token,item,x:x+width/2,box:{x:Math.max(0,x-1),y:item.y-1,w:Math.max(1,width)+2,h:item.h+2}});
 }
 return out;
}
function seiMetricCell(line,label,center){
 if(!label||!Number.isFinite(center))return null;
 const hits=(line.items||[]).filter(item=>item.x>label.x+label.w+5).flatMap(seiValueTokens)
  .filter(cell=>Math.abs(cell.x-center)<16);
 if(hits.length!==1)return null;
 return hits[0];
}
function seiFindMetric(block,key){
 for(const line of block.metricLines){const label=seiMetricLabel(line,key);if(label)return {line,label};}
 return null;
}
function seiParseFinancialPage(page,reportYear){
 if(!Array.isArray(page.items)||!page.items.length||page.ocrUsed)return [];
 const lines=seiBuildLines(page.items);
 if(!lines.some(seiIsRatioHeading))return [];
 const out=[];
 for(const block of seiClassBlocks(lines,reportYear)){
  const merLine=seiFindMetric(block,'MER'),ptrLine=seiFindMetric(block,'PTR');
  if(!merLine&&!ptrLine)continue;
  const mer=merLine?seiMetricCell(merLine.line,merLine.label,block.center):null;
  const ptr=ptrLine?seiMetricCell(ptrLine.line,ptrLine.label,block.center):null;
  out.push({cls:block.cls,quality:merLine&&ptrLine?3:2,values:{MER:mer?.value??null,TER:null,PTR:ptr?.value??null},evidence:{
   ...(merLine?{MER:{page:page.page,source:'Latest-year Management Expense Ratio row',method:'native-js'}}:{}),
   ...(ptrLine?{PTR:{page:page.page,source:'Latest-year Portfolio Turnover Rate row',method:'native-js'}}:{})
  }});
 }
 return out;
}
function extract_sei(pages,profile,fund,date){
 if(!fund||fund==='Unknown Fund'||!/^20\d{2}-\d{2}-\d{2}$/.test(date||''))return [];
 const reportYear=Number(date.slice(0,4)),byClass=new Map(),conflicts=new Set();
 for(const page of pages||[]){
  if(!/Financial\s+Highlights|Ratios\s+and\s+Supplemental\s+Data/i.test(page.text||''))continue;
  for(const row of seiParseFinancialPage(page,reportYear)){
   const previous=byClass.get(row.cls);
   if(!previous)byClass.set(row.cls,row);
   else if(JSON.stringify(previous.values)!==JSON.stringify(row.values))conflicts.add(row.cls);
  }
 }
 for(const cls of conflicts)byClass.delete(cls);
 return [...byClass.values()];
}
function auditRatioHeadings_sei(pageText,potential){
 const lines=String(pageText||'').split(/\r?\n/).map(seiNormalize);
 for(let i=0;i<lines.length;i++){
  const match=/^Class\s+([A-Za-z0-9][A-Za-z0-9 &/().-]{0,35}?)\s*\**$/i.exec(lines[i]);
  if(!match)continue;
  let end=lines.length;
  for(let j=i+1;j<lines.length;j++)if(/^Class\s+[A-Za-z0-9]/i.test(lines[j])){end=j;break;}
  if(lines.slice(i+1,end).some(line=>/^RATIOS\s+AND\s+SUPPLEMENTAL\s+DATA\s*:?$/i.test(line))){
   const suffix=seiNormalize(match[1]).replace(/\s+Units?$/i,'').trim();
   if(suffix)potential.add('Class '+suffix);
  }
 }
}

// @mrfp:evidence
const evidencePolicy_sei={stamps:{seiFinancialHighlightsLocatorVersion:1}};
function seiEvidenceNormalize(value){return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();}
function seiEvidenceItems(items){
 const out=[];
 for(const item of items||[]){
  if(typeof item.str!=='string'||!item.str.trim()||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;
  const normalized=seiEvidenceNormalize(item.str).toLowerCase();
  if(out.some(old=>seiEvidenceNormalize(old.str).toLowerCase()===normalized&&Math.abs(old.x-item.x)<1.15&&Math.abs(old.y-item.y)<2.25))continue;
  out.push({...item,str:seiEvidenceNormalize(item.str),h:Math.max(5,Number(item.h)||8),w:Math.max(0,Number(item.w)||0)});
 }
 return out.sort((a,b)=>b.y-a.y||a.x-b.x);
}
function seiEvidenceLines(items){
 const lines=[];
 for(const item of seiEvidenceItems(items)){
  let line=lines.find(row=>Math.abs(row.y-item.y)<Math.max(1.0,Math.min(1.5,item.h*.18)));
  if(!line){line={y:item.y,items:[]};lines.push(line);}
  line.items.push(item);
 }
 for(const line of lines){line.items.sort((a,b)=>a.x-b.x);line.text=line.items.map(item=>item.str).join(' ').replace(/\s+/g,' ').trim();}
 return lines.sort((a,b)=>b.y-a.y);
}
function seiEvidenceClass(line){
 const left=seiEvidenceNormalize((line.items||[]).filter(item=>item.x<190).map(item=>item.str).join(' '));
 const match=/^Class\s+([A-Za-z0-9][A-Za-z0-9 &/().-]{0,35}?)\s*\**$/i.exec(left);
 if(!match)return null;
 const suffix=seiEvidenceNormalize(match[1]).replace(/\s+Units?$/i,'').trim();
 return suffix&&suffix.length<=35&&!/\b(?:inception|date|outstanding|units?)\b/i.test(suffix)?'Class '+suffix:null;
}
function seiEvidenceYears(line){return (line.items||[]).filter(item=>item.x>200&&/^20\d{2}$/.test(seiEvidenceNormalize(item.str)));}
function seiEvidenceRatioHeading(line){return /^RATIOS\s+AND\s+SUPPLEMENTAL\s+DATA\s*:?$/i.test(seiEvidenceNormalize(line.text));}
function seiEvidenceBlocks(lines,reportYear){
 const headings=lines.map(line=>({line,cls:seiEvidenceClass(line)})).filter(item=>item.cls&&item.line.items.some(it=>it.x<150));
 const blocks=[];
 for(let i=0;i<headings.length;i++){
  const current=headings[i],next=headings[i+1],lower=next?.line.y??20;
  const header=lines.filter(line=>line.y<current.line.y&&line.y>lower&&current.line.y-line.y<45&&seiEvidenceYears(line).length>=2).sort((a,b)=>b.y-a.y)[0];
  if(!header)continue;
  const yearHits=seiEvidenceYears(header).filter(item=>Number(seiEvidenceNormalize(item.str))===reportYear);
  if(yearHits.length!==1)continue;
  const yearItem=yearHits[0],center=yearItem.x+(Number(yearItem.w)||0)/2;
  const section=lines.filter(line=>line.y<header.y&&line.y>lower&&seiEvidenceRatioHeading(line)).sort((a,b)=>b.y-a.y)[0];
  if(!section)continue;
  blocks.push({cls:current.cls,next:next?.line||null,lower,center,section,metricLines:lines.filter(line=>line.y<section.y&&line.y>lower)});
 }
 return blocks;
}
function seiEvidenceLabel(line,key){
 const patterns={MER:/^Management\s+expense\s+ratio(?:\s*\([a-z0-9]{1,3}\))?$/i,PTR:/^Portfolio\s+turnover\s+(?:rate|ratio)(?:\s*\([a-z0-9]{1,3}\))?$/i};
 return (line.items||[]).find(item=>item.x<250&&patterns[key]?.test(seiEvidenceNormalize(item.str)));
}
function seiEvidenceTokens(item){
 const raw=seiEvidenceNormalize(item.str).replace(/\s+/g,'');
 if(/^[—–−-]{1,2}$/.test(raw)||/^n\/?a$/i.test(raw))return [{value:null,isMissing:true,raw:raw||item.str,item,x:item.x+(Number(item.w)||0)/2,box:{x:Math.max(0,item.x-1),y:item.y-1,w:Math.max(2,item.w)+2,h:item.h+2}}];
 const out=[],rx=/(?:^|[^\w.])((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?%?)(?=$|[^\w])/g;let match;
 while((match=rx.exec(raw))){
  const token=match[1],n=Number(token.replace(/[,%]/g,''));if(!Number.isFinite(n)||n<0||n>1000)continue;
  const start=match.index+(match[0].length-token.length),width=(Number(item.w)||raw.length*item.h*.45)*token.length/Math.max(1,raw.length);
  const x=item.x+(Number(item.w)||raw.length*item.h*.45)*start/Math.max(1,raw.length);
  out.push({value:n,isMissing:false,raw:token,item,x:x+width/2,box:{x:Math.max(0,x-1),y:item.y-1,w:Math.max(1,width)+2,h:item.h+2}});
 }
 return out;
}
function seiEvidenceFindCell(page,row,key,value){
 if(!Array.isArray(page.items)||!page.items.length||page.ocrUsed||!['MER','PTR'].includes(key))return null;
 const reportYear=Number(String(row.report_date||'').slice(0,4));if(!reportYear)return null;
 const lines=seiEvidenceLines(page.items),blocks=seiEvidenceBlocks(lines,reportYear);
 const expected=seiEvidenceNormalize(row.class_identity||row.class_name).toLowerCase();
 const matching=blocks.filter(block=>seiEvidenceNormalize(block.cls).toLowerCase()===expected);
 if(matching.length!==1)return null;
 const block=matching[0];let selected=null;
 for(const line of block.metricLines){const label=seiEvidenceLabel(line,key);if(label){selected={line,label};break;}}
 if(!selected)return null;
 const hits=selected.line.items.filter(item=>item.x>selected.label.x+selected.label.w+5).flatMap(seiEvidenceTokens)
  .filter(cell=>Math.abs(cell.x-block.center)<16&&(value===null||value===undefined?cell.isMissing:!cell.isMissing&&Math.abs(cell.value-Number(value))<0.000001));
 if(hits.length!==1)return null;
 return {box:hits[0].box,page:page.page,metric:key,kind:'sei-latest-reporting-year-class-ratio-cell',raw:hits[0].raw,isMissing:!!hits[0].isMissing};
}
function validateDocumentEvidence_sei(pages,row){
 const head=(pages||[]).slice(0,3).map(page=>page.text||'').join('\n');
 const fund=seiEvidenceNormalize(row?.fund_name).toLowerCase();
 return /SEI Investments Canada Company/i.test(head)&&/seic\.com\/en-ca/i.test(head)&&fund.length>7&&seiEvidenceNormalize(head).toLowerCase().includes(fund);
}
function locateCell_sei(page,lines,row,key,value,context){
 if(!['MER','PTR'].includes(key))return null;
 return seiEvidenceFindCell(page,row,key,value);
}
