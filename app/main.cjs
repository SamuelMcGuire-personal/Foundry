const {app,BrowserWindow,ipcMain,dialog,shell,clipboard}=require('electron');
const fs=require('fs'),fsp=fs.promises,path=require('path'),crypto=require('crypto');
app.disableHardwareAcceleration();
let win;
const settingsFile=()=>path.join(app.getPath('userData'),'foundry-settings.json');
const startupLogFile=()=>path.join(app.getPath('userData'),'foundry-startup.log');
async function logBoot(stage,detail=''){try{await fsp.mkdir(app.getPath('userData'),{recursive:true});await fsp.appendFile(startupLogFile(),`${new Date().toISOString()} ${stage}${detail?` :: ${detail}`:''}\n`)}catch{}}
async function readJson(f,d){try{return JSON.parse(await fsp.readFile(f,'utf8'))}catch{return d}}
async function writeJson(f,v){await fsp.mkdir(path.dirname(f),{recursive:true});const t=f+'.tmp';await fsp.writeFile(t,JSON.stringify(v,null,2));await fsp.rename(t,f)}
const safe=s=>String(s||'').trim().replace(/[<>:\"/\\|?*\x00-\x1F]/g,'_').replace(/\s+/g,' ').slice(0,100);
async function getSettings(){return readJson(settingsFile(),{home:null,theme:'light'})}
async function setSettings(p){const s=Object.assign(await getSettings(),p);await writeJson(settingsFile(),s);return s}
async function ensureHome(h){for(const d of ['projects','archives','backups','collections','templates'])await fsp.mkdir(path.join(h,d),{recursive:true});const f=path.join(h,'foundry-library.json');if(!fs.existsSync(f))await writeJson(f,{format:'FoundryDesktop1Library',createdAt:new Date().toISOString(),projects:[],collections:[]});return h}
async function home(){const s=await getSettings();return s.home&&fs.existsSync(s.home)?s.home:null}
async function lib(h){return readJson(path.join(h,'foundry-library.json'),{format:'FoundryDesktop1Library',projects:[],collections:[]})}
async function saveLib(h,l){await writeJson(path.join(h,'foundry-library.json'),l)}
const projectDir=(h,p)=>path.join(h,p.status==='archived'?'archives':'projects',safe(p.name));
async function createProject(h,name){const l=await lib(h),n=safe(name);if(!n)throw Error('Project name is required.');if(l.projects.some(p=>p.name.toLowerCase()===n.toLowerCase()))throw Error('That project already exists.');const p={id:crypto.randomUUID(),name:n,status:'active',createdAt:new Date().toISOString()},d=path.join(h,'projects',n);for(const x of ['working','snapshots','conversations'])await fsp.mkdir(path.join(d,x),{recursive:true});await writeJson(path.join(d,'project.json'),{format:'FoundryDesktop1Project',...p});l.projects.push(p);await saveLib(h,l);return p}
async function moveProject(h,id,status){const l=await lib(h),p=l.projects.find(x=>x.id===id);if(!p)throw Error('Project not found.');const old=projectDir(h,p),oldStatus=p.status;p.status=status;const dest=projectDir(h,p);p.status=oldStatus;if(fs.existsSync(old)){if(fs.existsSync(dest))throw Error('Destination already exists.');await fsp.rename(old,dest)}p.status=status;await writeJson(path.join(dest,'project.json'),{format:'FoundryDesktop1Project',...p});await saveLib(h,l);return p}
async function scan(h){if(!h)throw Error('Choose a Foundry Home first.');const l=await lib(h);let added=0;for(const area of ['projects','archives']){for(const e of await fsp.readdir(path.join(h,area),{withFileTypes:true})){if(!e.isDirectory())continue;const pj=await readJson(path.join(h,area,e.name,'project.json'),null);if(pj&&!l.projects.some(p=>p.id===pj.id)){l.projects.push({id:pj.id||crypto.randomUUID(),name:pj.name||e.name,status:area==='archives'?'archived':(pj.status||'active'),createdAt:pj.createdAt||new Date().toISOString()});added++}}}await saveLib(h,l);return{added,library:l}}
async function filesFor(h,id){const l=await lib(h),p=l.projects.find(x=>x.id===id);if(!p)return[];const w=path.join(projectDir(h,p),'working');await fsp.mkdir(w,{recursive:true});const out=[];for(const e of await fsp.readdir(w,{withFileTypes:true})){if(!e.isFile())continue;const full=path.join(w,e.name),b=await fsp.readFile(full),st=await fsp.stat(full);out.push({name:e.name,path:full,size:st.size,hash:crypto.createHash('sha256').update(b).digest('hex')})}return out}
async function importFiles(h,id,srcs){const l=await lib(h),p=l.projects.find(x=>x.id===id);if(!p)throw Error('Project not found.');const w=path.join(projectDir(h,p),'working');await fsp.mkdir(w,{recursive:true});for(const src of srcs){let n=path.basename(src),d=path.join(w,n),i=2,ext=path.extname(n),stem=path.basename(n,ext);while(fs.existsSync(d)){n=`${stem}_${i++}${ext}`;d=path.join(w,n)}await fsp.copyFile(src,d)}return true}
async function snapshot(h,id){const l=await lib(h),p=l.projects.find(x=>x.id===id);if(!p)throw Error('Project not found.');const d=projectDir(h,p),w=path.join(d,'working'),sdir=path.join(d,'snapshots');await fsp.mkdir(sdir,{recursive:true});const s={id:crypto.randomUUID(),createdAt:new Date().toISOString(),message:'Manual snapshot',files:[]};for(const e of await fsp.readdir(w,{withFileTypes:true})){if(!e.isFile())continue;const b=await fsp.readFile(path.join(w,e.name));s.files.push({name:e.name,hash:crypto.createHash('sha256').update(b).digest('hex'),content:b.toString('base64')})}await writeJson(path.join(sdir,s.id+'.json'),s);return s}
async function snapshots(h,id){const l=await lib(h),p=l.projects.find(x=>x.id===id);if(!p)return[];const d=path.join(projectDir(h,p),'snapshots');await fsp.mkdir(d,{recursive:true});const out=[];for(const n of await fsp.readdir(d)){if(n.endsWith('.json')){const s=await readJson(path.join(d,n),null);if(s)out.push(s)}}return out.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
async function restoreSnapshot(h,id,sid){const l=await lib(h),p=l.projects.find(x=>x.id===id);if(!p)throw Error('Project not found.');const d=projectDir(h,p),s=await readJson(path.join(d,'snapshots',sid+'.json'),null);if(!s)throw Error('Snapshot not found.');const w=path.join(d,'working');for(const e of await fsp.readdir(w,{withFileTypes:true}))if(e.isFile())await fsp.unlink(path.join(w,e.name));for(const f of s.files)await fsp.writeFile(path.join(w,f.name),Buffer.from(f.content,'base64'));return true}
async function backup(h){const f=path.join(h,'backups',`Foundry_Library_${new Date().toISOString().replace(/[:.]/g,'-')}.json`);await writeJson(f,{format:'FoundryDesktop1Backup',createdAt:new Date().toISOString(),library:await lib(h)});return f}
function trusted(e){if(!win||e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted IPC sender.')}
function handle(n,fn){ipcMain.handle(n,async(e,...a)=>{trusted(e);return fn(...a)})}
async function createWindow(){
  if(win&&!win.isDestroyed()){win.show();win.focus();return win}
  await logBoot('create-window:start',`electron=${process.versions.electron} arch=${process.arch} platform=${process.platform}`);
  win=new BrowserWindow({width:1450,height:920,minWidth:980,minHeight:680,backgroundColor:'#f4f1e8',show:true,title:'Foundry',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.removeMenu();win.center();win.show();win.focus();
  await logBoot('create-window:visible');
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(e,u)=>{if(!u.startsWith('file:'))e.preventDefault()});
  win.webContents.on('did-finish-load',()=>logBoot('renderer:did-finish-load'));
  win.webContents.on('did-fail-load',(_e,code,desc,url)=>{logBoot('renderer:did-fail-load',`${code} ${desc} ${url}`);dialog.showErrorBox('Foundry could not load',`The Foundry interface failed to load.\n\n${desc} (${code})\n\nStartup log:\n${startupLogFile()}`)});
  win.webContents.on('render-process-gone',(_e,d)=>{logBoot('renderer:gone',`${d.reason} exit=${d.exitCode}`);dialog.showErrorBox('Foundry renderer stopped',`The Foundry renderer stopped: ${d.reason}.\n\nStartup log:\n${startupLogFile()}`)});
  win.on('unresponsive',()=>logBoot('window:unresponsive'));
  win.on('responsive',()=>logBoot('window:responsive'));
  win.on('closed',()=>{win=null});
  try{await win.loadFile(path.join(__dirname,'index.html'));await logBoot('load-file:resolved')}catch(err){await logBoot('load-file:error',err&&err.stack?err.stack:String(err));dialog.showErrorBox('Foundry startup error',`Foundry could not open its interface.\n\n${err.message||err}\n\nStartup log:\n${startupLogFile()}`)}
  return win;
}
app.whenReady().then(async()=>{await logBoot('electron:ready');await createWindow()}).catch(async err=>{await logBoot('electron:ready-error',err&&err.stack?err.stack:String(err));dialog.showErrorBox('Foundry startup error',String(err&&err.message?err.message:err))});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();else{const w=BrowserWindow.getAllWindows()[0];w.show();w.focus()}});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
handle('settings:get',getSettings);handle('settings:set',setSettings);
handle('home:choose',async()=>{const r=await dialog.showOpenDialog(win,{title:'Choose Foundry Home',properties:['openDirectory','createDirectory']});if(r.canceled)return null;const h=await ensureHome(r.filePaths[0]);await setSettings({home:h});return h});
handle('home:open',async()=>{const h=await home();if(h)await shell.openPath(h);return h});handle('home:info',async()=>{const h=await home();return h?{home:h,library:await lib(h)}:{home:null,library:null}});handle('home:scan',async()=>scan(await home()));
handle('project:create',async n=>createProject(await home(),n));handle('project:archive',async id=>moveProject(await home(),id,'archived'));handle('project:restore',async id=>moveProject(await home(),id,'active'));handle('project:list',async()=>{const h=await home();return h?(await lib(h)).projects:[]});
handle('file:list',async id=>filesFor(await home(),id));handle('file:pickImport',async id=>{const r=await dialog.showOpenDialog(win,{title:'Import files',properties:['openFile','multiSelections']});if(r.canceled)return[];return importFiles(await home(),id,r.filePaths)});handle('file:read',async p=>{const b=await fsp.readFile(p);return{text:b.toString('utf8'),binary:b.includes(0)}});
handle('snapshot:create',async id=>snapshot(await home(),id));handle('snapshot:list',async id=>snapshots(await home(),id));handle('snapshot:restore',async(id,sid)=>restoreSnapshot(await home(),id,sid));handle('backup:whole',async()=>backup(await home()));
handle('clipboard:write',async t=>{await clipboard.writeText(String(t||''));return true});handle('clipboard:read',async()=>clipboard.readText());handle('result:import',async()=>{const r=await dialog.showOpenDialog(win,{title:'Import AI result',properties:['openFile'],filters:[{name:'Text/Markdown/JSON',extensions:['txt','md','json']}]});if(r.canceled)return null;return fsp.readFile(r.filePaths[0],'utf8')});
