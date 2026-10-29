const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '../public/toast.js');

test('Уведомления показываются по очереди и закрываются вручную', () => {
  assert.ok(fs.existsSync(target), 'Система уведомлений пока отсутствует');
  const { createToastQueue } = require(target);
  const timers = [];
  function node() {
    return { children: [], textContent:'', className:'', attributes:{}, listeners:{},
      setAttribute(k,v){this.attributes[k]=v;},
      append(...items){this.children.push(...items);},
      replaceChildren(...items){this.children=[...items];},
      addEventListener(k,fn){this.listeners[k]=fn;}
    };
  }
  const document = {createElement:node};
  const region = node();
  const queue = createToastQueue(region, document, {setTimeout(fn){timers.push(fn);return timers.length;}, clearTimeout(){}});
  queue.show('Первое', 'success');
  queue.show('Второе', 'warning');
  assert.equal(region.children.length,1);
  assert.equal(region.children[0].children[0].textContent,'Первое');
  region.children[0].children[1].listeners.click();
  assert.equal(region.children.length,1);
  assert.equal(region.children[0].children[0].textContent,'Второе');
  timers[1]();
  assert.equal(region.children.length,0);
});
