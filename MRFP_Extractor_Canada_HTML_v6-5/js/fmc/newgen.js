/* FMC adapter: newgen. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_newgen={key:'newgen',label:'NewGen Asset Management',style:'newgen_v22',signatures:[/NewGen Asset Management Limited/i,/newgenfunds\.com/i],title:/^\s*(NewGen\s+[^\n]{4,140}?Fund)\s*$/im};

const fmcConfig_newgen={issuerPrefix:/^NewGen\s/i};

// @mrfp:extraction
function parseNewGen(pages){
 const out=new Map();
 for(const pg of pages){const lines=pg.text.split(/\r?\n/);const positions=[];
  for(let i=0;i<lines.length;i++){let m=/The\s+Fund.s\s+Net\s+Asset\s+Value\s*\(NAV\)\s+per\s+(Class\s+[FGI](?:\s*\(USD\))?)\s+Unit/i.exec(lines[i]);if(m)positions.push({cls:m[1],i});}
  for(let k=0;k<positions.length;k++){const h=positions[k];let t=lines.slice(h.i,positions[k+1]?.i??lines.length).join('\n');
   if(!/Ratios\s+and\s+Supplemental\s+Data/i.test(t))continue;
   t=t.slice(t.search(/Ratios\s+and\s+Supplemental\s+Data/i));const r=v22Metrics(t,{includePerformance:true});
   if(r.quality===3)out.set(h.cls,{cls:h.cls,...r});
  }
 }return [...out.values()];
}

function extract_newgen(pages,p,fund,date){return parseNewGen(pages);}
// @mrfp:evidence
const evidenceLayout_newgen={newBatch:true,newgenClassHeading:true,requirePerformanceFee:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_newgen={stamps:{nextFmcLocatorVersion:1}};


function locateCell_newgen(page,lines,row,key,value,context){const selected=nextBatchFmcCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'}:null;}
