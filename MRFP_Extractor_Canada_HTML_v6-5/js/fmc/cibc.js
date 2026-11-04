/* FMC adapter: cibc. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_cibc={key:'cibc',label:'CIBC Asset Management',style:'cibc_v22',signatures:[/CIBC Core Fixed Income Pool/i,/CIBC Asset Management Inc\./i],title:/^\s*(CIBC\s+[^\n]{3,140}?(?:Pool|Fund|ETF))\s*$/im};

const fmcConfig_cibc={issuerPrefix:/^CIBC\s/i};

// @mrfp:extraction
function parseCibc(pages){
 const out=new Map();
 for(const pg of pages){const lines=pg.text.split(/\r?\n/);for(let i=0;i<lines.length;i++){
  const m=/^\s*Ratios\s+and\s+Supplemental\s+Data\s*[-–]\s*((?:ETF\s+Series|Series\s+[A-Z][A-Z0-9-]*)\s+Units)\b/i.exec(lines[i]);
  if(!m)continue;
  let end=i+1;while(end<lines.length && !/^\s*(?:Ratios\s+and\s+Supplemental\s+Data\s*[-–]|The\s+Pool.s\s+Net\s+Assets\s+per\s+Unit|Past\s+Performance)/i.test(lines[end]))end++;
  const r=v22Metrics(lines.slice(i+1,end).join('\n'));if(r.quality===3)out.set(m[1],{cls:m[1],...r});
 }}return [...out.values()];
}

function extract_cibc(pages,p,fund,date){return parseCibc(pages);}
// @mrfp:evidence

