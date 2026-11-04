/* FMC adapter: hamilton. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_hamilton={key:'hamilton',label:'Hamilton ETFs',style:'hamilton_v22',signatures:[/Hamilton Capital Partners Inc\./i,/hamiltonetfs\.com/i],title:/^\s*(Hamilton\s+[^\n]{4,140}?ETF)\s*$/im};

const fmcConfig_hamilton={issuerPrefix:/^Hamilton\s/i};

// @mrfp:extraction
function parseHamilton(pages){
 for(const pg of pages){let text=pg.text;const pos=text.search(/Ratios\s+and\s+Supplemental\s+Data/i);if(pos<0)continue;
  text=text.slice(pos);const lines=text.split(/\r?\n/);
  const yrLine=lines.find(x=>/^\s*Year\b.*\b20\d{2}\b/i.test(x))||'';
  const count=(yrLine.match(/20\d\d/g)||[]).length;if(count<1)continue;
  const v={MER:null,TER:null,PTR:null};let quality=0;
  for(const metric of ['MER','TER','PTR']){
   const re=metric==='MER'?/^\s*Management\s+expense\s+ratio\b(?!\s+before)/i:metric==='TER'?/^\s*Trading\s+expense\s+ratio\b/i:/^\s*Portfolio\s+turnover\s+rate\b/i;
   const row=lines.find(x=>re.test(x));if(!row)continue;
   // Hamilton annotates rows with long 'Footnote' text embedded in a
   // single PDF.js line. Only the rightmost N year-column percentages
   // belong to the table; earlier figures may be in the annotation.
   const pct=[...row.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(x=>x[1]);
   if(pct.length<count)continue;
   v[metric]=toNumber(pct[pct.length-count]);quality++;
  }
  if(quality===3)return [{cls:'Class E',values:v,quality,evidence:{}}];
 }return [];
}

function extract_hamilton(pages,p,fund,date){return parseHamilton(pages);}
// @mrfp:evidence
function validateAnnualEtfRow_hamilton(page,row){return clean(page.text).includes(clean(row.fund_name)) && /^Class E$/i.test(row.class_name||'');}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_hamilton={stamps:{annualEtfLocatorVersion:1}};


function locateCell_hamilton(page,lines,row,key,value,context){const selected=annualEtfCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-year-ratio-cell'}:null;}
