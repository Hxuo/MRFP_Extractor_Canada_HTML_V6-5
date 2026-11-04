/* FMC adapter: middlefield. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const middlefield={key:'middlefield',label:'Middlefield',style:'middlefield',signatures:[/MIDDLEFIELD CORPORATE PROFILE/i,/\bMIDDLEFIELD\s+(?:MUTUAL FUNDS|GLOBAL|LIMITED)\b/i,/Middlefield Limited/i],title:/^\s*(MIDDLEFIELD\s+[A-Z\s.]{4,100}(?:FUND|CLASS|ETF))\s*$/im};

const fmcConfig_middlefield={issuerPrefix:/^Middlefield\s/i,startAtRatioHeading:true};

// @mrfp:extraction
function middlefieldTable(pages){
 const parsed=[];for(const page of pages){const lines=page.text.split(/\r?\n/);for(let i=0;i<lines.length;i++){if(!/Ratios?\s+and\s+Supplemental\s+Data\s*[-–]/i.test(lines[i]))continue;const cls=/Series\s+([AF])\b/i.exec(lines[i]+' '+(lines[i+1]||''));if(!cls)continue;let end=i+100;for(let j=i+1;j<Math.min(i+100,lines.length);j++){if(/Ratios?\s+and\s+Supplemental\s+Data\s*[-–]/i.test(lines[j])){end=j;break;}}const block=lines.slice(i+1,end).join('\n');const raw={};const ev={};let n=0;for(const key of ['MER','TER','PTR']){const m=findMetric(block,key);if(m.found){n++;raw[key]=m.value;if(m.value!==null)ev[key]={page:page.page,source:key+' (ratio table)',method:'native-js'};}}if(n>=2)parsed.push({cls:'Series '+cls[1],values:raw,evidence:ev,quality:n});}}return parsed;
}
// Batch 3 extension: Middlefield mutual-class and single ETF report layouts.
// The original middlefieldTable() remains the primary parser; this supplements
// only missing sections, never overrides an existing verified series row.
function middlefieldReportDate(pages){
 // Cover art states only the report year. The repeated official report
 // heading on later pages carries the exact six-month/year end date.
 const pattern=/\bFOR\s+THE\s+(?:SIX\s+MONTHS|YEAR)\s+ENDED\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i;
 for(const pg of pages.slice(0,12)){
  const m=pattern.exec(String(pg.text||''));if(!m)continue;
  const month=months[m[1].slice(0,3).toLowerCase()];
  return `${m[3]}-${String(month).padStart(2,'0')}-${m[2].padStart(2,'0')}`;
 }
 return reportDate(pages);
}
function middlefieldFallback(pages,fund,date){
 const out=new Map();if(!date)return [];
 const year=date.slice(0,4);
 const percent=/([—–−-]|\d+(?:\.\d+)?|\.\d+)\s*%/;
 function readMetric(lines,metric){
  const re=metric==='MER'?/^\s*Management\s+Expense\s+Ratio\b(?!\s+before)/i:
    metric==='TER'?/^\s*Trading\s+Expense\s+Ratio\b/i:/^\s*Portfolio\s+Turnover\s+(?:Rate|Ratio)\b/i;
  for(let i=0;i<lines.length;i++){
   if(!re.test(lines[i]))continue;
   for(let j=i;j<Math.min(i+5,lines.length);j++){
    // Do not borrow a number from a different metric or the next table.
    if(j>i && /^(?:\s*(?:Management|Trading)\s+Expense\s+Ratio|\s*Portfolio\s+Turnover|\s*MER\s*\()/i.test(lines[j]))break;
    const m=percent.exec(lines[j]);if(m)return {seen:true,value:toNumber(m[1])};
   }
   return {seen:false,value:null};
  }
  return {seen:false,value:null};
 }
 for(const pg of pages){
  const lines=String(pg.text||'').split(/\r?\n/),headings=[];
  for(let i=0;i<lines.length;i++){
   if(!/^\s*Ratios?\s+and\s+Supplemental\s+Data\b(?!\s+are)/i.test(lines[i]))continue;
   // Require actual ratio table context, not narrative mentioning the heading.
   const follow=lines.slice(i+1,i+12).join(' ');
   if(!new RegExp('\\b'+year+'\\b').test(follow))continue;
   const joined=lines.slice(i,i+4).join(' ');
   const series=/\b(Series\s+[A-Z][A-Z0-9]*)\b/i.exec(joined);
   if(!series && !/\bETF\b/i.test(fund))continue;
   headings.push({idx:i,cls:series?clean(series[1]):'ETF Units'});
  }
  for(let j=0;j<headings.length;j++){
   const h=headings[j];const end=headings[j+1]?.idx??lines.length;
   const block=lines.slice(h.idx,end);
   const vals={},evidence={};let quality=0;
   for(const metric of ['MER','TER','PTR']){
    const r=readMetric(block,metric);vals[metric]=r.value;
    if(r.seen){quality++;evidence[metric]={page:pg.page,source:metric+' (Middlefield current-period ratio table)',method:'native-js'};}
   }
   if(quality>=2&&!out.has(h.cls))out.set(h.cls,{cls:h.cls,values:vals,evidence,quality});
  }
 }
 return [...out.values()];
}

// First Trust U.S. technology MRFP has two ticker-specific blocks on the
// same page. The first financial column is the current reported year.

function extract_middlefield(pages,p,fund,date){const parsed=middlefieldTable(pages);const extra=middlefieldFallback(pages,fund,date);const found=new Set(parsed.map(x=>x.cls.toLowerCase()));for(const row of extra)if(!found.has(row.cls.toLowerCase()))parsed.push(row);return parsed;}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundLate_middlefield(pages,p,head){
if(p.key==='middlefield'){
    const m=head.match(/\b(MIDDLEFIELD\s+(?:GLOBAL\s+)?(?:[A-Z]+\s+){0,6}FUND)\b/i);
    if(m)return clean(m[1]).toUpperCase();
    // Middlefield covers often print the official name across 3-4 lines.
    // Only inspect the actual cover, not fund mentions in annual-report prose.
    const cover=String(pages[0]?.text||'').split(/\r?\n/).map(clean);
    for(let i=0;i<Math.min(cover.length,18);i++){
      if(!/^MIDDLEFIELD$/i.test(cover[i]))continue;
      for(let n=1;n<=5;n++){
        const candidate=clean(cover.slice(i,i+n+1).join(' '));
        if(/^MIDDLEFIELD\s+[A-Z0-9 .&'-]{5,120}\s+(?:FUND|CLASS|ETF)$/i.test(candidate))return candidate.toUpperCase();
      }
    }
  }
}

// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_middlefield(line){
 const style='middlefield';const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();let m;
 if(style==='middlefield'){m=/^Ratios\s+and\s+Supplemental\s+Data\s*[-–]\s*Series\s+([A-Z])/i.exec(s);return m?'Series '+m[1]:null;}
 return null;
}

function selectReportDate_middlefield(pages){return middlefieldReportDate(pages);}

// @mrfp:evidence
const evidenceLayout_middlefield={gapMerContinuation:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_middlefield={stamps:{lastGapLocatorVersion:1}};


function locateGap_middlefield(page,lines,row,key,value){return gapEtfYearCell(page,lines,row,key,value);}
