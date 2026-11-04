/* FMC adapter: lysander. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_lysander={key:'lysander',label:'Lysander Funds',style:'lysander',signatures:[/Lysander-Canso\s+U\.S\.\s+Corporate/i,/Lysander Funds Limited/i],title:/^\s*(Lysander-Canso\s+[^\n]+?Fund)\s*$/im};

const fmcConfig_lysander={issuerPrefix:/^Lysander\s/i,preferProfileLineTitle:true};

// @mrfp:extraction
function parseLysander(pages){
 return parseClassColumns(pages.filter(p=>p.page>=6),{heading:(line)=>{const m=/^\s*(Series\s+[A-Z]|ETF Series)\s*\**\s*$/i.exec(line);return m?m[1]:null;},ratiosAfterHeading:true});
}

function extract_lysander(pages,p,fund,date){return parseLysander(pages);}
// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_lysander={stamps:{lysanderLocatorVersion:1}};
function lysanderCell(page,lines,row,key,value){
 if(!clean(page.text).includes(clean(row.fund_name)))return null;
 const year=Number((row.report_date||'').slice(0,4));
 if(!Number.isInteger(year)||year<2000)return null;
 const cls=clean(row.class_name).replace(/\*+$/,'');
 const normalizeHeading=s=>clean(s).replace(/\*+$/,'');
 const heads=lines.filter(l=>/^((?:ETF|Series)\s+(?:Series|[A-Z][A-Z0-9-]*))\*?$/i.test(l.text.trim())||/^Series\s+[A-Z][A-Z0-9-]*\*?$/i.test(l.text.trim()));
 const matchingHeads=heads.filter(l=>normalizeHeading(l.text)===cls);
 if(matchingHeads.length!==1)return null;
 const title=matchingHeads[0];
 const next=heads.filter(l=>l.y<title.y-1).sort((a,b)=>b.y-a.y)[0];
 const minY=next?next.y:title.y-230;
 const segment=lines.filter(l=>l.y<title.y&&l.y>minY);
 const sections=segment.filter(l=>/^Ratios and supplemental data$/i.test(l.text));
 if(sections.length!==1)return null;
 const section=sections[0];
 const yearLines=segment.filter(l=>l.y>section.y&&l.y-section.y<57&&l.items.some(i=>new RegExp('\\b'+year+'\\b').test(i.str.trim())));
 if(yearLines.length!==1)return null;
 const years=yearLines[0].items.filter(i=>/^20\d{2}$/.test(i.str.trim())).sort((a,b)=>a.x-b.x);
 const yearIndex=years.findIndex(i=>Number(i.str)===year);
 if(yearIndex===-1||years.filter(i=>Number(i.str)===year).length!==1)return null;
 const current=years[yearIndex],currentX=tokenCenter(current);
 if(years.length>1&&yearIndex!==0)return null;
 const lower=segment.filter(l=>l.y<section.y&&section.y-l.y<115);
 const rx={MER:/^Management expense ratio[⁰¹²³⁴⁵⁶⁷⁸⁹\d]*$/i,
           TER:/^Trading expense ratio[⁰¹²³⁴⁵⁶⁷⁸⁹\d]*$/i,
           PTR:/^Portfolio turnover rate[⁰¹²³⁴⁵⁶⁷⁸⁹\d]*$/i}[key];
 const labels=lower.filter(l=>rx.test(l.text.split(/\s{2,}/)[0].trim())||
  l.items.some(i=>rx.test(i.str.trim())) ||
  // Layout splits 'Management expense' / 'ratio⁵' into separate PDF.js tokens.
  new RegExp('^'+(key==='MER'?'Management expense ratio':key==='TER'?'Trading expense ratio':'Portfolio turnover rate'),'i').test(l.text));
 const valid=labels.filter(l=>key!=='MER'||!/\bbefore\b/i.test(l.text));
 if(valid.length!==1)return null;
 // The available years determine mutually-exclusive column boundaries.
 const nextX=years[yearIndex+1]&&tokenCenter(years[yearIndex+1]);
 const right=nextX?(currentX+nextX)/2:currentX+29;
 const hits=cells(valid[0]).filter(c=>matchesCell(c,value)&&c.x>currentX-24&&c.x<right&&Math.abs(c.x-currentX)<25);
 return hits.length===1?hits[0]:null;
}


// Manulife, NewGen, Purpose and Leith Wheeler: table-bound, current-year
// source-cell location. All series, years, panels and cells are read from the
// current PDF; no fund-specific numbers, filenames or page positions are used.


function locateCell_lysander(page,lines,row,key,value,context){const selected=lysanderCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:'lysander-verified-series-year-metric-cell'}:null;}
