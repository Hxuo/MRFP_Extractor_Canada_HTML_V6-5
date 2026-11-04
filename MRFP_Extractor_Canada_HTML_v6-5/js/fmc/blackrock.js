/* FMC adapter: blackrock. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const blackrock={key:'blackrock',label:'BlackRock / iShares',style:'blackrock',signatures:[/BlackRock Asset Management Canada Limited/i,/www\.blackrock\.com\/ca/i,/\biShares\b/i],title:/\b(iShares\s+.{5,110}?(?:ETF Portfolio|Index ETF|ETF))\b/i};

const fmcConfig_blackrock={issuerPrefix:/^iShares\s/i,renameEmptyClasses:true};

// @mrfp:extraction
function parseBlackrockB2(pages){
 const out=new Map();
 for(const pg of pages){const text=pg.text.replace(/\u00a0/g,' ');
  if(!/Ratios\s*and\s*Supplemental\s*Data/i.test(text))continue;
  const start=text.search(/Ratios\s*and\s*Supplemental\s*Data/i);
  const first=text.slice(0,start);const cls=/\b(CAD|USD)\s*Units\b/i.exec(first)?.[0]||null;
  if(!cls)continue;
  const section=text.slice(start).split(/\r?\n/);
  const vals={};let quality=0;
  for(const metric of ['MER','TER','PTR']){
    const re=metric==='MER'?/Management\s*expense\s*ratio/i:metric==='TER'?/Trading\s*expense\s*ratio/i:/Portfolio\s*turnover\s*rate/i;
    const row=section.find(s=>re.test(s));if(!row)continue;
    const cut=row.slice(re.exec(row).index+re.exec(row)[0].length);
    // Skip footnote (h) and dot leaders; take first reported decimal.
    const m=/\b(\d*\.\d+)\s*%/i.exec(cut);
    if(!m)continue;
    vals[metric]=toNumber(m[1]);quality++;
  }
  if(quality===3){const name=/^CAD/i.test(cls)?'CAD Units':'USD Units';out.set(name,{cls:name,values:vals,quality,evidence:{}});}
 }
 return [...out.values()];
}
// v3-1: Single-class iShares ETFs with dotted-leader metric rows.
// In contrast, currency-specific CAD/USD Units reports continue through
// parseBlackrockB2() unchanged. Dashes in the current column stay null.
function parseBlackrockDottedEtf(pages,fund,date){
 if(!/\bETF\b/i.test(fund)||!date)return [];
 const year=date.slice(0,4);
 for(const pg of pages){
  const txt=normalizeExtraText(pg.text||'');const pos=txt.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
  if(pos<0)continue;
  const before=txt.slice(Math.max(0,pos-1200),pos);
  if(/\b(?:CAD|USD)\s+Units\b/i.test(before))continue;
  if(!new RegExp('\\b'+year+'\\b').test(before) && !new RegExp('\\b'+year+'\\b').test(pages.slice(0,2).map(x=>x.text).join(' ')))continue;
  const lines=txt.slice(pos,pos+3500).split(/\r?\n/);const vals={MER:null,TER:null,PTR:null},evidence={};let seen=0;
  for(const metric of ['MER','TER','PTR']){
   const re=metric==='MER'?/^\s*Management\s+expense\s+ratio\b/i:
     metric==='TER'?/^\s*Trading\s+expense\s+ratio\b/i:/^\s*Portfolio\s+turnover\s+(?:rate|ratio)\b/i;
   for(const line of lines){
    const m=re.exec(line);if(!m)continue;
    const tail=line.slice(m[0].length);
    // Dotted leaders identify the layout and keep the first financial
    // cell distinct from footnote markers and descriptive prose.
    const lead=/\.{6,}/.exec(tail);if(!lead)break;
    const valueText=tail.slice(lead.index+lead[0].length).trim();
    const tok=/^(?:\$\s*)?([—–−-]|\d+(?:\.\d+)?)(?=\s|%|$)/.exec(valueText);
    if(!tok)break;
    vals[metric]=toNumber(tok[1]);seen++;
    evidence[metric]={page:pg.page,source:'iShares dotted-leader latest-period ratio table',method:'native-js'};
    break;
   }
  }
  if(seen===3)return [{cls:'ETF Units',values:vals,evidence,quality:3}];
 }
 return [];
}

// Global X runs several financial report templates. Handle both '0.10%'
// and '0. 10%' for numeric fields, not just its legacy narrow regex.

function extract_blackrock(pages,p,fund,date){let parsed=parseBlackrockB2(pages);if(!parsed.length)parsed=parseBlackrockDottedEtf(pages,fund,date);if(!parsed.length)parsed=scanSingleFund(pages,p);return parsed;}
// Adapter-owned fund title strategy (original v6 rule, unchanged).
function identifyFundLate_blackrock(pages,p,head){
if(p.key==='blackrock'){
    for(const pg of pages.slice(0,5))for(const raw of pg.text.split(/\r?\n/)){
      const line=raw.trim();
      if(/^iShares[A-Za-z0-9-]{12,130}ETF$/.test(line)){
        return line.replace(/^iShares/,'iShares ').replace(/(\d)([A-Za-z])/g,'$1 $2')
          .replace(/([A-Z]{2,})([A-Z][a-z])/g,'$1 $2')
          .replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^i Shares\s+/i,'iShares ').replace(/\s+/g,' ').trim();
      }
    }
    let match=head.match(/(?:for the|for an?)\s+(iShares\s+[^\n]{5,130}?(?:ETF Portfolio|Index ETF|ETF))\s*(?:\(|for\s+the)/i);
    if(!match)match=head.match(/\b(iShares\s+[^\n]{5,130}?(?:ETF Portfolio|Index ETF|ETF))\b/i);
    return clean(match?.[1]||'').replace(/ETFPortfolio/g,'ETF Portfolio').replace(/1-5Year/g,'1-5 Year');
  }
}

// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_blackrock={stamps:{tdBlackrockLocatorVersion:1}};
function blackrockCell(page,lines,row,key,value){
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');if(!iso)return null;
 const reportMonth=({ '06':'June','12':'December'})[iso[2]];
 if(!reportMonth)return null;
 // Some PDFs duplicate text glyphs, but the fund name tokens still appear.
 const firstLines=lines.slice(0,3).map(l=>l.text).join(' '),fundWords=clean(row.fund_name).replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>1);
 if(!fundWords.length||fundWords.filter(w=>new RegExp('(?:^|\\W)'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|\\W)','i').test(firstLines)).length<Math.ceil(fundWords.length*.85))return null;
 const periodText=lines.slice(0,6).map(l=>l.text).join(' ');
 if(!new RegExp('\\b'+reportMonth+'\\s+'+Number(iso[3])+'\\s*,?\\s*'+iso[1]+'\\b','i').test(periodText))return null;
 const section=lines.filter(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data\b/i.test(l.text));
 const found=[];
 for(const sec of section){
  const yearLines=lines.filter(l=>l.y>sec.y&&l.y-sec.y<260&&yearTokens(l).length>=2).sort((a,b)=>a.y-b.y);
  if(!yearLines.length)continue;
  const yearLine=yearLines[0],years=yearTokens(yearLine);
  if(years.some((yr,i)=>i&&Number(yr.str)>=Number(years[i-1].str)))continue;
  const targetIndex=years.findIndex(i=>Number(i.str)===Number(iso[1]));
  if(targetIndex<0)continue;
  // Require the date headings from THIS table, not only the page report date.
  const aboveYear=lines.filter(l=>l.y>yearLine.y&&l.y-yearLine.y<40);
  if(!aboveYear.some(l=>new RegExp('\\b'+reportMonth+'\\s+'+Number(iso[3])+'\\b','i').test(l.text)))continue;
  const units=yearLine.items.filter(i=>i.x<250).map(i=>i.str.trim()).join(' ').match(/\b(CAD|USD)\s+Units\b/i);
  if(/^\s*(?:CAD|USD)\s+Units\s*$/i.test(row.class_name||'')){
   if(!units||compactName(units[0])!==compactName(row.class_name))continue;
  }else if(units)continue; // A single ETF row must not steal CAD/USD evidence.
  else if(compactName(row.class_name)!==compactName(row.fund_name)&&!/^ETF\s+Units$/i.test(row.class_name||''))continue;
  const ratioRows=lines.filter(l=>l.y<sec.y&&sec.y-l.y<90&&labelledMetricLine(l,key,'blackrock'));
  if(ratioRows.length!==1)continue;
  const metric=ratioRows[0];
  const candidates=cells(metric).filter(n=>n.x>years[0].x-35);
  if(candidates.length!==years.length)continue;
  const chosen=candidates[targetIndex];
  if(!chosen||Math.abs(chosen.x-years[targetIndex].x)>25||!matchesCell(chosen,value))continue;
  found.push(chosen);
 }
 const uniq=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return uniq.size===1?[...uniq.values()][0]:null;
}


// Mackenzie / IG Mackenzie financial-highlight evidence: each page may have
// two independent, side-by-side series tables. Read the *printed* class,
// year/date headings and the labelled ratio row within that same column band.
// No fixed year, page, fund, series or ratio-coordinate mapping.


function locateCell_blackrock(page,lines,row,key,value,context){const selected=blackrockCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-fund-period-series-header-cell'}:null;}
