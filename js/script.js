/*
 * script.js - Academic Flow
 * Lógica: Manipulação de Datas, CRUD, LocalStorage, Tema.
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

// Variáveis de Estado
let editingTaskId = null;
let tasks = []; // Array principal de tarefas

// 2. Persistência de Dados (Local Storage)
const loadTasks = () => {
    try {
        const tasksJson = localStorage.getItem('academic_tasks');
        // Ao carregar, converte a string de data de volta para um objeto Date, se necessário
        const loadedTasks = tasksJson ? JSON.parse(tasksJson) : [];
        return loadedTasks;
    } catch (e) {
        console.error("Erro ao carregar tarefas do localStorage:", e);
        return [];
    }
};

const saveTasks = (tasksToSave) => {
    try {
        localStorage.setItem('academic_tasks', JSON.stringify(tasksToSave));
    } catch (e) {
        console.error("Erro ao salvar tarefas no localStorage:", e);
    }
};

// 3. Gerenciamento de Tema (Idêntico ao projeto anterior, mantendo a qualidade)
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

// 4. Funções Auxiliares de Data e Formato (DADO DINÂMICO)

/**
 * Calcula os dias, horas e minutos restantes até um prazo.
 * @param {string} deadline - Data/hora do prazo no formato ISO.
 * @returns {Object} { days: number, hours: number, minutes: number, expired: boolean }
 */
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

/**
 * Formata a data para exibição na lista.
 * @param {string} deadline - Data/hora do prazo no formato ISO.
 * @returns {string} Data formatada.
 */
const formatDate = (deadline) => {
    // Acessibilidade: Usa o formato local do usuário.
    const date = new Date(deadline);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// 5. Manipulação Dinâmica do DOM (Renderização)

/**
 * Cria um elemento HTML (li) para uma tarefa.
 * @param {Object} task - O objeto tarefa.
 * @returns {HTMLLIElement} O elemento <li> da tarefa.
 */
const createTaskElement = (task) => {
    const li = document.createElement('li');
    // Adiciona classe base e a classe de cor específica
    li.className = `task-item type-${task.type.replace(/\s/g, '')}`; 
    li.setAttribute('data-id', task.id);
    li.setAttribute('role', 'listitem');
    li.setAttribute('aria-label', `Tarefa ${task.type}: ${task.title}`);

    const timeLeft = calculateTimeLeft(task.date);
    
    let deadlineText;
    if (timeLeft.expired) {
        deadlineText = `<span class="days-left" style="color: ${getComputedStyle(document.documentElement).getPropertyValue('--color-danger')}">EXPIRADO</span>`;
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
            ${task.notes ? `<p class="notes-preview">Notas: ${task.notes.substring(0, 50)}...</p>` : ''}
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

    // Adiciona ouvintes de eventos
    li.querySelector('.edit-btn').addEventListener('click', () => startEdit(task.id));
    // O botão delete/concluído remove a tarefa
    li.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

    return li;
};

/**
 * Renderiza a lista de tarefas no DOM.
 */
const renderTasks = () => {
    taskList.innerHTML = ''; // Limpa a lista atual

    const searchTerm = searchInput.value.toLowerCase();
    const filterValue = filterType.value;

    // 1. Aplica Filtros e Busca
    let filteredTasks = tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchTerm) || task.notes.toLowerCase().includes(searchTerm);
        const matchesFilter = filterValue === 'all' || task.type === filterValue;
        return matchesSearch && matchesFilter;
    });

    // 2. Ordena por prazo: tarefas mais próximas (ou expiradas) primeiro
    filteredTasks.sort((a, b) => new Date(a.date) - new Date(b.date));


    if (filteredTasks.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        
        filteredTasks.forEach(task => {
            taskList.appendChild(createTaskElement(task));
        });
    }

    // 3. Atualiza a contagem
    taskCountSpan.textContent = filteredTasks.length;
};

// 6. Funções CRUD

/**
 * Lida com o envio do formulário (Adicionar ou Atualizar).
 */
const handleFormSubmit = (e) => {
    e.preventDefault();

    // Cria um objeto task a partir dos dados do formulário
    const taskData = {
        type: document.getElementById('task-type').value,
        title: document.getElementById('task-title').value.trim(),
        date: document.getElementById('task-date').value, // Formato ISO para persistência
        notes: document.getElementById('task-notes').value.trim(),
    };

    if (editingTaskId) {
        // Modo Edição
        updateTask(editingTaskId, taskData);
    } else {
        // Modo Criação
        addTask(taskData);
    }

    resetForm();
    renderTasks();
};

/**
 * Adiciona uma nova tarefa.
 */
const addTask = (taskData) => {
    const newTask = {
        id: Date.now(), // ID simples e único
        ...taskData,
    };
    tasks.push(newTask);
    saveTasks(tasks);
};

/**
 * Inicia o modo de edição, preenchendo o formulário.
 */
const startEdit = (id) => {
    const taskToEdit = tasks.find(t => t.id === id);

    if (taskToEdit) {
        // Preenche o formulário
        document.getElementById('task-type').value = taskToEdit.type;
        document.getElementById('task-title').value = taskToEdit.title;
        // O campo datetime-local espera a string ISO (YYYY-MM-DDTHH:MM)
        document.getElementById('task-date').value = taskToEdit.date; 
        document.getElementById('task-notes').value = taskToEdit.notes;

        // Atualiza variáveis e botão
        editingTaskId = id;
        submitButton.textContent = 'Salvar Alterações';
        submitButton.classList.remove('btn-primary');
        submitButton.classList.add('btn-success');
        cancelButton.style.display = 'inline-block';
        
        // Foca no primeiro campo e rola para o formulário (UX)
        document.getElementById('task-type').focus();
        taskForm.scrollIntoView({ behavior: 'smooth' });
    }
};

/**
 * Atualiza os dados de uma tarefa existente.
 */
const updateTask = (id, newTaskData) => {
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
        tasks[index] = { ...tasks[index], ...newTaskData };
        saveTasks(tasks);
    }
};

/**
 * Deleta/Conclui uma tarefa com animação.
 */
const deleteTask = (id) => {
    const taskItem = taskList.querySelector(`[data-id="${id}"]`);

    if (taskItem) {
        taskItem.classList.add('fade-out'); // Animação de remoção

        setTimeout(() => {
            tasks = tasks.filter(t => t.id !== id);
            saveTasks(tasks);
            renderTasks();

            if (editingTaskId === id) {
                resetForm();
            }
        }, 400); 
    }
};

/**
 * Reseta o formulário e sai do modo de edição.
 */
const resetForm = () => {
    taskForm.reset();
    editingTaskId = null;
    submitButton.textContent = 'Agendar Tarefa';
    submitButton.classList.remove('btn-success');
    submitButton.classList.add('btn-primary');
    cancelButton.style.display = 'none';
};


// 7. Inicialização e Event Listeners

/**
 * Inicializa a aplicação.
 */
const init = () => {
    // Carrega dados e tema
    tasks = loadTasks();
    loadThemePreference();
    
    // Renderiza a lista inicial
    renderTasks();

    // Event Listener: Envio do Formulário (CRUD)
    taskForm.addEventListener('submit', handleFormSubmit);

    // Event Listener: Cancelar Edição
    cancelButton.addEventListener('click', resetForm);

    // Event Listener: Alternância de Tema
    themeToggle.addEventListener('click', toggleTheme);

    // Event Listener: Busca e Filtro (Disparam a renderização)
    searchInput.addEventListener('input', renderTasks);
    filterType.addEventListener('change', renderTasks);
    
    // Atualização de Prazos em Tempo Real (Performance: a cada minuto)
    setInterval(renderTasks, 60000); // Atualiza a cada 60 segundos
    
    // Define o ano atual no footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
};

// Inicia a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);