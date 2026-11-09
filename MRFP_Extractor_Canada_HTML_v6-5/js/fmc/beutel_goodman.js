/* Beutel Goodman Managed Funds — interim/annual MRFP adapter.
 * Current-period Financial Highlights are published per Class (B, D, F, I).
 * MER is the published Management Expense Ratio; PTR is Portfolio Turnover Rate.
 * Trading Expense Ratio is deliberately NOT mapped to TER. TER remains blank
 * unless the shared validator finds an explicitly labelled Total Expense Ratio.
 */
// @mrfp:profile
const profile_beutel_goodman={
 key:'beutel_goodman',label:'Beutel Goodman',style:'beutel_goodman',
 signatures:[/Beutel\s+Goodman\s+Managed\s+Funds/i,/Beutel,\s*Goodman\s*&\s*Company\s+Ltd\.?/i],
 title:/^\s*(Beutel\s+Goodman\s*[^\n]{2,130}?\b(?:Fund|ETF))\s*$/im
};
const fmcConfig_beutel_goodman={allowRowFallback:false,titleScanPages:3};

// @mrfp:extraction
function beutelGoodmanNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();
}
function beutelGoodmanCompact(value){
 return beutelGoodmanNormalize(value).toLowerCase().replace(/[^a-z0-9]/g,'');
}
function beutelGoodmanClassHeading(line){
 const match=/^Class\s+([A-Z0-9][A-Z0-9-]*)\s+Units?$/i.exec(beutelGoodmanNormalize(line));
 return match?'Class '+match[1].toUpperCase():null;
}
function classHeading_beutel_goodman(line){return beutelGoodmanClassHeading(line);}
function identifyFundEarly_beutel_goodman(pages,profile,head){
 const candidates=new Set();
 for(const page of (pages||[]).slice(0,3)){
  for(const raw of String(page.text||'').split(/\r?\n/)){
   const line=beutelGoodmanNormalize(raw);
   const match=/^Beutel\s+Goodman\s*(.{2,130}\b(?:Fund|ETF))$/i.exec(line);
   if(match&&!/^Managed\s+Funds$/i.test(match[1].trim()))candidates.add('Beutel Goodman '+match[1].trim());
  }
 }
 if(candidates.size===1)return [...candidates][0];
 if(candidates.size>1)return 'Unknown Fund';
 return undefined;
}
function selectReportDate_beutel_goodman(pages){
 const text=(pages||[]).slice(0,9).map(page=>String(page.text||'')).join('\n');
 const match=/\b(?:Interim|Annual)\s+Management\s+Report\s+of\s+Fund\s+Performance\s+as\s+of\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(text);
 if(match){
  const months={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};
  return `${match[3]}-${months[match[1].toLowerCase()]}-${match[2].padStart(2,'0')}`;
 }
 return reportDate(pages);
}
function beutelGoodmanCurrentHeader(lines,index,date){
 const match=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(date||'');
 if(!match)return null;
 const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const month=monthNames[Number(match[2])-1];
 if(!month)return null;
 for(let i=index+1;i<Math.min(lines.length,index+9);i++){
  const line=beutelGoodmanNormalize(lines[i]);
  const dateRx=new RegExp('\\b'+month+'\\s+'+match[1]+'\\b','i');
  if(!dateRx.test(line))continue;
  const years=[...line.matchAll(/\b(20\d{2})\b/g)].map(item=>Number(item[1]));
  if(!years.length||years[0]!==Number(match[1]))continue;
  // The header must include the current period and historical year columns.
  if(years.length<2||years.slice(1).some((year,i)=>year>=years[i]))continue;
  return {line,index:i,yearCount:years.length};
 }
 return null;
}
function beutelGoodmanRatioTokens(text){
 const tokens=[];
 const rx=/(?:^|\s)(N\/?A|[—–−-]{1,2}|(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?\s*%)(?=\s|$)/gi;
 let match;
 while((match=rx.exec(String(text||''))))tokens.push(match[1].replace(/\s+/g,''));
 return tokens;
}
function beutelGoodmanReadMetric(lines,index,expectedCount,key){
 const labelRx=key==='MER'?/^Management\s+expense\s+ratio\b(?!\s+before\b)/i:/^Portfolio\s+turnover\s+rate\b/i;
 if(!labelRx.test(beutelGoodmanNormalize(lines[index])))return {found:false,value:null};
 let combined=beutelGoodmanNormalize(lines[index]);
 let tokens=beutelGoodmanRatioTokens(combined.replace(labelRx,''));
 // A few PDF.js versions may place the row's cells on the following text line.
 for(let i=index+1;tokens.length<expectedCount&&i<Math.min(lines.length,index+4);i++){
  if(/^(?:Management\s+expense\s+ratio|Portfolio\s+turnover\s+rate|Trading\s+expense\s+ratio)\b/i.test(beutelGoodmanNormalize(lines[i])))break;
  combined+=' '+beutelGoodmanNormalize(lines[i]);
  tokens=beutelGoodmanRatioTokens(combined.replace(labelRx,''));
 }
 if(tokens.length!==expectedCount)return {found:false,value:null};
 const first=tokens[0];
 if(/^(?:N\/?A|[—–−-]{1,2})$/i.test(first))return {found:true,value:null};
 const value=Number(first.replace(/[,%]/g,''));
 return {found:Number.isFinite(value)&&value>=0, value:Number.isFinite(value)&&value>=0?value:null};
}
function beutelGoodmanRatioPage(page,fund,date){
 const text=String(page.text||'');
 if(!beutelGoodmanCompact(text).includes(beutelGoodmanCompact(fund))||
    !/Ratios\s+and\s+Supplemental\s+Data/i.test(text))return null;
 const lines=text.split(/\r?\n/).map(beutelGoodmanNormalize).filter(Boolean);
 const sectionIndexes=[];
 for(let i=0;i<lines.length;i++)if(/^Ratios\s+and\s+Supplemental\s+Data$/i.test(lines[i]))sectionIndexes.push(i);
 if(sectionIndexes.length!==1)return null;
 const sectionIndex=sectionIndexes[0];
 let cls=null;
 for(let i=sectionIndex+1;i<Math.min(lines.length,sectionIndex+6);i++){
  cls=beutelGoodmanClassHeading(lines[i]);
  if(cls)break;
  if(/^\(/.test(lines[i]))continue;
 }
 if(!cls)return null;
 const header=beutelGoodmanCurrentHeader(lines,sectionIndex,date);
 if(!header)return null;
 const merIndexes=[],ptrIndexes=[];
 for(let i=header.index+1;i<Math.min(lines.length,header.index+18);i++){
  if(/^Management\s+expense\s+ratio\b(?!\s+before\b)/i.test(lines[i]))merIndexes.push(i);
  if(/^Portfolio\s+turnover\s+rate\b/i.test(lines[i]))ptrIndexes.push(i);
 }
 if(merIndexes.length!==1||ptrIndexes.length!==1)return null;
 const mer=beutelGoodmanReadMetric(lines,merIndexes[0],header.yearCount,'MER');
 const ptr=beutelGoodmanReadMetric(lines,ptrIndexes[0],header.yearCount,'PTR');
 if(!mer.found&&!ptr.found)return null;
 return {cls,quality:3,values:{MER:mer.found?mer.value:null,TER:null,PTR:ptr.found?ptr.value:null},
  evidence:{
   ...(mer.found&&mer.value!==null?{MER:{page:page.page,source:'Current-period Management Expense Ratio row',method:'native-js'}}:{}),
   ...(ptr.found&&ptr.value!==null?{PTR:{page:page.page,source:'Current-period Portfolio Turnover Rate row',method:'native-js'}}:{})
  }};
}
function extract_beutel_goodman(pages,profile,fund,date){
 if(!fund||fund==='Unknown Fund'||!/^20\d\d-\d\d-\d\d$/.test(date||''))return [];
 const byClass=new Map(),conflicts=new Set();
 for(const page of pages||[]){
  const found=beutelGoodmanRatioPage(page,fund,date);if(!found)continue;
  const old=byClass.get(found.cls);
  if(!old)byClass.set(found.cls,found);
  else if(JSON.stringify(old.values)!==JSON.stringify(found.values))conflicts.add(found.cls);
 }
 for(const cls of conflicts)byClass.delete(cls);
 return [...byClass.values()];
}
function auditRatioHeadings_beutel_goodman(pageText,potential){
 const lines=String(pageText||'').split(/\r?\n/).map(beutelGoodmanNormalize);
 for(let i=0;i<lines.length;i++){
  if(!/^Ratios\s+and\s+Supplemental\s+Data$/i.test(lines[i]))continue;
  for(let j=i+1;j<Math.min(lines.length,i+6);j++){
   const cls=beutelGoodmanClassHeading(lines[j]);if(cls){potential.add(cls);break;}
  }
 }
}

// @mrfp:evidence
const evidencePolicy_beutel_goodman={stamps:{beutelGoodmanRatioLocatorVersion:2}};
function beutelGoodmanEvidenceNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();
}
function beutelGoodmanEvidenceClass(line){
 const match=/^Class\s+([A-Z0-9][A-Z0-9-]*)\s+Units?$/i.exec(beutelGoodmanEvidenceNormalize(line));
 return match?'Class '+match[1].toUpperCase():null;
}
function beutelGoodmanEvidenceDateHeader(line,iso){
 const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const month=monthNames[Number(iso[2])-1];if(!month||!Array.isArray(line.items))return null;
 const rx=new RegExp('^'+month+'\\s+'+iso[1]+'$','i');
 const dates=line.items.filter(item=>rx.test(beutelGoodmanEvidenceNormalize(item.str)));
 const years=line.items.filter(item=>/^20\d{2}$/.test(beutelGoodmanEvidenceNormalize(item.str)));
 if(dates.length!==1||years.length<2||Number(years[0].str)!==Number(iso[1])-1||years.slice(1).some((item,index)=>Number(item.str)>=Number(years[index].str)))return null;
 const item=dates[0];
 return item.x+(Number(item.w)||0)/2;
}
function validateDocumentEvidence_beutel_goodman(pages,row){
 const manager=(pages||[]).slice(0,5).some(page=>/Beutel\s+Goodman\s+Managed\s+Funds/i.test(page.text||'')||/Beutel,\s*Goodman\s*&\s*Company\s+Ltd\.?/i.test(page.text||''));
 const fund=beutelGoodmanEvidenceNormalize(row?.fund_name).toLowerCase().replace(/[^a-z0-9]/g,'');
 return manager&&fund&&(pages||[]).some(page=>beutelGoodmanEvidenceNormalize(page.text||'').toLowerCase().replace(/[^a-z0-9]/g,'').includes(fund));
}
function locateCell_beutel_goodman(page,lines,row,key,value,context){
 if((key!=='MER'&&key!=='PTR')||value===null||value===undefined||!Array.isArray(page.items)||page.ocrUsed)return null;
 const fund=beutelGoodmanEvidenceNormalize(row?.fund_name).toLowerCase().replace(/[^a-z0-9]/g,'');
 if(!fund||!beutelGoodmanEvidenceNormalize(page.text||'').toLowerCase().replace(/[^a-z0-9]/g,'').includes(fund))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');if(!iso)return null;
 const sections=lines.filter(line=>/^Ratios\s+and\s+Supplemental\s+Data$/i.test(line.text));
 if(sections.length!==1)return null;
 const section=sections[0];
 const expectedClass=String(row.class_identity||row.class_name||'');
 const classes=lines.filter(line=>line.y<section.y&&section.y-line.y<28&&
  beutelGoodmanEvidenceClass(line.text)===expectedClass);
 if(classes.length!==1)return null;
 const classLine=classes[0];
 const headers=lines.filter(line=>line.y<classLine.y&&classLine.y-line.y<48&&
  Number.isFinite(beutelGoodmanEvidenceDateHeader(line,iso)));
 if(headers.length!==1)return null;
 const header=headers[0],target=beutelGoodmanEvidenceDateHeader(header,iso);
 const labelRx=key==='MER'?/^Management\s+expense\s+ratio\b(?!\s+before\b)/i:/^Portfolio\s+turnover\s+rate\b/i;
 const metricLines=lines.filter(line=>line.y<header.y&&header.y-line.y<115&&labelRx.test(line.text));
 if(metricLines.length!==1)return null;
 const candidates=cells(metricLines[0]).filter(cell=>matchesCell(cell,value)&&
  Math.abs((cell.box.x+cell.box.w/2)-target)<18);
 if(candidates.length!==1)return null;
 return {...candidates[0],page:page.page,kind:'beutel-goodman-current-period-class-ratio-cell'};
}
