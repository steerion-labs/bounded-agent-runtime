import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createDashboardServer, dashboardHtml } from '../runtime/dashboard.mjs';

function request(port, path, method='GET') {
  return new Promise((resolve,reject) => {
    const req=http.request({hostname:'127.0.0.1',port,path,method,agent:false,headers:{connection:'close'}},res=>{
      const chunks=[]; res.on('data',chunk=>chunks.push(chunk));
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error',reject); req.end();
  });
}

test('dashboard renders runtime values through textContent only',()=>{
  const page=dashboardHtml();
  assert.match(page,/\.textContent=/);
  assert.doesNotMatch(page,/innerHTML/);
  assert.doesNotMatch(page,/<form\b/i);
  assert.doesNotMatch(page,/<button\b/i);
  assert.match(page,/Evidence timeline/);
  assert.match(page,/Exact candidate/);
});

test('dashboard exposes read-only GET surface and no approval endpoint',async()=>{
  const server=createDashboardServer({port:0});
  await new Promise(resolve=>server.once('listening',resolve));
  try {
    const address=server.address(); assert.ok(address&&typeof address==='object');
    const post=await request(address.port,'/api/status','POST');
    assert.equal(post.status,405); assert.equal(post.headers.allow,'GET');
    const approve=await request(address.port,'/api/approve','GET');
    assert.equal(approve.status,404);
    const page=await request(address.port,'/');
    assert.equal(page.status,200);
    assert.match(page.headers['content-security-policy'],/form-action 'none'/);
    assert.match(page.headers['content-security-policy'],/object-src 'none'/);
  } finally { server.closeAllConnections?.(); await new Promise(resolve=>server.close(resolve)); }
});
