/* FMC adapter: nei. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_nei={key:'nei',label:'NEI Investments',style:'nei',signatures:[/NEI Global Total Return Bond Fund/i,/Northwest\s*&\s*Ethical Investments/i],title:/^\s*(NEI\s+[^\n]+?Fund)\s*$/im};

const fmcConfig_nei={issuerPrefix:/^NEI\s/i,preferProfileLineTitle:true};

// @mrfp:extraction
function parseNEI(pages){
 const out=[];const date=reportDate(pages);const year=date?.slice(0,4),month=date?.slice(5,7);
 for(const p of pages){
  if(!/Ratios and Supplemental Data/i.test(p.text))continue;
  for(const line of normalizeExtraText(p.text).split('\n')){
   const m=/^\s*([A-Z]{1,3})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(20\d{2})\s+(.+)/i.exec(line);if(!m||m[3]!==year||String(months[m[2].slice(0,3).toLowerCase()]).padStart(2,'0')!==month)continue;
   const parts=m[4].trim().split(/\s{2,}/).map(z=>z.trim()).filter(Boolean);
   // asset value, units, MER, MER before, TER, PTR, NAV
   if(parts.length<6)continue;
   const v={MER:toNumber(parts[2]),TER:toNumber(parts[4]),PTR:toNumber(parts[5])};
   out.push({cls:'Series '+m[1],values:v,quality:3,evidence:{}});
  }
 }
 return out;
}

function extract_nei(pages,p,fund,date){return parseNEI(pages);}
// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_nei={stamps:{brandesNeiLocatorVersion:1}};
function neiCell(page,lines,row,key,value){
 if(!fundOnPage(page,row))return null;
 const date=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 const cls=/^Series\s+([A-Za-z0-9-]+)$/i.exec(row.class_name||'');
 if(!date||!cls)return null;
 const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][Number(date[2])-1];
 if(!month)return null;
 const section=lines.find(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data$/i.test(l.text.trim()));
 if(!section)return null;
 const allHeader=lines.filter(l=>l.y<section.y&&section.y-l.y<70).flatMap(l=>l.items);
 const find=rx=>allHeader.filter(i=>rx.test(i.str.trim()));
 const mgmt=find(/^Management$/i),expense=find(/^Expense Ratio$/i),before=find(/^before Waivers$/i);
 const trading=find(/^Trading Expense$/i),turn=find(/^Turnover Rate$/i);
 if(mgmt.length!==2||expense.length!==2||before.length!==1||trading.length!==1||turn.length!==1)return null;
 const e=expense.sort((a,b)=>a.x-b.x),a={MER:tokenCenter(e[0]),TER:tokenCenter(trading[0]),PTR:tokenCenter(turn[0])};
 if(!(a.MER<tokenCenter(before[0])&&tokenCenter(before[0])<a.TER&&a.TER<a.PTR))return null;
 if(!mgmt.some(it=>Math.abs(it.x-e[0].x)<14)||!mgmt.some(it=>Math.abs(it.x-e[1].x)<14))return null;
 // PDF headers here print a month/year, not the day. The exact report date
 // is still supplied independently by the extractor; only matching month and
 // year may be treated as current-period source evidence.
 const rxDate=new RegExp('^'+month+'[a-z]*\\.?\\s+'+date[1]+'$','i');
 const target=lines.filter(l=>l.y<section.y-42&&l.y>section.y-520&&
  l.items.some(i=>i.x<70&&i.str.trim().toUpperCase()===cls[1].toUpperCase())&&
  l.items.some(i=>i.x>60&&i.x<140&&rxDate.test(i.str.trim())));
 const found=[];
 for(const line of target){
  const marks=cells(line).concat(line.items.filter(i=>/^N\s*\/?\s*A$/i.test(i.str.trim())).map(i=>({value:null,isMissing:true,raw:i.str,x:i.x,box:{x:i.x-1,y:i.y-1,w:i.w+2,h:i.h+2}})));
  const match=marks.filter(c=>matchesCell(c,value)&&Math.abs(c.x+c.box.w/2-a[key])<28&&
   (key==='MER'?c.x<tokenCenter(before[0])-12:key==='TER'?c.x>a.MER+75&&c.x<a.PTR-15:c.x>a.TER+38));
  if(match.length===1)found.push(match[0]);
 }
 const unique=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return unique.size===1?[...unique.values()][0]:null;
}


// Pender: financial-ratio data are printed in one independent Class block per
// physical page band, under annual year columns. Reject the before-absorptions
// row even when it has the same value as the true MER.


function locateCell_nei(page,lines,row,key,value,context){const selected=neiCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-class-period-column'}:null;}
