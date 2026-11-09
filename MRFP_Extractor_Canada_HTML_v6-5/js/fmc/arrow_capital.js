/* Arrow Capital Management Inc. — annual/interim mutual-fund MRFP adapter.
 * Current-period Financial Highlights are extracted per published Series.
 * Historical re-designations are retained for display/search, while canonical
 * Series identity remains stable for row IDs, filtering and source evidence.
 * TER is populated only by the shared explicit Total Expense Ratio validator.
 */
// @mrfp:profile
const profile_arrow_capital={
 key:'arrow_capital',label:'Arrow Capital Management Inc.',style:'arrow_capital',
 signatures:[/Arrow\s+Capital\s+Management\s+Inc\.?/i],
 title:/^\s*([A-Z][A-Z0-9&'’().,\- ]{8,140}\bFUND)\s*$/m
};
const fmcConfig_arrow_capital={allowRowFallback:false,titleScanPages:3};

// @mrfp:extraction
function arrowCapitalNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-')
  .replace(/\s*-\s*/g,'-').replace(/\s+/g,' ').trim();
}
function arrowCapitalCompact(value){
 return arrowCapitalNormalize(value).toLowerCase().replace(/[^a-z0-9]/g,'');
}
function arrowCapitalTitleCase(value){
 const lower=String(value||'').toLowerCase();
 return lower.replace(/\b[a-z][a-z0-9']*/g,word=>
  /^(?:and|of|the|for|in|on|to|at|by)$/i.test(word)?word:word.charAt(0).toUpperCase()+word.slice(1));
}
function identifyFundEarly_arrow_capital(pages,profile,head){
 const candidates=new Set();
 for(const page of pages.slice(0,3)){
  for(const raw of String(page.text||'').split(/\r?\n/)){
   const line=String(raw||'').trim().replace(/\s+/g,' ');
   if(!/^[A-Z][A-Z0-9&'’().,\- ]{8,140}\bFUND$/.test(line))continue;
   if(/\b(?:ANNUAL|SEMI-ANNUAL|MANAGEMENT REPORT|FUND PERFORMANCE|FINANCIAL STATEMENTS|FINANCIAL HIGHLIGHTS)\b/.test(line))continue;
   candidates.add(line);
  }
 }
 if(candidates.size===1)return arrowCapitalTitleCase([...candidates][0]);
 if(candidates.size>1)return 'Unknown Fund';
 return undefined;
}
function selectReportDate_arrow_capital(pages){
 const text=pages.slice(0,6).map(page=>String(page.text||'')).join('\n');
 const monthMap={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
 const match=/\b(?:year|period)\s+ended\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(text);
 if(match)return `${match[3]}-${monthMap[match[1].slice(0,3).toLowerCase()]}-${match[2].padStart(2,'0')}`;
 return reportDate(pages);
}
function arrowCapitalSeriesHeading(line){
 const text=arrowCapitalNormalize(line).toUpperCase();
 const match=/^SERIES\s+([A-Z][A-Z0-9]*)\s*(?:\(\s*RE-DESIGNATED\s+FROM\s+([A-Z0-9][A-Z0-9 ]*?)\s*\))?$/.exec(text);
 if(!match)return null;
 const code=match[1].toUpperCase();
 const canonical=`Series ${code}`;
 const alias=match[2]?match[2].trim().replace(/\s+/g,' ').replace(/\bSERIES\b/i,'Series'):null;
 const display=alias?`${canonical} (re-designated from ${alias})`:canonical;
 return {cls:canonical,displayCls:display,aliases:alias?[alias]:[]};
}
function arrowCapitalYearHeader(lines,sectionIndex,year){
 const candidates=lines.slice(Math.max(0,sectionIndex-9),sectionIndex)
  .map(line=>({line,years:[...String(line).matchAll(/\b(20\d{2})\b/g)].map(match=>Number(match[1]))}))
  .filter(item=>item.years.length&&item.years[0]===year);
 return candidates.length?candidates[candidates.length-1].line:null;
}
function arrowCapitalFirstRatioCell(line,labelPattern){
 const text=arrowCapitalNormalize(line);
 const label=labelPattern.exec(text);
 if(!label)return {found:false,value:null};
 let tail=text.slice(label[0].length);
 // PDF.js may put a superscript footnote marker into the flattened row text.
 // Remove only a standalone small integer; never strip the leading ratio.
 tail=tail.replace(/^\s*(?:\(?\d{1,2}\)?)(?=\s|$)\s*/,'');
 const cell=/^\s*(N\/?A|[—–−-]{1,2}|(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?\s*%\*?)/i.exec(tail);
 if(!cell)return {found:false,value:null};
 const raw=cell[1].replace(/\s+/g,'');
 if(/^(?:N\/?A|[—–−-]{1,2})$/i.test(raw))return {found:true,value:null};
 // MER and PTR must be explicitly published as percentages in this table.
 if(!/%/.test(raw))return {found:false,value:null};
 const value=Number(raw.replace(/[,%*]/g,''));
 return {found:Number.isFinite(value)&&value>=0,value:Number.isFinite(value)&&value>=0?value:null};
}
function arrowCapitalRatioPage(page,fund,date){
 const text=String(page.text||'');
 if(!arrowCapitalCompact(text).includes(arrowCapitalCompact(fund))||
    !/Ratios\s+and\s+Supplemental\s+Data/i.test(text))return null;
 const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const sectionIndex=lines.findIndex(line=>/^Ratios\s+and\s+Supplemental\s+Data\b/i.test(line));
 if(sectionIndex<0)return null;
 const year=Number(String(date||'').slice(0,4));
 if(!year||!arrowCapitalYearHeader(lines,sectionIndex,year))return null;
 let heading=null;
 for(let i=sectionIndex-1;i>=Math.max(0,sectionIndex-10);i--){
  const parsed=arrowCapitalSeriesHeading(lines[i]);
  if(parsed){heading=parsed;break;}
 }
 if(!heading)return null;
 const merLine=lines.slice(sectionIndex+1).find(line=>
  /^Management\s+expense\s+ratio(?=\s|$|\d)(?!\s+before\b)/i.test(line));
 const ptrLine=lines.slice(sectionIndex+1).find(line=>/^Portfolio\s+turnover\s+rate(?=\s|$|\d)/i.test(line));
 const mer=merLine?arrowCapitalFirstRatioCell(merLine,/^Management\s+expense\s+ratio(?=\s|$|\d)(?!\s+before\b)/i):{found:false,value:null};
 const ptr=ptrLine?arrowCapitalFirstRatioCell(ptrLine,/^Portfolio\s+turnover\s+rate(?=\s|$|\d)/i):{found:false,value:null};
 if(!mer.found&&!ptr.found)return null;
 return {cls:heading.cls,displayCls:heading.displayCls,aliases:heading.aliases,quality:3,
  values:{MER:mer.found?mer.value:null,TER:null,PTR:ptr.found?ptr.value:null},
  evidence:{
   ...(mer.found&&mer.value!==null?{MER:{page:page.page,source:'Current-period Management Expense Ratio (MER) row',method:'native-js'}}:{}),
   ...(ptr.found&&ptr.value!==null?{PTR:{page:page.page,source:'Current-period Portfolio Turnover Rate row',method:'native-js'}}:{})
  }};
}
function extract_arrow_capital(pages,profile,fund,date){
 if(!fund||fund==='Unknown Fund'||!/^20\d\d-\d\d-\d\d$/.test(date||''))return [];
 const bySeries=new Map(),conflicts=new Set();
 for(const page of pages){
  const found=arrowCapitalRatioPage(page,fund,date);if(!found)continue;
  const old=bySeries.get(found.cls);
  if(!old)bySeries.set(found.cls,found);
  else if(JSON.stringify(old.values)!==JSON.stringify(found.values)||old.displayCls!==found.displayCls)conflicts.add(found.cls);
 }
 for(const cls of conflicts)bySeries.delete(cls);
 return [...bySeries.values()];
}
function auditRatioHeadings_arrow_capital(pageText,potential){
 const text=String(pageText||'');if(!/Ratios\s+and\s+Supplemental\s+Data/i.test(text))return;
 for(const line of text.split(/\r?\n/)){
  const heading=arrowCapitalSeriesHeading(line.trim());
  if(heading)potential.add(heading.cls);
 }
}

// @mrfp:evidence
const evidencePolicy_arrow_capital={stamps:{arrowCapitalEvidenceVersion:1}};
function arrowCapitalEvidenceNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s*-\s*/g,'-').replace(/\s+/g,' ').trim();
}
function arrowCapitalEvidenceCompact(value){
 return arrowCapitalEvidenceNormalize(value).toLowerCase().replace(/[^a-z0-9]/g,'');
}
function arrowCapitalEvidenceSeriesHeading(line){
 const text=arrowCapitalEvidenceNormalize(line).toUpperCase();
 const match=/^SERIES\s+([A-Z][A-Z0-9]*)\s*(?:\(\s*RE-DESIGNATED\s+FROM\s+([A-Z0-9][A-Z0-9 ]*?)\s*\))?$/.exec(text);
 return match?{cls:`Series ${match[1].toUpperCase()}`}:null;
}
function validateDocumentEvidence_arrow_capital(pages,row){
 const manager=(pages||[]).slice(0,3).some(page=>/Arrow\s+Capital\s+Management\s+Inc\.?/i.test(page.text||''));
 const fund=arrowCapitalEvidenceCompact(row?.fund_name);
 return manager&&fund&&pages.some(page=>arrowCapitalEvidenceCompact(page.text||'').includes(fund));
}
function locateCell_arrow_capital(page,lines,row,key,value,context){
 if(!['MER','PTR'].includes(key)||value===null||value===undefined||
    !arrowCapitalEvidenceCompact(page.text||'').includes(arrowCapitalEvidenceCompact(row.fund_name)))return null;
 const year=Number(String(row.report_date||'').slice(0,4));if(!year)return null;
 const sections=lines.filter(line=>/^Ratios\s+and\s+Supplemental\s+Data\b/i.test(line.text));
 if(sections.length!==1)return null;
 const section=sections[0];
 const yearLines=lines.filter(line=>line.y>section.y&&line.y-section.y<42&&
  line.items.some(item=>new RegExp('^'+year+'(?:†)?$').test(String(item.str||'').trim())));
 if(yearLines.length!==1)return null;
 const yearItem=yearLines[0].items.find(item=>new RegExp('^'+year+'(?:†)?$').test(String(item.str||'').trim()));
 if(!yearItem)return null;
 const yearCenter=yearItem.x+(Number(yearItem.w)||0)/2;
 const headings=lines.filter(line=>line.y>yearLines[0].y&&line.y-yearLines[0].y<48)
  .map(line=>({line,heading:arrowCapitalEvidenceSeriesHeading(line.text)})).filter(item=>item.heading);
 if(headings.length!==1)return null;
 const expected=String(row.class_identity||row.class_name||'').trim().toLowerCase();
 if(headings[0].heading.cls.toLowerCase()!==expected)return null;
 const labelPattern=key==='MER'?/^Management\s+expense\s+ratio\b(?!\s+before\b)/i:/^Portfolio\s+turnover\s+rate\b/i;
 const metricLines=lines.filter(line=>line.y<section.y&&section.y-line.y<165&&labelPattern.test(line.text));
 if(metricLines.length!==1)return null;
 const line=metricLines[0];
 const candidates=cells(line).filter(cell=>matchesCell(cell,value)&&
  Math.abs((cell.box.x+cell.box.w/2)-yearCenter)<20);
 if(candidates.length!==1)return null;
 return {...candidates[0],page:page.page,metric:key,kind:'arrow-capital-current-period-series-ratio-cell'};
}
