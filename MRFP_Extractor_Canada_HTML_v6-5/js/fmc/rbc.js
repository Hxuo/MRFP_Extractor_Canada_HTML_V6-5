/* FMC adapter: rbc. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const rbc={key:'rbc',label:'RBC Global Asset Management',style:'rbc',signatures:[/RBC Global Asset Management Inc/i,/rbcgam\.com/i,/RBC CANADIAN/i],title:/^\s*(RBC\s+[^\n]{3,120}?(?:FUND|PORTFOLIO|SOLUTION\s*[–-]\s*ENHANCED(?:\s+PLUS)?))\s*$/im};
// BMO issues two independent financial-table templates: mutual funds and exchange-traded funds.

const fmcConfig_rbc={issuerPrefix:/^RBC\s/i,datedRowIndices:{MER:3,TER:6,PTR:5},datedRowMin:7,allowRowFallback:false};

// @mrfp:extraction
function parseRbcEtfFallback(pages,reportFund){
 if(!/\bETF\b/i.test(reportFund))return [];
 const date=reportDate(pages);if(!date)return [];
 const [yr,mm,dd]=date.split('-').map(Number);
 const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 for(const pg of pages){
  const text=String(pg.text||'');const ix=text.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
  if(ix<0)continue;
  const block=text.slice(ix,ix+4500);
  if(!/As\s+at/i.test(block)||!/Expense\s+Ratio/i.test(block)||!/Turnover\s+Rate/i.test(block))continue;
  const rowRe=/^\s*([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2})\s+(.+)$/gm;
  for(const m of block.matchAll(rowRe)){
   const month=monthNames.findIndex(x=>m[1].slice(0,3).toLowerCase()===x.toLowerCase())+1;
   if(month!==mm||Number(m[2])!==dd||Number(m[3])!==yr)continue;
   const tokens=m[4].match(/(?:n\/?a|[—–−-]|\d[\d,]*(?:\.\d+)?)/gi)||[];
   // 8 columns: unit NAV, fund NAV, outstanding units, MER, before
   // absorption MER, PTR, TER and closing price, in that order.
   if(tokens.length!==8)continue;
   return [{cls:'ETF Units',values:{MER:toNumber(tokens[3]),TER:toNumber(tokens[6]),PTR:toNumber(tokens[5])},quality:3,evidence:{}}];
  }
 }
 return [];
}


function extract_rbc(pages,p,fund,date){let parsed=rowTable(pages,p);if(!parsed.length)parsed=parseRbcEtfFallback(pages,fund);return parsed;}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundEarly_rbc(pages,p,head){
if(p.key==='rbc'){
    // Phillips, Hager & North is managed by RBC GAM. Its fund title is
    // frequently broken into 2-3 lines on the cover's RIGHT column.
    // Restrict this to the cover and an explicit PH&N issuer prefix.
    const cover=String(pages[0]?.rightText||pages[0]?.text||'').split(/\r?\n/).map(clean);
    for(let i=0;i<Math.min(cover.length,45);i++){
      if(!/^Phillips,?\s+Hager\s*&\s*North\b/i.test(cover[i]))continue;
      for(let n=0;n<=2 && i+n<cover.length;n++){
        const candidate=clean(cover.slice(i,i+n+1).join(' '));
        if(/^Phillips,?\s+Hager\s*&\s*North\s+[A-Za-z0-9 &',.()-]+\s+(?:Fund|ETF|Portfolio)$/i.test(candidate))return candidate;
      }
    }
  }
}

// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_rbc(line){
 const style='rbc';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='rbc'){m=/^((?:Series\s+[A-Z][A-Z0-9]*|ETF(?:H)?\s+Series))$/i.exec(s);return m?m[1]:null;}
 return null;
}

// @mrfp:evidence
// Adapter-owned dated-ratio header validation. Do not infer a column from values.
function ratioHeader_rbc(lines,rowY){
 const sections=lines.filter(l=>l.y>rowY&&l.y-rowY<590&&/ratios?\s+(?:and|&)\s+supplemental\s+data/i.test(l.text))
  .sort((a,b)=>a.y-b.y);
 for(const section of sections){
  const top=lines.filter(l=>l.y<section.y&&section.y-l.y<70&&l.y>rowY+6);
  if(!top.length)continue;
   const heads=top.filter(l=>l.items.some(i=>/^Management$/i.test(i.str.trim()))&&l.items.some(i=>/^MER Before$/i.test(i.str.trim()))&&l.items.some(i=>/^Portfolio$/i.test(i.str.trim()))&&l.items.some(i=>/^Trading$/i.test(i.str.trim())));
   if(heads.length!==1)continue;
   const h=heads[0],a=h.items.find(i=>/^Management$/i.test(i.str.trim())),b=h.items.find(i=>/^MER Before$/i.test(i.str.trim())),c=h.items.find(i=>/^Portfolio$/i.test(i.str.trim())),d=h.items.find(i=>/^Trading$/i.test(i.str.trim()));
   if(!(a.x<b.x&&b.x<c.x&&c.x<d.x))continue;
   const lower=top.filter(l=>l.y<h.y&&h.y-l.y<18).flatMap(l=>l.items);
   const close=(rx,head)=>lower.some(i=>rx.test(i.str.trim())&&Math.abs(i.x-head.x)<33);
   if(!(close(/^Expense Ratio\s*\(%\)/i,a)&&close(/^Absorption\s*\(%\)/i,b)&&close(/^Turnover Rate/i,c)&&close(/^Expense Ratio\s*\(%\)/i,d)))continue;
   return {MER:tokenCenter(a),before:tokenCenter(b),PTR:tokenCenter(c),TER:tokenCenter(d),section:section.y};
   }
 return null;
}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_rbc={stamps:{lastGapLocatorVersion:1}};
function gapRbcEtfCell(page,lines,row,key,value){
 if(!/^(?:ETF|CAD|USD)\s+Units$/i.test(row.class_name))return null;
 const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(row.report_date||'');if(!iso)return null;
 const header=lines.find(l=>l.items.some(i=>i.str.trim()==='Management')&&l.items.some(i=>i.str.trim()==='MER Before')&&l.items.some(i=>i.str.trim()==='Portfolio')&&l.items.some(i=>i.str.trim()==='Trading'));
 if(!header||!lines.some(l=>/ratios and supplemental data/i.test(l.text)&&l.y>header.y&&l.y-header.y<40))return null;
 const labels={MER:'Management',TER:'Trading',PTR:'Portfolio'};
 const target=header.items.find(i=>i.str.trim()===labels[key]);const before=header.items.find(i=>i.str.trim()==='MER Before');
 if(!target||!before||!(header.items.find(i=>i.str.trim()==='Management').x<before.x))return null;
 const lower=lines.filter(l=>l.y<header.y&&header.y-l.y<19).flatMap(l=>l.items);
 if(!lower.some(i=>(key==='PTR'?/Turnover Rate/:/Expense Ratio/).test(i.str)&&Math.abs(i.x-target.x)<35))return null;
 const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+iso[2]-1];
 const date=new RegExp('^'+month+'[a-z]*\\.?\\s+'+Number(iso[3])+'[,\\s]+'+iso[1]+'\\b','i');
 const vals=[];
 const x=target.x;
 for(const l of lines.filter(l=>date.test(l.text)&&l.y<header.y&&header.y-l.y<55)){
  const found=cells(l).filter(c=>Math.abs(c.x-x)<38&&matchesCell(c,value));
  if(found.length===1)vals.push(found[0]);
 }
 return vals.length===1?vals[0]:null;
}


function locateCell_rbc(page,lines,row,key,value,context){const selected=datedFmcCell(lines,row,key,value,row.fmc_key);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-header-validated-dated-cell'}:null;}

function locateGap_rbc(page,lines,row,key,value){return gapRbcEtfCell(page,lines,row,key,value);}
