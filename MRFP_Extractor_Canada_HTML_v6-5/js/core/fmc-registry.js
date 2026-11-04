/* Generated-build input: keep declaration order in dev-tools/fmc-manifest.json. */
// Many issuers append an explanatory alias to the printed product title,
// e.g. 'Portfolio (the “Fund”)'. Normalize ONLY a trailing alias, never
// arbitrary report prose or securities mentioned in the holdings section.
function reportTitleLine(raw){
  return String(raw||'').trim().replace(/\s+/g,' ')
    .replace(/\s*\(\s*(?:the|this)\s+[“”"'‘’]?(?:Fund|ETF|Portfolio|Pool)[“”"'‘’]?\s*\)\s*$/i,'')
    .trim();
}
function issuerTitleCandidate(pages,profile){
  const re=profile.title&&new RegExp(profile.title.source,profile.title.flags.replace(/g/g,''));
  const adapter=FMC_ADAPTERS_BY_KEY[profile.key];
  const prefix=adapter?.config?.issuerPrefix;
  const genericEnd=/(?:\bFund|\bPortfolio|\bETF|\bClass|\bPool)(?:[®™]|\.)?$/i;
  for(const pg of pages.slice(0,adapter?.config?.titleScanPages??3)){
    for(const raw of String(pg.text||'').split(/\r?\n/).slice(0,100)){
      const line=reportTitleLine(raw);
      if(line.length<12||line.length>190)continue;
      const m=re&&re.exec(line);
      if(m&&m[1]&&m[0].trim().length===line.length&&m[1].trim().length>=12)
        return {text:m[1].trim(),kind:'profile'};
      // The generic path insists on a complete branded product title, never
      // arbitrary mention of an issuer or a generic manager address.
      if(prefix?.test(line)&&genericEnd.test(line)&&!/(?:management\s+report|fund\s+performance|fund\s+facts|(?:the|this)\s+fund)/i.test(line))
        return {text:line,kind:'branded-title'};
    }
  }
  return null;
}
function detectFmc(pages){
  const head=pages.slice(0,3).map(p=>p.text).join('\n');
  const scores=REGISTRY.map(p=>({profile:p,signatureScore:p.signatures.reduce((s,x,i)=>s+(x.test(head)?(i?2:5):0),0)}));
  const strongOwners=scores.filter(s=>s.signatureScore>=5);
  const sorted=scores.map(({profile,signatureScore})=>{
    // A standalone issuer-branded product title is strong supporting evidence.
    // If a different manager is already strongly identified, don't let a
    // fund mentioned in its portfolio falsely take ownership of the report.
    // A zero-signature issuer cannot win against a different strongly matched manager.
    // Skip the otherwise wasted title scan, retaining identical detection scores.
    const canWin=signatureScore>0||strongOwners.length===0;
    const hasTitle=canWin&&Boolean(issuerTitleCandidate(pages,profile));
    const titleScore=hasTitle&&(signatureScore>0||!strongOwners.some(x=>x.profile.key!==profile.key))?5:0;
    return {profile,score:signatureScore+titleScore};
  }).sort((a,b)=>b.score-a.score);
  return sorted[0].score>=5 && sorted[0].score!==sorted[1]?.score ? sorted[0].profile : null;
}


// ---- src/shared/period.mjs ----
