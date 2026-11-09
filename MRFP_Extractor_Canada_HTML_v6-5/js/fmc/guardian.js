/* FMC adapter: guardian. Dynamic Series/Class parsing for Guardian Capital MRFPs.
 * Fund category and individual series names are intentionally not hardcoded.
 * Build browser bundles with `node dev-tools/build.cjs`. */
// @mrfp:profile
const profile_guardian={
 key:'guardian',
 label:'Guardian Capital',
 style:'guardian',
 signatures:[/Guardian Capital LP/i,/www\.guardiancapital\.com\/investmentsolutions/i],
 title:/^\s*(GUARDIAN[\s\S]{5,150}?(?:FUND|ETF))\s*$/im
};

const fmcConfig_guardian={issuerPrefix:/^GUARDIAN\s/i,titleScanPages:4};

function identifyFundEarly_guardian(pages,profile,head){
 const dateRx=/^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+20\d{2}$/i;
 for(const pg of pages.slice(0,3)){
  const items=Array.isArray(pg.items)?pg.items.filter(it=>typeof it.str==='string'&&it.str.trim()&&Number.isFinite(it.x)&&Number.isFinite(it.y)):[];
  const report=items.find(it=>/MANAGEMENT REPORT OF FUND PERFORMANCE/i.test(it.str));
  const date=items.find(it=>dateRx.test(String(it.str||'').trim()));
  if(report&&date){
   const region=items.filter(it=>it.y<report.y-5&&it.y>date.y+5);
   const groups=[];
   for(const it of region){
    let line=groups.find(x=>Math.abs(x.y-it.y)<1.8);
    if(!line){line={y:it.y,items:[]};groups.push(line);}
    line.items.push({...it,str:String(it.str).trim()});
   }
   groups.sort((a,b)=>b.y-a.y);
   // PDF.js can place a superscript trademark digit (e.g. the 3 in i3)
   // on a separate baseline. Reattach only a single digit that touches
   // the end of a word on the immediately lower title line.
   for(const line of groups){
    for(const mark of line.items){
     if(!/^\d$/.test(mark.str))continue;
     const below=groups.filter(g=>g.y<line.y&&line.y-g.y<18).sort((a,b)=>b.y-a.y)[0];
     if(!below)continue;
     const owner=below.items.find(it=>Math.abs((it.x+(Number(it.w)||0))-mark.x)<3.5);
     if(owner&&/[A-Za-z]$/.test(owner.str)){owner.str+=mark.str;mark.str='';}
    }
   }
   const title=groups.map(g=>g.items.sort((a,b)=>a.x-b.x)
     .map(it=>it.str).filter(t=>t&&!/^(?:TM|™|®)$/i.test(t)).join(' '))
     .filter(Boolean).join(' ').replace(/\s+/g,' ').replace(/-\s+/g,'-').trim();
   if(/\b(?:FUND|ETF|PORTFOLIO|POOL)\b$/i.test(title)&&title.length>=12&&title.length<190)return title;
  }
  // Text-only fallback for synthetic tests or source pages without PDF.js geometry.
  const lines=String(pg.text||'').split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  const marker=lines.findIndex(x=>/^(?:ANNUAL|INTERIM)\s+MANAGEMENT REPORT OF FUND PERFORMANCE/i.test(x));
  if(marker>=0){
   const parts=[];
   for(const line of lines.slice(marker+1,marker+7)){
    if(dateRx.test(line))break;
    if(/^(?:TM|™|®|\d)$/i.test(line))continue;
    parts.push(line);
    const candidate=parts.join(' ').replace(/\s+/g,' ').replace(/-\s+/g,'-').trim();
    if(/\b(?:FUND|ETF|PORTFOLIO|POOL)\b$/i.test(candidate)&&candidate.length>=12)return candidate;
   }
  }
 }
 return undefined;
}

// @mrfp:extraction
// Normalize text without changing the class identity or collapsing combined headings.
function guardianNormalize(s){return String(s||'').normalize('NFKC').replace(/\u00ad/g,'').replace(/\s+/g,' ').trim();}
function guardianCompact(s){return guardianNormalize(s).toLowerCase().replace(/[^a-z0-9]/g,'');}
function guardianClassName(s){
 let value=guardianNormalize(s).replace(/^(?:Series|Class)\s+/i,m=>m[0].toUpperCase()+m.slice(1));
 // Parenthetical "formerly ..." text is a product alias, not a second class.
 value=value.replace(/\s*\(formerly\b[^)]*\)\s*$/i,'').trim();
 return value;
}
function guardianClassFromHeading(line){
 const text=guardianNormalize(line);
 const m=/^Ratios?\s+(?:and|&)\s+Supplemental\s+Data\s*\((.+)\)\s*$/i.exec(text);
 if(!m)return null;
 const cls=guardianClassName(m[1]);
 return cls||null;
}
function classHeading_guardian(line){
 const t=guardianNormalize(line);
 const m=/^((?:Series|Class)\s+[A-Z0-9][A-Z0-9\s&/'-]*|(?:ETF|CAD|USD)\s+(?:Units?|Series)|[A-Z][A-Z0-9-]*\s+(?:Shares?|Units?))(?:\s+\(formerly\b.*\))?$/i.exec(t);
 return m?guardianClassName(m[1]):null;
}
function guardianClassNearHeading(lines,index){
 for(let i=index-1;i>=Math.max(0,index-10);i--){
  const m=/Net Assets per Unit\s*\((.+)\)\s*$/i.exec(guardianNormalize(lines[i]));
  if(m){const cls=guardianClassName(m[1]);if(cls)return cls;}
 }
 for(let i=index+1;i<Math.min(lines.length,index+4);i++){
  const cls=classHeading_guardian(lines[i]);
  if(cls)return cls;
 }
 return null;
}
function guardianMetric(line,key){
 const t=guardianNormalize(line);
 const label=key==='MER'?/^Management\s+expense\s+ratio\b/i:/^Portfolio\s+turnover\s+(?:rate|ratio)\b/i;
 const m=label.exec(t);if(!m)return {found:false,value:null};
 if(key==='MER'&&/\bbefore\s+waivers\b|\babsorptions\b/i.test(t))return {found:false,value:null};
 let tail=t.slice(m[0].length).replace(/^\s*(?:(?:\[\d+\])|(?:\(\d+\))|(?:\(\s*%\s*\)))\s*/,'').trim();
 const token=/(?:N\/?A|[—–−-]{1,2}|-?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*%?)/i.exec(tail);
 if(token){
  const raw=token[0].replace(/\s/g,'');
  if(/^(?:N\/?A|[—–−-]{1,2})$/i.test(raw))return {found:true,value:null};
  const n=Number(raw.replace(/[,%]/g,''));
  return {found:true,value:Number.isFinite(n)?n:null};
 }
 return {found:false,value:null};
}
function guardianDateText(date){
 const m=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(date||'');if(!m)return null;
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 return `${months[Number(m[2])-1]} ${Number(m[3])}, ${m[1]}`;
}
function guardianDateColumnCenter(items,sectionY,iso){
 if(!Array.isArray(items))return null;
 const month=['January','February','March','April','May','June','July','August','September','October','November','December'][Number(iso[2])-1];
 const monthPrefix=month.slice(0,3)+'[a-z]*';
 const day=Number(iso[3]),year=iso[1];
 const fullRx=new RegExp('^'+monthPrefix+'\\.?\\s+'+day+',?\\s+'+year+'$','i');
 const monthDayRx=new RegExp('^'+monthPrefix+'\\.?\\s+'+day+',?$','i');
 const monthOnlyRx=new RegExp('\\b'+monthPrefix+'\\b','i');
 const dayYearRx=new RegExp('^'+day+',?\\s+'+year+'$','i');
 const yearRx=new RegExp('^'+year+'$');
 const nearby=items.filter(it=>Number.isFinite(it.x)&&Number.isFinite(it.y)&&it.y<sectionY&&sectionY-it.y<145);
 const center=it=>it.x+(Number(it.w)||0)/2;
 const direct=nearby.filter(it=>fullRx.test(guardianNormalize(it.str)));
 if(direct.length===1)return center(direct[0]);
 if(direct.length>1)return null;
 const dateItems=nearby.filter(it=>monthDayRx.test(guardianNormalize(it.str)));
 const monthItems=nearby.filter(it=>monthOnlyRx.test(guardianNormalize(it.str)));
 const dayYearItems=nearby.filter(it=>dayYearRx.test(guardianNormalize(it.str)));
 const yearItems=nearby.filter(it=>yearRx.test(guardianNormalize(it.str)));
 const centers=[];
 for(const d of dateItems)for(const y of yearItems)
  if(Math.abs(center(d)-center(y))<22&&Math.abs(d.y-y.y)<40)centers.push(center(y));
 for(const m of monthItems)for(const dy of dayYearItems)
  if(Math.abs(center(m)-center(dy))<22&&Math.abs(m.y-dy.y)<40)centers.push(center(dy));
 const unique=[...new Set(centers.map(x=>Math.round(x*10)/10))];
 return unique.length===1?unique[0]:null;
}
function guardianHasCurrentPeriod(block,date,page,sectionHeading){
 const wanted=guardianDateText(date);
 if(!wanted)return false;
 const compact=s=>guardianNormalize(s).replace(/[,]/g,'').toLowerCase();
 if(compact(block).includes(compact(wanted)))return true;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(date||'');
 if(!iso||!Array.isArray(page?.items))return false;
 const month=['January','February','March','April','May','June','July','August','September','October','November','December'][Number(iso[2])-1];
 const heading=guardianNormalize(sectionHeading||'');
 const section=page.items.find(it=>guardianNormalize(it.str)===heading&&/Ratios?\s+(?:and|&)\s+Supplemental\s+Data/i.test(it.str))
  ||page.items.find(it=>/Ratios?\s+(?:and|&)\s+Supplemental\s+Data/i.test(String(it.str||'')));
 if(section&&Number.isFinite(guardianDateColumnCenter(page.items,section.y,iso)))return true;
 // Some multi-column annual headers interleave text from adjacent columns,
 // so month/day and year are not contiguous in the flattened text stream.
 // Keep this fallback scoped to the same ratio-table block and the report's
 // exact month/day/year; evidence still requires an aligned source column.
 const blockText=guardianNormalize(block);
 const monthDayRx=new RegExp(month.slice(0,3)+'[a-z]*\\.?\\s+'+Number(iso[3])+',?','i');
 return monthDayRx.test(blockText)&&new RegExp('\\b'+iso[1]+'\\b').test(blockText);
}
function guardianRatioSections(pages,fund,date){
 const sections=[];
 for(const page of pages){
  const lines=String(page.text||'').split(/\r?\n/).map(guardianNormalize);
  for(let i=0;i<lines.length;i++){
   if(!/^Ratios?\s+(?:and|&)\s+Supplemental\s+Data\b/i.test(lines[i]))continue;
   const next=i+1;let end=next;
   while(end<lines.length&&!/^Ratios?\s+(?:and|&)\s+Supplemental\s+Data\b/i.test(lines[end]))end++;
   const block=lines.slice(i,end).join('\n');
   if(!guardianHasCurrentPeriod(block,date,page,lines[i]))continue;
   let cls=guardianClassFromHeading(lines[i])||guardianClassNearHeading(lines,i);
   sections.push({page,lines,headingIndex:i,endIndex:end,block,cls});
  }
 }
 // A genuine single fund-level ratio table may omit any Series/Class heading.
 // Do not invent a class when a multi-table document makes the identity ambiguous.
 if(sections.length===1&&!sections[0].cls)sections[0].cls='Fund';
 return sections.filter(s=>s.cls);
}
function extract_guardian(pages,p,fund,date){
 const reportDateValue=date||reportDate(pages);
 if(!reportDateValue||!fund||fund==='Unknown Fund')return [];
 const sections=guardianRatioSections(pages,fund,reportDateValue);
 const byClass=new Map();
 for(const section of sections){
  const values={MER:null,TER:null,PTR:null},evidence={};
  let seen=0;
  for(const key of ['MER','PTR']){
   const labelRx=key==='MER'?/^Management\s+expense\s+ratio\b/i:/^Portfolio\s+turnover\s+(?:rate|ratio)\b/i;
   const line=section.lines.slice(section.headingIndex+1,section.endIndex)
    .find(t=>labelRx.test(t)&&!(key==='MER'&&/\bbefore\s+waivers\b|\babsorptions\b/i.test(t)));
   if(!line)continue;
   const parsed=guardianMetric(line,key);
   if(!parsed.found)continue;
   values[key]=parsed.value;seen++;
   evidence[key]={page:section.page.page,source:`${key} (Guardian current-period ratio table)`,method:'native-js'};
  }
  if(!seen)continue;
  const old=byClass.get(section.cls);
  if(!old)byClass.set(section.cls,{cls:section.cls,values,evidence,quality:3});
  else{
   for(const key of ['MER','PTR']){
    if(!Object.hasOwn(old.evidence,key)&&Object.hasOwn(evidence,key)){
     old.values[key]=values[key];old.evidence[key]=evidence[key];
    }else if(Object.hasOwn(old.evidence,key)&&Object.hasOwn(evidence,key)&&old.values[key]!==values[key]){
     delete old.evidence[key];old.values[key]=null;
    }
   }
  }
 }
 return [...byClass.values()];
}
function auditRatioHeadings_guardian(source,potential){
 const lines=String(source||'').split(/\r?\n/);
 for(const line of lines){
  const cls=guardianClassFromHeading(line);
  if(cls)potential.add(cls);
 }
}

// @mrfp:evidence
function guardianEvidenceNormalize(s){return String(s||'').normalize('NFKC').replace(/\u00ad/g,'').replace(/™|®|\bTM\b|TM(?=\s)/gi,'').replace(/\s+/g,' ').trim();}
function guardianEvidenceCompact(s){return guardianEvidenceNormalize(s).toLowerCase().replace(/[^a-z0-9]/g,'');}
function guardianEvidenceClassFromHeading(line){
 const text=guardianEvidenceNormalize(line);
 const m=/^Ratios?\s+(?:and|&)\s+Supplemental\s+Data\s*\((.+)\)\s*$/i.exec(text);
 if(!m)return null;
 return guardianEvidenceNormalize(m[1]).replace(/\s*\(formerly\b[^)]*\)\s*$/i,'').trim();
}
function guardianEvidenceFundMatches(text,fundName){
 const source=guardianEvidenceCompact(String(text||'').slice(0,2800));
 const target=guardianEvidenceCompact(fundName);
 if(target&&source.includes(target))return true;
 // Some PDF.js builds place a one-digit superscript in a separate text run.
 const targetLetters=target.replace(/\d/g,'');
 const sourceLetters=source.replace(/\d/g,'');
 const digits=String(fundName||'').match(/\d+/g)||[];
 return targetLetters.length>12&&sourceLetters.includes(targetLetters)&&digits.every(d=>source.includes(d));
}
function guardianEvidenceDateCenter(lines,section,iso){
 const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const month=monthNames[Number(iso[2])-1],day=Number(iso[3]),year=iso[1],prefix=month.slice(0,3)+'[a-z]*';
 const fullRx=new RegExp('^'+prefix+'\\.?\\s+'+day+',?\\s+'+year+'$','i');
 const monthDayRx=new RegExp('^'+prefix+'\\.?\\s+'+day+',?$','i');
 const monthOnlyRx=new RegExp('\\b'+prefix+'\\b','i');
 const dayYearRx=new RegExp('^'+day+',?\\s+'+year+'$','i');
 const yearRx=new RegExp('^'+year+'$');
 const nearby=lines.filter(l=>l.y<section.y&&section.y-l.y<145).flatMap(l=>l.items);
 const center=it=>tokenCenter(it);
 const direct=nearby.filter(it=>fullRx.test(guardianEvidenceNormalize(it.str)));
 if(direct.length===1)return center(direct[0]);
 if(direct.length>1)return null;
 const dateItems=nearby.filter(it=>monthDayRx.test(guardianEvidenceNormalize(it.str)));
 const monthItems=nearby.filter(it=>monthOnlyRx.test(guardianEvidenceNormalize(it.str)));
 const dayYearItems=nearby.filter(it=>dayYearRx.test(guardianEvidenceNormalize(it.str)));
 const yearItems=nearby.filter(it=>yearRx.test(guardianEvidenceNormalize(it.str)));
 const centers=[];
 for(const d of dateItems)for(const y of yearItems)
  if(Math.abs(center(d)-center(y))<22&&Math.abs(d.y-y.y)<40)centers.push(center(y));
 for(const m of monthItems)for(const dy of dayYearItems)
  if(Math.abs(center(m)-center(dy))<22&&Math.abs(m.y-dy.y)<40)centers.push(center(dy));
 const unique=[...new Set(centers.map(x=>Math.round(x*10)/10))];
 return unique.length===1?unique[0]:null;
}
const evidencePolicy_guardian={stamps:{guardianRatioLocatorVersion:1}};
function validateDocumentEvidence_guardian(pages,row){
 return pages.slice(0,5).some(p=>guardianEvidenceFundMatches(p.text,row?.fund_name));
}
function locateCell_guardian(page,lines,row,key,value,context){
 if(key!=='MER'&&key!=='PTR'||!Array.isArray(page.items)||page.ocrUsed)return null;
 if(!guardianEvidenceFundMatches(page.text,row.fund_name))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso)return null;
 const compactClass=s=>guardianEvidenceNormalize(s).toLowerCase();
 const sectionLines=lines.filter(l=>/^Ratios?\s+(?:and|&)\s+Supplemental\s+Data\b/i.test(l.text));
 const found=[];
 for(const section of sectionLines){
  const cls=guardianEvidenceClassFromHeading(section.text)||null;
  if(!cls||compactClass(cls)!==compactClass(row.class_name))continue;
  // Match the latest date by its actual date/year header cells. Annual
  // reports may split "December 31," and "2025" onto separate PDF.js lines.
  const target=guardianEvidenceDateCenter(lines,section,iso);
  if(!Number.isFinite(target))continue;
  const metricRx=key==='MER'?/^Management\s+expense\s+ratio\b/i:/^Portfolio\s+turnover\s+(?:rate|ratio)\b/i;
  const nextSection=sectionLines.filter(l=>l.y<section.y).sort((a,b)=>b.y-a.y)[0];
  const lowerBound=nextSection?nextSection.y+2:section.y-285;
  const metricLines=lines.filter(l=>l.y<section.y-2&&l.y>lowerBound&&section.y-l.y<285&&metricRx.test(l.text)
    &&!(key==='MER'&&/\bbefore\s+waivers\b|\babsorptions\b/i.test(l.text)));
  if(metricLines.length!==1)continue;
  const line=metricLines[0];
  const candidates=cells(line).filter(c=>matchesCell(c,value)&&
    Math.abs((c.x+c.box.w/2)-target)<19);
  if(candidates.length===1)found.push(candidates[0]);
 }
 const unique=new Map(found.map(c=>[`${c.box.x.toFixed(2)}:${c.box.y.toFixed(2)}`,c]));
 if(unique.size!==1)return null;
 const hit=[...unique.values()][0];
 return {...hit,page:page.page,metric:key,kind:'guardian-current-period-class-and-metric-cell'};
}
