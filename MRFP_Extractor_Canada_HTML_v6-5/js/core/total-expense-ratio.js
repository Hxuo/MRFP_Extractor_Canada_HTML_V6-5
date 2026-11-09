/* Office TER contract (v6-5): TER = explicitly published TOTAL EXPENSE RATIO.
 * Trading Expense Ratio and FER are never interchangeable with this metric.
 * Strict generic evidence-backed support for single-period/column financial tables.
 * Unrecognized layouts fail closed; issuers can add verified layout support later.
 * This is included in BOTH generated bundles to avoid extraction/locator drift. */
const TOTAL_EXPENSE_RATIO_DEFINITION='total-expense-ratio-v1';
const TOTAL_EXPENSE_RATIO_LABEL=/^total\s+expense\s+ratios?\b/i;
const TOTAL_EXPENSE_LINES_CACHE=new WeakMap();

function totalExpenseNormalize(s){return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function totalExpenseClassHeading(s){
 const t=totalExpenseNormalize(s).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g,'').replace(/(?:\s*\(\d+\))+\s*$/,'').trim();
 const m=/^(?:(?:Series|Class)\s+[A-Z][A-Z0-9-]*|[A-Z][A-Z0-9-]*\s+(?:Shares?|Units?)|(?:ETF|CAD|USD)\s+(?:Series|Units?))\b/i.exec(t);
 if(!m)return null;
 const rest=t.slice(m[0].length).trim();
 return !rest||/^(?:\*+|\(\d+\)|\(\d+\)\s*\(\d+\))$/.test(rest)?m[0].toLowerCase().replace(/\s+/g,' '):null;
}
function totalExpensePageLines(items){
 const result=[];
 for(const it of items||[]){
  if(typeof it.str!=='string'||!it.str.trim()||!Number.isFinite(it.x)||!Number.isFinite(it.y))continue;
  const h=Math.max(5,Number(it.h)||8);
  let line=result.find(l=>Math.abs(l.y-it.y)<Math.max(1.5,Math.min(2.8,h*.25)));
  if(!line){line={y:it.y,items:[]};result.push(line);}
  line.items.push(it);
 }
 for(const l of result){l.items.sort((a,b)=>a.x-b.x);l.text=totalExpenseNormalize(l.items.map(it=>it.str).join(' '));}
 return result.sort((a,b)=>b.y-a.y);
}
function totalExpenseCell(item){
 const raw=String(item.str||'').trim().replace(/\s+/g,'');
 if(/^[-–—−]{1,2}$/.test(raw)||/^n\/?a$/i.test(raw))return {value:null,isMissing:true,raw};
 if(!/^(?:\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)\s*%?$/.test(raw))return null;
 const n=Number(raw.replace(/[,%]/g,''));
 return Number.isFinite(n)&&n>=0&&n<=100?{value:n,isMissing:false,raw}:null;
}
function totalExpenseClassMatches(found,expected){
 const normalize=s=>totalExpenseNormalize(s).toLowerCase().replace(/\s+/g,' ');
 return normalize(found)===normalize(expected);
}
function totalExpenseRatioSource(pages,row){
 const year=Number(String(row?.report_date||'').slice(0,4))||Number(row?.year);
 const className=row?.class_identity||row?.class_name;
 if(!year||year<2000||year>2100||!className)return null;
 const hits=[];
 for(const page of pages||[]){
  if(page?.ocrUsed||!Array.isArray(page?.items)||!page.items.length)continue;
  // Most MRFPs do not publish this metric. Avoid building text geometry
  // repeatedly for every class when the explicit label is not present.
  if(page.text&&!/\btotal\s+expense\s+ratios?\b/i.test(page.text))continue;
  let lines=TOTAL_EXPENSE_LINES_CACHE.get(page);
  if(!lines){lines=totalExpensePageLines(page.items);TOTAL_EXPENSE_LINES_CACHE.set(page,lines);}
  for(let ix=0;ix<lines.length;ix++){
   const metric=lines[ix];
   if(!TOTAL_EXPENSE_RATIO_LABEL.test(metric.text))continue;
   // This must be a named financial-table row, not an explanatory paragraph,
   // a calculated FER, or a before-waivers Total Expense Ratio variant.
   const label=TOTAL_EXPENSE_RATIO_LABEL.exec(metric.text)[0];
   const tail=metric.text.slice(label.length).trim();
   if(/^(?:before|excluding|including|plus|less|and)\b/i.test(tail))continue;
   // Require a physically distinct percentage cell, never a number guessed
   // from a text run containing the entire heading and surrounding prose.
   let accumulated='',labelRight=null;
   for(const it of metric.items){
    accumulated=totalExpenseNormalize(accumulated+' '+it.str);
    if(!TOTAL_EXPENSE_RATIO_LABEL.test(accumulated))continue;
    labelRight=it.x+(Number(it.w)||0);
    break;
   }
   if(!Number.isFinite(labelRight))continue;
   const explicitCells=metric.items.filter(it=>it.x>labelRight+2.5).map(it=>{
    const parsed=totalExpenseCell(it);
    if(!parsed||!Number.isFinite(it.w)||it.w<=0)return null;
    return {...parsed,x:it.x,y:it.y,box:{x:Math.max(0,it.x-1),y:it.y-1,w:it.w+2,h:Math.max(6,it.h||8)+2}};
   }).filter(Boolean);
   if(!explicitCells.length)continue;
   // Determine the NEAREST preceding class or series heading. A different
   // class heading blocks using an identical number from the wrong class.
   const precedingClasses=lines.slice(Math.max(0,ix-45),ix).map(l=>{
    const firstX=l.items[0]?.x??0;
    const headingText=l.items.filter(it=>it.x<firstX+230&&!/^20\d\d$/.test(it.str.trim())).slice(0,6).map(it=>it.str).join(' ');
    return {name:totalExpenseClassHeading(headingText),y:l.y};
   }).filter(x=>x.name&&x.y>metric.y&&x.y-metric.y<310).sort((a,b)=>a.y-b.y);
   if(!precedingClasses.length||!totalExpenseClassMatches(precedingClasses[0].name,className))continue;
   // Require the exact document reporting year printed above the cell in
   // the SAME column. Other-year figures or first-column assumptions fail.
   const printedYears=lines.slice(Math.max(0,ix-45),ix).flatMap(l=>l.items.filter(it=>/^20\d\d$/.test(it.str.trim())&&l.y>metric.y&&l.y-metric.y<310).map(it=>({year:Number(it.str.trim()),x:it.x,y:l.y})));
   for(const cell of explicitCells){
    const yearMarkers=printedYears.filter(it=>Math.abs(it.x-cell.x)<25);
    if(!yearMarkers.length)continue;
    yearMarkers.sort((a,b)=>a.y-b.y);
    // If two year rows share one x, the closest header determines the period.
    if(yearMarkers[0].year!==year)continue;
    hits.push({page:page.page,value:cell.value,box:cell.box,raw:cell.raw,isMissing:cell.isMissing,kind:'strict-total-expense-ratio-cell'});
   }
  }
 }
 // Multiple possible cells are ambiguous. Do not select by number alone.
 return hits.length===1?hits[0]:null;
}
