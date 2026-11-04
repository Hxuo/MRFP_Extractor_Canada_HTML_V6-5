/* FMC adapter: leith_wheeler. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_leith_wheeler={key:'leith_wheeler',label:'Leith Wheeler',style:'leith_v22',signatures:[/Leith Wheeler Investment Counsel Ltd\./i,/leithwheeler\.com/i],title:/^\s*(Leith Wheeler\s+[^\n]{4,140}?Fund)\s*$/im};

const fmcConfig_leith_wheeler={issuerPrefix:/^Leith Wheeler\s/i};

// @mrfp:extraction
function parseLeith(pages){
 const out=new Map();for(const pg of pages){const pos=pg.text.search(/Ratios\s+and\s+Supplemental\s+Data/i);if(pos<0)continue;
  const lines=pg.text.slice(pos).split(/\r?\n/);let heads=[];
  for(let i=0;i<lines.length;i++){const m=/^\s*(Series\s+[A-Z][A-Z0-9]*)(?:\s*\(\d+\))?\s+(?:(?:202[0-9]|\bJune\b)|$)/i.exec(lines[i]);if(m)heads.push({cls:m[1],i});}
  for(let j=0;j<heads.length;j++){const h=heads[j],text=lines.slice(h.i,heads[j+1]?.i??lines.length).join('\n');const r=v22Metrics(text);
   if(r.quality===3)out.set(h.cls,{cls:h.cls,...r});
  }
 }return [...out.values()];
}

function extract_leith_wheeler(pages,p,fund,date){return parseLeith(pages);}
// @mrfp:evidence
const evidenceLayout_leith_wheeler={newBatch:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_leith_wheeler={stamps:{nextFmcLocatorVersion:1}};


function locateCell_leith_wheeler(page,lines,row,key,value,context){const selected=nextBatchFmcCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'}:null;}
