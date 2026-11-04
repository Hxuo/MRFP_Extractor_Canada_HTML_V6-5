/* FMC adapter: pender. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_pender={key:'pender',label:'PenderFund Capital Management',style:'pender_new',signatures:[/Pender Corporate Bond Fund/i,/PenderFund Capital Management/i],title:/^\s*(Pender\s+[^\n]+?Fund)\s*$/im};

const fmcConfig_pender={issuerPrefix:/^Pender\s/i,preferProfileLineTitle:true};

// @mrfp:extraction
function parsePender(pages){
 return parseClassColumns(pages.filter(p=>p.page>=8 && /Ratios and Supplemental Data/i.test(p.text)),{heading:(line)=>{
 const m=/^\s*(Class\s+[A-Z](?:\s*\((?:USD|CAD)\))?)\s*$/i.exec(line);return m?m[1]:null;},requireRatioHeading:true});
}

function extract_pender(pages,p,fund,date){return parsePender(pages);}
// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_pender={stamps:{penderScotiaLocatorVersion:1}};
function penderCell(page,lines,row,key,value){
 if(!fundOnPage(page,row))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso||!/^Class\s+[A-Za-z0-9]+(?:\s*\(USD\))?$/i.test(row.class_name||''))return null;
 const year=Number(iso[1]);
 const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const month=months[Number(iso[2])-1];if(!month)return null;
 const periodRx=new RegExp('For\\s+the\\s+(?:year|period)\\s+ended\\s+'+month+'\\s+'+Number(iso[3])+',?\\s*'+year,'i');
 if(!periodRx.test((page.text||'').slice(0,500)))return null;
 const section=lines.find(l=>/^Ratios?\s+(?:and|&)\s+Supplemental\s+Data\b/i.test(l.text.trim()));
 if(!section)return null;
 // Read current-year coordinate directly from the header immediately below section.
 const yearLines=lines.filter(l=>l.y<section.y&&section.y-l.y<44)
  .filter(l=>l.items.some(it=>it.str.trim()===String(year)));
 if(yearLines.length!==1)return null;
 const yearTokens=yearLines[0].items.filter(it=>/^20\d{2}$/.test(it.str.trim())).sort((a,b)=>a.x-b.x);
 if(yearTokens.length<1||Number(yearTokens[0].str.trim())!==year||
  !yearTokens.every((it,i)=>Number(it.str.trim())===year-i))return null;
 const targetX=tokenCenter(yearTokens[0]);
 const classes=lines.filter(l=>l.y<yearLines[0].y&&l.items.some(it=>it.x<120&&
  /^Class\s+[A-Za-z0-9]+(?:\s*\(USD\))?$/i.test(it.str.trim())))
  .sort((a,b)=>b.y-a.y);
 const found=[];
 for(let i=0;i<classes.length;i++){
  const cls=classes[i],label=cls.items.find(it=>it.x<120&&/^Class\s+/i.test(it.str.trim()));
  if(clean(label?.str)!==clean(row.class_name))continue;
  const lower=classes[i+1]?.y??Math.max(35,cls.y-140);
  const band=lines.filter(l=>l.y<cls.y-1&&l.y>lower+1);
  const rx={MER:/^Management expense ratio\s*\(\w+\)/i,
   TER:/^Trading expense ratio\s*\(\w+\)/i,
   PTR:/^Portfolio turnover rate\s*\(\w+\)/i}[key];
  const matching=band.filter(l=>l.items.some(it=>it.x<250&&rx.test(it.str.trim())) &&
   (key!=='MER'||!/before\s+(?:waivers|absorptions)/i.test(l.text)));
  if(matching.length!==1)continue;
  const marks=cells(matching[0]).concat(matching[0].items.filter(it=>/^n\s*\/?\s*a$/i.test(it.str.trim())).map(it=>({value:null,isMissing:true,raw:it.str,x:it.x,box:{x:it.x-1,y:it.y-1,w:it.w+2,h:it.h+2}})));
  const hits=marks.filter(c=>c.x>225&&Math.abs(c.x+c.box.w/2-targetX)<22&&matchesCell(c,value));
  if(hits.length===1)found.push(hits[0]);
 }
 const uniq=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return uniq.size===1?[...uniq.values()][0]:null;
}

// Scotia: the header has MER, MER-before-waivers, TER, and PTR in adjacent
// columns. Use the physical column header alignment AND the exact dated row
// under the selected Series, never just equal numeric text.


function locateCell_pender(page,lines,row,key,value,context){const selected=penderCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-period-header-cell'}:null;}
