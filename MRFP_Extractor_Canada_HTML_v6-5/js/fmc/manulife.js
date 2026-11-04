/* FMC adapter: manulife. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const manulife={key:'manulife',label:'Manulife Investment Management',style:'manulife',signatures:[/Manulife Investment Management Limited/i,/manulifeim\.ca/i,/\bManulife\b/i],title:/^\s*(Manulife\s+[^\n]{3,120}(?:Fund|Class|Portfolio))\s*$/im};

const fmcConfig_manulife={issuerPrefix:/^Manulife\s/i,deduplicate:true,waitForRatioHeading:true,stopAtPastPerformance:true};

// @mrfp:extraction

function extract_manulife(pages,p,fund,date){return tableBlocks(pages,p,{allowWithoutRatio:true});}
// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_manulife(line){
 const style='manulife';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='manulife'){m=/^(Advisor Series|Series\s+[A-Z][A-Z0-9]*)$/i.exec(s);return m?m[1]:null;}
 return null;
}

// @mrfp:evidence
const evidenceLayout_manulife={newBatch:true,flexibleDate:true,shortClassBand:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_manulife={stamps:{nextFmcLocatorVersion:1}};


function locateCell_manulife(page,lines,row,key,value,context){const selected=nextBatchFmcCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'}:null;}
