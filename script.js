// Productive Planner Pro - To-Do App
document.addEventListener('DOMContentLoaded', () => {
    // Task data model
    let tasks = [];
    let currentFilter = 'all';
    let searchTerm = '';
    let editTaskId = null;
    let notificationInterval = null;
    
    // DOM Elements
    const appContainer = document.getElementById('app');
    const newTaskInput = document.getElementById('new-task-input');
    const taskDeadlineInput = document.getElementById('task-deadline');
    const addTaskBtn = document.getElementById('add-task-btn');
    const searchInput = document.getElementById('search-input');
    const tasksRemainingEl = document.getElementById('tasks-remaining');
    const taskListContainer = document.getElementById('task-list-container');
    const emptyState = document.getElementById('empty-state');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const notificationBtn = document.getElementById('notification-btn');
    
    // Modal elements
    const editModal = document.getElementById('edit-modal');
    const editTaskDescription = document.getElementById('edit-task-description');
    const editTaskDeadline = document.getElementById('edit-task-deadline');
    const editTaskPriority = document.getElementById('edit-task-priority');
    const saveEditBtn = document.getElementById('save-edit-btn');
    const closeModalBtn = document.querySelector('.close-modal');
    
    // Initialize the app
    init();
    
    // Initialize application
    function init() {
        loadTasksFromStorage();
        setupEventListeners();
        requestNotificationPermission();
        startDeadlineChecker();
        
        // Set min datetime for deadline inputs to current time
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        taskDeadlineInput.min = localDateTime;
        editTaskDeadline.min = localDateTime;
    }
    
    // Setup all event listeners
    function setupEventListeners() {
        // Add task
        addTaskBtn.addEventListener('click', addTask);
        newTaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTask();
        });
        
        // Search
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value.toLowerCase();
            renderTasks();
        });
        
        // Select all
        selectAllCheckbox.addEventListener('change', toggleSelectAll);
        
        // Filters
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderTasks();
            });
        });
        
        // Notifications
        notificationBtn.addEventListener('click', requestNotificationPermission);
        
        // Modal
        closeModalBtn.addEventListener('click', () => {
            editModal.style.display = 'none';
        });
        
        saveEditBtn.addEventListener('click', saveEditedTask);
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === editModal) {
                editModal.style.display = 'none';
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+A to focus on add task input
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                newTaskInput.focus();
            }
            
            // Escape to close modal
            if (e.key === 'Escape' && editModal.style.display === 'flex') {
                editModal.style.display = 'none';
            }
        });
    }
    
    // Task Data Model Functions
    function createTask(description, deadline = null, source = 'user', priority = 'medium') {
        return {
            id: Date.now() + Math.floor(Math.random() * 1000),
            description,
            completed: false,
            deadline: deadline ? new Date(deadline).toISOString() : null,
            source,
            priority,
            notified: false,
            createdAt: new Date().toISOString()
        };
    }
    
    // Load tasks from localStorage or fetch from API
    async function loadTasksFromStorage() {
        const storedTasks = localStorage.getItem('productivePlannerTasks');
        
        if (storedTasks) {
            const parsedTasks = JSON.parse(storedTasks);
            tasks = parsedTasks.map(task => ({
                ...task,
                deadline: task.deadline ? new Date(task.deadline) : null,
                createdAt: task.createdAt ? new Date(task.createdAt) : new Date()
            }));
            renderTasks();
            updateTasksCounter();
        } else {
            await fetchTasksFromAPI();
        }
    }
    
    // Fetch initial tasks from API
    async function fetchTasksFromAPI() {
        try {
            const response = await fetch('https://jsonplaceholder.typicode.com/todos');
            const apiTasks = await response.json();
            
            // Limit to 15 tasks for demonstration
            const limitedTasks = apiTasks.slice(0, 15);
            
            tasks = limitedTasks.map(task => ({
                id: task.id,
                description: task.title,
                completed: task.completed,
                deadline: null,
                source: 'api',
                priority: 'medium',
                notified: false,
                createdAt: new Date().toISOString()
            }));
            
            saveTasksToStorage();
            renderTasks();
            updateTasksCounter();
            
            console.log('Fetched', tasks.length, 'tasks from API');
        } catch (error) {
            console.error('Error fetching tasks from API:', error);
            // Create some sample tasks if API fails
            tasks = [
                createTask('Welcome to Productive Planner Pro!', null, 'system'),
                createTask('Try adding your own tasks', null, 'system'),
                createTask('Set deadlines for important tasks', null, 'system'),
                createTask('Use filters to organize your tasks', null, 'system'),
                createTask('Enable notifications for reminders', null, 'system')
            ];
            saveTasksToStorage();
            renderTasks();
            updateTasksCounter();
        }
    }
    
    // Save tasks to localStorage
    function saveTasksToStorage() {
        localStorage.setItem('productivePlannerTasks', JSON.stringify(tasks));
    }
    
    // Add a new task
    function addTask() {
        const description = newTaskInput.value.trim();
        const deadline = taskDeadlineInput.value;
        
        if (!description) {
            alert('Please enter a task description');
            newTaskInput.focus();
            return;
        }
        
        const newTask = createTask(
            description, 
            deadline || null,
            'user',
            'medium'
        );
        
        tasks.push(newTask);
        newTaskInput.value = '';
        taskDeadlineInput.value = '';
        
        saveTasksToStorage();
        renderTasks();
        updateTasksCounter();
        
        // Scroll to the new task
        setTimeout(() => {
            const taskElements = document.querySelectorAll('.task-item');
            if (taskElements.length > 0) {
                taskElements[taskElements.length - 1].scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    }
    
    // Toggle task completion
    function toggleTaskCompletion(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            // Reset notification flag if task is marked incomplete again
            if (!task.completed) {
                task.notified = false;
            }
            saveTasksToStorage();
            renderTasks();
            updateTasksCounter();
        }
    }
    
    // Delete a task
    function deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            tasks = tasks.filter(t => t.id !== taskId);
            saveTasksToStorage();
            renderTasks();
            updateTasksCounter();
        }
    }
    
    // Edit a task
    function editTask(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            editTaskId = taskId;
            editTaskDescription.value = task.description;
            
            if (task.deadline) {
                const deadlineDate = new Date(task.deadline);
                const localDateTime = new Date(deadlineDate.getTime() - deadlineDate.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16);
                editTaskDeadline.value = localDateTime;
            } else {
                editTaskDeadline.value = '';
            }
            
            editTaskPriority.value = task.priority;
            editModal.style.display = 'flex';
            editTaskDescription.focus();
        }
    }
    
    // Save edited task
    function saveEditedTask() {
        if (!editTaskId) return;
        
        const task = tasks.find(t => t.id === editTaskId);
        if (task) {
            task.description = editTaskDescription.value.trim();
            task.deadline = editTaskDeadline.value ? new Date(editTaskDeadline.value).toISOString() : null;
            task.priority = editTaskPriority.value;
            
            saveTasksToStorage();
            renderTasks();
            editModal.style.display = 'none';
            editTaskId = null;
        }
    }
    
    // Toggle select all visible tasks
    function toggleSelectAll() {
        const visibleTasks = getFilteredTasks();
        const allCompleted = visibleTasks.every(task => task.completed);
        
        visibleTasks.forEach(task => {
            task.completed = !allCompleted;
            // Reset notification flag for incomplete tasks
            if (!task.completed) {
                task.notified = false;
            }
        });
        
        saveTasksToStorage();
        renderTasks();
        updateTasksCounter();
    }
    
    // Get filtered tasks based on current filter and search
    function getFilteredTasks() {
        let filtered = tasks;
        
        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(task => 
                task.description.toLowerCase().includes(searchTerm)
            );
        }
        
        // Apply status filter
        switch (currentFilter) {
            case 'active':
                filtered = filtered.filter(task => !task.completed);
                break;
            case 'completed':
                filtered = filtered.filter(task => task.completed);
                break;
            case 'overdue':
                filtered = filtered.filter(task => {
                    if (task.completed) return false;
                    if (!task.deadline) return false;
                    return new Date(task.deadline) < new Date();
                });
                break;
            // 'all' filter doesn't need additional filtering
        }
        
        return filtered;
    }
    
    // Render tasks to the UI
    function renderTasks() {
        const filteredTasks = getFilteredTasks();
        
        // Show/hide empty state
        if (filteredTasks.length === 0) {
            emptyState.style.display = 'block';
            taskListContainer.innerHTML = '';
            return;
        }
        
        emptyState.style.display = 'none';
        
        // Clear and rebuild task list
        taskListContainer.innerHTML = '';
        
        filteredTasks.forEach(task => {
            const taskElement = createTaskElement(task);
            taskListContainer.appendChild(taskElement);
        });
        
        // Update select all checkbox state
        const visibleTasks = getFilteredTasks();
        const allCompleted = visibleTasks.length > 0 && visibleTasks.every(task => task.completed);
        selectAllCheckbox.checked = allCompleted;
        selectAllCheckbox.indeterminate = !allCompleted && visibleTasks.some(task => task.completed);
    }
    
    // Create HTML element for a task
    function createTaskElement(task) {
        const taskEl = document.createElement('div');
        taskEl.className = 'task-item';
        
        if (task.completed) {
            taskEl.classList.add('completed');
        }
        
        // Check if task is overdue
        const isOverdue = !task.completed && task.deadline && new Date(task.deadline) < new Date();
        if (isOverdue) {
            taskEl.classList.add('overdue');
        }
        
        // Format deadline for display
        let deadlineDisplay = '';
        if (task.deadline) {
            const deadlineDate = new Date(task.deadline);
            const now = new Date();
            const diffHours = Math.floor((deadlineDate - now) / (1000 * 60 * 60));
            
            if (isOverdue) {
                deadlineDisplay = `Overdue: ${deadlineDate.toLocaleDateString()} ${deadlineDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            } else if (diffHours < 24) {
                deadlineDisplay = `Due today: ${deadlineDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            } else if (diffHours < 48) {
                deadlineDisplay = `Due tomorrow: ${deadlineDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            } else {
                deadlineDisplay = `Due: ${deadlineDate.toLocaleDateString()} ${deadlineDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            }
        }
        
        taskEl.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <div class="task-content">
                <div class="task-description ${task.completed ? 'completed' : ''}">${escapeHtml(task.description)}</div>
                <div class="task-meta">
                    ${deadlineDisplay ? `<div class="deadline ${isOverdue ? 'overdue' : ''}"><i class="far fa-clock"></i> ${deadlineDisplay}</div>` : ''}
                    <div class="priority priority-${task.priority}">${task.priority.toUpperCase()}</div>
                    <div class="task-source">${task.source === 'api' ? 'Sample task' : 'Your task'}</div>
                </div>
            </div>
            <div class="task-actions">
                <button class="edit-btn" title="Edit task"><i class="fas fa-ellipsis-h"></i></button>
                <button class="delete-btn" title="Delete task"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        // Add event listeners
        const checkbox = taskEl.querySelector('.task-checkbox');
        const editBtn = taskEl.querySelector('.edit-btn');
        const deleteBtn = taskEl.querySelector('.delete-btn');
        
        checkbox.addEventListener('change', () => toggleTaskCompletion(task.id));
        editBtn.addEventListener('click', () => editTask(task.id));
        deleteBtn.addEventListener('click', () => deleteTask(task.id));
        
        // Add keyboard navigation
        taskEl.tabIndex = 0;
        taskEl.addEventListener('keydown', (e) => {
            if (e.key === ' ') {
                e.preventDefault();
                toggleTaskCompletion(task.id);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                editTask(task.id);
            } else if (e.key === 'Delete') {
                e.preventDefault();
                deleteTask(task.id);
            }
        });
        
        return taskEl;
    }
    
    // Update tasks counter
    function updateTasksCounter() {
        const activeTasks = tasks.filter(task => !task.completed).length;
        const totalTasks = tasks.length;
        tasksRemainingEl.textContent = `${activeTasks} of ${totalTasks} tasks remaining`;
    }
    
    // Request notification permission
    function requestNotificationPermission() {
        if (!('Notification' in window)) {
            alert('This browser does not support desktop notifications');
            return;
        }
        
        if (Notification.permission === 'granted') {
            alert('Notifications are already enabled!');
            return;
        }
        
        if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    alert('Notifications enabled! You will receive reminders for upcoming deadlines.');
                    notificationBtn.textContent = 'Notifications Enabled';
                    notificationBtn.disabled = true;
                }
            });
        } else {
            alert('Notification permission was denied. You can enable it in your browser settings.');
        }
    }
    
    // Check for upcoming deadlines and send notifications
    function checkDeadlines() {
        if (Notification.permission !== 'granted') return;
        
        const now = new Date();
        
        tasks.forEach(task => {
            // Skip if task is completed, has no deadline, or already notified
            if (task.completed || !task.deadline || task.notified) return;
            
            const deadline = new Date(task.deadline);
            const timeDiff = deadline - now;
            const minutesDiff = timeDiff / (1000 * 60);
            
            // Notify if deadline is within 15 minutes
            if (minutesDiff > 0 && minutesDiff <= 15) {
                new Notification('Task Reminder!', {
                    body: `Your task "${task.description}" is due soon!`,
                    icon: 'https://cdn-icons-png.flaticon.com/512/3208/3208720.png'
                });
                
                task.notified = true;
                saveTasksToStorage();
            }
        });
    }
    
    // Start the deadline checker interval
    function startDeadlineChecker() {
        if (notificationInterval) {
            clearInterval(notificationInterval);
        }
        
        // Check every minute
        notificationInterval = setInterval(checkDeadlines, 60000);
    }
    
    // Utility function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Drag and drop functionality (bonus feature)
    function initializeDragAndDrop() {
        let draggedTask = null;
        
        taskListContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('task-item')) {
                draggedTask = e.target;
                e.target.style.opacity = '0.5';
            }
        });
        
        taskListContainer.addEventListener('dragend', (e) => {
            if (draggedTask) {
                draggedTask.style.opacity = '';
                draggedTask = null;
            }
        });
        
        taskListContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(taskListContainer, e.clientY);
            const draggable = draggedTask;
            
            if (afterElement == null) {
                taskListContainer.appendChild(draggable);
            } else {
                taskListContainer.insertBefore(draggable, afterElement);
            }
        });
    }
    
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    // Initialize drag and drop after tasks are rendered
    setTimeout(initializeDragAndDrop, 1000);
});