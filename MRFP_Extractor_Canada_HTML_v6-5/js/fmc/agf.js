/* FMC adapter: agf. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_agf={key:'agf',label:'AGF Investments',style:'agf_new',signatures:[/AGF (?:Global Convertible Bond Fund|European Equity Class)/i,/AGF Investments Inc\./i],title:/^\s*(AGF\s+[^\n]+?(?:Fund|Class))\s*$/im};

const fmcConfig_agf={issuerPrefix:/^AGF\s/i,preferProfileLineTitle:true};

// @mrfp:extraction
function parseAGF(pages){
 return parseClassColumns(pages,{splitColumns:true,heading:(line)=>{const m=/^\s*((?:Mutual Fund|Series\s*[A-Z]{1,3})\s+(?:Units|Shares))\s*[-–]\s*Ratios\/Supplemental Data/i.exec(line);return m?m[1].replace(/^Series(?=[A-Z])/i,'Series '):null;}});
}

function extract_agf(pages,p,fund,date){return parseAGF(pages);}
// @mrfp:evidence
const evidenceLayout_agf={issuerPeriodBandAgf:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_agf={stamps:{bmoAgfLocatorVersion:1}};


function locateCell_agf(page,lines,row,key,value,context){const selected=issuerPeriodBandCell(page,row,key,value,row.fmc_key);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'}:null;}
