function arr(value, code) { if (!Array.isArray(value)) throw new Error(code); return value; }
function str(value, code) { if (typeof value !== 'string' || !value.trim()) throw new Error(code); return value.trim(); }
function stringList(value, code) { return arr(value, code).map(item => str(item, code)); }
function topo(nodes) { const byId = new Map(nodes.map(n => [n.id, n])); const state = new Map(); const order = [];
  function visit(id) { const s = state.get(id); if (s === 'visiting') throw new Error('BOUNDARY_PLAN_CYCLE'); if (s === 'done') return; state.set(id, 'visiting'); const node = byId.get(id);
    for (const dep of node.depends_on) { if (!byId.has(dep)) throw new Error('BOUNDARY_PLAN_DEPENDENCY_UNKNOWN'); visit(dep); } state.set(id, 'done'); order.push(id); }
  for (const node of nodes) visit(node.id); return order; }
export function createBoundedPlan({ task_id, parent_allow = [], nodes = [], max_nodes = 12 }) {
  const taskId = str(task_id, 'BOUNDARY_PLAN_TASK_REQUIRED');
  const parentList = stringList(parent_allow, 'BOUNDARY_PLAN_PARENT_ALLOW_INVALID');
  const parent = new Set(parentList); if (parent.size !== parentList.length) throw new Error('BOUNDARY_PLAN_PARENT_ALLOW_DUPLICATE');
  const rawNodes = arr(nodes, 'BOUNDARY_PLAN_NODES_INVALID'); if (!Number.isInteger(max_nodes) || max_nodes < 1 || rawNodes.length > max_nodes) throw new Error('BOUNDARY_PLAN_BUDGET_EXCEEDED');
  const ids = new Set(); const normalized = rawNodes.map(raw => { const id = str(raw?.id, 'BOUNDARY_PLAN_NODE_ID_REQUIRED'); if (ids.has(id)) throw new Error('BOUNDARY_PLAN_NODE_DUPLICATE'); ids.add(id);
    const allow = stringList(raw.allow || [], 'BOUNDARY_PLAN_NODE_ALLOW_INVALID'); for (const permission of allow) if (!parent.has(permission)) throw new Error('BOUNDARY_PLAN_AUTHORITY_EXPANSION');
    const dependsOn = stringList(raw.depends_on || [], 'BOUNDARY_PLAN_DEPENDENCIES_INVALID'); if (new Set(dependsOn).size !== dependsOn.length) throw new Error('BOUNDARY_PLAN_DEPENDENCY_DUPLICATE');
    const verify = stringList(raw.verify || [], 'BOUNDARY_PLAN_VERIFY_INVALID'); if (verify.length === 0) throw new Error('BOUNDARY_PLAN_VERIFICATION_REQUIRED');
    return Object.freeze({ id, goal: str(raw.goal, 'BOUNDARY_PLAN_NODE_GOAL_REQUIRED'), depends_on: Object.freeze(dependsOn), allow: Object.freeze(allow), verify: Object.freeze(verify), authority:'INHERITED_SUBSET_ONLY', may_expand_authority:false, completion_requires_verification:true }); });
  const order = topo(normalized); return Object.freeze({ task_id:taskId, nodes:Object.freeze(normalized), order:Object.freeze(order), parent_allow:Object.freeze(parentList), authority:'NONE', planner_may_execute:false, planner_may_approve:false });
}
