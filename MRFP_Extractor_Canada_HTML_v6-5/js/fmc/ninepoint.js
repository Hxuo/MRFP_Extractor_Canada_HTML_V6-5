/* FMC adapter: ninepoint. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_ninepoint={key:'ninepoint',label:'Ninepoint Partners',style:'ninepoint_new',signatures:[/Ninepoint Partners LP/i,/Ninepoint Silver Bullion Fund/i],title:/^\s*(Ninepoint[^\n]{5,140}?Fund)\s*$/im};

const fmcConfig_ninepoint={issuerPrefix:/^Ninepoint\s/i};

// @mrfp:extraction
function parseNinepoint(pages){
 const results=new Map();
 for(const page of pages){
  if(!/Ratios and Supplemental Data/i.test(page.text))continue;
  const txt=normalizeExtraText(page.text),lines=txt.split(/\r?\n/),headings=[];
  for(let i=0;i<lines.length;i++){
   const m=/^\s*(Series\s+(?:ETF|[A-Z]))(?:\s+20\d{2}(?:\s+20\d{2})*)?\s*$/i.exec(lines[i]);
   if(m)headings.push({cls:m[1].replace(/\s+/g,' '),idx:i});
  }
  for(let i=0;i<headings.length;i++){
   const h=headings[i];
   const r=extraRatios(lines.slice(h.idx,headings[i+1]?.idx??lines.length).join('\n'));
   if(r.quality>=3)results.set(h.cls,{cls:h.cls,...r});
  }
 }
 return [...results.values()];
}

function extract_ninepoint(pages,p,fund,date){return parseNinepoint(pages);}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundEarly_ninepoint(pages,p,head){
if(p.key==='ninepoint'){
    const datedTitle=/^(Ninepoint\s+.{4,130}?\bFund)(?:\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+20\d{2})?$/i;

    for(const pg of pages.slice(0,3)){
      for(const raw of String(pg.text||'').split(/\r?\n/).slice(0,25)){
        const m=datedTitle.exec(reportTitleLine(raw));

        if(m)return clean(m[1]);
      }
    }

    const cover=String(pages[0]?.text||'')
      .split(/\r?\n/)
      .slice(0,15)
      .map(reportTitleLine);

    for(let i=0;i<cover.length;i++){
      if(!/^Ninepoint$/i.test(cover[i]))continue;

      for(let n=3;n<=6 && i+n<=cover.length;n++){
        const m=/^(Ninepoint\s+.{4,130}?\bFund)$/i.exec(
          clean(cover.slice(i,i+n).join(' '))
        );

        if(m)return clean(m[1]);
      }
    }
  }
}

// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_ninepoint={stamps:{lastGapLocatorVersion:1}};


function locateGap_ninepoint(page,lines,row,key,value){return gapSeriesYearCell(page,lines,row,key,value);}
