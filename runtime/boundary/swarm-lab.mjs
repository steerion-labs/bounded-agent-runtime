function str(v,code){if(typeof v!=='string'||!v.trim())throw new Error(code);return v.trim()}
function arr(v,code){if(!Array.isArray(v))throw new Error(code);return v}
const MODES=new Set(['READ_ONLY','DISPOSABLE_WRITE']);
export function createBoundedSwarmLab({task_id,parent_allow=[],agents=[],max_agents=4,max_parallel=2,max_model_calls=8,wall_clock_seconds=300}){
  const taskId=str(task_id,'BOUNDARY_SWARM_TASK_REQUIRED'); const parent=new Set(arr(parent_allow,'BOUNDARY_SWARM_PARENT_ALLOW_INVALID'));
  if(!Number.isInteger(max_agents)||max_agents<1||max_agents>8)throw new Error('BOUNDARY_SWARM_MAX_AGENTS_INVALID');
  if(!Number.isInteger(max_parallel)||max_parallel<1||max_parallel>max_agents)throw new Error('BOUNDARY_SWARM_PARALLEL_INVALID');
  if(!Number.isInteger(max_model_calls)||max_model_calls<1||max_model_calls>64)throw new Error('BOUNDARY_SWARM_CALL_BUDGET_INVALID');
  if(!Number.isInteger(wall_clock_seconds)||wall_clock_seconds<1||wall_clock_seconds>3600)throw new Error('BOUNDARY_SWARM_WALL_CLOCK_INVALID');
  const raw=arr(agents,'BOUNDARY_SWARM_AGENTS_INVALID'); if(raw.length>max_agents)throw new Error('BOUNDARY_SWARM_AGENT_BUDGET_EXCEEDED');
  const ids=new Set(); const normalized=raw.map(a=>{const id=str(a?.id,'BOUNDARY_SWARM_AGENT_ID_REQUIRED');if(ids.has(id))throw new Error('BOUNDARY_SWARM_AGENT_DUPLICATE');ids.add(id);
    const role=str(a?.role,'BOUNDARY_SWARM_AGENT_ROLE_REQUIRED');const mode=a?.workspace_mode||'READ_ONLY';if(!MODES.has(mode))throw new Error('BOUNDARY_SWARM_WORKSPACE_MODE_INVALID');
    const allow=arr(a?.allow||[],'BOUNDARY_SWARM_AGENT_ALLOW_INVALID');for(const p of allow)if(!parent.has(p))throw new Error('BOUNDARY_SWARM_AUTHORITY_EXPANSION');
    if(mode==='READ_ONLY'&&allow.length)throw new Error('BOUNDARY_SWARM_READ_ONLY_ALLOW_FORBIDDEN');
    return Object.freeze({id,role,workspace_mode:mode,allow:Object.freeze([...allow]),authority:'INHERITED_SUBSET_ONLY',may_expand_authority:false,may_approve:false,may_merge:false,may_deploy:false});});
  return Object.freeze({task_id:taskId,mode:'LAB_ONLY',agents:Object.freeze(normalized),max_agents,max_parallel,max_model_calls,wall_clock_seconds,parent_allow:Object.freeze([...parent]),authority:'NONE',coordinator_may_execute:false,swarm_consensus_may_approve:false,background_workers:false,credentials:'NONE'});
}
export function assertSwarmLabSafe(s){if(!s||s.mode!=='LAB_ONLY'||s.authority!=='NONE'||s.coordinator_may_execute!==false||s.swarm_consensus_may_approve!==false||s.background_workers!==false||s.credentials!=='NONE')throw new Error('BOUNDARY_SWARM_CONTRACT_REQUIRED');return true}
