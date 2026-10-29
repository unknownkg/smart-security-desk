const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function render(camera) {
  const elements = new Map();
  const element = key => {
    if (!elements.has(key)) elements.set(key, {
      value: '', innerHTML: '', textContent: '', disabled: false,
      classList: {add() {}, remove() {}}, addEventListener() {},
      querySelectorAll() { return []; }
    });
    return elements.get(key);
  };
  const context = vm.createContext({
    document: {querySelector: element},
    fetch: () => new Promise(() => {}),
    URL, location: {origin: 'http://localhost:3000'}, console
  });
  vm.runInContext(fs.readFileSync(require.resolve('../public/app.js'), 'utf8'), context);
  context.camera = camera;
  vm.runInContext('state.cameras = [camera]; renderCameras()', context);
  return element('#camera-list').innerHTML;
}

test('Предпросмотр без адреса сообщает, что поток не подключён', () => {
  assert.match(render({id:'CAM-01', name:'Вход', location:'1 этаж', status:'online', previewUrl:''}), /Предпросмотр не подключён/);
});

test('Отключённая камера не загружает поток', () => {
  const html = render({id:'CAM-01', name:'Вход', location:'1 этаж', status:'offline', previewUrl:'https://example.org/video.mp4'});
  assert.match(html, /Камера не в сети/);
  assert.doesNotMatch(html, /<video/);
  assert.doesNotMatch(html, /<a[^>]+href=/);
});

test('Для камеры с адресом создаётся настоящий видеоэлемент', () => {
  const html = render({id:'CAM-01', name:'Вход', location:'1 этаж', status:'online', previewUrl:'https://example.org/video.mp4'});
  assert.match(html, /<video/);
  assert.match(html, /https:\/\/example\.org\/video\.mp4/);
});

test('Локальная запись обозначается как демонстрационная', () => {
  const html = render({id:'CAM-01', name:'Вход', location:'1 этаж', status:'online', previewUrl:'/media/entrance.mp4'});
  assert.match(html, /<video/);
  assert.match(html, /Демонстрационная запись/);
});

test('Недопустимая схема не попадает в ссылку или видео', () => {
  const html = render({id:'CAM-01', name:'Вход', location:'1 этаж', status:'online', previewUrl:'javascript:alert(1)'});
  assert.doesNotMatch(html, /javascript:alert/);
  assert.match(html, /Адрес потока недопустим/);
});
