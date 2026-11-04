/* FMC adapter: vanguard. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_vanguard={key:'vanguard',label:'Vanguard Investments Canada',style:'vanguard_new',signatures:[/Vanguard Investments Canada Inc/i,/Vanguard FTSE Canadian/i],title:/^\s*(Vanguard[^\n]{5,150}?ETF)\s*$/im};

const fmcConfig_vanguard={issuerPrefix:/^Vanguard\s/i};

// @mrfp:extraction
function parseVanguard(pages){
 for(const page of pages){
  const pos=page.text.search(/Ratios and Supplemental Data/i);
  if(pos<0)continue;
  const block=page.text.slice(pos,pos+4500);
  const r=extraRatios(block);
  if(r.quality>=3)return [{cls:'ETF Units',...r}];
 }
 return [];
}
function parseVanguardB2(pages){
 for(const pg of pages){let pos=pg.text.search(/Ratios\s+and\s+Supplemental\s+Data/i);if(pos<0)continue;
  const lines=pg.text.slice(pos).split(/\r?\n/);let v={},seen=0;
  for(const m of ['MER','TER','PTR']){
   const re=m==='MER'?/^\s*Management\s+expense\s+ratio(?!\s+before)/i:m==='TER'?/^\s*Trading\s+expense\s+ratio/i:/^\s*Portfolio\s+turnover\s+rate/i;
   const row=lines.find(x=>re.test(x));if(!row)continue;
   const label=re.exec(row),tail=row.slice(label[0].length).replace(/^(?:\d+|\s|\([^)]*\))*(?=\s+\d+\.\d+%|\s+[—–−-])/,'');
   const values=[...tail.matchAll(/(?:\d*\.\d+|[—–−-])%?/g)];
   if(!values.length)continue;
   v[m]=toNumber(values[0][0].replace(/%/g,''));seen++;
  }
  if(seen===3)return [{cls:'ETF Units',values:v,quality:3,evidence:{}}];
 }
 return [];
}
// BlackRock has a family of condensed text PDFs, with collapsed spaces like
// 'RatiosandSupplementalData(g)' and separate CAD/USD units per page.

function extract_vanguard(pages,p,fund,date){const r=parseVanguard(pages);return r.length?r:parseVanguardB2(pages);}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundLate_vanguard(pages,p,head){
if(p.key==='vanguard'){
    const lines=pages.slice(0,2).flatMap(pg=>pg.text.split(/\r?\n/));
    for(let i=0;i<lines.length;i++){
      let line=lines[i].trim();if(!/^Vanguard\s+FTSE\b/i.test(line))continue;
      if(!/\bETF\b/i.test(line))line+=' '+(lines[i+1]||'').trim();
      const found=/(Vanguard\s+[^\n]{5,160}?ETF(?:\s*\(CAD-hedged\))?)/i.exec(line);
      if(found)return clean(found[1]);
    }
  }
}

// @mrfp:evidence
function validateAnnualEtfRow_vanguard(page,row){return /^ETF Units$/i.test(row.class_name||'');}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_vanguard={stamps:{annualEtfLocatorVersion:1}};


function locateCell_vanguard(page,lines,row,key,value,context){const selected=annualEtfCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-year-ratio-cell'}:null;}
