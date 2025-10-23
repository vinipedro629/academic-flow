/*
 * script.js - Academic Flow (Versão Completa e Avançada)
 * Lógica: IndexedDB (Persistência Assíncrona), CRUD, Canvas (Gráfico), Notificações.
 */

// 1. Variáveis Globais do DOM
const taskForm = document.getElementById('task-form');
const taskList = document.getElementById('task-list');
const themeToggle = document.getElementById('theme-toggle');
const taskCountSpan = document.getElementById('task-count');
const emptyState = document.getElementById('empty-state');
const submitButton = document.getElementById('submit-button');
const cancelButton = document.getElementById('cancel-edit');
const searchInput = document.getElementById('search-input');
const filterType = document.getElementById('filter-type');
const notifyButton = document.getElementById('notify-button');

// Variáveis de Gráfico
const taskChartCanvas = document.getElementById('task-chart');
// Certifica-se de que o contexto 2D existe antes de usar o Canvas
const ctx = taskChartCanvas ? taskChartCanvas.getContext('2d') : null; 

// Variáveis de Estado
let editingTaskId = null;
let tasks = [];

// 2. Persistência Assíncrona (IndexedDB)
const DB_NAME = 'AcademicFlowDB';
const STORE_NAME = 'tasks';
let db;

/**
 * Abre a conexão com o IndexedDB e cria a Store.
 */
const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = (e) => {
            const dbInstance = e.target.result;
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' }); 
            }
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };

        request.onerror = (e) => {
            console.error("IndexedDB error:", e.target.error);
            reject(e.target.error);
        };
    });
};

/**
 * Carrega todas as tarefas do IndexedDB.
 */
const loadTasks = () => {
    return new Promise((resolve, reject) => {
        if (!db) { 
            tasks = [];
            return resolve([]); // Retorna lista vazia se o DB não está pronto
        }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (e) => {
            tasks = e.target.result;
            resolve(tasks);
        };

        request.onerror = (e) => {
            console.error("Erro ao carregar do IndexedDB:", e.target.error);
            reject(e.target.error);
        };
    });
};

/**
 * Adiciona ou atualiza uma tarefa no IndexedDB.
 */
const saveTaskToDB = (task) => {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(task); 

        request.onsuccess = resolve;
        request.onerror = reject;
    });
};

/**
 * Remove uma tarefa do IndexedDB.
 */
const deleteTaskFromDB = (id) => {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = resolve;
        request.onerror = reject;
    });
};

// 3. Gerenciamento de Tema (Boas Práticas e Acessibilidade)
const loadThemePreference = () => {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let themeToSet = 'light';
    if (savedTheme) { themeToSet = savedTheme; } 
    else if (systemPrefersDark) { themeToSet = 'dark'; }
    setTheme(themeToSet);
};
const setTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeToggleIcon(theme);
};
const updateThemeToggleIcon = (theme) => {
    themeToggle.innerHTML = theme === 'dark' ? '<span class="icon-sun" aria-hidden="true">☀️</span>' : '<span class="icon-moon" aria-hidden="true">🌙</span>';
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro');
};
const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
};

// 4. Módulo de Notificações (PWA Básico)
const requestNotificationPermission = () => {
    if (!("Notification" in window)) {
        alert("Este navegador não suporta notificações de desktop.");
        return;
    }

    if (Notification.permission === "granted") {
        notifyButton.textContent = "🔔 Permissão Concedida";
        notifyButton.disabled = true;
        return;
    }

    Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
            new Notification("Notificações Ativadas!", { body: "Você será avisado sobre prazos importantes." });
            notifyButton.textContent = "🔔 Permissão Concedida";
            notifyButton.disabled = true;
        } else {
            notifyButton.textContent = "🔔 Permissão Negada";
        }
    });
};

const sendUrgentNotifications = () => {
    if (Notification.permission !== "granted") return;

    tasks.forEach(task => {
        const timeLeft = calculateTimeLeft(task.date);
        
        // Alerta se faltar entre 1 e 60 minutos
        if (!timeLeft.expired && timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes <= 60 && timeLeft.minutes > 0) {
             new Notification("🚨 PRAZO URGENTE! (" + task.type + ")", {
                body: `${task.title} expira em ${timeLeft.minutes} minutos.`,
                icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='%23dc3545'>❗</text></svg>",
                tag: `task-${task.id}`
            });
        }
    });
};

// 5. Funções Auxiliares de Data e Formato
const calculateTimeLeft = (deadline) => {
    const now = new Date().getTime();
    const target = new Date(deadline).getTime();
    const difference = target - now;

    if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, expired: true };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

    return { days, hours, minutes, expired: false };
};

const formatDate = (deadline) => {
    const date = new Date(deadline);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// 6. Módulo de Visualização (Gráfico Canvas)
const drawTaskChart = () => {
    if (!ctx) return;
    
    const counts = { Prova: 0, Trabalho: 0, Avaliacao: 0, 'Prazo Final': 0, Total: tasks.length };
    tasks.forEach(task => { if (counts.hasOwnProperty(task.type)) counts[task.type]++; });

    const style = getComputedStyle(document.documentElement);
    const colors = [
        style.getPropertyValue('--color-prova').trim(),
        style.getPropertyValue('--color-trabalho').trim(),
        style.getPropertyValue('--color-avaliacao').trim(),
        style.getPropertyValue('--color-prazo').trim(),
    ];
    
    const types = ['Prova', 'Trabalho', 'Avaliacao', 'Prazo Final'];
    const data = types.map(t => counts[t]);
    
    const width = taskChartCanvas.width;
    const height = taskChartCanvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2.5;
    const innerRadius = radius * 0.6; 

    ctx.clearRect(0, 0, width, height);
    
    let currentAngle = 0;
    
    // Desenha as fatias
    data.forEach((value, index) => {
        if (value === 0) return;
        
        const sliceAngle = (value / counts.Total) * 2 * Math.PI;
        
        ctx.fillStyle = colors[index];
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.lineTo(centerX, centerY);
        ctx.fill();
        
        // Desenha porcentagens (Melhoria de UX)
        const midAngle = currentAngle + sliceAngle / 2;
        const labelX = centerX + radius * 0.8 * Math.cos(midAngle);
        const labelY = centerY + radius * 0.8 * Math.sin(midAngle);

        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        
        if ((value / counts.Total) > 0.05) { 
            const percentage = ((value / counts.Total) * 100).toFixed(0);
            ctx.fillText(`${percentage}%`, labelX, labelY);
        }

        currentAngle += sliceAngle;
    });

    // Desenha o círculo central (buraco)
    ctx.fillStyle = style.getPropertyValue('--color-surface').trim();
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Desenha a legenda do lado de fora
    drawChartLegend(ctx, width, height, types, data, colors, counts.Total);
};

const drawChartLegend = (ctx, width, height, types, data, colors, total) => {
    const style = getComputedStyle(document.documentElement);
    const legendX = 10;
    let legendY = 10; // Posição inicial da legenda no topo

    types.forEach((type, index) => {
        const value = data[index];
        if (total !== 0 && value === 0) return; 

        ctx.fillStyle = colors[index];
        ctx.fillRect(legendX, legendY, 10, 10); 

        ctx.fillStyle = style.getPropertyValue('--color-text').trim();
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        
        const percentage = total === 0 ? 0 : ((value / total) * 100).toFixed(1);
        ctx.fillText(`${type}: ${value} (${percentage}%)`, legendX + 15, legendY + 9);
        
        legendY += 20;
    });
};

// 7. Manipulação Dinâmica do DOM e Funções CRUD
const createTaskElement = (task) => {
    // ... Código para criar o LI (mesmo da versão anterior) ...
    const li = document.createElement('li');
    li.className = `task-item type-${task.type.replace(/\s/g, '')}`; 
    li.setAttribute('data-id', task.id);
    li.setAttribute('role', 'listitem');
    li.setAttribute('aria-label', `Tarefa ${task.type}: ${task.title}`);

    const timeLeft = calculateTimeLeft(task.date);
    
    let deadlineText;
    const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim();
    
    if (timeLeft.expired) {
        deadlineText = `<span class="days-left" style="color: ${dangerColor}">EXPIRADO</span>`;
    } else if (timeLeft.days > 0) {
        deadlineText = `<span class="days-left">${timeLeft.days}</span> dias`;
    } else if (timeLeft.hours > 0) {
        deadlineText = `<span class="days-left">${timeLeft.hours}</span> horas`;
    } else {
        deadlineText = `<span class="days-left">${timeLeft.minutes}</span> mins`;
    }


    li.innerHTML = `
        <div class="task-info">
            <p class="task-type" aria-label="Tipo de evento">${task.type}</p>
            <h3>${task.title}</h3>
            <p>Prazo: ${formatDate(task.date)}</p>
            ${task.notes ? `<p class="notes-preview" title="${task.notes}">Notas: ${task.notes.substring(0, 50)}...</p>` : ''}
        </div>
        <div class="task-deadline">
            ${deadlineText}
            <p>Restantes</p>
        </div>
        <div class="task-actions">
            <button class="btn btn-primary edit-btn" aria-label="Editar ${task.title}" data-id="${task.id}">
                Editar
            </button>
            <button class="btn btn-danger delete-btn" aria-label="Deletar ${task.title}" data-id="${task.id}">
                Concluído
            </button>
        </div>
    `;

    li.querySelector('.edit-btn').addEventListener('click', () => startEdit(task.id));
    li.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

    return li;
};

const renderTasks = async () => {
    await loadTasks(); 
    taskList.innerHTML = '';

    const searchTerm = searchInput.value.toLowerCase();
    const filterValue = filterType.value;

    let filteredTasks = tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchTerm) || task.notes.toLowerCase().includes(searchTerm);
        const matchesFilter = filterValue === 'all' || task.type === filterValue;
        return matchesSearch && matchesFilter;
    });

    filteredTasks.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filteredTasks.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        filteredTasks.forEach(task => {
            taskList.appendChild(createTaskElement(task));
        });
    }

    taskCountSpan.textContent = filteredTasks.length;
    drawTaskChart(); 
};

const handleFormSubmit = async (e) => {
    e.preventDefault();

    const taskData = {
        type: document.getElementById('task-type').value,
        title: document.getElementById('task-title').value.trim(),
        date: document.getElementById('task-date').value,
        notes: document.getElementById('task-notes').value.trim(),
    };

    if (editingTaskId) {
        const taskIndex = tasks.findIndex(t => t.id === editingTaskId);
        if (taskIndex !== -1) {
             const updatedTask = { ...tasks[taskIndex], ...taskData, id: editingTaskId };
             await saveTaskToDB(updatedTask);
        }
    } else {
        const newTask = { id: Date.now(), ...taskData };
        await saveTaskToDB(newTask);
    }

    resetForm();
    await renderTasks();
};

const startEdit = (id) => {
    const taskToEdit = tasks.find(t => t.id === id);

    if (taskToEdit) {
        document.getElementById('task-type').value = taskToEdit.type;
        document.getElementById('task-title').value = taskToEdit.title;
        document.getElementById('task-date').value = taskToEdit.date; 
        document.getElementById('task-notes').value = taskToEdit.notes;

        editingTaskId = id;
        submitButton.textContent = 'Salvar Alterações';
        submitButton.classList.remove('btn-primary');
        submitButton.classList.add('btn-success');
        cancelButton.style.display = 'inline-block';
        
        document.getElementById('task-type').focus();
        taskForm.scrollIntoView({ behavior: 'smooth' });
    }
};

const deleteTask = async (id) => {
    const taskItem = taskList.querySelector(`[data-id="${id}"]`);

    if (taskItem) {
        taskItem.classList.add('fade-out');

        setTimeout(async () => {
            await deleteTaskFromDB(id);
            await renderTasks();
            if (editingTaskId === id) {
                resetForm();
            }
        }, 400); 
    }
};

const resetForm = () => {
    taskForm.reset();
    editingTaskId = null;
    submitButton.textContent = 'Agendar Tarefa';
    submitButton.classList.remove('btn-success');
    submitButton.classList.add('btn-primary');
    cancelButton.style.display = 'none';
};


// 8. Inicialização (Assíncrona para IndexedDB)

const init = async () => {
    // 1. Abre o IndexedDB
    try {
        await openDB();
    } catch (e) {
        console.error("Não foi possível iniciar o IndexedDB. O sistema não salvará dados permanentemente.");
    }

    // 2. Carregamento e renderização inicial
    await renderTasks();
    loadThemePreference();
    
    // 3. Event Listeners
    taskForm.addEventListener('submit', handleFormSubmit);
    cancelButton.addEventListener('click', resetForm);
    themeToggle.addEventListener('click', toggleTheme);
    searchInput.addEventListener('input', renderTasks);
    filterType.addEventListener('change', renderTasks);
    
    notifyButton.addEventListener('click', requestNotificationPermission);
    
    // 4. Atualização em Tempo Real (Prazos, Gráfico e Notificações)
    setInterval(() => {
        renderTasks(); // Re-renderiza para atualizar os contadores de tempo
        sendUrgentNotifications();
    }, 60000); // Roda a cada 60 segundos

    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Inicializa o estado do botão de notificação
    if ("Notification" in window && Notification.permission === "granted") {
        notifyButton.textContent = "🔔 Permissão Concedida";
        notifyButton.disabled = true;
    }
};

// Inicia a aplicação
document.addEventListener('DOMContentLoaded', init);