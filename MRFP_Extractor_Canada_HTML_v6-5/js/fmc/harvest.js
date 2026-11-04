/* FMC adapter: harvest. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_harvest={key:'harvest',label:'Harvest ETFs',style:'harvest_new',signatures:[/Harvest Healthcare Leaders Income ETF/i,/Harvest Portfolios Group Inc\./i],title:/^\s*(Harvest\s+[^\n]+?ETF)\s*$/im};

const fmcConfig_harvest={issuerPrefix:/^Harvest\s/i,preferProfileLineTitle:true};

// @mrfp:extraction
function parseHarvest(pages){
 return parseClassColumns(pages,{heading:(line)=>{const m=/^\s*(Class\s+[A-Z](?:\s*\((?:USD|CAD)\))?)\s*$/i.exec(line);return m?m[1]:null;},ratiosAfterHeading:true});
}

function extract_harvest(pages,p,fund,date){return parseHarvest(pages);}
// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_harvest={stamps:{lastGapLocatorVersion:1}};


function locateGap_harvest(page,lines,row,key,value){return gapSeriesYearCell(page,lines,row,key,value);}
