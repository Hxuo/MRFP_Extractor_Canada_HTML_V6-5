/* FMC adapter: rpia. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_rpia={key:'rpia',label:'RP Investment Advisors',style:'rpia_v22',signatures:[/RP Investment Advisors LP/i,/\brpia\.ca\b/i],title:/^\s*(RP\s+[^\n]{4,150}?Fund)\s*$/im};

const fmcConfig_rpia={issuerPrefix:/^RP\s/i};

// @mrfp:extraction
function parseRP(pages){
 const out=new Map(),target=reportDate(pages);
 for(const pg of pages){const txt=pg.text;const pos=txt.search(/Ratios\s+and\s+supplemental\s+data/i);if(pos<0)continue;
  const lines=txt.slice(pos).split(/\r?\n/);let cls=null;
  for(const raw of lines){const heading=/^\s*(Class\s+[A-Z][A-Z0-9]*(?:-USD)?)(?:\*+)?\s*$/i.exec(raw);if(heading){cls=heading[1];continue;}
   if(!cls||!/\bJun(?:e)?\.?\s+30,?\s+20\d{2}/i.test(raw))continue;
   const m=/^\s*Jun(?:e)?\.?\s+30,?\s+(20\d{2})\*{0,8}\s*(.*)$/i.exec(raw);if(!m||target&&m[1]!==target.slice(0,4))continue;
   const matches=m[2].match(/(?:\d[\d,]*\.\d+|\d[\d,]*|[—–−-])%?/g)||[];
   if(matches.length<7)continue;
   out.set(cls,{cls,values:{MER:toNumber(matches[2]),TER:toNumber(matches[4]),PTR:toNumber(matches[5])},quality:3,evidence:{}});
  }
 }return [...out.values()];
}

function extract_rpia(pages,p,fund,date){return parseRP(pages);}
// @mrfp:evidence

// Exact dated-year Class source locator moved from the shared core, unchanged.
function locateCell_rpia(page,lines,row,key,value,{hint=false,year}={}){
 function choose(candidates,kind){
  const unique=new Map(candidates.map(m=>[`${m.box.x.toFixed(1)}:${m.box.y.toFixed(1)}`,{...m,page:page.page,metric:key,kind}]));
  return unique.size===1?[...unique.values()][0]:null;
 }
{
  const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateRx=iso?new RegExp('^'+months[Number(iso[2])-1]+'(?:e)?\\.?\\s+'+Number(iso[3])+'[,\\s]+'+year+'\\b','i'):null;
  const normalizeClass=s=>clean(s).replace(/\*+$/,'').trim();
  const found=[];
  for(const l of lines){
   if(!dateRx||!dateRx.test(l.text))continue;
   // Only the closest class heading applies to a dated row; importantly,
   // "Class A" is not the same as "Class A-USD**".
   const heading=lines.filter(x=>x.y>l.y&&x.y-l.y<245&&/^class\s+[a-z][a-z0-9]*(?:-usd)?\**$/i.test(x.text.trim()))
     .sort((a,b)=>a.y-b.y)[0];
   if(!heading||normalizeClass(heading.text)!==normalizeClass(row.class_name))continue;
   const main=lines.filter(x=>x.y>l.y&&x.y-l.y<570&&x.items.some(i=>/^management expense$/i.test(i.str.trim()))&&x.items.some(i=>/^trading$/i.test(i.str.trim()))&&x.items.some(i=>/^portfolio$/i.test(i.str.trim())))
     .sort((a,b)=>a.y-b.y)[0];
   if(!main)continue;
   const xBefore=main.items.find(i=>/^management expense$/i.test(i.str.trim()))?.x;
   const xTrade=main.items.find(i=>/^trading$/i.test(i.str.trim()))?.x;
   const xTurn=main.items.find(i=>/^portfolio$/i.test(i.str.trim()))?.x;
   const xNAV=main.items.find(i=>/^net asset$/i.test(i.str.trim()))?.x;
   const firstHeader=lines.some(x=>x.y<=main.y&&main.y-x.y<20&&x.items.some(i=>/^management$/i.test(i.str.trim())&&i.x<xBefore-15));
   if(!firstHeader||![xBefore,xTrade,xTurn,xNAV].every(Number.isFinite)||!(xBefore<xTrade&&xTrade<xTurn&&xTurn<xNAV))continue;
   const values=cells(l);
   const candidates=values.filter(n=>{
    if(key==='MER')return n.x>xBefore-95&&n.x<xBefore-1;
    if(key==='TER')return n.x>xTrade-5&&n.x<xTurn-1;
    return n.x>xTurn-5&&n.x<xNAV-1;
   }).filter(n=>matchesCell(n,value));
   if(candidates.length===1)found.push(candidates[0]);
  }
  const selected=choose(found,'rpia-dated-class-column');if(selected)return selected;
 }
 return null;
}

