var allTasks = [];
var currentFilter = 'all';
var modalPriority = 'medium';

// Init
(function() {
    // Set current date
    var now = new Date();
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var day = now.getDate();
    var suffix = 'th';
    if (day === 1 || day === 21 || day === 31) suffix = 'st';
    else if (day === 2 || day === 22) suffix = 'nd';
    else if (day === 3 || day === 23) suffix = 'rd';
    document.getElementById('current-date').textContent = days[now.getDay()] + ', ' + day + suffix + ' ' + months[now.getMonth()];

    // Set greeting based on hour
    var hour = now.getHours();
    var greeting = 'Good Morning';
    if (hour >= 12 && hour < 18) greeting = 'Good Afternoon';
    else if (hour >= 18) greeting = 'Good Evening';

    var savedName = localStorage.getItem('userName') || 'John';
    var nameEl = document.getElementById('user-name');
    nameEl.textContent = savedName;

    var headingEl = nameEl.parentElement;
    headingEl.childNodes[0].textContent = greeting + '! ';

    // Save name on edit
    nameEl.addEventListener('blur', function() {
        var name = nameEl.textContent.trim();
        if (name) {
            localStorage.setItem('userName', name);
            document.querySelector('.avatar').textContent = name.charAt(0).toUpperCase();
        }
    });

    nameEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
    });

    // Update avatar
    document.querySelector('.avatar').textContent = savedName.charAt(0).toUpperCase();

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });

    document.getElementById('modal-title').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') addTaskFromModal();
    });

    loadTasks();
})();

async function loadTasks() {
    var res = await fetch('/api/tasks');
    allTasks = await res.json() || [];
    render();
}

function setFilter(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.chip').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    render();
}

function getTimeFilter() {
    return document.getElementById('time-filter').value;
}

function isInTimeRange(dateStr) {
    var tf = getTimeFilter();
    if (tf === 'all') return true;

    var taskDate = new Date(dateStr);
    var now = new Date();

    if (tf === 'today') {
        return taskDate.toDateString() === now.toDateString();
    }

    if (tf === 'week') {
        var startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        var endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return taskDate >= startOfWeek && taskDate < endOfWeek;
    }

    if (tf === 'month') {
        return taskDate.getMonth() === now.getMonth() && taskDate.getFullYear() === now.getFullYear();
    }

    return true;
}

function getVisibleTasks() {
    return allTasks.filter(function(t) {
        var statusMatch = true;
        if (currentFilter === 'active') statusMatch = !t.done;
        if (currentFilter === 'done') statusMatch = t.done;

        var timeMatch = isInTimeRange(t.created_at);

        return statusMatch && timeMatch;
    });
}

function render() {
    var visible = getVisibleTasks();
    var list = document.getElementById('task-list');

    document.getElementById('stat-total').textContent = allTasks.length;
    document.getElementById('stat-done').textContent = allTasks.filter(function(t) { return t.done; }).length;
    document.getElementById('stat-left').textContent = allTasks.filter(function(t) { return !t.done; }).length;

    if (visible.length === 0) {
        list.innerHTML = '<div class="empty-state">No tasks found for this period.</div>';
        return;
    }

    list.innerHTML = visible.map(function(t) {
        var date = new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        var doneClass = t.done ? ' done' : '';
        var checkedClass = t.done ? ' checked' : '';
        var statusClass = t.done ? 'completed' : 'in-progress';
        var statusText = t.done ? 'Completed' : 'In Progress';

        if (!t.done && t.priority === 'medium') {
            statusClass = 'pending';
            statusText = 'Pending';
        }

        return '<div class="task-row' + doneClass + '">'
            + '<div class="task-name-cell">'
            +   '<div class="task-check' + checkedClass + '" onclick="toggleTask(' + t.id + ')"></div>'
            +   '<span class="task-name">' + escapeHtml(t.title) + '</span>'
            + '</div>'
            + '<div class="priority-badge"><span class="priority-dot ' + t.priority + '"></span></div>'
            + '<div class="status-badge"><span class="status-pill ' + statusClass + '">' + statusText + '</span></div>'
            + '<div class="date-cell">' + date + '</div>'
            + '<div class="action-cell"><button class="btn-del" onclick="deleteTask(' + t.id + ')">&#10005;</button></div>'
            + '</div>';
    }).join('');
}

// Modal
function openModal() {
    document.getElementById('modal-overlay').classList.add('open');
    document.getElementById('modal-title').value = '';
    modalPriority = 'medium';
    document.querySelectorAll('.priority-btn').forEach(function(b) {
        b.classList.remove('selected');
        if (b.classList.contains('medium')) b.classList.add('selected');
    });
    setTimeout(function() { document.getElementById('modal-title').focus(); }, 100);
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
}

function selectPriority(p, btn) {
    modalPriority = p;
    document.querySelectorAll('.priority-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
}

async function addTaskFromModal() {
    var title = document.getElementById('modal-title').value.trim();
    if (!title) { document.getElementById('modal-title').focus(); return; }

    await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, priority: modalPriority })
    });

    closeModal();
    loadTasks();
}

// Inline add (from table row)
async function addTask() {
    var input = document.getElementById('task-input');
    var priority = document.getElementById('priority-select').value;
    if (!input.value.trim()) return;

    await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: input.value.trim(), priority: priority })
    });
    input.value = '';
    loadTasks();
}

async function toggleTask(id) {
    var task = allTasks.find(function(t) { return t.id === id; });
    await fetch('/api/tasks/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !task.done })
    });
    loadTasks();
}

async function deleteTask(id) {
    await fetch('/api/tasks/' + id, { method: 'DELETE' });
    loadTasks();
}

function escapeHtml(text) {
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

document.getElementById('task-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addTask();
});
