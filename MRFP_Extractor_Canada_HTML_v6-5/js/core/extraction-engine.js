/* v6 FMC-dispatch extraction. The original fallback and row-shaping behavior are retained. */
function analyzePages(pages,{onProgress=()=>{}}={}){
 const p=detectFmc(pages);
 if(!p)return {results:[],diagnostics:[{warning:'Unrecognized or ambiguous FMC; no financial values guessed.'}],raw:[],profile:null};
 const fund=identifyFund(pages,p);
 const adapter=FMC_ADAPTERS_BY_KEY[p.key];
 const date=adapter?.selectReportDate?adapter.selectReportDate(pages):reportDate(pages);
 let parsed=adapter?adapter.extract(pages,p,fund,date):[];
 if(adapter?.config?.renameEmptyClasses&&!parsed.some(r=>/^(?:CAD|USD) Units$/i.test(r.cls||'')))parsed.forEach(r=>{if(!r.cls)r.cls=fund;});
 if(adapter?.config?.deduplicate)parsed=[...new Map(parsed.map(x=>[x.cls,x])).values()];
 if(!parsed.length&&adapter?.config?.allowRowFallback!==false)parsed=rowTable(pages,p);
 // TER has changed meaning at the office level: the legacy adapters' TER
 // cells are Trading Expense Ratios. Never expose them as Total Expense Ratio.
 // Re-detect only explicitly labelled, class/year-bound TOTAL expense cells.
 const rows=parsed.filter(r=>r.cls&&r.quality>=2).map(r=>{
  const values={...r.values,TER:null},evidence={...r.evidence};
  delete evidence.TER;
  const total=totalExpenseRatioSource(pages,{class_name:r.cls,fund_name:fund,report_date:date});
  if(total){
   values.TER=total.value;
   evidence.TER={page:total.page,source:'Total Expense Ratio (verified class and reporting-year column)',method:'native-js',totalExpenseValidated:true};
  }
  return makeRow(r.cls,p,fund,date,values,evidence,fund==='Unknown Fund',
   r.displayCls?{displayClassName:r.displayCls,classAliases:r.aliases||[]}:null);
 });
 const audit=ratioHeadingAudit(pages,p,parsed);
 const diagnostics=[{fmc_detection:{status:'matched',fmc_key:p.key},report_date:date,extraction_method:'native-js',fund_name:fund,fmc_label:p.label,classes:rows.length,...(audit?{series_completeness:audit}:{})},...pages.map(x=>({page:x.page,mode:x.ocrUsed?'ocr-fallback':'native-pdfjs'}))];
 return {results:rows,diagnostics,raw:[],profile:p};
}
