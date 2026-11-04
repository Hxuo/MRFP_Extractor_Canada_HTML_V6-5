/* FMC adapter: franklin. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const franklin={key:'franklin',label:'Franklin Templeton',style:'franklin',signatures:[/franklintempleton\.ca/i,/Franklin Templeton Investments Corp/i,/\bFRANKLIN CANADIAN\b/i],title:/^\s*(FRANKLIN\s+[^\n]{3,130}(?:FUND|PORTFOLIO))\s*$/im};

const fmcConfig_franklin={issuerPrefix:/^Franklin\s/i};

// @mrfp:extraction

function extract_franklin(pages,p,fund,date){return simpleTable(pages,p);}
// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_franklin(line){
 const style='franklin';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='franklin'){m=/^(?:SERIES\s+([AFO])|ETF\s+SERIES)\s*\(AS AT /i.exec(s);return m?(s.toUpperCase().startsWith('ETF')?'ETF Series':'Series '+m[1]):null;}
 return null;
}

// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_franklin={stamps:{franklinLocatorVersion:1}};
function franklinCell(page,lines,row,key,value){
 if(!clean(page.text).includes(clean(row.fund_name)))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso)return null;
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const date=months[Number(iso[2])-1]+' '+Number(iso[3])+', '+iso[1];
 const heads=lines.filter(l=>l.items.some(i=>/^Ratios and supplemental data:?$/i.test(i.str.trim())) &&
  l.items.some(i=>clean(i.str)===clean(date)));
 if(heads.length!==1)return null;
 const h=heads[0],dateCell=h.items.find(i=>clean(i.str)===clean(date));
 const laterYears=h.items.filter(i=>/^20\d{2}$/.test(i.str.trim())).sort((a,b)=>a.x-b.x);
 if(!dateCell||laterYears.length<1||Number(laterYears[0].str)!==Number(iso[1])-1||
    dateCell.x>=laterYears[0].x||!laterYears.every((i,j)=>Number(i.str)===Number(iso[1])-1-j))return null;
 const headings=lines.filter(l=>l.y>h.y&&l.y-h.y<250 && l.items.some(i=>clean(i.str)===clean(row.class_name)));
 if(headings.length!==1)return null;
 const band=lines.filter(l=>l.y<h.y&&h.y-l.y<95);
 const patterns={MER:/^Management expense ratio(?:\s*\(\d+\))?$/i,
                 TER:/^Trading expense ratio(?:\s*\(\d+\))?$/i,
                 PTR:/^Portfolio turnover rate(?:\s*\(\d+\))?$/i};
 if(!Object.values(patterns).every(rx=>band.filter(l=>l.items.some(i=>rx.test(i.str.trim()))).length===1))return null;
 const targetRows=band.filter(l=>l.items.some(i=>patterns[key].test(i.str.trim())));
 if(targetRows.length!==1)return null;
 const targetX=tokenCenter(dateCell);
 const rightBound=(targetX+tokenCenter(laterYears[0]))/2;
 const hits=cells(targetRows[0]).filter(c=>c.x>targetX-25&&c.x<rightBound&&matchesCell(c,value));
 return hits.length===1?hits[0]:null;
}

// Lysander-Canso: per-Series ratios with full or single-year columns.
// The current year is identified independently inside each physical Series
// band, even when its location differs (ETF Series starts in a far-right band).


function locateCell_franklin(page,lines,row,key,value,context){const selected=franklinCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:'franklin-verified-series-date-ratio-cell'}:null;}
