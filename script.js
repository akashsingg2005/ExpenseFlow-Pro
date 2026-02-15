        let elements = {};
        let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
        let monthlyBudget = parseFloat(localStorage.getItem('monthlyBudget')) || 0;
        let isDarkMode = localStorage.getItem('theme') !== 'light';
        let chartInstance = null;
        let isEditing = false;

        const COLORS = { 'Food': '#00f2ff', 'Rent': '#7000ff', 'Transport': '#ff007a', 'Shopping': '#00ff88', 'Salary': '#f1c40f', 'Other': '#94a3b8' };
        const LIGHT_COLORS = { 'Food': '#0891b2', 'Rent': '#7c3aed', 'Transport': '#e11d48', 'Shopping': '#059669', 'Salary': '#d97706', 'Other': '#64748b' };

        function init() {
            elements = {
                form: document.getElementById('transaction-form'),
                list: document.getElementById('transaction-list'),
                searchInput: document.getElementById('search-bar'),
                toast: document.getElementById('toast'),
                toastMsg: document.getElementById('toast-msg'),
                themeBtn: document.getElementById('theme-toggle'),
                themeIcon: document.getElementById('theme-icon'),
                exportBtn: document.getElementById('export-btn'),
                budgetInput: document.getElementById('monthly-budget-input'),
                saveBudgetBtn: document.getElementById('save-budget-btn'),
                resetBudgetBtn: document.getElementById('reset-budget-btn'),
                budgetAlert: document.getElementById('budget-alert'),
                totalBalance: document.getElementById('total-balance'),
                totalIncome: document.getElementById('total-income'),
                totalExpenses: document.getElementById('total-expenses'),
                itemCount: document.getElementById('item-count'),
                monthlySpent: document.getElementById('monthly-spent-val'),
                savingsRatio: document.getElementById('savings-ratio'),
                insightsText: document.getElementById('insights-text'),
                alertOverAmount: document.getElementById('alert-over-amount')
            };

            // Theme fix on load
            if (!isDarkMode) {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
                if (elements.themeIcon) elements.themeIcon.setAttribute('data-lucide', 'sun');
            }

            if (typeof lucide !== 'undefined') lucide.createIcons();
            if (elements.budgetInput) elements.budgetInput.value = monthlyBudget || '';
            
            // Initialization sequence
            setupChart();
            render();
            
            // Event bindings
            if (elements.themeBtn) elements.themeBtn.onclick = toggleTheme;
            if (elements.saveBudgetBtn) elements.saveBudgetBtn.onclick = saveBudget;
            if (elements.resetBudgetBtn) elements.resetBudgetBtn.onclick = resetBudget;
            if (elements.form) elements.form.onsubmit = handleFormSubmit;
            if (elements.exportBtn) elements.exportBtn.onclick = exportReport;
            if (elements.searchInput) elements.searchInput.oninput = render;
            document.getElementById('clear-data').onclick = resetData;
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
            if (!elements.toastMsg || !elements.toast) return;
            elements.toastMsg.innerText = msg;
            elements.toast.style.borderColor = type === 'success' ? (isDarkMode ? '#00f2ff' : '#f43f5e') : '#ff007a';
            elements.toast.classList.remove('translate-y-20', 'opacity-0');
            setTimeout(() => elements.toast.classList.add('translate-y-20', 'opacity-0'), 3000);
        }

        function render() {
            const searchTerm = elements.searchInput ? elements.searchInput.value.toLowerCase() : '';
            const filtered = transactions.filter(t => t.desc.toLowerCase().includes(searchTerm));

            const totalIncomeValue = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
            const totalExpenseValue = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
            
            if (elements.totalBalance) elements.totalBalance.innerText = `₹${(totalIncomeValue - totalExpenseValue).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            if (elements.totalIncome) elements.totalIncome.innerText = `₹${totalIncomeValue.toLocaleString('en-IN')}`;
            if (elements.totalExpenses) elements.totalExpenses.innerText = `₹${totalExpenseValue.toLocaleString('en-IN')}`;
            if (elements.itemCount) elements.itemCount.innerText = `${filtered.length} records`;

            const now = new Date();
            const currM = now.getMonth();
            const thisMonthExpenses = transactions.filter(t => {
                const d = new Date(t.timestamp);
                return t.type === 'expense' && d.getMonth() === currM;
            }).reduce((s, t) => s + t.amount, 0);

            if (elements.monthlySpent) elements.monthlySpent.innerText = `₹${thisMonthExpenses.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

            if (elements.insightsText) {
                if (transactions.length > 0) {
                    const expOnly = transactions.filter(t => t.type === 'expense' && new Date(t.timestamp).getMonth() === currM);
                    const catTotals = expOnly.reduce((a, t) => { a[t.category] = (a[t.category] || 0) + t.amount; return a; }, {});
                    const topCat = Object.keys(catTotals).reduce((a, b) => catTotals[a] > catTotals[b] ? a : b, '');
                    elements.insightsText.innerHTML = topCat ? `You spent most on <b>${topCat}</b> this month. Consider a sub-limit for this category.` : "Keep tracking to unlock personalized insights.";
                } else {
                    elements.insightsText.innerHTML = "Add a transaction to see insights.";
                }
            }

            if (elements.savingsRatio) {
                const ratio = totalIncomeValue > 0 ? ((totalIncomeValue - totalExpenseValue) / totalIncomeValue * 100).toFixed(0) : 0;
                elements.savingsRatio.innerText = `${ratio}% Saving`;
            }

            // Budget calculations
            const bar = document.getElementById('budget-progress-bar');
            const status = document.getElementById('budget-status');
            const pValue = document.getElementById('budget-percentage');

            if (monthlyBudget > 0) {
                const perc = Math.min((thisMonthExpenses / monthlyBudget) * 100, 100);
                if (bar) {
                    bar.style.width = `${perc}%`;
                    bar.className = perc >= 100 ? 'bg-rose-500 h-full' : perc >= 80 ? 'bg-amber-500 h-full' : (isDarkMode ? 'bg-cyan-400' : 'bg-rose-500') + ' h-full';
                }
                if (status) status.innerText = `Spent: ₹${thisMonthExpenses.toFixed(0)} / ₹${monthlyBudget}`;
                if (pValue) pValue.innerText = `${perc.toFixed(0)}%`;
                
                if (elements.budgetAlert) {
                    const exceeded = thisMonthExpenses > monthlyBudget;
                    elements.budgetAlert.classList.toggle('hidden', !exceeded);
                    if (exceeded && elements.alertOverAmount) {
                        elements.alertOverAmount.innerText = `₹${(thisMonthExpenses - monthlyBudget).toLocaleString('en-IN')} Over`;
                    }
                }
            } else {
                if (bar) bar.style.width = `0%`;
                if (status) status.innerText = `Budget not set`;
                if (pValue) pValue.innerText = `0%`;
                if (elements.budgetAlert) elements.budgetAlert.classList.add('hidden');
            }

            if (elements.list) {
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
            }
            if (window.lucide) lucide.createIcons();
            updateChart();
        }

        function setupChart() {
            const chartCanvas = document.getElementById('expenseChart');
            if (!chartCanvas) return;
            const ctx = chartCanvas.getContext('2d');
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
            const descInput = document.getElementById('desc');
            const amountInput = document.getElementById('amount');
            const typeInput = document.getElementById('type');
            const catInput = document.getElementById('category');
            const editIdInput = document.getElementById('edit-id');

            const desc = descInput.value.trim();
            const amount = parseFloat(amountInput.value);
            const id = editIdInput.value;

            if (isEditing) {
                const index = transactions.findIndex(t => t.id == id);
                if (index !== -1) transactions[index] = { ...transactions[index], desc, amount, type: typeInput.value, category: catInput.value };
                isEditing = false;
                document.getElementById('submit-btn').innerText = "Add Transaction";
                showToast("Updated!");
            } else {
                transactions.push({ 
                    id: Date.now(), 
                    timestamp: Date.now(), 
                    desc, amount, 
                    type: typeInput.value, 
                    category: catInput.value, 
                    date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) 
                });
                showToast("Added!");
            }
            localStorage.setItem('transactions', JSON.stringify(transactions));
            elements.form.reset();
            render();
        }

        function saveBudget() {
            monthlyBudget = parseFloat(elements.budgetInput.value) || 0;
            localStorage.setItem('monthlyBudget', monthlyBudget);
            showToast("Limit Saved!");
            render();
        }

        function resetBudget() {
            monthlyBudget = 0;
            localStorage.removeItem('monthlyBudget');
            elements.budgetInput.value = '';
            showToast("Budget Reset", "error");
            render();
        }

        window.deleteItem = (id) => { 
            transactions = transactions.filter(t => t.id !== id); 
            localStorage.setItem('transactions', JSON.stringify(transactions)); 
            render(); 
            showToast("Deleted", "error"); 
        };

        window.editItem = (id) => { 
            const t = transactions.find(x => x.id === id); 
            if (!t) return;
            document.getElementById('desc').value = t.desc; 
            document.getElementById('amount').value = t.amount; 
            document.getElementById('type').value = t.type; 
            document.getElementById('category').value = t.category; 
            document.getElementById('edit-id').value = t.id; 
            isEditing = true; 
            document.getElementById('submit-btn').innerText = "Update Transaction"; 
            window.scrollTo({ top: 0, behavior: 'smooth' }); 
        };

        function resetData() { 
            if(confirm("Clear all transaction data?")) { 
                transactions = []; 
                localStorage.removeItem('transactions'); 
                render(); 
                showToast("Data reset", "error"); 
            } 
        }

        function exportReport() {
            if (transactions.length === 0) return showToast("No data to export", "error");
            const headerHeight = 160;
            const rowHeight = 50;
            const footerHeight = 80;
            const totalHeight = headerHeight + (transactions.length * rowHeight) + footerHeight;
            const w = 850;
            const bgColor = isDarkMode ? '#0a0a0c' : '#fff5f7';
            const textColor = isDarkMode ? '#e2e2e2' : '#1e293b';
            const accent = isDarkMode ? '#00f2ff' : '#f43f5e';
            let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${totalHeight}" viewBox="0 0 ${w} ${totalHeight}">
                <rect width="100%" height="100%" fill="${bgColor}" />
                <text x="40" y="60" font-family="Arial, sans-serif" font-size="28" fill="${accent}" font-weight="bold">ExpenseFlow Pro Summary</text>
                <text x="40" y="95" font-family="Arial, sans-serif" font-size="14" fill="#888">Generated on ${new Date().toLocaleString('en-IN')}</text>
                
                <text x="40" y="140" font-family="Arial, sans-serif" font-size="12" fill="#888" font-weight="bold">DESCRIPTION</text>
                <text x="320" y="140" font-family="Arial, sans-serif" font-size="12" fill="#888" font-weight="bold">CATEGORY</text>
                <text x="500" y="140" font-family="Arial, sans-serif" font-size="12" fill="#888" font-weight="bold">AMOUNT</text>
                <text x="680" y="140" font-family="Arial, sans-serif" font-size="12" fill="#888" font-weight="bold">DATE &amp; TIME</text>
                <line x1="40" y1="150" x2="${w - 40}" y2="150" stroke="#333" stroke-width="1" />`;
            
            transactions.slice().sort((a,b) => b.timestamp - a.timestamp).forEach((t, i) => {
                const y = headerHeight + 35 + (i * rowHeight);
                const col = t.type === 'expense' ? '#f43f5e' : '#10b981';
                svg += `<text x="40" y="${y}" font-family="Arial, sans-serif" font-size="14" fill="${textColor}">${t.desc}</text>
                        <text x="320" y="${y}" font-family="Arial, sans-serif" font-size="13" fill="#888">${t.category}</text>
                        <text x="500" y="${y}" font-family="Arial, sans-serif" font-size="14" fill="${col}" font-weight="bold">₹${t.amount.toLocaleString('en-IN')}</text>
                        <text x="680" y="${y}" font-family="Arial, sans-serif" font-size="12" fill="#888">${t.date}</text>
                        <line x1="40" y1="${y + 12}" x2="${w - 40}" y2="${y + 12}" stroke="${isDarkMode ? '#222' : '#eee'}" stroke-width="0.5" />`;
            });
            
            svg += `<text x="40" y="${totalHeight - 30}" font-family="Arial, sans-serif" font-size="12" fill="#888" font-style="italic">Generated via ExpenseFlow Pro | Babusaheb</text></svg>`;
            const blob = new Blob([svg], {type: 'image/svg+xml'});
            const dl = document.createElement('a');
            dl.href = URL.createObjectURL(blob);
            dl.download = `ExpenseFlow_Report.svg`;
            dl.click();
            showToast("Report Exported!");
        }

        window.addEventListener('DOMContentLoaded', init);
   