const $ = (selector) => document.querySelector(selector);
const state = { cameras: [], events: [], incidents: [] };
let hasLoaded = false;
const statusLabels = { new: 'Новый', in_progress: 'В работе', resolved: 'Решён' };
const severityLabels = { low: 'Низкая', medium: 'Средняя', high: 'Высокая' };
const eventLabels = { motion: 'Движение', door_open: 'Открытие двери', smoke: 'Дым', camera_offline: 'Камера недоступна' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function formatDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : 'Время не указано';
}

function safePreviewUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  let data;
  try { data = await response.json(); } catch { throw new Error(`Сервер вернул некорректный ответ (${response.status}).`); }
  if (!response.ok) throw new Error(data.error || `Ошибка сервера (${response.status}).`);
  return data;
}

function showError(error) {
  const messages = {
    'Camera not found': 'Камера не найдена.',
    'Invalid camera status': 'Недопустимое состояние камеры.',
    'Incident not found': 'Инцидент не найден.',
    'Invalid incident status': 'Недопустимый статус инцидента.',
    'Invalid assignee': 'Недопустимый ответственный.',
    'status or assignee is required': 'Укажи статус или ответственного.',
    'Invalid description': 'Недопустимое описание.',
    'title, cameraId, severity are required': 'Укажи название, камеру и важность инцидента.',
    'type, cameraId, severity, message are required': 'Укажи тип, камеру, важность и сообщение события.',
    'Invalid JSON': 'Некорректный формат запроса.',
    'Internal server error': 'Внутренняя ошибка сервера.',
    'Failed to fetch': 'Не удалось связаться с сервером.'
  };
  notifications.show(messages[error.message] || (/[а-яё]/i.test(error.message || '') ? error.message : 'Не удалось выполнить запрос.'), 'error');
}
function showSuccess(message) { notifications.show(message, 'success'); }

function renderCameras() {
  $('#camera-count').textContent = state.cameras.length;
  $('#kpi-online').textContent = `${state.cameras.filter((camera) => camera.status === 'online').length} / ${state.cameras.length}`;
  $('#kpi-offline').textContent = state.cameras.filter((camera) => camera.status === 'offline').length;
  const select = $('#incident-camera');
  const selected = select.value;
  select.innerHTML = '<option value="">Выберите камеру</option>' + state.cameras.map((camera) => `<option value="${escapeHtml(camera.id)}">${escapeHtml(camera.id)} · ${escapeHtml(camera.name)}</option>`).join('');
  select.value = selected;
  const eventSelect = $('#event-camera-filter');
  const eventSelected = eventSelect.value;
  eventSelect.innerHTML = '<option value="">Все камеры</option>' + state.cameras.map((camera) => `<option value="${escapeHtml(camera.id)}">${escapeHtml(camera.id)} · ${escapeHtml(camera.name)}</option>`).join('');
  eventSelect.value = eventSelected;
  const list = $('#camera-list');
  list.innerHTML = state.cameras.length ? state.cameras.map((camera) => {
    const online = camera.status === 'online';
    const preview = safePreviewUrl(camera.previewUrl);
    const demoRecording = preview && new URL(preview).origin === location.origin && /^\/media\/.*\.(mp4|webm|ogg)$/i.test(new URL(preview).pathname);
    const stateTitle = !online ? 'Камера не в сети' : preview ? 'Подключение к источнику видео' : camera.previewUrl ? 'Предпросмотр недоступен' : 'Предпросмотр не подключён';
    const stateDetail = !online ? 'Проверьте состояние устройства' : preview ? 'Ожидание видеоданных' : camera.previewUrl ? 'Допустимы адреса HTTP и HTTPS' : 'Адрес видеопотока не указан';
    return `<article class="camera-card"><div class="camera-view"><span class="camera-id">${escapeHtml(camera.id)}</span><span class="preview-indicator" hidden>${demoRecording ? 'Демонстрационная запись' : 'Поток доступен'}</span>${online && preview ? `<video controls muted playsinline preload="metadata" data-src="${escapeHtml(preview)}" aria-label="Поток камеры ${escapeHtml(camera.name)}"></video>` : ''}<div class="preview-state${camera.previewUrl && !preview && online ? ' unavailable' : ''}" role="status"><span class="preview-icon" aria-hidden="true">▧</span><strong>${stateTitle}</strong><span>${stateDetail}</span></div></div><div class="camera-body"><div class="camera-title"><h3>${escapeHtml(camera.name)}</h3><span class="badge ${online ? 'online' : 'offline'}">● ${online ? 'В сети' : 'Не в сети'}</span></div><p>${escapeHtml(camera.location)}</p></div><div class="camera-actions"><button type="button" class="text-button camera-toggle" data-id="${escapeHtml(camera.id)}" data-status="${online ? 'offline' : 'online'}">${online ? 'Отметить не в сети' : 'Отметить в сети'}</button>${online && preview ? `<a class="text-link" href="${escapeHtml(preview)}" target="_blank" rel="noopener noreferrer">Открыть поток ↗</a>` : `<span class="muted">${online ? (camera.previewUrl ? 'Адрес потока недопустим' : 'Поток не указан') : 'Камера не в сети'}</span>`}</div></article>`;
  }).join('') : '<div class="empty">Камер пока нет.</div>';
  list.querySelectorAll('video[data-src]').forEach((video) => {
    const status = video.parentElement.querySelector('.preview-state');
    const indicator = video.parentElement.querySelector('.preview-indicator');
    const setAvailable = () => { status.hidden = true; video.hidden = false; indicator.hidden = false; };
    video.addEventListener('loadeddata', setAvailable);
    video.addEventListener('canplay', setAvailable);
    video.addEventListener('error', () => {
      video.hidden = true;
      indicator.hidden = true;
      status.hidden = false;
      status.classList.add('unavailable');
      status.querySelector('strong').textContent = 'Предпросмотр недоступен';
      status.querySelector('span:last-child').textContent = 'Проверьте адрес и поддержку формата браузером';
    });
    video.src = video.dataset.src;
  });
}

function renderEvents() {
  const camera = $('#event-camera-filter').value;
  const severity = $('#event-severity-filter').value;
  const items = state.events.filter((event) => (!camera || event.cameraId === camera) && (!severity || event.severity === severity));
  $('#event-count').textContent = items.length;
  $('#kpi-events').textContent = state.events.length;
  $('#event-list').innerHTML = items.length ? items.map((event) => `<article class="event"><div class="event-icon" aria-hidden="true">⌁</div><div><h3>${escapeHtml(event.message || eventLabels[event.type] || event.type)}</h3><p>${escapeHtml(eventLabels[event.type] || event.type)} · ${escapeHtml(event.cameraId)}</p></div><div class="event-meta"><span class="badge ${['low', 'medium', 'high'].includes(event.severity) ? event.severity : ''}">${escapeHtml(severityLabels[event.severity] || event.severity)}</span><time datetime="${escapeHtml(event.createdAt)}">${escapeHtml(formatDate(event.createdAt))}</time></div></article>`).join('') : `<div class="empty">${state.events.length ? 'Событий по выбранным фильтрам нет.' : 'Событий пока нет.'}</div>`;
}

function renderIncidents(items) {
  $('#incident-count').textContent = items.length;
  $('#kpi-incidents').textContent = state.incidents.filter((item) => item.status === 'new' || item.status === 'in_progress').length;
  $('#incident-list').innerHTML = items.length ? items.map((item) => `<article class="incident ${['low', 'medium', 'high'].includes(item.severity) ? item.severity : ''}"><div class="incident-content"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.cameraId)} · ${escapeHtml(formatDate(item.createdAt))}${item.assignee ? ` · Ответственный: ${escapeHtml(item.assignee)}` : ''}</p>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}<div class="badges"><span class="badge ${['low', 'medium', 'high'].includes(item.severity) ? item.severity : ''}">${escapeHtml(severityLabels[item.severity] || item.severity)}</span><span class="badge ${['new', 'in_progress', 'resolved'].includes(item.status) ? item.status : ''}">${escapeHtml(statusLabels[item.status] || item.status)}</span></div><div class="incident-controls"><label for="status-${escapeHtml(item.id)}">Статус</label><select class="incident-status" id="status-${escapeHtml(item.id)}" data-id="${escapeHtml(item.id)}">${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}"${item.status === value ? ' selected' : ''}>${label}</option>`).join('')}</select></div><form class="assignee-form" data-id="${escapeHtml(item.id)}"><label for="assignee-${escapeHtml(item.id)}">Ответственный</label><div class="assignee-controls"><input id="assignee-${escapeHtml(item.id)}" name="assignee" type="text" maxlength="120" value="${escapeHtml(item.assignee || '')}" placeholder="Не назначен"><button class="button secondary" type="submit">Сохранить</button></div></form></div></article>`).join('') : `<div class="empty incident-empty">${state.incidents.length ? 'Инцидентов по выбранным фильтрам нет.' : '<span class="empty-icon" aria-hidden="true">✓</span><strong>Активных инцидентов нет</strong><span>Новые и находящиеся в работе инциденты появятся здесь</span>'}</div>`;
}

async function refresh() {
  const button = $('#refresh');
  button.disabled = true;
  try {
    const [cameras, events, incidents] = await Promise.all([api('/api/cameras'), api('/api/events'), api('/api/incidents')]);
    state.cameras = cameras; state.events = events; state.incidents = incidents;
    hasLoaded = true;
    renderCameras(); renderEvents(); applyFilters();
    $('#connection').classList.remove('error');
    $('#connection').innerHTML = '<span class="status-dot"></span> Система доступна';
    return true;
  } catch (error) {
    if (!hasLoaded) {
      for (const selector of ['#camera-list', '#event-list', '#incident-list']) $(selector).innerHTML = '<div class="empty">Не удалось загрузить данные. Повторите обновление.</div>';
    }
    $('#connection').classList.add('error');
    $('#connection').innerHTML = '<span class="status-dot"></span> Данные не обновлены';
    showError(error);
    return false;
  } finally { button.disabled = false; }
}

function applyFilters() {
  const status = $('#status-filter').value;
  const severity = $('#severity-filter').value;
  renderIncidents(state.incidents.filter((item) => (!status || item.status === status) && (!severity || item.severity === severity)));
}

$('#refresh').addEventListener('click', async () => { if (await refresh()) showSuccess('Данные обновлены.'); });
$('#status-filter').addEventListener('change', applyFilters);
$('#severity-filter').addEventListener('change', applyFilters);
$('#event-camera-filter').addEventListener('change', renderEvents);
$('#event-severity-filter').addEventListener('change', renderEvents);
$('#camera-list').addEventListener('click', async (event) => {
  const button = event.target.closest('.camera-toggle');
  if (!button) return;
  if (button.disabled) return;
  button.disabled = true;
  try { await api(`/api/cameras/${encodeURIComponent(button.dataset.id)}`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.status }) }); if (await refresh()) showSuccess('Состояние камеры обновлено.'); }
  catch (error) { showError(error); }
  finally { button.disabled = false; }
});
$('#incident-list').addEventListener('change', async (event) => {
  const select = event.target.closest('.incident-status');
  if (!select) return;
  if (select.disabled) return;
  select.disabled = true;
  try { await api(`/api/incidents/${encodeURIComponent(select.dataset.id)}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); if (await refresh()) showSuccess('Статус инцидента обновлён.'); }
  catch (error) { showError(error); applyFilters(); }
  finally { select.disabled = false; }
});
$('#incident-list').addEventListener('submit', async (event) => {
  const form = event.target.closest('.assignee-form');
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector('button');
  if (button.disabled) return;
  button.disabled = true;
  const assignee = form.elements.assignee.value.trim();
  try {
    await api(`/api/incidents/${encodeURIComponent(form.dataset.id)}`, {method:'PATCH', body:JSON.stringify({assignee:assignee || null})});
    if (await refresh()) showSuccess('Ответственный обновлён.');
  } catch (error) { showError(error); }
  finally { button.disabled = false; }
});

$('#incident-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const title = data.get('title').trim();
  if (!title) { showError(new Error('Укажи название инцидента.')); return; }
  const button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  try {
    await api('/api/incidents', { method: 'POST', body: JSON.stringify({ title, cameraId: data.get('cameraId'), severity: data.get('severity'), description: data.get('description').trim() }) });
    form.reset();
    if (await refresh()) showSuccess('Инцидент создан.');
  } catch (error) { showError(error); }
  finally { button.disabled = false; }
});

refresh();
