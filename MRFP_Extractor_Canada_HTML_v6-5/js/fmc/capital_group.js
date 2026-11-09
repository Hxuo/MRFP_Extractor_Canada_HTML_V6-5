/* Capital Group (Canada) semi-annual MRFPs: mutual funds and Select ETFs.
 * Source is the CURRENT period in Ratios and Supplemental Data, never
 * MER-before-waivers, trading expenses, fund fees, or portfolio returns.
 * No issuer-specific logic belongs in the shared core/viewer. */
// @mrfp:profile
const profile_capital_group={
 key:'capital_group',label:'Capital Group',style:'capital_group',
 signatures:[/Capital\s+International Asset Management\s*\(Canada\),?\s*Inc\.?/i,
             /Capital Group\s+(?:Canadian|Global|International|Multi-Sector)[^\n]*?(?:Fund|ETF)\b/i],
 title:/^\s*(Capital Group\s+[^\n]{5,110}?(?:Fund|ETF)\s*\(Canada\))\s*$/im
};
const fmcConfig_capital_group={allowRowFallback:false};

// @mrfp:extraction
// Prefer the full publication footer over a multi-line graphic cover or
// narrative references to underlying investments. Both footer orientations
// ("4 Capital Group ..." and "Capital Group ... 5") are supported.
function identifyFundEarly_capital_group(pages,profile,head){
 const names=new Set();
 for(const page of pages.slice(1,9)){
  for(const raw of String(page.text||'').split(/\r?\n/)){
   const candidate=raw.trim().replace(/^\d{1,2}\s+/,'').replace(/\s+\d{1,2}$/,'').replace(/[®™]/g,'').replace(/\s+/g,' ');
   if(/^Capital Group\s+[A-Za-z][\w\s-]{7,115}\s+(?:Fund|ETF)\s*\(Canada\)$/i.test(candidate))names.add(candidate);
  }
  if(names.size===1)return [...names][0];
  if(names.size>1)return 'Unknown Fund';
 }
 return undefined;
}
function selectReportDate_capital_group(pages){
 // Reporting periods on cover and in ratio table must agree; the generic
 // date reader prioritizes the cover's "Six Months Ended" headline.
 const date=reportDate(pages);
 return date;
}
function capitalGroupFinancialRowTokens(tail,isEtf){
 const cells=String(tail||'').match(/(?:\$\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?|[—–−-]/g)||[];
 if(cells.length!==(isEtf?8:7))return null;
 // Assets, units, actual MER, before-waivers MER, Trading expenses,
 // portfolio turnover, NAV, [ETF closing market price].
 const parse=s=>toNumber(s.replace(/^\$\s*/,''));
 const values=cells.map(parse);
 if(values[0]===null||values[1]===null||values[6]===null||
    values.some(v=>v!==null&&(!Number.isFinite(v)||v<0))||
    values[2]!==null&&values[2]>100||values[5]!==null&&values[5]>1000)return null;
 return {MER:values[2],TER:null,PTR:values[5]};
}
function extract_capital_group(pages,profile,fund,date){
 if(!/^Capital Group\s+.+\s+(?:Fund|ETF)\s*\(Canada\)$/i.test(fund||'')||
    !/^20\d\d-\d\d-\d\d$/.test(date||''))return [];
 const isEtf=/\bETF\s*\(Canada\)$/i.test(fund),out=new Map(),conflicts=new Set();
 for(const pg of pages){
  const text=String(pg.text||'');
  if(!/\bRatios and Supplemental Data\b/i.test(text)||
     !text.toLowerCase().includes(fund.toLowerCase()))continue;
  const lines=text.split(/\r?\n/);
  const index=lines.findIndex(l=>/^Ratios and Supplemental Data\b/i.test(l.trim()));
  if(index<0)continue;
  const header=lines.slice(index,index+12).join(' ');
  // Verify the complete printed column order. The MER and the second MER
  // before waivers may have identical numbers but are NOT interchangeable.
  if(!/Management\s+Before Waivers or\s+Trading\s+Portfolio\s+Net Asset/i.test(header)||
     !/Expense Ratio\s+Absorptions\s+Expense Ratio\s+Turnover Rate/i.test(header))continue;
  let cls=isEtf?'ETF Units':null;
  for(let i=index+1;i<lines.length;i++){
   const s=lines[i].trim();
   if(/^Refer to page\b/i.test(s)||/^(?:Management Fees|Past Performance)\b/i.test(s))break;
   const heading=/^Series\s+([A-Z](?:\d+)?)(?:\s*\d+(?:,\d+)*)?\s*$/i.exec(s);
   if(heading){cls=isEtf?null:'Series '+heading[1].toUpperCase();continue;}
   const m=/^(?:Period|Year) ended\s+(\d{1,2})\/(\d{1,2})\/(20\d{2})\s+(.+)$/i.exec(s);
   if(!m||!cls)continue;
   const printed=`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
   if(printed!==date)continue;
   const values=capitalGroupFinancialRowTokens(m[4],isEtf);
   if(!values)continue;
   const found={cls,values,quality:3,evidence:{
     ...(values.MER!==null?{MER:{page:pg.page,source:'Current-period Management Expense Ratio column',method:'native-js'}}:{}),
     ...(values.PTR!==null?{PTR:{page:pg.page,source:'Current-period Portfolio Turnover Rate column',method:'native-js'}}:{})
   }};
   if(out.has(cls)&&JSON.stringify(out.get(cls).values)!==JSON.stringify(found.values))conflicts.add(cls);
   else out.set(cls,found);
  }
 }
 for(const cls of conflicts)out.delete(cls); // Conflicting disclosures fail closed.
 return [...out.values()];
}
function auditRatioHeadings_capital_group(pageText,potential){
 const text=String(pageText||'');if(!/Ratios and Supplemental Data/i.test(text))return;
 const section=text.slice(text.search(/Ratios and Supplemental Data/i));
 const series=[...section.matchAll(/^Series\s+([A-Z](?:\d+)?)(?:\s*\d+(?:,\d+)*)?\s*$/gim)];
 if(series.length)for(const m of series)potential.add('Series '+m[1].toUpperCase());
 else if(/\b(?:Period|Year) ended\s+\d{1,2}\/\d{1,2}\/20\d\d/i.test(section))potential.add('ETF Units');
}

// @mrfp:evidence
// New FMC-local stamp; no changes to other managers' History/Restore policies.
const evidencePolicy_capital_group={stamps:{capitalGroupRatioLocatorVersion:1}};
function validateDocumentEvidence_capital_group(pages,row){
 const name=String(row?.fund_name||'').toLowerCase();
 return /^capital group\s+.+\s+(?:fund|etf)\s*\(canada\)$/.test(name)&&
   pages.some(p=>String(p.text||'').toLowerCase().includes(name));
}
function locateCell_capital_group(page,lines,row,key,value,context){
 if(key!=='MER'&&key!=='PTR'||value===null||value===undefined||
    !String(page.text||'').toLowerCase().includes(String(row.fund_name||'').toLowerCase()))return null;
 const r=/^(20\d\d)-(\d\d)-(\d\d)$/.exec(row.report_date||'');
 if(!r)return null;
 const targetDate=`${Number(r[2])}/${Number(r[3])}/${r[1]}`;
 const sections=lines.filter(l=>/^Ratios and Supplemental Data\b/i.test(l.text));
 if(sections.length!==1)return null;
 const section=sections[0];
 const headers=lines.filter(l=>l.y<section.y&&section.y-l.y<85)
  .filter(l=>/Management\s+Before Waivers or\s+Trading\s+Portfolio\s+Net Asset/i.test(l.text));
 if(headers.length!==1)return null;
 const head=headers[0];
 const anchor=t=>head.items.filter(it=>it.str.trim()===t);
 const management=anchor('Management'),before=anchor('Before Waivers or'),trading=anchor('Trading'),portfolio=anchor('Portfolio'),nav=anchor('Net Asset');
 if([management,before,trading,portfolio,nav].some(a=>a.length!==1))return null;
 const [mx,bx,tx,px,nx]=[management[0],before[0],trading[0],portfolio[0],nav[0]].map(it=>it.x);
 if(!(mx+25<bx&&bx+25<tx&&tx+25<px&&px+25<nx))return null;
 const expectedClass=String(row.class_name||'');
 const isEtf=/^ETF Units$/i.test(expectedClass)&&/\bETF\s*\(Canada\)$/i.test(row.fund_name||'');
 if(!isEtf&&!/^Series\s+[A-Z](?:\d+)?$/i.test(expectedClass))return null;
 const dated=lines.filter(l=>l.y<headers[0].y&&
   new RegExp('^(?:Period|Year) ended\\s+'+targetDate.replaceAll('/','\\/')+'(?:\\s|$)','i').test(l.text));
 const matches=[];
 for(const current of dated){
  if(current.y<20||current.y>section.y-45)continue;
  const preceding=lines.filter(l=>l.y>current.y&&l.y<section.y&&
     /^Series\s+[A-Z](?:\d+)?\s*$/i.test(l.text.trim())).sort((a,b)=>a.y-b.y);
  if(isEtf){if(preceding.length)continue;}
  else if(!preceding.length||preceding[0].text.trim().toLowerCase()!==expectedClass.toLowerCase())continue;
  const lower=key==='MER'?mx-5:px-5;
  const upper=key==='MER'?bx-10:nx-10;
  const c=cells(current).filter(c=>c.x>=lower&&c.x<upper&&matchesCell(c,value));
  if(c.length!==1)continue;
  // Require adjacent printed ratio columns, not just an isolated number.
  const ratioVals=cells(current);
  if(!ratioVals.some(z=>z.x>=bx-5&&z.x<tx-10)||
     !ratioVals.some(z=>z.x>=tx-5&&z.x<px-10))continue;
  matches.push(c[0]);
 }
 const unique=new Map(matches.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 if(unique.size!==1)return null;
 return {...[...unique.values()][0],page:page.page,metric:key,kind:'capital-group-verified-current-series-and-metric-column'};
}
