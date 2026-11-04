#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const manifest=JSON.parse(read('dev-tools/fmc-manifest.json'));
const uniq=new Set(manifest.map(x=>x.key));if(uniq.size!==manifest.length)throw Error('Duplicate FMC keys');
const section=(txt,a,b)=>{
 const start='// @mrfp:'+a+'\n',end='// @mrfp:'+b+'\n';
 const i=txt.indexOf(start),j=txt.indexOf(end,i+start.length);
 if(i<0||j<0)throw Error('Missing section '+a+' / '+b);
 return txt.slice(i+start.length,j);
};
const fmc=manifest.map(entry=>{
 if(!entry.key||!entry.profile||!entry.extract||!/^js\/fmc\/[a-z0-9_]+\.js$/.test(entry.file))throw Error('Invalid FMC manifest entry: '+JSON.stringify(entry));
 const txt=read(entry.file);
 for(const mark of ['profile','extraction','evidence'])if(!txt.includes('// @mrfp:'+mark+'\n'))throw Error('Adapter section missing: '+entry.file+' '+mark);
 return {entry,txt};
});
const profiles=fmc.map(({txt})=>section(txt,'profile','extraction'));
const extract=fmc.map(({txt})=>section(txt,'extraction','evidence'));
const evidence=fmc.map(({txt})=>txt.slice(txt.indexOf('// @mrfp:evidence\n')+'// @mrfp:evidence\n'.length));
const handler=(entry,kind)=>fmc.find(f=>f.entry.key===entry.key).txt.includes('function '+kind+'_'+entry.key+'(')?kind+'_'+entry.key:'null';
const config=(entry)=>new RegExp('\\bconst\\s+fmcConfig_'+entry.key+'\\s*=').test(fmc.find(f=>f.entry.key===entry.key).txt)?'fmcConfig_'+entry.key:'null';
const bindings=manifest.map(x=>`{key:${JSON.stringify(x.key)},profile:${x.profile},extract:${x.extract},config:${config(x)},identifyFundEarly:${handler(x,'identifyFundEarly')},identifyFundLate:${handler(x,'identifyFundLate')},identifyFundFallback:${handler(x,'identifyFundFallback')},selectReportDate:${handler(x,'selectReportDate')},auditRatioHeadings:${handler(x,'auditRatioHeadings')}}`).join(',\n');
const classBindings=manifest.filter(x=>fmc.find(f=>f.entry.key===x.key).txt.includes('function classHeading_'+x.key+'('))
  .map(x=>`[${x.profile}.style,classHeading_${x.key}]`).join(',');
const registered=`\nconst FMC_ADAPTERS=[\n${bindings}\n];\nconst FMC_ADAPTERS_BY_KEY=Object.fromEntries(FMC_ADAPTERS.map(x=>[x.key,x]));\nconst FMC_CLASS_HEADING_BY_STYLE=Object.fromEntries([${classBindings}]);\nconst REGISTRY=FMC_ADAPTERS.map(x=>x.profile);\n`;
const prefix='/* GENERATED from js/core + js/fmc via dev-tools/build.cjs. DO NOT EDIT DIRECTLY. Browser file:// safe. */\n(function(global){\n\'use strict\';\n';
const engine=prefix+read('js/core/shared-utils.js')+ '\n'+profiles.join('\n')+'\n'+extract.join('\n')+'\n'+registered+read('js/core/fmc-registry.js')+read('js/core/extraction-engine.js')+'\nglobal.MRFP_ENGINE={analyzePages,detectFmc,reportDate,REGISTRY,groupLines:undefined};\n})(globalThis);\n';
const fmcPrimary=fmc.filter(({entry,txt})=>txt.includes('function locateCell_'+entry.key+'(')).map(({entry})=>JSON.stringify(entry.key)+':locateCell_'+entry.key).join(',');
const fmcGap=fmc.filter(({entry,txt})=>txt.includes('function locateGap_'+entry.key+'(')).map(({entry})=>JSON.stringify(entry.key)+':locateGap_'+entry.key).join(',');
// Evidence freshness policies live beside each adapter's evidence strategies.
// A new manager needs only its own adapter and one manifest entry.
const evidencePolicies=fmc.filter(({entry,txt})=>new RegExp('\\bconst\\s+evidencePolicy_'+entry.key+'\\s*=').test(txt))
  .map(({entry})=>JSON.stringify(entry.key)+':evidencePolicy_'+entry.key).join(',');
const documentChecks=fmc.filter(({entry,txt})=>txt.includes('function validateDocumentEvidence_'+entry.key+'(')).map(({entry})=>JSON.stringify(entry.key)+':validateDocumentEvidence_'+entry.key).join(',');
const evidenceLayouts=fmc.filter(({entry,txt})=>new RegExp('\\bconst\\s+evidenceLayout_'+entry.key+'\\s*=').test(txt))
  .map(({entry})=>JSON.stringify(entry.key)+':evidenceLayout_'+entry.key).join(',');
const annualValidators=fmc.filter(({entry,txt})=>txt.includes('function validateAnnualEtfRow_'+entry.key+'('))
  .map(({entry})=>JSON.stringify(entry.key)+':validateAnnualEtfRow_'+entry.key).join(',');
const ratioHeaderHandlers=fmc.filter(({entry,txt})=>txt.includes('function ratioHeader_'+entry.key+'('))
  .map(({entry})=>JSON.stringify(entry.key)+':ratioHeader_'+entry.key).join(',');
const locator=prefix+read('js/core/evidence-utils.js')+'\n'+evidence.join('\n')
 +'\nconst FMC_EVIDENCE_HANDLERS={'+fmcPrimary+'};\nconst FMC_GAP_HANDLERS={'+fmcGap+'};'
 +'\nconst FMC_EVIDENCE_POLICIES={'+evidencePolicies+'};\nconst FMC_DOCUMENT_IDENTITIES={'+documentChecks+'};\nconst FMC_EVIDENCE_LAYOUTS={'+evidenceLayouts+'};\nconst FMC_ANNUAL_ETF_VALIDATORS={'+annualValidators+'};\nconst FMC_RATIO_HEADER_HANDLERS={'+ratioHeaderHandlers+'};\nconst GAP_FMCS=new Set(Object.keys(FMC_GAP_HANDLERS));\n'+read('js/core/evidence-engine.js')
 +'\nglobal.MRFP_EVIDENCE={GAP_FMCS:[...GAP_FMCS],LOCATOR_VERSION,needsRefresh,emptyRecord,locateLastGap,locate,locateInPage,textLines,numbers,missingMarks,cells,sourcePages,initialPage};\n})(globalThis);\n';
// Validate both output bundles before writing either file; a failed build must
// never leave users with mismatched old/new extraction and evidence bundles.
const outputs=[['js/engine.js',engine],['js/evidence-locator.js',locator]];
for(const [name,code] of outputs)new vm.Script(code,{filename:name});
for(const [name,code] of outputs){
 fs.writeFileSync(path.join(root,name),code);
 console.log(name,Buffer.byteLength(code),'bytes');
}
console.log('Registered FMC adapters:',manifest.length);
