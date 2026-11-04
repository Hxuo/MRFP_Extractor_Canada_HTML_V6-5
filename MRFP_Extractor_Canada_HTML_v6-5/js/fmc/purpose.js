/* FMC adapter: purpose. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const purpose={key:'purpose',label:'Purpose Investments',style:'purpose',signatures:[/www\.purposeinvest\.com|www\.purposeinvest\.com/i,/PURPOSE ACTIVE BALANCED FUND/i,/Purpose Investments/i],title:/^\s*(PURPOSE\s+[^\n]{3,100}(?:FUND|PORTFOLIO))\s*$/im};

const fmcConfig_purpose={issuerPrefix:/^Purpose\s/i,splitColumns:true,deduplicate:true,startAtRatioHeading:true,retainRatioHeading:true};

// @mrfp:extraction

function extract_purpose(pages,p,fund,date){return tableBlocks(pages,p,{allowWithoutRatio:true});}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundLate_purpose(pages,p,head){
if(p.key==='purpose'){
    for(const line of head.split(/\r?\n/)){const m=/^\s*(PURPOSE[ \t]+(?:[A-Z]+[ \t]+){1,10}FUND)[ \t]*$/.exec(line);if(m)return clean(m[1]);}
  }
}

// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_purpose(line){
 const style='purpose';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if (style === 'purpose') { m = /^(ETF Units|Class\s+[A-Z]\s*Units)(?:\s+\d+)?(?:\s*\([^)]*\))?(?=\s|$)/i.exec(s); return m ? (m[1].toLowerCase() === 'etf units' ? 'ETF Units': m[1].replace(/\s*Units$/i, '')): null;}
 return null;
}

// @mrfp:evidence
const evidenceLayout_purpose={newBatch:true,normalizePurposeTitle:true,splitPanels:true,purposeClassHeading:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_purpose={stamps:{nextFmcLocatorVersion:1}};


function locateCell_purpose(page,lines,row,key,value,context){const selected=nextBatchFmcCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'}:null;}
