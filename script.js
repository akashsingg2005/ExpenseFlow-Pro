        let elements = {};
        let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
        let storedDescs = JSON.parse(localStorage.getItem('storedDescs')) || [];
        let monthlyBudget = parseFloat(localStorage.getItem('monthlyBudget')) || 0;
        let isDarkMode = localStorage.getItem('theme') !== 'light';
        let chartInstance = null;
        let isEditing = false;
        let pendingAction = null;

        const COLORS = { 'Food': '#00f2ff', 'Rent': '#7000ff', 'Transport': '#ff007a', 'Shopping': '#00ff88', 'Salary': '#f1c40f', 'Other': '#94a3b8' };
        const LIGHT_COLORS = { 'Food': '#0891b2', 'Rent': '#7c3aed', 'Transport': '#e11d48', 'Shopping': '#059669', 'Salary': '#d97706', 'Other': '#64748b' };

        function init() {
            elements = {
                form: document.getElementById('transaction-form'),
                list: document.getElementById('transaction-list'),
                descInput: document.getElementById('desc'),
                descDropdown: document.getElementById('desc-dropdown'),
                searchInput: document.getElementById('search-bar'),
                toast: document.getElementById('toast'),
                toastMsg: document.getElementById('toast-msg'),
                themeBtn: document.getElementById('theme-toggle'),
                themeIcon: document.getElementById('theme-icon'),
                exportBtn: document.getElementById('export-btn'),
                budgetInput: document.getElementById('monthly-budget-input'),
                saveBudgetBtn: document.getElementById('save-budget-btn'),
                resetBudgetBtn: document.getElementById('reset-budget-btn'),
                alertCard: document.getElementById('alert-card-container'),
                cardAlertAmount: document.getElementById('card-alert-amount'),
                totalBalance: document.getElementById('total-balance'),
                totalIncome: document.getElementById('total-income'),
                totalExpenses: document.getElementById('total-expenses'),
                itemCount: document.getElementById('item-count'),
                monthlySpent: document.getElementById('monthly-spent-val'),
                savingsRatio: document.getElementById('savings-ratio'),
                insightsText: document.getElementById('insights-text'),
                customModal: document.getElementById('custom-modal'),
                modalCancel: document.getElementById('modal-cancel'),
                modalConfirm: document.getElementById('modal-confirm'),
                clearDataBtn: document.getElementById('clear-data')
            };

            if (!isDarkMode) {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
                if (elements.themeIcon) elements.themeIcon.setAttribute('data-lucide', 'sun');
            }

            if (typeof lucide !== 'undefined') lucide.createIcons();
            if (elements.budgetInput) elements.budgetInput.value = monthlyBudget || '';
            
            setupChart();
            render();

            // Event bindings
            elements.themeBtn.onclick = toggleTheme;
            elements.saveBudgetBtn.onclick = saveBudget;
            elements.resetBudgetBtn.onclick = () => showModal('Reset Limit', 'Do you want to reset your monthly spending limit?', resetBudget, 'violet');
            elements.form.onsubmit = handleFormSubmit;
            elements.exportBtn.onclick = exportReport;
            elements.searchInput.oninput = render;
            elements.clearDataBtn.onclick = () => showModal('Reset All Data', 'DANGER: This will delete ALL transactions and suggestions permanently.', resetAllData, 'rose');
            
            elements.modalCancel.onclick = hideModal;

            // Custom Dropdown Logic
            elements.descInput.onfocus = () => showDescSuggestions();
            elements.descInput.oninput = () => showDescSuggestions();
            document.addEventListener('click', (e) => {
                if (!elements.form.contains(e.target)) elements.descDropdown.classList.remove('show');
            });
        }

        // --- Custom Modal Logic ---
        function showModal(title, desc, onConfirm, themeColor) {
            document.getElementById('modal-title').innerText = title;
            document.getElementById('modal-desc').innerText = desc;
            const container = document.getElementById('modal-icon-container');
            
            // Color theme adaptation
            if (themeColor === 'rose') {
                container.className = "w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 bg-rose-500/10 text-rose-500";
                elements.modalConfirm.className = "flex-1 px-4 py-3 rounded-xl bg-rose-600 font-bold text-white text-sm shadow-lg hover:bg-rose-500 transition-colors";
            } else {
                container.className = "w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 bg-violet-500/10 text-violet-500";
                elements.modalConfirm.className = "flex-1 px-4 py-3 rounded-xl bg-violet-600 font-bold text-white text-sm shadow-lg hover:bg-violet-500 transition-colors";
            }

            pendingAction = onConfirm;
            elements.customModal.classList.add('show');
            elements.modalConfirm.onclick = () => {
                pendingAction();
                hideModal();
            };
        }

        function hideModal() {
            elements.customModal.classList.remove('show');
            pendingAction = null;
        }

        function toggleTheme() {
            isDarkMode = !isDarkMode;
            document.documentElement.classList.toggle('dark');
            document.documentElement.classList.toggle('light');
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
            if (elements.themeIcon) elements.themeIcon.setAttribute('data-lucide', isDarkMode ? 'moon' : 'sun');
            if (window.lucide) lucide.createIcons();
            render();
            updateChart();
        }

        function showToast(msg, type = 'success') {
            elements.toastMsg.innerText = msg;
            elements.toast.style.borderColor = type === 'success' ? (isDarkMode ? '#00f2ff' : '#f43f5e') : '#ff007a';
            elements.toast.classList.remove('translate-y-20', 'opacity-0');
            setTimeout(() => elements.toast.classList.add('translate-y-20', 'opacity-0'), 3000);
        }

        function showDescSuggestions() {
            const query = elements.descInput.value.toLowerCase();
            const filtered = storedDescs.filter(d => d.toLowerCase().includes(query));
            if (filtered.length === 0) { elements.descDropdown.classList.remove('show'); return; }
            elements.descDropdown.innerHTML = filtered.map(d => `
                <div class="desc-item group">
                    <span class="flex-grow" onclick="selectDesc('${d.replace(/'/g, "\\'")}')">${d}</span>
                    <button type="button" onclick="removeStoredDesc('${d.replace(/'/g, "\\'")}')" class="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity px-2">
                        <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                </div>`).join('');
            elements.descDropdown.classList.add('show');
            if (window.lucide) lucide.createIcons();
        }

        window.selectDesc = (val) => { elements.descInput.value = val; elements.descDropdown.classList.remove('show'); };
        window.removeStoredDesc = (val) => {
            storedDescs = storedDescs.filter(d => d !== val);
            localStorage.setItem('storedDescs', JSON.stringify(storedDescs));
            showDescSuggestions();
        };

        function render() {
            const searchTerm = elements.searchInput.value.toLowerCase();
            const filtered = transactions.filter(t => t.desc.toLowerCase().includes(searchTerm));
            const incomeVal = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
            const expenseVal = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
            
            elements.totalBalance.innerText = `₹${(incomeVal - expenseVal).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            elements.totalIncome.innerText = `₹${incomeVal.toLocaleString('en-IN')}`;
            elements.totalExpenses.innerText = `₹${expenseVal.toLocaleString('en-IN')}`;
            elements.itemCount.innerText = `${filtered.length} records`;

            const now = new Date();
            const currM = now.getMonth();
            const thisMonthExpenses = transactions.filter(t => {
                const d = new Date(t.timestamp);
                return t.type === 'expense' && d.getMonth() === currM;
            }).reduce((s, t) => s + t.amount, 0);

            elements.monthlySpent.innerText = `₹${thisMonthExpenses.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

            // Handle Active Alert Card
            if (monthlyBudget > 0 && thisMonthExpenses > monthlyBudget) {
                elements.alertCard.classList.remove('hidden');
                elements.cardAlertAmount.innerText = `₹${(thisMonthExpenses - monthlyBudget).toLocaleString('en-IN')}`;
            } else {
                elements.alertCard.classList.add('hidden');
            }

            // Efficiency & Insights
            const ratio = incomeVal > 0 ? ((incomeVal - expenseVal) / incomeVal * 100).toFixed(0) : 0;
            elements.savingsRatio.innerText = `${ratio}% Saving`;

            // Progress Bar
            const bar = document.getElementById('budget-progress-bar');
            if (monthlyBudget > 0) {
                const perc = Math.min((thisMonthExpenses / monthlyBudget) * 100, 100);
                if (bar) {
                    bar.style.width = `${perc}%`;
                    bar.className = perc >= 100 ? 'bg-rose-500 h-full transition-all' : perc >= 80 ? 'bg-amber-500 h-full transition-all' : (isDarkMode ? 'bg-cyan-400' : 'bg-rose-500') + ' h-full transition-all';
                }
                document.getElementById('budget-status').innerText = `Spent: ₹${thisMonthExpenses.toFixed(0)} / ₹${monthlyBudget}`;
                document.getElementById('budget-percentage').innerText = `${perc.toFixed(0)}%`;
            } else {
                if (bar) bar.style.width = '0%';
                document.getElementById('budget-status').innerText = 'Limit not set';
                document.getElementById('budget-percentage').innerText = '0%';
            }

            elements.list.innerHTML = filtered.length === 0 ? '<div class="text-center py-6 text-slate-500 text-xs font-medium italic">No transactions found</div>' : '';
            filtered.slice().sort((a,b) => b.timestamp - a.timestamp).forEach(t => {
                const div = document.createElement('div');
                div.className = `flex items-center justify-between p-3.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 animate-fade-in group hover:border-rose-500/30 dark:hover:border-cyan-500/30 transition-all`;
                const currentColors = isDarkMode ? COLORS : LIGHT_COLORS;
                div.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center text-[10px]" style="background: ${currentColors[t.category]}20; color: ${currentColors[t.category]}"><i data-lucide="${t.type === 'income' ? 'arrow-up-right' : 'arrow-down-right'}" class="w-4 h-4"></i></div>
                        <div><p class="text-sm font-bold">${t.desc}</p><p class="text-[10px] text-slate-500 font-medium">${t.date}</p></div>
                    </div>
                    <div class="flex items-center gap-3">
                        <p class="text-sm font-black ${t.type === 'expense' ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-500'}">${t.type === 'expense' ? '-' : '+'}₹${t.amount.toLocaleString('en-IN')}</p>
                        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="editItem(${t.id})" class="p-1.5 hover:text-cyan-500 dark:hover:text-cyan-400 bg-white dark:bg-white/10 rounded-md border border-slate-100 dark:border-white/5"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
                            <button onclick="deleteItem(${t.id})" class="p-1.5 hover:text-rose-500 bg-white dark:bg-white/10 rounded-md border border-slate-100 dark:border-white/5"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>`;
                elements.list.appendChild(div);
            });
            if (window.lucide) lucide.createIcons();
            updateChart();
        }

        function setupChart() {
            const ctx = document.getElementById('expenseChart').getContext('2d');
            chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0, hoverOffset: 12 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { backgroundColor: isDarkMode ? '#1a1a1e' : '#ffffff', titleColor: isDarkMode ? '#fff' : '#1e293b', bodyColor: isDarkMode ? '#94a3b8' : '#64748b', padding: 12, borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1 } } }
            });
        }

        function updateChart() {
            if (!chartInstance) return;
            const expOnly = transactions.filter(t => t.type === 'expense');
            const catData = expOnly.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {});
            const currentColors = isDarkMode ? COLORS : LIGHT_COLORS;
            chartInstance.data.labels = Object.keys(catData);
            chartInstance.data.datasets[0].data = Object.values(catData);
            chartInstance.data.datasets[0].backgroundColor = Object.keys(catData).map(l => currentColors[l]);
            chartInstance.update();
        }

        function handleFormSubmit(e) {
            e.preventDefault();
            const desc = elements.descInput.value.trim();
            const amount = parseFloat(document.getElementById('amount').value);
            const id = document.getElementById('edit-id').value;
            if (!storedDescs.includes(desc)) { storedDescs.push(desc); localStorage.setItem('storedDescs', JSON.stringify(storedDescs)); }
            if (isEditing) {
                const index = transactions.findIndex(t => t.id == id);
                if (index !== -1) transactions[index] = { ...transactions[index], desc, amount, type: document.getElementById('type').value, category: document.getElementById('category').value };
                isEditing = false; document.getElementById('submit-btn').innerText = "Add Transaction"; showToast("Updated!");
            } else {
                transactions.push({ id: Date.now(), timestamp: Date.now(), desc, amount, type: document.getElementById('type').value, category: document.getElementById('category').value, date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) });
                showToast("Added!");
            }
            localStorage.setItem('transactions', JSON.stringify(transactions));
            elements.form.reset(); elements.descDropdown.classList.remove('show'); render();
        }

        function saveBudget() {
            monthlyBudget = parseFloat(elements.budgetInput.value) || 0;
            localStorage.setItem('monthlyBudget', monthlyBudget);
            showToast("Limit Saved!"); render();
        }

        function resetBudget() {
            monthlyBudget = 0;
            localStorage.removeItem('monthlyBudget');
            elements.budgetInput.value = '';
            showToast("Limit Reset", "error"); render();
        }

        function resetAllData() {
            transactions = [];
            storedDescs = [];
            localStorage.removeItem('transactions');
            localStorage.removeItem('storedDescs');
            render(); showToast("System Reset", "error");
        }

        window.deleteItem = (id) => { transactions = transactions.filter(t => t.id !== id); localStorage.setItem('transactions', JSON.stringify(transactions)); render(); showToast("Deleted", "error"); };
        window.editItem = (id) => { const t = transactions.find(x => x.id === id); if (!t) return; elements.descInput.value = t.desc; document.getElementById('amount').value = t.amount; document.getElementById('type').value = t.type; document.getElementById('category').value = t.category; document.getElementById('edit-id').value = t.id; isEditing = true; document.getElementById('submit-btn').innerText = "Update Transaction"; window.scrollTo({ top: 0, behavior: 'smooth' }); };

        function exportReport() {
            if (transactions.length === 0) return showToast("No data to export", "error");
            const headerHeight = 160; const rowHeight = 50; const totalHeight = headerHeight + (transactions.length * rowHeight) + 80;
            const width = 850; const bgColor = isDarkMode ? '#0a0a0c' : '#fff5f7'; const textColor = isDarkMode ? '#e2e2e2' : '#1e293b'; const accent = isDarkMode ? '#00f2ff' : '#f43f5e';
            let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
                <rect width="100%" height="100%" fill="${bgColor}" />
                <text x="40" y="60" font-family="Arial, sans-serif" font-size="28" fill="${accent}" font-weight="bold">ExpenseFlow Pro Summary</text>
                <text x="40" y="95" font-family="Arial, sans-serif" font-size="14" fill="#888">Generated on ${new Date().toLocaleString('en-IN')}</text>
                <line x1="40" y1="150" x2="${width - 40}" y2="150" stroke="#333" stroke-width="1" />`;
            transactions.slice().sort((a,b) => b.timestamp - a.timestamp).forEach((t, i) => {
                const y = headerHeight + 35 + (i * rowHeight); const col = t.type === 'expense' ? '#f43f5e' : '#10b981';
                svg += `<text x="40" y="${y}" font-family="Arial, sans-serif" font-size="14" fill="${textColor}">${t.desc}</text>
                        <text x="320" y="${y}" font-family="Arial, sans-serif" font-size="13" fill="#888">${t.category}</text>
                        <text x="500" y="${y}" font-family="Arial, sans-serif" font-size="14" fill="${col}" font-weight="bold">₹${t.amount.toLocaleString('en-IN')}</text>
                        <text x="680" y="${y}" font-family="Arial, sans-serif" font-size="12" fill="#888">${t.date}</text>
                        <line x1="40" y1="${y + 12}" x2="${width - 40}" y2="${y + 12}" stroke="${isDarkMode ? '#222' : '#eee'}" stroke-width="0.5" />`;
            });
            svg += `<text x="40" y="${totalHeight - 30}" font-family="Arial, sans-serif" font-size="12" fill="#888" font-style="italic">Generated via ExpenseFlow Pro | Babusaheb</text></svg>`;
            const blob = new Blob([svg], {type: 'image/svg+xml'});
            const dl = document.createElement('a'); dl.href = URL.createObjectURL(blob); dl.download = `ExpenseFlow_Report.svg`; dl.click(); showToast("Report Exported!");
        }

        window.addEventListener('DOMContentLoaded', init);
 
