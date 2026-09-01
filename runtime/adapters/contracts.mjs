export function buildAgentInvocation({adapter,role,task,workspace,prompt,generic=null}) {
  const config=task.workers?.[role] ?? {adapter};
  if(adapter==='codex') { const isolation=role==='builder'?['--ignore-rules']:['--ignore-user-config','--ignore-rules']; return {command:'codex',args:['exec','--sandbox',role==='builder'?'workspace-write':'read-only','--ephemeral',...isolation,'--color','never','-C',workspace,...(config.model?['--model',config.model]:[]),prompt]}; }
  if(adapter==='claude') {
    const tools=role==='builder'?'Read,Edit,Write,Glob,Grep':'Read,Glob,Grep';
    return {command:'claude',args:['-p','--safe-mode','--no-session-persistence','--output-format','text','--permission-mode',role==='builder'?'acceptEdits':'plan','--disable-slash-commands','--strict-mcp-config','--tools',tools,...(config.model?['--model',config.model]:[])],input:prompt};
  }
  if(adapter==='opencode') return {command:'opencode',args:['run','--pure','--dir',workspace,...(config.model?['--model',config.model]:[]),prompt]};
  if(adapter==='ollama') {
    if(role!=='reviewer') throw new Error('ADAPTER_ROLE_UNSUPPORTED:ollama:builder');
    if(!config.model) throw new Error('OLLAMA_MODEL_REQUIRED');
    return {command:'ollama',args:['run',config.model,prompt]};
  }
  if(adapter==='generic') {
    if(!generic?.executable||!Array.isArray(generic.args)) throw new Error('GENERIC_ADAPTER_CONFIG_REQUIRED');
    return {command:generic.executable,args:[...generic.args,prompt]};
  }
  throw new Error(`ADAPTER_UNKNOWN:${adapter}`);
}
export function parseReviewOutput(text) {
  const trimmed=String(text||'').trim(); const candidates=[trimmed];
  const fenced=trimmed.match(/```(?:json)?\s*([\s\S]*?)```/gi)??[];
  for(const block of fenced)candidates.push(block.replace(/^```(?:json)?\s*/i,'').replace(/```$/i,'').trim());
  for(let index=trimmed.lastIndexOf('{');index>=0;){candidates.push(trimmed.slice(index));if(index===0)break;index=trimmed.lastIndexOf('{',index-1);}
  for(const value of candidates){
    try{
      const parsed=JSON.parse(value); if(!['APPROVE','BLOCK'].includes(parsed.decision))continue;
      return {decision:parsed.decision,reason:typeof parsed.reason==='string'?parsed.reason:'',residual_risks:Array.isArray(parsed.residual_risks)?parsed.residual_risks.map(String).slice(0,20):[]};
    }catch{}
  }
  throw new Error('REVIEWER_INVALID_JSON');
}
