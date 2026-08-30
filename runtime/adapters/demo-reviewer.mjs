import fs from 'node:fs';
const {candidate}=JSON.parse(fs.readFileSync(0,'utf8'));
if(!candidate?.candidate_sha||!candidate?.tree_hash) {
  process.stdout.write(JSON.stringify({decision:'BLOCK',reason:'missing candidate binding'}));
} else {
  process.stdout.write(JSON.stringify({decision:'APPROVE',reviewed_candidate_sha:candidate.candidate_sha,reviewed_tree_hash:candidate.tree_hash,residual_risks:['demo reviewer process is not a separate OS identity']}));
}
