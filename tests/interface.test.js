const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const elements = new Map();
  function element(key) {
    if (!elements.has(key)) elements.set(key, {value:'', textContent:'', innerHTML:'', hidden:false, disabled:false, listeners:{}, classList:{add(){},remove(){}}, addEventListener(type, handler){this.listeners[type]=handler;}, querySelectorAll(){return []}});
    return elements.get(key);
  }
  const context = vm.createContext({document:{querySelector:element}, fetch:()=>new Promise(()=>{}), URL, location:{origin:'http://localhost:3000'}, console});
  vm.runInContext(fs.readFileSync(require.resolve('../public/app.js'),'utf8'),context);
  return {context, element};
}

test('Карточка инцидента позволяет назначить ответственного без исполнения HTML', () => {
  const {context,element}=setup();
  context.item={id:1,title:'<img src=x onerror=alert(1)>',cameraId:'CAM-01',severity:'high',status:'new',assignee:'<script>'};
  vm.runInContext('state.incidents=[item];renderIncidents(state.incidents)',context);
  const html=element('#incident-list').innerHTML;
  assert.match(html,/name="assignee"/);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<img src=x/);
});

test('Журнал событий фильтруется по камере и важности', () => {
  const {context,element}=setup();
  context.events=[{cameraId:'CAM-01',severity:'high',message:'Первое'}, {cameraId:'CAM-02',severity:'low',message:'Второе'}];
  element('#event-camera-filter').value='CAM-01';
  element('#event-severity-filter').value='high';
  vm.runInContext('state.events=events;renderEvents()',context);
  assert.match(element('#event-list').innerHTML,/Первое/);
  assert.doesNotMatch(element('#event-list').innerHTML,/Второе/);
});

test('Обновление статуса не стирает несохранённого ответственного', () => {
  const {context, element} = setup();
  context.item = {id: 1, title: 'Инцидент', cameraId: 'CAM-01', severity: 'high', status: 'new', assignee: null};
  vm.runInContext('state.incidents=[item];renderIncidents(state.incidents)', context);
  const list = element('#incident-list');
  const form = {dataset: {id: '1'}, elements: {assignee: {value: 'Черновик <оператора>', dataset: {savedAssignee: ''}}}};
  list.querySelectorAll = () => [form];
  vm.runInContext('item.status="in_progress";renderIncidents(state.incidents)', context);
  assert.match(list.innerHTML, /value="Черновик &lt;оператора&gt;"/);
});

test('Неизменённое поле показывает новое значение с сервера', () => {
  const {context, element} = setup();
  context.item = {id: 1, title: 'Инцидент', cameraId: 'CAM-01', severity: 'high', status: 'new', assignee: 'Прежний'};
  vm.runInContext('state.incidents=[item];renderIncidents(state.incidents)', context);
  element('#incident-list').querySelectorAll = () => [{dataset: {id: '1'}, elements: {assignee: {value: 'Прежний', dataset: {savedAssignee: 'Прежний'}}}}];
  vm.runInContext('item.assignee="Новый";renderIncidents(state.incidents)', context);
  assert.match(element('#incident-list').innerHTML, /value="Новый"/);
});

test('После сохранения черновик ответственного не скрывает будущие серверные изменения', async () => {
  const {context, element} = setup();
  context.item = {id: 1, title: 'Инцидент', cameraId: 'CAM-01', severity: 'high', status: 'new', assignee: null};
  vm.runInContext('state.incidents=[item];renderIncidents(state.incidents)', context);
  const input = {value: 'Сохранено', dataset: {savedAssignee: ''}};
  const form = {dataset: {id: '1'}, elements: {assignee: input}, querySelector: () => ({disabled: false})};
  form.closest = () => form;
  element('#incident-list').querySelectorAll = () => [form];
  vm.runInContext('api=async()=>({});refresh=async()=>{item.assignee="Сохранено";renderIncidents(state.incidents);return true};showSuccess=()=>{}', context);
  await element('#incident-list').listeners.submit({target: form, preventDefault(){}});
  vm.runInContext('item.assignee="Новое значение";renderIncidents(state.incidents)', context);
  assert.match(element('#incident-list').innerHTML, /value="Новое значение"/);
});
