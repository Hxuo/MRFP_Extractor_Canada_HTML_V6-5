/* FMC adapter: first_trust. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const firstTrust={key:'first_trust',label:'First Trust Canada',style:'first_trust_b3',
  signatures:[/FT Portfolios Canada Co\./i,/First Trust AlphaDEX[^\n]{0,160}ETF/i,/www\.firsttrust\.ca/i],
  title:/^\s*(First Trust\s+[^\n]{8,180}?ETF)\s*$/im};

const fmcConfig_first_trust={issuerPrefix:/^First Trust\s/i};

// @mrfp:extraction
function parseFirstTrust(pages){
 const date=reportDate(pages);if(!date)return [];
 const year=date.slice(0,4),out=new Map();
 const percent=/([—–−-]|\d+(?:\.\d+)?|\.\d+)\s*%/;
 for(const pg of pages){
  const text=String(pg.text||'');const ix=text.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
  if(ix<0)continue;
  const lines=text.slice(ix).split(/\r?\n/),headers=[];
  for(let i=0;i<lines.length;i++){
   const m=/^\s*([A-Z]{2,7}(?:\.[A-Z])?)\s+(20\d{2})\b/i.exec(lines[i]);
   if(m&&m[2]===year)headers.push({idx:i,cls:m[1]});
  }
  for(let k=0;k<headers.length;k++){
   const h=headers[k],block=lines.slice(h.idx,headers[k+1]?.idx??lines.length);
   const vals={MER:null,TER:null,PTR:null},evidence={};let quality=0;
   for(const metric of ['MER','TER','PTR']){
    const re=metric==='MER'?/^\s*Management\s+expense\s+ratio\b/i:
     metric==='TER'?/^\s*Trading\s+expense\s+ratio\b/i:/^\s*Portfolio\s+turnover\s+rate\b/i;
    for(let i=0;i<block.length;i++){
     const m=re.exec(block[i]);if(!m)continue;
     if(metric==='MER'&&/\bbefore\s+(?:waivers|absorption)/i.test(block[i]))continue;
     const tail=block.slice(i,i+3).join(' '),numeric=percent.exec(tail);
     if(numeric){vals[metric]=toNumber(numeric[1]);quality++;evidence[metric]={page:pg.page,source:metric+' (First Trust current-period ratio table)',method:'native-js'};}
     break;
    }
   }
   if(quality>=2)out.set(h.cls,{cls:h.cls,values:vals,evidence,quality});
  }
 }
 return [...out.values()];
}

// RBC ETF financial table has no Series subheading. This is a guarded
// complement to the existing RBC mutual-fund dated-table implementation.

function extract_first_trust(pages,p,fund,date){return parseFirstTrust(pages);}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundLate_first_trust(pages,p,head){
if(p.key==='first_trust'){
    for(const pg of pages.slice(0,4))for(const raw of String(pg.text||'').split(/\r?\n/)){
      const line=raw.replace(/^[\s®™]+/,'').replace(/\s+/g,' ').trim();
      const m=/^(First Trust\s+.{8,170}?ETF)(?:\s*[•(]|$)/i.exec(line);
      if(m)return clean(m[1]);
    }
  }
}

// @mrfp:evidence
const evidenceLayout_first_trust={gapTickerCaption:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_first_trust={stamps:{lastGapLocatorVersion:1}};


function locateGap_first_trust(page,lines,row,key,value){return gapSeriesYearCell(page,lines,row,key,value);}
