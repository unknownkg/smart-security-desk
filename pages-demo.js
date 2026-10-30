(function(){
'use strict';
const key='ssd-pages-demo-v1',originalFetch=window.fetch.bind(window),now=()=>new Date().toISOString();
const seed=()=>({cameras:[{id:'CAM-01',name:'Главный вход',location:'1 этаж',status:'online',previewUrl:'',updatedAt:now()},{id:'CAM-02',name:'Лаборатория',location:'2 этаж',status:'offline',previewUrl:'',updatedAt:now()}],events:[{id:1,type:'motion',cameraId:'CAM-01',severity:'medium',message:'Демонстрационное событие: обнаружено движение',createdAt:now()}],incidents:[]});
let memory=seed();
function read(){try{const raw=localStorage.getItem(key);if(raw){const db=JSON.parse(raw);if(['cameras','events','incidents'].every(k=>Array.isArray(db[k])))return db}}catch(e){}return JSON.parse(JSON.stringify(memory))}
function write(db){memory=db;try{localStorage.setItem(key,JSON.stringify(db))}catch(e){}}
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}),fail=(message,status)=>reply({error:message},status),filled=x=>typeof x==='string'&&x.trim().length>0;
const nextId=items=>Math.max(Date.now(),...items.map(x=>Number(x.id)||0))+1;
const sorted=items=>items.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
async function handle(url,method,opts){
const db=read(),path=url.pathname;let body={};
if(method!=='GET'){try{body=opts.body?JSON.parse(opts.body):{}}catch(e){return fail('Invalid JSON',400)}}
if(method==='GET'&&path==='/api/health')return reply({status:'ok',service:'smart-security-desk-pages-demo'});
if(method==='GET'&&path==='/api/cameras')return reply(db.cameras);
if(method==='GET'&&path==='/api/events')return reply(sorted(db.events.filter(x=>(!url.searchParams.get('severity')||x.severity===url.searchParams.get('severity'))&&(!url.searchParams.get('cameraId')||x.cameraId===url.searchParams.get('cameraId')))));
if(method==='GET'&&path==='/api/incidents')return reply(sorted(db.incidents.filter(x=>(!url.searchParams.get('status')||x.status===url.searchParams.get('status'))&&(!url.searchParams.get('severity')||x.severity===url.searchParams.get('severity')))));
const camera=path.match(/^\/api\/cameras\/([^/]+)$/);
if(method==='PATCH'&&camera){const item=db.cameras.find(x=>x.id===decodeURIComponent(camera[1]));if(!item)return fail('Camera not found',404);if(!body||!['online','offline'].includes(body.status))return fail('Invalid camera status',400);item.status=body.status;item.updatedAt=now();write(db);return reply(item)}
if(method==='POST'&&path==='/api/events'){const {type,cameraId,severity,message}=body||{};if(![type,cameraId,severity,message].every(filled))return fail('type, cameraId, severity, message are required',400);const item={id:nextId(db.events),type,cameraId,severity,message,createdAt:now()};db.events.push(item);write(db);return reply(item,201)}
if(method==='POST'&&path==='/api/incidents'){const {title,cameraId,severity,description=''}=body||{};if(![title,cameraId,severity].every(filled))return fail('title, cameraId, severity are required',400);if(typeof description!=='string')return fail('Invalid description',400);const date=now(),item={id:nextId(db.incidents),title,cameraId,severity,description,status:'new',assignee:null,createdAt:date,updatedAt:date};db.incidents.push(item);write(db);return reply(item,201)}
const incident=path.match(/^\/api\/incidents\/([^/]+)$/);
if(method==='PATCH'&&incident){const item=db.incidents.find(x=>String(x.id)===decodeURIComponent(incident[1]));if(!item)return fail('Incident not found',404);if(!body||typeof body!=='object')return fail('Invalid JSON',400);if(Object.hasOwn(body,'status')&&!['new','in_progress','resolved'].includes(body.status))return fail('Invalid incident status',400);if(Object.hasOwn(body,'assignee')&&body.assignee!==null&&typeof body.assignee!=='string')return fail('Invalid assignee',400);if(!Object.hasOwn(body,'status')&&!Object.hasOwn(body,'assignee'))return fail('status or assignee is required',400);if(Object.hasOwn(body,'status'))item.status=body.status;if(Object.hasOwn(body,'assignee'))item.assignee=body.assignee;item.updatedAt=now();write(db);return reply(item)}
return fail('Not found',404);
}
window.fetch=(input,opts={})=>{const address=typeof input==='string'?input:input.url;let url;try{url=new URL(address,location.href)}catch(e){return originalFetch(input,opts)}if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return originalFetch(input,opts);const method=String(opts.method||(typeof input!=='string'&&input.method)||'GET').toUpperCase();return handle(url,method,opts)};
document.addEventListener('DOMContentLoaded',()=>{const reset=document.getElementById('demo-reset');if(reset)reset.addEventListener('click',()=>{memory=seed();try{localStorage.removeItem(key)}catch(e){}location.reload()})});
})();