/* FMC adapter: brandes. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_brandes={key:'brandes',label:'Bridgehouse / Brandes',style:'brandes_new',signatures:[/Brandes (?:International|Global Small Cap|Emerging Markets).*Fund/i,/Bridgehouse Asset Managers/i],title:/^\s*(Brandes\s+[^\n]+?Fund)\s*$/im};

const fmcConfig_brandes={issuerPrefix:/^Brandes\s/i,preferProfileLineTitle:true};

// @mrfp:extraction
function parseBrandes(pages){
 const out=new Map();const year=brandesDate(pages)?.slice(0,4);for(const p of pages){
  if(!/Ratios and Supplemental Data/i.test(p.text))continue;
  const lines=normalizeExtraText(p.text).split('\n');
  for(let i=0;i<lines.length;i++){
   const m=/^\s*(Series\s+[A-Z][A-Z0-9]*)\s*$/i.exec(lines[i]);if(!m)continue;
   // For this tabular layout, a series name is centered vertically among
   // the six-year data rows; its 2026 line appears immediately above it.
   let latest=null;
   for(let j=i-1;j>=Math.max(0,i-12);j--){if(year&&lines[j].startsWith(year+' ')){latest=lines[j];break;}if(/^Series\s/i.test(lines[j]))break;}
   if(!latest)continue;
   let parts=(latest.match(/\b\d[\d,]*(?:\.\d+)?\b|[—–−-]/g)||[]);
   // Year, net assets, units, MER, MER before, PTR, TER, NAV.
   if(parts.length<7)continue;
   const v={MER:toNumber(parts[3]),PTR:toNumber(parts[5]),TER:toNumber(parts[6])};
   out.set(m[1],{cls:m[1],values:v,quality:3,evidence:{}});
  }
 }
 return [...out.values()];
}
function brandesDate(pages){
 const head=normalizeExtraText(pages.slice(0,5).map(x=>x.text).join('\n'));
 const m=/Results\s+of\s+Operations\s+from[\s\S]{0,160}?\bto[\s\S]{0,170}?\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})/i.exec(head);
 if(m){const mm=months[m[1].slice(0,3).toLowerCase()];return `${m[3]}-${String(mm).padStart(2,'0')}-${m[2].padStart(2,'0')}`;}
 return reportDate(pages);
}
// v2-1: New issuer formats. Ratios are read from the latest period's first
// published table column; no amounts are hardcoded for any named fund.

function extract_brandes(pages,p,fund,date){return parseBrandes(pages);}
function selectReportDate_brandes(pages){return brandesDate(pages);}

// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_brandes={stamps:{brandesNeiLocatorVersion:1}};
function brandesCell(page,lines,row,key,value){
 // Brandes ratio pages identify the fund in a letter-spaced footer, not a title.
 // Verify the entire page's printed fund identifier, never assume a filename.
 if(!compactName(page.text).includes(compactName(row.fund_name)))return null;
 const targetYear=Number((row.report_date||'').slice(0,4));
 if(!targetYear||!/^Series\s+[A-Za-z0-9-]+$/i.test(row.class_name||''))return null;
 const section=lines.find(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data$/i.test(l.text.trim()));
 if(!section)return null;
 const headerItems=lines.filter(l=>l.y<section.y&&section.y-l.y<65).flatMap(l=>l.items);
 const findUnique=rx=>headerItems.filter(i=>rx.test(i.str.trim()));
 const mer=findUnique(/^ratio\s*\(MER\)$/i),before=findUnique(/^MER before waivers$/i);
 const turn=findUnique(/^turnover rate$/i),trading=findUnique(/^expense ratio$/i);
 if([mer,before,turn,trading].some(a=>a.length!==1))return null;
 const anchors={MER:tokenCenter(mer[0]),PTR:tokenCenter(turn[0]),TER:tokenCenter(trading[0])};
 if(!(anchors.MER<tokenCenter(before[0])&&tokenCenter(before[0])<anchors.PTR&&anchors.PTR<anchors.TER))return null;
 const current=lines.filter(l=>l.y<section.y-20&&l.items.some(i=>i.x<180&&i.x>65&&i.str.trim()===String(targetYear)))
  .sort((a,b)=>b.y-a.y);
 const found=[];
 for(let j=0;j<current.length;j++){
  const top=current[j],bottom=current[j+1]?.y??top.y-100;
  // A full series contains its own physical Series caption, usually beside
  // the third historical year. Never infer a class from a prior page.
  const captions=lines.filter(l=>l.y<top.y&&l.y>bottom&&l.items.some(i=>i.x<125&&/^Series\s+[A-Za-z0-9-]+$/i.test(i.str.trim())));
  if(captions.length!==1||clean(captions[0].text)!==clean(row.class_name))continue;
  const years=lines.filter(l=>l.y<=top.y&&l.y>bottom&&l.items.some(i=>i.x<180&&i.x>65&&/^20\d{2}$/.test(i.str.trim())))
   .sort((a,b)=>b.y-a.y);
  if(years.length<1||!years[0].items.some(i=>i.x<180&&i.str.trim()===String(targetYear)))continue;
  // Historical rows must be chronologically descending when present.
  if(!years.every((l,i)=>l.items.some(it=>it.x<180&&it.str.trim()===String(targetYear-i))))continue;
  // Require the target-year printed cell to be inside the metric's header
  // column band, excluding adjacent MER-before-waivers even if identical.
  const targetX=anchors[key];
  const marks=cells(top);
  const selected=marks.filter(c=>matchesCell(c,value)&&c.x>290&&Math.abs(c.x+c.box.w/2-targetX)<28);
  // A tighter band excludes the neighboring MER-before-waivers value.
  const restrict=key==='MER'?selected.filter(c=>c.x<tokenCenter(before[0])-12):
   key==='PTR'?selected.filter(c=>c.x>tokenCenter(before[0])+15&&c.x<anchors.TER-20):
   selected.filter(c=>c.x>anchors.PTR+25);
  if(restrict.length===1)found.push(restrict[0]);
 }
 const unique=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return unique.size===1?[...unique.values()][0]:null;
}

// NEI: date/class live in one physical row, while the actual MER and the
// before-waivers MER have separate adjacent header columns. Derive anchors
// from printed column titles; missing N/A is a real source glyph, not zero.


function locateCell_brandes(page,lines,row,key,value,context){const selected=brandesCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-class-period-column'}:null;}
