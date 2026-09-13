// Check copied examples against exact runtime/extension archives, using local resources.
import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {mkdtemp, cp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';

const root=fileURLToPath(new URL('..', import.meta.url));
const [runtimeArg, ...selected]=process.argv.slice(2);
if (!runtimeArg) throw new Error('Usage: node t.js/qualify-examples.mjs RUNTIME_TARBALL [EXAMPLE ...]');
const runtime=resolve(runtimeArg);
const names=selected.length ? selected : ['storage','d1-sessions','secrets-store','durable-objects','hyperdrive','hyperdrive-mysql'];
const allowed=new Set(['storage','d1-sessions','secrets-store','durable-objects','hyperdrive','hyperdrive-mysql']);
assert.ok(names.every(name=>allowed.has(name)), 'Unknown example');
const directory=await mkdtemp(join(tmpdir(),'webdyne-examples-'));
const cache=join(directory,'cache');
const wrangler=join(root,'node_modules/wrangler/bin/wrangler.js');
let server;
let log='';
let base;
const execute=(cmd,args,cwd,extra={})=>execFileSync(cmd,args,{cwd,encoding:'utf8',env:{...process.env,npm_config_cache:cache,XDG_CONFIG_HOME:join(directory,'config'),WRANGLER_SEND_METRICS:'false',...extra},maxBuffer:16*1024*1024});
async function stop(){
    if(server&&server.exitCode===null){const done=once(server,'exit');server.kill('SIGTERM');await done;}
    server=undefined;
}
async function start(cwd,extra){
    log='';
    server=spawn(process.execPath,[wrangler,'dev','--config','.webdyne/wrangler.jsonc','--port','0','--inspector-port','0'],{cwd,env:{...process.env,XDG_CONFIG_HOME:join(directory,'config'),WRANGLER_SEND_METRICS:'false',...extra},stdio:['ignore','pipe','pipe']});
    for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{log+=chunk;});
    for(let attempt=0;attempt<300;attempt++){
        const match=log.match(/Ready on (http:\/\/[^\s\x1b]+)/);
        if(match){base=match[1];return;}
        if(server.exitCode!==null)throw new Error(log);
        await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error(`Server startup timeout: ${log}`);
}
async function request(path='/',options={}){
    const response=await fetch(base+path,{...options,signal:AbortSignal.timeout(30000)});
    const body=await response.text();
    assert.equal(response.status,200,body);
    return {response,body};
}
const post=body=>({method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
try{
    const [packed]=JSON.parse(execute('npm',['pack','--json','--ignore-scripts','--pack-destination',directory],root));
    for(const name of names){
        const cwd=join(directory,name);
        await cp(join(root,'examples',name),cwd,{recursive:true,filter:source=>!['node_modules','.wrangler','.webdyne'].includes(source.split('/').at(-1))});
        const pkg=JSON.parse(await readFile(join(cwd,'package.json')));
        pkg.dependencies={'@webdyne/webdyne-zeroperl-5.44.0':runtime,'@webdyne/webdyne-cloudflare':join(directory,packed.filename)};
        const database=name.startsWith('hyperdrive');
        const url=process.env[name==='hyperdrive'?'WEBDYNE_POSTGRES_TEST_URL':'WEBDYNE_MYSQL_TEST_URL'];
        const extra=database ? {CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB:url||(name==='hyperdrive'?'postgres://test:test@127.0.0.1:5432/test':'mysql://test:test@127.0.0.1:3306/test')} : {};
        if(database)pkg.webdyne.cloudflare.hyperdrive[0].id='0'.repeat(32);
        await writeFile(join(cwd,'package.json'),JSON.stringify(pkg,null,2));
        execute('npm',['install','--ignore-scripts'],cwd);
        execute('npm',['run','check'],cwd,extra);
        if(name==='storage')execute(process.execPath,[wrangler,'d1','execute','DB','--local','--config','.webdyne/wrangler.jsonc','--file','schema.sql'],cwd);
        if(name==='secrets-store')execute(process.execPath,[wrangler,'secrets-store','secret','create','0'.repeat(32),'--name','webdyne-local-demo','--scopes','workers','--value','webdyne-test-dummy-do-not-render','--config','.webdyne/wrangler.jsonc'],cwd);
        if(database&&!url){
            pkg.webdyne.entry='app.pagi';
            await writeFile(join(cwd,'package.json'),JSON.stringify(pkg,null,2));
            execute('npm',['run','check'],cwd,extra);
            console.log(`${name}: both entry builds/dry runs PASS; database HTTP checks SKIPPED (no test URL)`);
            continue;
        }
        await start(cwd,extra);
        let {body,response}=await request();
        assert.match(response.headers.get('content-type'),/text\/html/);
        if(name==='storage'){
            assert.match(body,/Payload bytes/);
            assert.equal(JSON.parse((await request('/d1-api/row/1')).body).found,true);
            assert.equal(JSON.parse((await request('/d1-api/row/999999')).body).found,false);
            for(const service of ['kv','r2']){
                await request(`/${service}.psp`);
                assert.match((await request(`/${service}.psp`,post('save=1'))).body,/Hello from WebDyne/);
            }
        }else if(name==='d1-sessions'){
            assert.match(body,/Query value: 7/);
            const bookmark=response.headers.get('x-d1-bookmark')||'';
            assert.match((await request('/',post(`bookmark=${encodeURIComponent(bookmark)}`))).body,/Query value: 7/);
        }else if(name==='secrets-store'){
            assert.match(body,/Secret retrieval succeeded/);
            assert.ok(!body.includes('webdyne-test-dummy-do-not-render'));
            assert.ok(response.headers.get('cache-control').split(',').map(value=>value.trim()).includes('no-store'));
        }else if(name==='durable-objects'){
            assert.match(body,/Counter value: 0/);
            assert.match((await request('/',post('increment=1'))).body,/Counter value: 1/);
        }else{
            assert.match(body,/Club dinner/);
            assert.match(body,/&lt;script&gt;/);
            assert.ok(!body.includes('<script>'));
        }
        await stop();
        if(name!=='storage'){
            pkg.webdyne.entry='app.pagi';
            await writeFile(join(cwd,'package.json'),JSON.stringify(pkg,null,2));
            execute('npm',['run','check'],cwd,extra);
            await start(cwd,extra);
            const results=await Promise.all(Array.from({length:4},()=>request()));
            for(const result of results){
                if(name==='secrets-store'){
                    assert.equal(result.body,'Secret retrieval succeeded\n');
                    assert.equal(result.response.headers.get('cache-control'),'no-store');
                }else if(name==='d1-sessions'){
                    assert.equal(JSON.parse(result.body).results[0].value,7);
                }else if(name==='durable-objects')assert.equal(JSON.parse(result.body).value,1);
                else assert.ok(JSON.parse(result.body).some(row=>row.name.includes('Club dinner')));
            }
            if(name==='d1-sessions'){
                const bookmark=results[0].response.headers.get('x-d1-bookmark');
                assert.equal(JSON.parse((await request('/',{headers:bookmark?{'x-d1-bookmark':bookmark}:{}})).body).results[0].value,7);
            }
            if(name==='durable-objects')assert.equal(JSON.parse((await request('/',{method:'POST'})).body).value,2);
            await stop();
        }
        console.log(`${name}: WebDyne and applicable native PAGI build/dry run/HTTP checks PASS`);
    }
}catch(error){console.error(log);throw error;}
finally{await stop();await rm(directory,{recursive:true,force:true});}
