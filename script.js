// Application State Management
class FinanceApp {
    constructor() {
        this.state = {
            members: [],
            categories: {
                ics: { name: 'ICS', amount: 1, description: '€1 per partitella', type: 'category', parentCategory: null, active: true, deletable: false }
            },
            activities: [],
            icsEvents: [],
            notifications: [],
            globalDonations: []
        };
    }

    init() {
        this.currentPeriod = 'mensile'; // Default period
        this.currentFineStatus = 'pagate'; // Default fine status filter
        this.currentCategoryFineStatus = 'pagate'; // Default category fine status filter
        this.selectedMembers = new Set(); // Initialize selected members set
        this.setupEventListeners();
        this.generateActivities();
        this.initializeTabs();
        this.updateRestoreButton();
        this.updateButtonLabels();
        
        // Set up periodic check for restore button (every minute)
        setInterval(() => {
            this.updateRestoreButton();
        }, 60000);
    }
    
    initializeTabs() {
        // Initialize Multe tabs - show "Assegna Multe" by default
        setTimeout(() => {
            this.switchMulteTab('assegna');
        }, 100);
        
        // Initialize Rosa tabs - show "Staff" by default
        setTimeout(() => {
            this.switchRosaTab('staff');
        }, 100);
    }

    // Data Management
    async loadData() {
        try {
            // Detect if we're running on a server or as a static file
            const apiBaseUrl = this.getApiBaseUrl();
            if (apiBaseUrl) {
                const response = await fetch(`${apiBaseUrl}/api/data`);
                if (response.ok) {
                    const backendData = await response.json();
                    if (backendData && Object.keys(backendData).length > 0) {
                        this.loadDataFromSource(backendData, 'backend');
                        console.log('Dati caricati dal backend');
                        return;
                    }
                }
            }
        } catch (error) {
            console.warn('Backend non disponibile, provo localStorage:', error.message);
        }
        
        try {
            // Fallback to localStorage
            const localData = localStorage.getItem('financeAppData');
            if (localData) {
                const parsedData = JSON.parse(localData);
                if (parsedData && Object.keys(parsedData).length > 0) {
                    this.loadDataFromSource(parsedData, 'localStorage');
                    console.log('Dati caricati da localStorage (fallback)');
                    return;
                }
            }
        } catch (error) {
            console.error('Errore nel caricamento da localStorage:', error);
        }
        
        console.log('Utilizzo dati di default');
    }
    
    loadDataFromSource(savedData, source) {
        // Merge with default state, keeping existing structure
        this.state = {
            ...this.state,
            members: savedData.members || this.state.members,
            categories: savedData.categories || this.state.categories,
            activities: savedData.activities || this.state.activities,
            icsEvents: savedData.icsEvents || this.state.icsEvents,
            notifications: savedData.notifications || this.state.notifications,
            globalDonations: savedData.globalDonations || this.state.globalDonations
        };
        
        // Migration: add 'active' field to existing members if missing
        this.state.members.forEach(member => {
            if (member.active === undefined) {
                member.active = true;
            }
        });
        
        // Migration: add 'active' field to existing categories if missing
        Object.keys(this.state.categories).forEach(categoryKey => {
            if (this.state.categories[categoryKey].active === undefined) {
                this.state.categories[categoryKey].active = true;
            }
        });
        
        console.log(`Dati caricati da ${source}`);
    }

    // Helper method to get API base URL
    getApiBaseUrl() {
        // Check if we have a proper hostname (not file:// protocol)
        if (window.location.hostname && window.location.hostname !== '') {
            return window.location.origin;
        }
        // For file:// protocol, no backend available
        return null;
    }

    async saveData() {
        try {
            // Try to save to backend first
            const apiBaseUrl = this.getApiBaseUrl();
            if (apiBaseUrl) {
                const response = await fetch(`${apiBaseUrl}/api/data`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.state)
                });
                
                if (response.ok) {
                    console.log('Dati salvati nel backend');
                    // Also save to localStorage as backup
                    localStorage.setItem('financeAppData', JSON.stringify(this.state));
                    console.log('Backup salvato in localStorage');
                    return;
                } else {
                    throw new Error(`Errore HTTP: ${response.status}`);
                }
            }
        } catch (error) {
            console.warn('Backend non disponibile, salvo solo in localStorage:', error.message);
        }
        
        try {
            // Fallback to localStorage only
            localStorage.setItem('financeAppData', JSON.stringify(this.state));
            console.log('Dati salvati in localStorage (fallback)');
        } catch (error) {
            console.error('Errore nel salvataggio dei dati:', error);
        }
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.dataset.section;
                this.showSection(section);
            });
        });

        // Add Member Modal
        const addMemberBtn = document.getElementById('addMemberBtn');
        if (addMemberBtn) {
            addMemberBtn.addEventListener('click', () => {
                this.openAddMemberModal();
            });
        }

        // Close Add Member Modal
        const closeAddMemberBtn = document.getElementById('closeAddMemberBtn');
        if (closeAddMemberBtn) {
            closeAddMemberBtn.addEventListener('click', () => {
                this.closeAddMemberModal();
            });
        }

        // Submit Add Member Form
        const submitAddMemberBtn = document.getElementById('submitAddMemberBtn');
        if (submitAddMemberBtn) {
            submitAddMemberBtn.addEventListener('click', () => {
                this.addMember();
            });
        }

        // Add Member Form
        const addMemberForm = document.getElementById('addMemberForm');
        if (addMemberForm) {
            addMemberForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addMember();
            });
        }

        // Modal close buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
                this.closeModal(e.target.closest('.modal'));
            }
        });

        // Assign Fine Form
        const assignFineForm = document.getElementById('assignFineForm');
        if (assignFineForm) {
            assignFineForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.assignFine();
            });
        }
        
        // Add event listener for macrocategory selection
        const macroCategorySelect = document.getElementById('fineMacroCategory');
        if (macroCategorySelect) {
            macroCategorySelect.addEventListener('change', () => {
                this.updateMicroCategoriesSelect();
            });
        }
        
        // Add event listener for microcategory selection
        const microCategorySelect = document.getElementById('fineCategory');
        if (microCategorySelect) {
            microCategorySelect.addEventListener('change', () => {
                this.onMicroCategoryChange();
            });
        }

        // ICS Assignment
        // assignICS button is handled by the centralized event delegation system

        // Tab Management
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.period);
            });
        });
        
        // Fine Status Filter Management
        document.querySelectorAll('.status-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.dataset.target || 'ranking';
                this.switchFineStatus(e.target.dataset.status, target);
            });
        });

        // RIMOSSO: Category Tabs event listeners
        // Event listeners per i tab delle categorie rimossi insieme alla sezione "Multe per Categoria"
        
        // Multe Tab Management
        document.querySelectorAll('.multe-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchMulteTab(e.target.getAttribute('data-multe-section'));
            });
        });
        
        // Rosa Tab Management
        document.querySelectorAll('.rosa-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchRosaTab(e.target.getAttribute('data-rosa-section'));
            });
        });

        // PDF Download
        const pdfBtn = document.querySelector('.btn-pdf');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => {
                this.downloadPDF();
            });
        }

        // Temporary PDF Download (all fines up to current date)
        const pdfTempBtn = document.querySelector('.btn-pdf-temp');
        if (pdfTempBtn) {
            pdfTempBtn.addEventListener('click', () => {
                this.downloadTemporaryPDF();
            });
        }

        // Logout Button
        const logoutBtn = document.querySelector('.btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (confirm('Sei sicuro di voler effettuare il logout?')) {
                    try {
                        const response = await fetch('/logout', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            window.location.href = '/login.html';
                        } else {
                            alert('Errore durante il logout');
                        }
                    } catch (error) {
                        console.error('Errore durante il logout:', error);
                        alert('Errore di connessione durante il logout');
                    }
                }
            });
        }

        // Member Card Clicks
        document.addEventListener('click', (e) => {
            // Check if click is on a button or input inside member card, but exclude specific buttons
            if ((e.target.closest('button') && !e.target.closest('#gestisciCategorie') && !e.target.closest('#eliminaMulte') && !e.target.closest('.btn-delete')) || e.target.closest('input') || e.target.closest('.member-actions')) {
                return; // Don't toggle accordion for button/input clicks
            }
            
            if (e.target.closest('.member-card')) {
                const memberCard = e.target.closest('.member-card');
                const memberId = memberCard.dataset.member;
                this.toggleMemberAccordion(memberId);
            }
        });

        // Fine payment toggle
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('fine-payment-toggle')) {
                const memberId = e.target.dataset.member;
                const fineIndex = parseInt(e.target.dataset.fine);
                this.toggleFinePayment(memberId, fineIndex);
            }
        });

        // Centralized Event Delegation System
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            // Get action from data-action attribute or derive from classes/ids
            let action = button.dataset.action;
            let params = button.dataset.params ? JSON.parse(button.dataset.params) : {};
            
            // Debug logging per il bottone "Visualizza multe pagate"
            if (button.classList.contains('btn-show-paid')) {
                console.log('🔍 [DEBUG] Bottone "Visualizza multe pagate" cliccato:', {
                    button: button,
                    action: action,
                    params: params,
                    dataParams: button.getAttribute('data-params'),
                    classList: Array.from(button.classList)
                });
            }

            // Prevent default for all button clicks to avoid conflicts
            e.preventDefault();
            e.stopPropagation();

            // If no data-action, derive action from button characteristics
            if (!action) {
                // Handle by ID
                if (button.id === 'gestisciCategorie') action = 'openCategoriesModal';
                else if (button.id === 'eliminaMulte') action = 'deleteAssignedAndPaidFines';
                else if (button.id === 'restoreMulte') action = 'restoreDeletedFines';
                else if (button.id === 'addMemberBtn') action = 'openAddMemberModal';
                else if (button.id === 'closeAddMemberBtn') action = 'closeAddMemberModal';
                else if (button.id === 'submitAddMemberBtn') action = 'submitAddMember';
                else if (button.id === 'clearSelection') action = 'clearMemberSelection';
                else if (button.id === 'assignICS') action = 'assignICS';
                else if (button.id === 'addDonationBtn') action = 'addGlobalDonation';
                else if (button.id === 'mobileMenuToggle') action = 'toggleMobileMenu';
                
                // Handle by class
                else if (button.classList.contains('btn-close') && button.closest('#categoriesModal')) action = 'closeCategoriesModal';
                else if (button.classList.contains('btn-add-category')) action = 'addNewCategory';
                else if (button.classList.contains('btn-save')) {
                    action = 'saveCategory';
                    const onclick = button.getAttribute('onclick');
                    if (onclick) {
                        const categoryKey = onclick.match(/saveCategory\('([^']+)'\)/)?.[1];
                        if (categoryKey) params.categoryKey = categoryKey;
                    }
                }
                else if (button.classList.contains('btn-edit')) {
                    action = 'editCategory';
                    const onclick = button.getAttribute('onclick');
                    if (onclick) {
                        const categoryKey = onclick.match(/editCategory\('([^']+)'\)/)?.[1];
                        if (categoryKey) params.categoryKey = categoryKey;
                    }
                }
                else if (button.classList.contains('btn-cancel')) action = 'renderCategoriesList';
                else if (button.classList.contains('btn-delete') && !button.classList.contains('btn-delete-category')) {
                    const onclick = button.getAttribute('onclick');
                    if (onclick) {
                        const memberId = onclick.match(/deleteMember\('([^']+)'\)/)?.[1];
                        const categoryKey = onclick.match(/deleteCategory\('([^']+)'\)/)?.[1];
                        if (memberId) {
                            action = 'deleteMember';
                            params.memberId = memberId;
                        } else if (categoryKey) {
                            action = 'deleteCategory';
                            params.categoryKey = categoryKey;
                        }
                    }
                }
                else if (button.classList.contains('btn-reactivate')) {
                    const onclick = button.getAttribute('onclick');
                    if (onclick) {
                        const memberId = onclick.match(/reactivateMember\('([^']+)'\)/)?.[1];
                        const categoryKey = onclick.match(/reactivateCategory\('([^']+)'\)/)?.[1];
                        if (memberId) {
                            action = 'reactivateMember';
                            params.memberId = memberId;
                        } else if (categoryKey) {
                            action = 'reactivateCategory';
                            params.categoryKey = categoryKey;
                        }
                    }
                }
                else if (button.classList.contains('btn-pay')) {
                    action = 'toggleFinePayment';
                    const onclick = button.getAttribute('onclick');
                    if (onclick) {
                        const matches = onclick.match(/toggleFinePayment\('([^']+)',\s*(\d+)\)/);
                        if (matches) {
                            params.memberId = matches[1];
                            params.fineIndex = parseInt(matches[2]);
                        }
                    }
                }
                else if (button.classList.contains('btn-show-paid')) {
                    action = 'togglePaidFines';
                    const dataParams = button.getAttribute('data-params');
                    if (dataParams) {
                        try {
                            const parsedParams = JSON.parse(dataParams);
                            if (parsedParams.memberId) params.memberId = parsedParams.memberId;
                        } catch (e) {
                            console.error('Error parsing data-params:', e);
                        }
                    }
                }
                
                // Handle navigation buttons
                else if (button.classList.contains('nav-link')) {
                    action = 'switchSection';
                    params.section = button.dataset.section;
                }
                else if (button.classList.contains('multe-tab-btn')) {
                    action = 'switchMulteTab';
                    params.section = button.dataset.multeSection;
                }
                else if (button.classList.contains('rosa-tab-btn')) {
                    action = 'switchRosaTab';
                    params.section = button.dataset.rosaSection;
                }
                else if (button.classList.contains('tab-btn')) {
                    action = 'switchPeriodTab';
                    params.period = button.dataset.period;
                }
                else if (button.classList.contains('status-tab-btn')) {
                    action = 'switchStatusTab';
                    params.status = button.dataset.status;
                    params.target = button.dataset.target;
                }
                // RIMOSSO: Gestione click sui category-tab
                // Rimosso insieme alla sezione "Multe per Categoria"
                
                // Handle form buttons
                else if (button.type === 'submit') {
                    const form = button.closest('form');
                    if (form && form.id === 'assignFineForm') {
                        action = 'assignFine';
                    }
                }
                
                // Handle donation button
                else if (button.classList.contains('donation-submit-btn') || button.textContent.includes('Aggiungi Offerta')) {
                    action = 'addGlobalDonation';
                }
                
                // Handle PDF buttons
                else if (button.classList.contains('btn-pdf')) {
                    action = 'generatePDF';
                }
                else if (button.classList.contains('btn-pdf-temp')) {
                    action = 'generateTempPDF';
                }
                
                // Handle clear selection button
                else if (button.classList.contains('btn-clear-selection')) {
                    action = 'clearMemberSelection';
                }
            }

            // Execute the action
            this.executeAction(action, params, button);
        });
        
        // Event delegation for donor type selection in offerte libere
        document.addEventListener('change', (e) => {
            if (e.target.name === 'donorType') {
                this.toggleDonorInput();
            }
        });
        
        // Initialize donor input toggle on page load
        this.toggleDonorInput();

        // Event delegation for member selection in assignment form
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('member-selection-card')) {
                const memberId = e.target.dataset.memberId;
                if (memberId) {
                    this.toggleMemberSelection(memberId);
                }
            }
        });        

    }

    // Centralized action executor for event delegation
    executeAction(action, params, button) {
        if (!action) return;

        // Debug logging per togglePaidFines
        if (action === 'togglePaidFines') {
            console.log('🔍 [DEBUG] Esecuzione azione togglePaidFines:', {
                action: action,
                params: params,
                button: button,
                memberId: params.memberId
            });
        }

        try {
            switch (action) {
                // Navigation actions
                case 'switchSection':
                    if (params.section) this.switchSection(params.section);
                    break;
                case 'switchMulteTab':
                    if (params.section) this.switchMulteTab(params.section);
                    break;
                case 'switchRosaTab':
                    if (params.section) this.switchRosaTab(params.section);
                    break;
                case 'switchPeriodTab':
                    if (params.period) this.switchTab(params.period);
                    break;
                case 'switchStatusTab':
                    this.switchFineStatus(params.status, params.target);
                    break;
                // RIMOSSO: case 'switchCategoryTab'
                // Rimosso insieme alla sezione "Multe per Categoria"

                // Modal actions
                case 'openCategoriesModal':
                    if (typeof openCategoriesModal === 'function') openCategoriesModal();
                    break;
                case 'closeCategoriesModal':
                    if (typeof closeCategoriesModal === 'function') closeCategoriesModal();
                    break;
                case 'openAddMemberModal':
                    this.openAddMemberModal();
                    break;
                case 'closeAddMemberModal':
                    this.closeAddMemberModal();
                    break;

                // Member actions
                case 'submitAddMember':
                    this.submitAddMember();
                    break;
                case 'deleteMember':
                    if (params.memberId) this.deleteMember(params.memberId);
                    break;
                case 'reactivateMember':
                    if (params.memberId) this.reactivateMember(params.memberId);
                    break;

                // Category actions
                case 'addNewCategory':
                    if (typeof addNewCategory === 'function') addNewCategory();
                    break;
                case 'saveCategory':
                    if (params.categoryKey && typeof saveCategory === 'function') {
                        saveCategory(params.categoryKey);
                    }
                    break;
                case 'editCategory':
                    if (params.categoryKey && typeof editCategory === 'function') {
                        editCategory(params.categoryKey);
                    }
                    break;
                case 'deleteCategory':
                    if (params.categoryKey && typeof deleteCategory === 'function') {
                        deleteCategory(params.categoryKey);
                    }
                    break;
                case 'reactivateCategory':
                    if (params.categoryKey && typeof reactivateCategory === 'function') {
                        reactivateCategory(params.categoryKey);
                    }
                    break;
                case 'renderCategoriesList':
                    if (typeof renderCategoriesList === 'function') renderCategoriesList();
                    break;

                // Fine actions
                case 'toggleFinePayment':
                    if (params.memberId && params.fineIndex !== undefined) {
                        this.toggleFinePayment(params.memberId, params.fineIndex);
                    }
                    break;
                case 'togglePaidFines':
                    if (params.memberId) {
                        console.log('🔍 [DEBUG] Chiamata togglePaidFines con memberId:', params.memberId);
                        try {
                            this.togglePaidFines(params.memberId);
                        } catch (error) {
                            console.error('❌ [ERROR] Errore in togglePaidFines:', error);
                        }
                    } else {
                        console.error('❌ [ERROR] memberId mancante per togglePaidFines:', params);
                    }
                    break;
                case 'deleteAssignedAndPaidFines':
                    if (typeof deleteAssignedAndPaidFines === 'function') {
                        deleteAssignedAndPaidFines();
                    }
                    break;
                case 'restoreDeletedFines':
                    if (typeof restoreDeletedFines === 'function') {
                        restoreDeletedFines();
                    }
                    break;
                case 'assignFine':
                    this.assignFine();
                    break;
                case 'assignICS':
                    this.assignICS();
                    break;

                // Selection actions
                case 'clearMemberSelection':
                    this.clearMemberSelection();
                    break;

                // Donation actions
                case 'addGlobalDonation':
                    if (typeof addGlobalDonation === 'function') {
                        addGlobalDonation();
                    } else if (this.addGlobalDonation) {
                        this.addGlobalDonation();
                    }
                    break;

                // PDF actions
                case 'generatePDF':
                    this.generatePDF();
                    break;
                case 'generateTempPDF':
                    this.generateTempPDF();
                    break;

                // Mobile menu
                case 'toggleMobileMenu':
                    this.toggleMobileMenu();
                    break;

                default:
                    console.warn(`Unknown action: ${action}`);
                    break;
            }
        } catch (error) {
            console.error(`Error executing action ${action}:`, error);
        }
    }

    // Helper function to check if a date is in the current period
    isInCurrentPeriod(dateString, period) {
        const date = new Date(dateString);
        const now = new Date();
        
        if (period === 'mensile') {
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        } else if (period === 'stagionale') {
            // Define season as August to July (football season)
            // Season starts from August 1st, 2025 as per user specification
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth(); // 0-based (0=January, 7=August)
            
            let seasonStart, seasonEnd;
            if (currentMonth >= 7) { // August onwards (month 7 = August)
                seasonStart = new Date(currentYear, 7, 1); // August 1st current year
                seasonEnd = new Date(currentYear + 1, 6, 31); // July 31st next year
            } else { // January to July
                seasonStart = new Date(currentYear - 1, 7, 1); // August 1st previous year
                seasonEnd = new Date(currentYear, 6, 31); // July 31st current year
            }
            
            // Ensure we don't go before the official season start (August 1st, 2025)
            const officialSeasonStart = new Date(2025, 7, 1); // August 1st, 2025
            if (seasonStart < officialSeasonStart) {
                seasonStart = officialSeasonStart;
            }
            
            return date >= seasonStart && date <= now;
        }
        
        return true;
    }

    // Get member stats filtered by period
    getMemberStatsByPeriod(memberId, period, status = 'pagate') {
        const member = this.state.members.find(m => m.id === memberId);
        if (!member) return { totalFines: 0, paidAmount: 0, unpaidAmount: 0, totalContribution: 0, totalAssigned: 0, assignedAmount: 0, totalICS: 0, paidICS: 0, totalPaid: 0, totalDonations: 0 };
        
        const periodFines = member.fines.filter(fine => this.isInCurrentPeriod(fine.date, period));
        const periodDonations = member.donations ? member.donations.filter(donation => this.isInCurrentPeriod(donation.date, period)) : [];
        
        // Add global donations attributed to this member
        let globalDonationsForMember = 0;
        if (this.state.globalDonations) {
            const periodGlobalDonations = this.state.globalDonations.filter(donation => 
                this.isInCurrentPeriod(donation.date, period) && donation.memberId === memberId
            );
            globalDonationsForMember = periodGlobalDonations.reduce((sum, donation) => sum + donation.amount, 0);
        }
        
        // Separate regular fines from ICS
        const regularFines = periodFines.filter(fine => fine.category !== 'ics');
        const icsFines = periodFines.filter(fine => fine.category === 'ics');
        
        const totalFines = Math.round(regularFines.reduce((sum, fine) => sum + fine.amount, 0) * 100) / 100;
        const paidAmount = Math.round(regularFines.filter(fine => fine.paid).reduce((sum, fine) => sum + fine.amount, 0) * 100) / 100;
        const unpaidAmount = Math.round((totalFines - paidAmount) * 100) / 100;
        
        const totalICS = Math.round(icsFines.reduce((sum, fine) => sum + fine.amount, 0) * 100) / 100;
        const paidICS = Math.round(icsFines.filter(fine => fine.paid).reduce((sum, fine) => sum + fine.amount, 0) * 100) / 100;
        
        const donationsAmount = Math.round((periodDonations.reduce((sum, donation) => sum + donation.amount, 0) + globalDonationsForMember) * 100) / 100;
        
        // Total paid includes fines, ICS, and donations
        const totalPaid = Math.round((paidAmount + paidICS + donationsAmount) * 100) / 100;
        
        // Calculate assigned amounts (all fines, paid and unpaid) - donations NOT included in assigned
        const assignedAmount = Math.round((totalFines + totalICS) * 100) / 100;
        const totalAssigned = Math.round((totalFines + totalICS) * 100) / 100;
        
        // Total contribution depends on status: donations only count for 'pagate'
        const totalContribution = status === 'pagate' ? totalPaid : totalAssigned;
        
        return {
            totalFines,
            paidAmount,
            unpaidAmount,
            totalContribution,
            donationsAmount,
            assignedAmount,
            totalAssigned,
            totalICS,
            paidICS,
            totalPaid,
            totalDonations: donationsAmount
        };
    }

    // Update categories grid in classifiche page
    updateCategoriesGridClassifica() {
        const grid = document.getElementById('categoriesGridClassifica');
        if (!grid) return;
        
        const period = this.currentPeriod || 'mensile';
        grid.innerHTML = '';
        
        // Separate categories: ICS first, then Offerte Libere, then microcategories only
        const icsCategory = this.state.categories['ics'];
        const microcategories = [];
        
        Object.entries(this.state.categories).forEach(([key, category]) => {
            if (key !== 'ics' && category.type === 'subcategory') {
                microcategories.push([key, category]);
            }
        });
        
        // Add ICS as first item if it exists
        if (icsCategory) {
            const icsCard = this.createCategoryCard('ics', icsCategory, period);
            grid.appendChild(icsCard);
        }
        
        // Add Offerte Libere section
        const donationsCard = this.createDonationsCard(period);
        grid.appendChild(donationsCard);
        
        // Add microcategories with simplified layout
        microcategories.forEach(([key, category]) => {
            const categoryCard = this.createSimplifiedCategoryCard(key, category, period);
            grid.appendChild(categoryCard);
        });
    }
    
    createCategoryCard(key, category, period) {
        // Calculate category statistics for the current period
        const categoryFines = [];
        this.state.members.forEach(member => {
            member.fines.forEach(fine => {
                if (fine.category === key && this.isInCurrentPeriod(fine.date, period)) {
                    categoryFines.push(fine);
                }
            });
        });
        
        const totalFines = categoryFines.length;
        const totalAmount = categoryFines.reduce((sum, fine) => sum + fine.amount, 0);
        const paidAmount = categoryFines.filter(fine => fine.paid).reduce((sum, fine) => sum + fine.amount, 0);
        
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.innerHTML = `
            <h4>${category.name}</h4>
            <p>${category.description}</p>
            <div class="category-stats">
                <span>Totale multe: ${totalFines}</span>
                <span>Importo totale: €${totalAmount}</span>
                <span>Pagato: €${paidAmount}</span>
            </div>
        `;
        
        return categoryCard;
    }
    
    createSimplifiedCategoryCard(key, category, period) {
        // Calculate category statistics for the current period
        const categoryFines = [];
        this.state.members.forEach(member => {
            member.fines.forEach(fine => {
                if (fine.category === key && this.isInCurrentPeriod(fine.date, period)) {
                    categoryFines.push(fine);
                }
            });
        });
        
        const totalFines = categoryFines.length;
        const totalAmount = categoryFines.reduce((sum, fine) => sum + fine.amount, 0);
        const paidAmount = categoryFines.filter(fine => fine.paid).reduce((sum, fine) => sum + fine.amount, 0);
        
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card simplified';
        categoryCard.innerHTML = `
            <h4 style="color: white;">${category.name}</h4>
            <div class="category-stats">
                <span>€${totalAmount} (${totalFines} multe)</span>
            </div>
        `;
        
        return categoryCard;
    }
    
    createDonationsCard(period) {
        // Calculate donations statistics for the current period
        const membersWithDonations = [];
        let totalDonations = 0;
        let donationsCount = 0;
        
        this.state.members.forEach(member => {
            if (member.donations) {
                const periodDonations = member.donations.filter(donation => 
                    this.isInCurrentPeriod(donation.date, period)
                );
                
                if (periodDonations.length > 0) {
                    const memberTotal = Math.round(periodDonations.reduce((sum, donation) => sum + donation.amount, 0) * 100) / 100;
                    totalDonations += memberTotal;
                    donationsCount += periodDonations.length;
                    
                    const displayName = member.nickname ? 
                        member.nickname : 
                        `${member.name} ${member.surname}`;
                    
                    membersWithDonations.push({
                        name: displayName,
                        amount: memberTotal,
                        count: periodDonations.length
                    });
                }
            }
        });
        
        // Add global donations from members
        if (this.state.globalDonations) {
            const periodGlobalDonations = this.state.globalDonations.filter(donation => 
                this.isInCurrentPeriod(donation.date, period)
            );
            
            periodGlobalDonations.forEach(donation => {
                totalDonations += donation.amount;
                donationsCount++;
                
                if (donation.memberId) {
                    // Find existing member entry and add to their total
                    const member = this.state.members.find(m => m.id === donation.memberId);
                    if (member) {
                        const displayName = member.nickname ? 
                            member.nickname : 
                            `${member.name} ${member.surname}`;
                        
                        const existingEntry = membersWithDonations.find(entry => entry.name === displayName);
                        if (existingEntry) {
                            existingEntry.amount = Math.round((existingEntry.amount + donation.amount) * 100) / 100;
                            existingEntry.count++;
                        } else {
                            membersWithDonations.push({
                                name: displayName,
                                amount: Math.round(donation.amount * 100) / 100,
                                count: 1
                            });
                        }
                    }
                } else {
                    // External donation
                    const existingExternal = membersWithDonations.find(entry => entry.name === donation.donorName);
                    if (existingExternal) {
                        existingExternal.amount = Math.round((existingExternal.amount + donation.amount) * 100) / 100;
                        existingExternal.count++;
                    } else {
                        membersWithDonations.push({
                            name: donation.donorName,
                            amount: Math.round(donation.amount * 100) / 100,
                            count: 1
                        });
                    }
                }
            });
        }
        
        // Round total donations
        totalDonations = Math.round(totalDonations * 100) / 100;
        
        // Sort by donation amount descending
        membersWithDonations.sort((a, b) => b.amount - a.amount);
        
        const donationsCard = document.createElement('div');
        donationsCard.className = 'category-card simplified';
        
        if (membersWithDonations.length === 0) {
            donationsCard.innerHTML = `
                <h4 style="color: white;">💰 Offerte Libere</h4>
                <div class="category-stats">
                    <span>Nessuna offerta nel periodo</span>
                </div>
            `;
        } else {
            const membersList = membersWithDonations.map(member => 
                `<div class="donation-member">${member.name}: €${member.amount} (${member.count} offerte)</div>`
            ).join('');
            
            donationsCard.innerHTML = `
                <h4 style="color: white;">💰 Offerte Libere</h4>
                <div class="category-stats">
                    <span>€${totalDonations} (${donationsCount} offerte)</span>
                </div>
                <div class="donations-list" style="margin-top: 10px; font-size: 0.9em;">
                    ${membersList}
                </div>
            `;
        }
        
        return donationsCard;
    }

    // RIMOSSO: updateCategoryTabs() - Funzione specifica per la sezione "Multe per Categoria" rimossa
    // Le funzionalità delle categorie rimangono disponibili per il resto dell'applicazione

    // Navigation
    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Update section-specific data
        this.updateSectionData(sectionName);
    }

    updateSectionData(sectionName) {
        switch (sectionName) {
            case 'home':
                this.updateDashboard();
                break;
            case 'multe':
                this.updateMulteSection();
                break;
            case 'rosa':
                this.updateRosaSection();
                break;
            case 'classifica':
                this.updateClassificaSection();
                break;
        }
    }

    // Modal Management
    openAddMemberModal() {
        const modal = document.getElementById('addMemberModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.remove('active');
        }
    }

    closeAddMemberModal() {
        const modal = document.getElementById('addMemberModal');
        this.closeModal(modal);
    }

    // Member Management
    async addMember() {
        const name = document.getElementById('memberName').value.trim();
        const surname = document.getElementById('memberSurname').value.trim();
        const nickname = document.getElementById('memberNickname').value.trim();
        const role = document.getElementById('memberRole').value;

        if (!name || !surname) {
            this.showNotification('Nome e cognome sono obbligatori', 'error');
            return;
        }

        // Check if member already exists
        const existingMember = this.state.members.find(member => 
            member.name.toLowerCase() === name.toLowerCase() && 
            member.surname.toLowerCase() === surname.toLowerCase()
        );

        if (existingMember) {
            this.showNotification('Questo membro esiste già', 'error');
            return;
        }

        const newMember = {
            id: Date.now().toString(),
            name: name,
            surname: surname,
            nickname: nickname || null,
            role: role,
            active: true,
            fines: [],
            donations: [],
            icsEvents: []
        };

        this.state.members.push(newMember);
        
        // Registra l'attività di aggiunta membro
        this.addActivity(`Membro aggiunto: ${name} ${surname}`, 'member', new Date());
        
        await this.saveData();
        this.updateAllSections();
        this.showNotification(`${name} ${surname} aggiunto con successo!`, 'success');
        
        // Reset form fields
        document.getElementById('memberName').value = '';
        document.getElementById('memberSurname').value = '';
        document.getElementById('memberNickname').value = '';
        document.getElementById('memberRole').value = 'Giocatore';
        
        // Close modal
        this.closeAddMemberModal();
    }

    // Fine Management
    async assignFine() {
        const macroCategory = document.getElementById('fineMacroCategory').value;
        const microCategory = document.getElementById('fineCategory').value;
        const description = document.getElementById('fineDescription').value;
        const selectedMembers = this.selectedMembers ? Array.from(this.selectedMembers) : [];

        // Validate hierarchical selection
        if (!macroCategory) {
            this.showNotification('Seleziona prima una macrocategoria', 'error');
            return;
        }
        
        if (!microCategory) {
            this.showNotification('Seleziona una microcategoria', 'error');
            return;
        }
        
        if (selectedMembers.length === 0) {
            this.showNotification('Seleziona almeno un membro', 'error');
            return;
        }

        const categoryData = this.state.categories[microCategory];
        const amount = categoryData.amount;

        selectedMembers.forEach(memberId => {
            const member = this.state.members.find(m => m.id === memberId);
            if (member) {
                member.fines.push({
                    category: microCategory,
                    amount,
                    date: new Date().toISOString().split('T')[0],
                    paid: false,
                    description: description.trim() || null
                });
                
                const noteText = description.trim() ? `: ${description.trim()}` : '';
                this.addActivity(`Multa assegnata: ${member.name} ${member.surname} - ${categoryData.name}${noteText}`, 'fine', new Date(), amount);
            }
        });

        // Reset form and clear selections
        document.getElementById('assignFineForm').reset();
        document.getElementById('microCategoryGroup').style.display = 'none';
        if (this.selectedMembers) {
            this.selectedMembers.clear();
        }
        this.updateMemberSelectionGrid();
        this.updateSelectionSummary();
        this.updateAssignFineButton();
        
        await this.saveData();
        this.updateAllSections();
        
        this.showNotification(`Multa di €${amount} assegnata a ${selectedMembers.length} membri`, 'success');
    }

    async assignICS() {
        // Small delay to ensure DOM is fully updated
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const selectedMembers = Array.from(document.querySelectorAll('#icsCheckboxes input:checked'))
            .map(cb => cb.value);

        if (selectedMembers.length === 0) {
            this.showNotification('Seleziona almeno un giocatore per assegnare l\'ICS', 'error');
            return;
        }

        // Create ICS event
        const icsEvent = {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            participants: selectedMembers.length,
            members: selectedMembers.map(id => {
                const member = this.state.members.find(m => m.id === id);
                return member ? `${member.name} ${member.surname}` : id;
            })
        };
        
        this.state.icsEvents.unshift(icsEvent);

        selectedMembers.forEach(memberId => {
            const member = this.state.members.find(m => m.id === memberId);
            if (member) {
                member.fines.push({
                    category: 'ics',
                    amount: 1,
                    date: new Date().toISOString().split('T')[0],
                    paid: false,
                    description: 'ICS - Partitella persa/saltata'
                });
                
                this.addActivity(`ICS assegnato: ${member.name} ${member.surname}`, 'ics', new Date(), 1);
            }
        });

        // Reset checkboxes
        document.querySelectorAll('#icsCheckboxes input').forEach(cb => cb.checked = false);
        
        await this.saveData();
        this.updateAllSections();
        
        this.showNotification(`ICS di €1 assegnato a ${selectedMembers.length} membri`, 'success');
    }
    
    // Global Donation Management
    async addGlobalDonation() {
        const donorType = document.querySelector('input[name="donorType"]:checked').value;
        const donationAmount = Math.round(parseFloat(document.getElementById('donationAmount').value) * 100) / 100;
        
        let donorName = '';
        let memberId = null;
        
        if (donorType === 'external') {
            donorName = document.getElementById('donorName').value.trim();
            if (!donorName) {
                this.showNotification('Inserisci nome donatore', 'error');
                return;
            }
        } else {
            memberId = document.getElementById('memberDonor').value;
            if (!memberId) {
                this.showNotification('Seleziona un membro', 'error');
                return;
            }
            const member = this.state.members.find(m => m.id === memberId);
            donorName = member.nickname || `${member.name} ${member.surname}`;
        }
        
        if (!donationAmount || donationAmount <= 0) {
            this.showNotification('Inserisci importo valido', 'error');
            return;
        }
        
        const donation = {
            id: Date.now(),
            donorName,
            memberId: memberId || null,
            amount: donationAmount,
            date: new Date().toISOString().split('T')[0],
            note: 'Offerta libera'
        };
        
        if (!this.state.globalDonations) {
            this.state.globalDonations = [];
        }
        
        this.state.globalDonations.push(donation);
        this.addActivity(`Offerta libera ricevuta da ${donorName}`, 'donation', new Date(), donationAmount);
        
        // Reset form
        document.getElementById('donorName').value = '';
        document.getElementById('memberDonor').value = '';
        document.getElementById('donationAmount').value = '';
        
        await this.saveData();
        this.updateAllSections();
        
        this.showNotification(`Offerta di €${donationAmount} da ${donorName} aggiunta con successo!`, 'success');
    }

    toggleDonorInput() {
        const donorType = document.querySelector('input[name="donorType"]:checked').value;
        const externalGroup = document.getElementById('externalDonorGroup');
        const memberGroup = document.getElementById('memberDonorGroup');
        
        if (donorType === 'external') {
            externalGroup.style.display = 'block';
            memberGroup.style.display = 'none';
            document.getElementById('donorName').required = true;
            document.getElementById('memberDonor').required = false;
        } else {
            externalGroup.style.display = 'none';
            memberGroup.style.display = 'block';
            document.getElementById('donorName').required = false;
            document.getElementById('memberDonor').required = true;
            this.updateMemberDonorSelect();
        }
    }

    updateMemberDonorSelect() {
        const select = document.getElementById('memberDonor');
        if (!select) return;
        
        // Clear existing options except the first one
        select.innerHTML = '<option value="">Seleziona membro</option>';
        
        // Add active members
        this.state.members
            .filter(member => member.active !== false)
            .forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                const displayName = member.nickname || `${member.name} ${member.surname}`;
                option.textContent = `${displayName} (${member.role})`;
                select.appendChild(option);
            });
    }

    updateCategoriesSelect() {
        // Update both macro and micro category selects
        this.updateMacroCategoriesSelect();
        this.updateMicroCategoriesSelect();
    }
    
    updateMacroCategoriesSelect() {
        const macroSelect = document.getElementById('fineMacroCategory');
        if (!macroSelect) return;
        
        // Save current selection
        const currentValue = macroSelect.value;
        
        // Clear existing options except the first one
        macroSelect.innerHTML = '<option value="">Seleziona macrocategoria</option>';
        
        // Add only active macrocategories (main categories), excluding ICS
        Object.entries(this.state.categories).forEach(([key, category]) => {
            if (category.type === 'category' && category.active !== false && key !== 'ics') {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = category.name;
                macroSelect.appendChild(option);
            }
        });
        
        // Restore selection if it still exists and is a macrocategory (not ICS)
        if (currentValue && this.state.categories[currentValue] && 
            this.state.categories[currentValue].type === 'category' && 
            currentValue !== 'ics') {
            macroSelect.value = currentValue;
        }
    }
    
    updateMicroCategoriesSelect(selectedMacroCategory = null) {
        const microSelect = document.getElementById('fineCategory');
        const microGroup = document.getElementById('microCategoryGroup');
        if (!microSelect || !microGroup) return;
        
        // Get the selected macrocategory
        const macroSelect = document.getElementById('fineMacroCategory');
        const macroCategory = selectedMacroCategory || (macroSelect ? macroSelect.value : null);
        
        // Clear microcategory selection when macrocategory changes
        microSelect.value = '';
        
        // Se la macrocategoria è ICS, non mostrare le microcategorie nella sezione Assegna Multe
        if (!macroCategory || macroCategory === 'ics') {
            // Hide microcategory dropdown if no macrocategory is selected or if ICS is selected
            microGroup.style.display = 'none';
            microSelect.innerHTML = '<option value="">Seleziona microcategoria</option>';
            // Disable member selection when no valid macrocategory
            this.disableMemberSelection();
            this.updateAssignFineButton();
            return;
        }
        
        // Show microcategory dropdown
        microGroup.style.display = 'block';
        
        // Clear existing options except the first one
        microSelect.innerHTML = '<option value="">Seleziona microcategoria</option>';
        
        // Add only active microcategories that belong to the selected macrocategory
        Object.entries(this.state.categories).forEach(([key, category]) => {
            if (category.type === 'subcategory' && category.parentCategory === macroCategory && category.active !== false) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = `${category.name} (€${category.amount})`;
                microSelect.appendChild(option);
            }
        });
        
        // Disable member selection until microcategory is selected
        this.disableMemberSelection();
        this.updateAssignFineButton();
    }

    // Activity Management
    addActivity(description, type, date, amount = null) {
        const activity = {
            id: Date.now(),
            description,
            type,
            date: date.toISOString(),
            amount
        };
        
        this.state.activities.unshift(activity);
        
        // Keep only last 10 activities
        if (this.state.activities.length > 10) {
            this.state.activities = this.state.activities.slice(0, 10);
        }
    }

    // Show Notification
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    generateActivities() {
        if (this.state.activities.length === 0) {
            // Generate some sample activities based on existing data
            this.state.members.forEach(member => {
                member.fines.forEach(fine => {
                    if (fine.paid) {
                        this.addActivity(`${member.name} ${member.surname} - Pagamento multe`, 'payment', new Date(fine.date), fine.amount);
                    } else {
                        this.addActivity(`${member.name} ${member.surname} - ${fine.description || fine.note || 'Multa'}`, 'fine', new Date(fine.date), fine.amount);
                    }
                });
                
                member.donations.forEach(donation => {
                    this.addActivity(`${member.name} ${member.surname} - Offerta libera`, 'donation', new Date(donation.date), donation.amount);
                });
            });
            
            // Sort by date (newest first)
            this.state.activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
    }

    // Calculation Methods
    calculateTotals() {
        let totalFines = 0;
        let paidFines = 0;
        let totalICS = 0;
        let paidICS = 0;
        let totalDonations = 0;

        this.state.members.forEach(member => {
            member.fines.forEach(fine => {
                if (fine.category === 'ics') {
                    totalICS += fine.amount;
                    if (fine.paid) {
                        paidICS += fine.amount;
                    }
                } else {
                    totalFines += fine.amount;
                    if (fine.paid) {
                        paidFines += fine.amount;
                    }
                }
            });
            
            member.donations.forEach(donation => {
                totalDonations += donation.amount;
            });
        });
        
        // Add global donations
        if (this.state.globalDonations) {
            this.state.globalDonations.forEach(donation => {
                totalDonations += donation.amount;
            });
        };

        // Round all values to 2 decimal places
        totalFines = Math.round(totalFines * 100) / 100;
        paidFines = Math.round(paidFines * 100) / 100;
        totalICS = Math.round(totalICS * 100) / 100;
        paidICS = Math.round(paidICS * 100) / 100;
        totalDonations = Math.round(totalDonations * 100) / 100;

        return {
            totalFines,
            paidFines,
            unpaidFines: Math.round((totalFines - paidFines) * 100) / 100,
            totalICS,
            paidICS,
            unpaidICS: Math.round((totalICS - paidICS) * 100) / 100,
            totalDonations,
            totalCash: Math.round((totalFines + totalICS + totalDonations) * 100) / 100,
            totalPaidAll: Math.round((paidFines + paidICS + totalDonations) * 100) / 100,
            totalUnpaidAll: Math.round(((totalFines - paidFines) + (totalICS - paidICS)) * 100) / 100
        };
    }

    calculateTotalsUpToDate(endDate) {
        let totalFines = 0;
        let paidFines = 0;
        let totalICS = 0;
        let paidICS = 0;
        let totalDonations = 0;

        this.state.members.forEach(member => {
            member.fines.forEach(fine => {
                // Check if fine was created before or on the end date
                const fineDate = fine.date ? new Date(fine.date) : new Date(0); // Default to epoch if no date
                if (fineDate <= endDate) {
                    if (fine.category === 'ics') {
                        totalICS += fine.amount;
                        // Check if ICS payment was made before or on the end date
                        if (fine.paid) {
                            const paymentDate = fine.paymentDate ? new Date(fine.paymentDate) : fineDate;
                            if (paymentDate <= endDate) {
                                paidICS += fine.amount;
                            }
                        }
                    } else {
                        totalFines += fine.amount;
                        // Check if payment was made before or on the end date
                        if (fine.paid) {
                            const paymentDate = fine.paymentDate ? new Date(fine.paymentDate) : fineDate;
                            if (paymentDate <= endDate) {
                                paidFines += fine.amount;
                            }
                        }
                    }
                }
            });
            
            member.donations.forEach(donation => {
                // Check if donation was made before or on the end date
                const donationDate = donation.date ? new Date(donation.date) : new Date(0);
                if (donationDate <= endDate) {
                    totalDonations += donation.amount;
                }
            });
        });
        
        // Add global donations
        if (this.state.globalDonations) {
            this.state.globalDonations.forEach(donation => {
                const donationDate = donation.date ? new Date(donation.date) : new Date(0);
                if (donationDate <= endDate) {
                    totalDonations += donation.amount;
                }
            });
        };

        return {
            totalFines,
            paidFines,
            unpaidFines: totalFines - paidFines,
            totalICS,
            paidICS,
            unpaidICS: totalICS - paidICS,
            totalDonations,
            totalCash: totalFines + totalICS + totalDonations,
            totalPaidAll: paidFines + paidICS + totalDonations,
            totalUnpaidAll: (totalFines - paidFines) + (totalICS - paidICS)
        };
    }

    getMemberStats(memberId) {
        const member = this.state.members.find(m => m.id === memberId);
        if (!member) return null;

        let totalFines = 0;
        let paidAmount = 0;
        
        member.fines.forEach(fine => {
            totalFines += fine.amount;
            if (fine.paid) {
                paidAmount += fine.amount;
            }
        });
        
        return {
            totalFines,
            paidAmount,
            unpaidAmount: totalFines - paidAmount,
            totalContribution: paidAmount
        };
    }

    getMemberStatsUpToDate(memberId, endDate) {
        const member = this.state.members.find(m => m.id === memberId);
        if (!member) return null;

        let assignedAmount = 0;
        let paidAmount = 0;
        let donationsAmount = 0;
        
        member.fines.forEach(fine => {
            const fineDate = fine.date ? new Date(fine.date) : new Date(0);
            if (fineDate <= endDate) {
                assignedAmount += fine.amount;
                if (fine.paid) {
                    const paymentDate = fine.paymentDate ? new Date(fine.paymentDate) : fineDate;
                    if (paymentDate <= endDate) {
                        paidAmount += fine.amount;
                    }
                }
            }
        });
        
        if (member.donations) {
            member.donations.forEach(donation => {
                const donationDate = donation.date ? new Date(donation.date) : new Date(0);
                if (donationDate <= endDate) {
                    donationsAmount += donation.amount;
                }
            });
        }
        
        return {
            assignedAmount,
            paidAmount,
            unpaidAmount: assignedAmount - paidAmount,
            donationsAmount,
            totalContribution: paidAmount + donationsAmount
        };
    }

    // Update Methods
    updateAllSections() {
        this.updateDashboard();
        this.updateMulteSection();
        this.updateRosaSection();
        this.updateClassificaSection();
    }

    updateDashboard() {
        const totals = this.calculateTotals();
        
        // Update total cash
        const totalCashEl = document.getElementById('totalCash');
        if (totalCashEl) {
            totalCashEl.textContent = `€${totals.totalCash}`;
        }
        
        // Update total versato and da versare
        const totalVersatoEl = document.getElementById('totalVersato');
        if (totalVersatoEl) {
            totalVersatoEl.textContent = `Versato: €${totals.totalPaidAll}`;
            totalVersatoEl.style.color = '#28a745'; // Verde
        }
        
        const totalDaVersareEl = document.getElementById('totalDaVersare');
        if (totalDaVersareEl) {
            totalDaVersareEl.textContent = `Da versare: €${totals.totalUnpaidAll}`;
            totalDaVersareEl.style.color = '#dc3545'; // Rosso
        }
        
        // Update breakdown amounts
        const multeAmountEl = document.getElementById('multeAmount');
        if (multeAmountEl) {
            multeAmountEl.textContent = `€${totals.totalFines}`;
        }
        
        const icsAmountEl = document.getElementById('icsAmount');
        if (icsAmountEl) {
            icsAmountEl.textContent = `€${totals.totalICS}`;
        }
        
        const offerteAmountEl = document.getElementById('offerteAmount');
        if (offerteAmountEl) {
            offerteAmountEl.textContent = `€${totals.totalDonations}`;
        }
        
        // Update details in multe card
        const versatoEl = document.querySelector('.versato');
        if (versatoEl) {
            versatoEl.textContent = `Versato: €${totals.paidFines}`;
            versatoEl.style.color = '#28a745'; // Verde
        }
        
        const daVersareEl = document.querySelector('.da-versare');
        if (daVersareEl) {
            daVersareEl.textContent = `Da versare: €${totals.unpaidFines}`;
            daVersareEl.style.color = '#dc3545'; // Rosso
        }
        
        // Update details in ICS card
        const versatoIcsEl = document.querySelector('.versato-ics');
        if (versatoIcsEl) {
            versatoIcsEl.textContent = `Versato: €${totals.paidICS}`;
            versatoIcsEl.style.color = '#28a745'; // Verde
        }
        
        const daVersareIcsEl = document.querySelector('.da-versare-ics');
        if (daVersareIcsEl) {
            daVersareIcsEl.textContent = `Da versare: €${totals.unpaidICS}`;
            daVersareIcsEl.style.color = '#dc3545'; // Rosso
        }
        
        // Update activities
        this.updateActivitiesList();
        
        // Update general stats
        this.updateGeneralStats();
        
        // Update donations breakdown
        this.updateDonationsBreakdown();
    }
    
    updateDonationsBreakdown() {
        const totals = this.calculateTotals();
        
        const donationsTotalEl = document.getElementById('donationsTotal');
        if (donationsTotalEl) {
            donationsTotalEl.textContent = `€${totals.totalDonations}`;
        }
        
        const donationsCountEl = document.getElementById('donationsCount');
        if (donationsCountEl) {
            let totalDonationsCount = 0;
            this.state.members.forEach(member => {
                totalDonationsCount += member.donations.length;
            });
            // Add global donations count if we have them
            if (this.state.globalDonations) {
                totalDonationsCount += this.state.globalDonations.length;
            }
            donationsCountEl.textContent = totalDonationsCount;
        }
    }

    updateActivitiesList() {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;
        
        activityList.innerHTML = '';
        
        this.state.activities.slice(0, 5).forEach(activity => {
            const activityEl = document.createElement('div');
            activityEl.className = 'activity-item';
            
            const icon = this.getActivityIcon(activity.type);
            const date = new Date(activity.date).toLocaleDateString('it-IT');
            const amountText = activity.amount ? 
                (activity.type === 'payment' ? `Pagato €${activity.amount}` : `+€${activity.amount}`) : '';
            
            activityEl.innerHTML = `
                <div class="activity-icon">${icon}</div>
                <div class="activity-details">
                    <div class="activity-name">${activity.description.split(' - ')[0]}</div>
                    <div class="activity-desc">${activity.description.split(' - ')[1] || activity.description}</div>
                </div>
                <div class="activity-amount">${amountText}</div>
                <div class="activity-date">${date}</div>
            `;
            
            activityList.appendChild(activityEl);
        });
    }

    getActivityIcon(type) {
        const icons = {
            fine: '⚠️',
            ics: '⚽',
            payment: '💰',
            donation: '💜',
            member: '👤'
        };
        return icons[type] || '📝';
    }

    updateGeneralStats() {
        // Ottieni la data di fine (ultimo giorno del mese precedente)
        const today = new Date();
        const lastDayOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        
        const totals = this.calculateTotalsUpToDate(lastDayOfPrevMonth);
        const paymentRate = totals.totalFines > 0 ? Math.round((totals.paidFines / totals.totalFines) * 100) : 0;
        
        // Update progress bar
        const progressEl = document.querySelector('.progress');
        if (progressEl) {
            progressEl.style.width = `${paymentRate}%`;
        }
        
        // Update stats numbers
        // Filtra i membri con multe non pagate fino alla fine del mese precedente
        const membersWithFines = this.state.members.filter(member => {
            return member.fines.some(fine => {
                const fineDate = new Date(fine.date);
                return !fine.paid && fineDate <= lastDayOfPrevMonth;
            });
        }).length;
        
        const statNumbers = document.querySelectorAll('.stat-number');
        if (statNumbers.length >= 2) {
            statNumbers[0].textContent = this.state.members.length;
            statNumbers[1].textContent = membersWithFines;
        }
        
        // Aggiorna il contatore di persone con multe non saldate nel box Multe Assegnate
        const unpaidFinesCountEl = document.getElementById('unpaidFinesCount');
        if (unpaidFinesCountEl) {
            unpaidFinesCountEl.textContent = membersWithFines;
        }
    }

    updateMulteSection() {
        // Update member selection grid
        this.updateMemberCheckboxes('#memberSelectionGrid');
        this.updateMemberCheckboxes('#icsCheckboxes');
        
        // Update member donor select for donations
        this.updateMemberDonorSelect();
        
        // Initialize donor input state
        this.toggleDonorInput();
        
        // Update categories select
        this.updateCategoriesSelect();
        
        // Update categories grid
        this.updateCategoriesGrid();
        
        // Initialize hierarchical selection state
        this.initializeHierarchicalSelection();
        
        // Add event listener for clear selection button
        const clearButton = document.getElementById('clearSelection');
        if (clearButton) {
            clearButton.onclick = () => this.clearMemberSelection();
        }
    }

    updateMemberCheckboxes(selector) {
        // Handle new member selection grid
        if (selector === '#memberSelectionGrid') {
            this.updateMemberSelectionGrid();
            return;
        }
        
        const container = document.querySelector(selector);
        if (!container) return;
        
        container.innerHTML = '';
        
        // Filter members based on selector - show only active members
        let membersToShow = this.state.members.filter(member => member.active !== false);
        if (selector === '#icsCheckboxes') {
            // For ICS, show only active players (not staff)
            membersToShow = this.state.members.filter(member => member.role === 'Giocatore' && member.active !== false);
        }
        
        membersToShow.forEach(member => {
            const label = document.createElement('label');
            const displayName = member.nickname ? 
                member.nickname : 
                `${member.name} ${member.surname}`;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = member.id;
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${displayName} (${member.role})`));
            
            container.appendChild(label);
        });
    }
    
    updateMemberSelectionGrid() {
        const container = document.getElementById('memberSelectionGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Show only active members
        const activeMembers = this.state.members.filter(member => member.active !== false);
        
        // Check if member selection should be enabled
        const microCategory = document.getElementById('fineCategory').value;
        const isEnabled = !!microCategory;
        
        activeMembers.forEach(member => {
            const displayName = member.nickname ? 
                member.nickname : 
                `${member.name} ${member.surname}`;
            
            const initials = member.nickname ? 
                member.nickname.substring(0, 2).toUpperCase() : 
                `${member.name.charAt(0)}${member.surname.charAt(0)}`.toUpperCase();
            
            const card = document.createElement('div');
            card.className = 'member-selection-card';
            card.dataset.memberId = member.id;
            
            if (isEnabled) {
                // Add click handler only if enabled
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleMemberSelection(member.id);
                });
                
                // Check if member is already selected and apply class
                if (this.selectedMembers && this.selectedMembers.has(member.id)) {
                    card.classList.add('selected');
                }
                
                card.style.cursor = 'pointer';
                card.style.opacity = '1';
            } else {
                // Disable member selection visually
                card.style.cursor = 'not-allowed';
                card.style.opacity = '0.5';
                card.classList.add('disabled');
            }
            
            card.innerHTML = `
                <div class="member-avatar-mini">${initials}</div>
                <div class="member-name-mini">${displayName}</div>
            `;
            
            container.appendChild(card);
        });
        
        this.updateSelectionSummary();
        this.updateAssignFineButton();
    }
    
    toggleMemberSelection(memberId) {
        if (!this.selectedMembers) {
            this.selectedMembers = new Set();
        }
        
        const card = document.querySelector(`[data-member-id="${memberId}"]`);
        if (!card) return;
        
        // Check if member selection is enabled
        const microCategory = document.getElementById('fineCategory').value;
        if (!microCategory) {
            this.showNotification('Seleziona prima una microcategoria', 'error');
            return;
        }
        
        // Instant visual feedback with improved logic
        if (this.selectedMembers.has(memberId)) {
            // Deselect: remove from set and remove visual class
            this.selectedMembers.delete(memberId);
            card.classList.remove('selected');
        } else {
            // Select: add to set and add visual class
            this.selectedMembers.add(memberId);
            card.classList.add('selected');
        }
        
        // Update selection summary and button state immediately
        this.updateSelectionSummary();
        this.updateAssignFineButton();
    }
    
    updateSelectionSummary() {
        const summaryContainer = document.getElementById('selectionSummary');
        const clearButton = document.getElementById('clearSelection');
        
        if (!summaryContainer || !clearButton) return;
        
        if (!this.selectedMembers || this.selectedMembers.size === 0) {
            summaryContainer.style.display = 'none';
            return;
        }
        
        summaryContainer.style.display = 'block';
        
        const selectedMembersList = Array.from(this.selectedMembers).map(memberId => {
            const member = this.state.members.find(m => m.id === memberId);
            return member ? (member.nickname || `${member.name} ${member.surname}`) : '';
        }).filter(name => name);
        
        const summaryText = document.getElementById('selectedMembersText');
        if (summaryText) {
            summaryText.textContent = `Selezionati: ${selectedMembersList.join(', ')}`;
        }
    }
    
    clearMemberSelection() {
        if (this.selectedMembers) {
            this.selectedMembers.clear();
        }
        
        // Remove selected class from all cards
        document.querySelectorAll('.member-selection-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        
        this.updateSelectionSummary();
        this.updateAssignFineButton();
    }
    
    // New functions for hierarchical selection logic
    initializeHierarchicalSelection() {
        // Reset form state
        const macroSelect = document.getElementById('fineMacroCategory');
        const microSelect = document.getElementById('fineCategory');
        const microGroup = document.getElementById('microCategoryGroup');
        
        if (macroSelect) macroSelect.value = '';
        if (microSelect) microSelect.value = '';
        if (microGroup) microGroup.style.display = 'none';
        
        // Clear member selection
        this.clearMemberSelection();
        
        // Disable member selection initially
        this.disableMemberSelection();
        
        // Update button state
        this.updateAssignFineButton();
    }
    
    onMicroCategoryChange() {
        const microCategory = document.getElementById('fineCategory').value;
        
        if (microCategory) {
            // Enable member selection when microcategory is selected
            this.enableMemberSelection();
        } else {
            // Disable member selection when no microcategory is selected
            this.disableMemberSelection();
        }
        
        this.updateAssignFineButton();
    }
    
    disableMemberSelection() {
        // Clear current selection
        if (this.selectedMembers) {
            this.selectedMembers.clear();
        }
        
        // Update the grid to show disabled state
        this.updateMemberSelectionGrid();
    }
    
    enableMemberSelection() {
        // Update the grid to show enabled state
        this.updateMemberSelectionGrid();
    }
    
    updateAssignFineButton() {
        const submitButton = document.querySelector('#assignFineForm button[type="submit"]');
        if (!submitButton) return;
        
        const macroCategory = document.getElementById('fineMacroCategory').value;
        const microCategory = document.getElementById('fineCategory').value;
        const hasSelectedMembers = this.selectedMembers && this.selectedMembers.size > 0;
        
        // Enable button only when all conditions are met
        const isEnabled = macroCategory && microCategory && hasSelectedMembers;
        
        submitButton.disabled = !isEnabled;
        
        if (isEnabled) {
            submitButton.classList.remove('disabled');
            submitButton.style.opacity = '1';
            submitButton.style.cursor = 'pointer';
        } else {
            submitButton.classList.add('disabled');
            submitButton.style.opacity = '0.6';
            submitButton.style.cursor = 'not-allowed';
        }
    }

    updateCategoriesGrid() {
        const grid = document.getElementById('categoriesGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        Object.entries(this.state.categories).forEach(([key, category]) => {
            // Calculate category statistics
            const categoryFines = [];
            this.state.members.forEach(member => {
                member.fines.forEach(fine => {
                    if (fine.category === key) {
                        categoryFines.push(fine);
                    }
                });
            });
            
            const totalAmount = categoryFines.reduce((sum, fine) => sum + fine.amount, 0);
            const paidAmount = categoryFines.filter(fine => fine.paid).reduce((sum, fine) => sum + fine.amount, 0);
            
            const card = document.createElement('div');
            card.className = 'category-card';
            card.innerHTML = `
                <h4>${category.name}</h4>
                <p>${category.description}</p>
                <div class="category-stats">
                    <div class="stat">
                        <span class="label">Totale multe:</span>
                        <span class="value">${categoryFines.length}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Importo totale:</span>
                        <span class="value">€${totalAmount}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Pagato:</span>
                        <span class="value">€${paidAmount}</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    updateRosaSection() {
        this.updateMembersList();
        this.updateTeamStats();
    }

    updateMembersList() {
        const staffList = document.getElementById('staffList');
        const playersList = document.getElementById('playersList');
        const inactiveMembersList = document.getElementById('inactiveMembersList');
        const inactiveMembersSection = document.getElementById('inactiveMembersSection');
        if (!staffList || !playersList) return;

        // Separate and sort members - only active members
        const staff = this.state.members.filter(m => m.role === 'Staff' && m.active !== false)
            .sort((a, b) => this.getMemberStats(b.id).unpaidAmount - this.getMemberStats(a.id).unpaidAmount);
        const players = this.state.members.filter(m => m.role === 'Giocatore' && m.active !== false)
            .sort((a, b) => this.getMemberStats(b.id).unpaidAmount - this.getMemberStats(a.id).unpaidAmount);
        
        // Get inactive members
        const inactiveMembers = this.state.members.filter(m => m.active === false)
            .sort((a, b) => this.getMemberStats(b.id).unpaidAmount - this.getMemberStats(a.id).unpaidAmount);

        // Render staff members
        staffList.innerHTML = '';
        staff.forEach(member => {
            const memberCardHTML = this.renderMemberCard(member);
            staffList.innerHTML += memberCardHTML;
        });
        
        // Render player members
        playersList.innerHTML = '';
        players.forEach(member => {
            const memberCardHTML = this.renderMemberCard(member);
            playersList.innerHTML += memberCardHTML;
        });
        
        // Render inactive members
        if (inactiveMembersList && inactiveMembersSection) {
            if (inactiveMembers.length > 0) {
                inactiveMembersList.innerHTML = '';
                inactiveMembers.forEach(member => {
                    const memberCardHTML = this.renderMemberCard(member, true);
                    inactiveMembersList.innerHTML += memberCardHTML;
                });
                inactiveMembersSection.style.display = 'block';
            } else {
                inactiveMembersSection.style.display = 'none';
            }
        }
        
        // Update counts
        const staffCount = document.getElementById('staffCount');
        const playersCount = document.getElementById('playersCount');
        if (staffCount) staffCount.textContent = staff.length;
        if (playersCount) playersCount.textContent = players.length;
    }

    renderMemberCard(member, isInactive = false) {
        const stats = this.getMemberStats(member.id);
        const displayName = member.nickname ? 
            member.nickname : 
            `${member.name} ${member.surname}`;
        
        const inactiveClass = isInactive ? ' inactive' : '';
        const inactiveLabel = isInactive ? ' (Inattivo)' : '';
        
        return `
            <div class="member-card${inactiveClass}" data-member="${member.id}">
                <div class="member-info">
                    <div class="member-name">${displayName}${inactiveLabel}</div>
                    <div class="member-role">${member.role}</div>
                </div>
                <div class="member-stats">
                    <div class="stat">
                        <span class="label">Totale</span>
                        <span class="value">€${stats.totalFines}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Da versare</span>
                        <span class="value ${stats.unpaidAmount > 0 ? 'red' : 'green'}">€${stats.unpaidAmount}</span>
                    </div>
                </div>
                ${isInactive ? `<button class="btn-reactivate" data-action="reactivateMember" data-params='{"memberId":"${member.id}"}'>Riattiva</button>` : ''}
            </div>
        `;
    }

    updateTeamStats() {
        const playersCount = this.state.members.filter(m => m.role === 'Giocatore' && m.active !== false).length;
        const staffCount = this.state.members.filter(m => m.role === 'Staff' && m.active !== false).length;
        const activeFinesCount = this.state.members.filter(member => 
            member.fines.some(fine => !fine.paid)
        ).length;
        
        const playersCountEl = document.getElementById('playersCount');
        if (playersCountEl) playersCountEl.textContent = playersCount;
        
        const staffCountEl = document.getElementById('staffCount');
        if (staffCountEl) staffCountEl.textContent = staffCount;
        
        const activeFinesCountEl = document.getElementById('activeFinesCount');
        if (activeFinesCountEl) activeFinesCountEl.textContent = activeFinesCount;
    }

    // AGGIORNATO: Assicura aggiornamenti in tempo reale per tutta la sezione classifiche
    updateClassificaSection() {
        this.updateTopContributors();
        
        // RIMOSSO: updateCategoryTabs() e updateCategoryContent() - funzioni specifiche per "Multe per Categoria" rimosse
        // Le funzionalità delle categorie rimangono disponibili per il resto dell'applicazione
    }

    updateTopContributors() {
        const rankingGrid = document.querySelector('.ranking-grid');
        if (!rankingGrid) return;
        
        // Get current filter status (default to 'pagate')
        const currentStatus = this.currentFineStatus || 'pagate';
        
        // Calculate total contributions for each member based on current period and status
        const memberContributions = this.state.members
            .filter(member => member.active !== false) // Only active members
            .map(member => {
                const stats = this.getMemberStatsByPeriod(member.id, this.currentPeriod || 'mensile', currentStatus);
                return {
                    ...member,
                    totalContribution: currentStatus === 'pagate' ? stats.totalPaid : stats.totalAssigned,
                    finesPaid: stats.paidAmount,
                    paidICS: stats.paidICS,
                    donations: stats.totalDonations
                };
            })
            .filter(member => member.totalContribution > 0) // Only members with contributions
            .sort((a, b) => b.totalContribution - a.totalContribution)
            .slice(0, 10); // Limit to top 10 contributors
        
        // Clear existing content
        const leftColumn = rankingGrid.querySelector('.ranking-column:first-child');
        const rightColumn = rankingGrid.querySelector('.ranking-column:last-child');
        if (leftColumn) leftColumn.innerHTML = '';
        if (rightColumn) rightColumn.innerHTML = '';
        
        memberContributions.forEach((member, index) => {
            const rankingItem = document.createElement('div');
            const rankEmojis = ['🏆', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            const rankEmoji = rankEmojis[index] || `${index + 1}️⃣`;
            
            const displayName = member.nickname || `${member.name} ${member.surname}`;
            
            // Remove breakdown text - show only total amount
            let breakdownText = '';
            
            rankingItem.className = 'ranking-item compact';
            rankingItem.innerHTML = `
                <span class="rank-emoji">${rankEmoji}</span>
                <div class="member-info">
                    <span class="player-nickname">${displayName}</span>
                    ${breakdownText}
                </div>
                <span class="amount">€${member.totalContribution}</span>
            `;
            
            // Add to appropriate column (first 5 to left, 6-10 to right)
            if (index < 5 && leftColumn) {
                leftColumn.appendChild(rankingItem);
            } else if (rightColumn) {
                rightColumn.appendChild(rankingItem);
            }
        });
        
        // If no contributors, show a message
        if (memberContributions.length === 0 && leftColumn) {
            leftColumn.innerHTML = '<div class="no-data">Nessun contributore per il periodo selezionato</div>';
        }
    }

    updateGeneralStatistics() {
        // This function is no longer used as we removed the general statistics section
        return;
    }

    // Tab Management
    switchTab(period) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-period="${period}"]`).classList.add('active');
        
        // Store current period
        this.currentPeriod = period;
        
        // Update section title
        const sectionTitle = document.querySelector('.classifica-section h3');
        if (sectionTitle) {
            const periodText = period === 'stagionale' ? 'stagionale' : 'mensile';
            sectionTitle.textContent = `🏆 Top Pagatori (${periodText})`;
        }
        
        // Update content based on period
        this.updateClassificaSection();
        this.updateCategoriesGridClassifica();
    }

    // Multe Tab Management
    switchMulteTab(tabName) {
        // Remove active class from all multe tabs
        document.querySelectorAll('.multe-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked tab
        const targetTab = document.querySelector(`[data-multe-section="${tabName}"]`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // Hide all multe content sections
        document.querySelectorAll('.multe-content').forEach(section => {
            section.style.display = 'none';
        });
        
        // Show selected content section
        const targetSection = document.getElementById(`${tabName}Section`);
        if (targetSection) {
            targetSection.style.display = 'block';
        }
    }

    // Rosa Tab Management
    switchRosaTab(tabName) {
        // Remove active class from all rosa tabs
        document.querySelectorAll('.rosa-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked tab
        document.querySelector(`[data-rosa-section="${tabName}"]`).classList.add('active');
        
        // Hide all rosa content sections
        document.querySelectorAll('.rosa-content').forEach(section => {
            section.style.display = 'none';
        });
        
        // Show selected content section
        const targetSection = document.getElementById(`${tabName}Section`);
        if (targetSection) {
            targetSection.style.display = 'block';
        }
    }
    
    // Fine Status Filter Management
    switchFineStatus(status, target = 'ranking') {
        // Update only the buttons for the specific target
        const targetButtons = document.querySelectorAll(`[data-target="${target}"] .status-tab-btn, .status-tab-btn:not([data-target])`);
        if (target === 'category') {
            document.querySelectorAll('[data-target="category"]').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-status="${status}"][data-target="category"]`).classList.add('active');
            
            // Store current category fine status
            this.currentCategoryFineStatus = status;
            
            // RIMOSSO: updateCategoryContent() - funzione specifica per "Multe per Categoria" rimossa
            // Le funzionalità delle categorie rimangono disponibili per il resto dell'applicazione
        } else {
            document.querySelectorAll('.status-tab-btn:not([data-target])').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-status="${status}"]:not([data-target])`).classList.add('active');
            
            // Store current fine status
            this.currentFineStatus = status;
            
            // Update rankings based on status
            this.updateTopContributors();
        }
    }

    // RIMOSSO: switchCategoryTab(), updateCategoryContent(), updateDonationsRanking(), updateICSRanking(), renderCategoryRanking()
    // Funzioni specifiche per la sezione "Multe per Categoria" rimosse
    // Le funzionalità delle categorie rimangono disponibili per il resto dell'applicazione

    // Member Accordion Toggle
    toggleMemberAccordion(memberId) {
        const memberCard = document.querySelector(`[data-member="${memberId}"]`);
        if (!memberCard) return;

        const existingDetails = memberCard.querySelector('.member-details');
        if (existingDetails) {
            existingDetails.remove();
            memberCard.classList.remove('expanded');
            return;
        }

        // Close other expanded cards
        document.querySelectorAll('.member-card.expanded').forEach(card => {
            card.querySelector('.member-details')?.remove();
            card.classList.remove('expanded');
        });

        const member = this.state.members.find(m => m.id === memberId);
        if (!member) return;

        const detailsEl = document.createElement('div');
        detailsEl.className = 'member-details';
        
        // Sort fines: unpaid first, then by date (most recent first)
        const sortedFines = [...member.fines]
            .map((fine, originalIndex) => ({ ...fine, originalIndex }))
            .sort((a, b) => {
                // First priority: unpaid fines
                if (a.paid !== b.paid) {
                    return a.paid ? 1 : -1;
                }
                // Second priority: most recent date
                return new Date(b.date) - new Date(a.date);
            });
        
        // Separate paid and unpaid fines
        const unpaidFines = sortedFines.filter(fine => !fine.paid);
        const paidFines = sortedFines.filter(fine => fine.paid);
        
        const unpaidFinesHtml = unpaidFines.map(fine => `
            <div class="fine-item">
                <div class="fine-info">
                    <div class="fine-category">${this.state.categories[fine.category]?.name || fine.category}</div>
                    <div class="fine-date">${new Date(fine.date).toLocaleDateString('it-IT')}</div>
                </div>
                <div class="fine-amount">
                    €${fine.amount}
                </div>
                <button class="btn-pay" 
                        data-action="toggleFinePayment" data-params='{"memberId":"${memberId}","fineIndex":${fine.originalIndex}}'>
                    Paga
                </button>
            </div>
        `).join('');
        
        const paidFinesHtml = paidFines.map(fine => `
            <div class="fine-item paid-fine" style="display: none;">
                <div class="fine-info">
                    <div class="fine-category">${this.state.categories[fine.category]?.name || fine.category}</div>
                    <div class="fine-date">${new Date(fine.date).toLocaleDateString('it-IT')}</div>
                </div>
                <div class="fine-amount paid">
                    €${fine.amount}
                </div>
                <button class="btn-pay" disabled>
                    Pagata
                </button>
            </div>
        `).join('');
        
        const showPaidButton = paidFines.length > 0 ? `
            <button class="btn-show-paid" data-action="togglePaidFines" data-params='{"memberId":"${memberId}"}'>
                Visualizza multe pagate (${paidFines.length})
            </button>
        ` : '';

        // Get ICS events for this member
        const memberICSEvents = this.state.icsEvents.filter(event => 
            event.assignedMembers && event.assignedMembers.includes(memberId)
        );
        
        const icsHtml = memberICSEvents.map(event => `
            <div class="ics-item">
                <div class="ics-info">
                    <div class="ics-title">${event.title}</div>
                    <div class="ics-date">${new Date(event.date).toLocaleDateString('it-IT')}</div>
                </div>
                <div class="ics-status">Assegnato</div>
            </div>
        `).join('');

        detailsEl.innerHTML = `
            <div class="details-container">
                <div class="details-section">
                    <h4>Multe da pagare (${unpaidFines.length})</h4>
                    <div class="fines-list">
                        ${unpaidFinesHtml || '<p class="no-data">Nessuna multa da pagare</p>'}
                        ${paidFinesHtml}
                    </div>
                    ${showPaidButton}
                </div>
                <div class="details-section">
                    <h4>Eventi ICS (${memberICSEvents.length})</h4>
                    <div class="ics-list">
                        ${icsHtml || '<p class="no-data">Nessun evento ICS assegnato</p>'}
                    </div>
                </div>
            </div>
            ${member.active !== false ? `<div class="member-actions">
                <button class="btn-delete" data-action="deleteMember" data-params='{"memberId":"${memberId}"}'>Elimina Membro</button>
            </div>` : ''}
        `;

        memberCard.appendChild(detailsEl);
        memberCard.classList.add('expanded');
    }

    // Toggle Paid Fines Visibility
    togglePaidFines(memberId) {
        console.log('🔍 [DEBUG] togglePaidFines chiamata con memberId:', memberId);
        
        const memberCard = document.querySelector(`[data-member="${memberId}"]`);
        console.log('🔍 [DEBUG] memberCard trovata:', memberCard);
        
        if (!memberCard) {
            console.error('❌ [ERROR] memberCard non trovata per memberId:', memberId);
            return;
        }
        
        const paidFines = memberCard.querySelectorAll('.paid-fine');
        const showPaidButton = memberCard.querySelector('.btn-show-paid');
        
        console.log('🔍 [DEBUG] Elementi trovati:', {
            paidFines: paidFines,
            paidFinesLength: paidFines.length,
            showPaidButton: showPaidButton
        });
        
        if (!paidFines.length || !showPaidButton) {
            console.warn('⚠️ [WARN] Elementi mancanti - paidFines.length:', paidFines.length, 'showPaidButton:', showPaidButton);
            return;
        }
        
        const isVisible = paidFines[0].style.display !== 'none';
        console.log('🔍 [DEBUG] isVisible (prima del toggle):', isVisible);
        
        paidFines.forEach((fine, index) => {
            const oldDisplay = fine.style.display;
            fine.style.display = isVisible ? 'none' : 'block';
            console.log(`🔍 [DEBUG] Fine ${index}: ${oldDisplay} -> ${fine.style.display}`);
        });
        
        const newButtonText = isVisible ? 
            `Visualizza multe pagate (${paidFines.length})` : 
            `Nascondi multe pagate (${paidFines.length})`;
        
        console.log('🔍 [DEBUG] Cambio testo bottone:', showPaidButton.textContent, '->', newButtonText);
        showPaidButton.textContent = newButtonText;
        
        console.log('✅ [SUCCESS] togglePaidFines completata');
    }

    // Toggle Fine Payment
    async toggleFinePayment(memberId, fineIndex) {
        const member = this.state.members.find(m => m.id === memberId);
        if (!member || !member.fines[fineIndex]) return;

        const fine = member.fines[fineIndex];
        fine.paid = !fine.paid;

        const action = fine.paid ? 'Pagamento' : 'Annullamento pagamento';
        const categoryName = this.state.categories[fine.category]?.name || fine.category || 'Categoria sconosciuta';
        this.addActivity(`${member.name} ${member.surname} - ${action} multa ${categoryName}`, 
                        fine.paid ? 'payment' : 'fine', new Date(), fine.amount);

        await this.saveData();
        this.updateAllSections();
        
        this.showNotification(
            `${action} di €${fine.amount} per ${member.name} ${member.surname}`, 
            'success'
        );
    }



    // Delete Member
    async deleteMember(memberId) {
        const member = this.state.members.find(m => m.id === memberId);
        if (!member) return;

        if (!confirm(`Sei sicuro di voler rendere inattivo ${member.name} ${member.surname}? Le sue statistiche e multe rimarranno salvate.`)) return;

        member.active = false;
        this.addActivity(`Membro reso inattivo: ${member.name} ${member.surname}`, 'member', new Date());
        
        await this.saveData();
        this.updateAllSections();
        
        this.showNotification(`${member.name} ${member.surname} reso inattivo`, 'success');
    }

    async reactivateMember(memberId) {
        const member = this.state.members.find(m => m.id === memberId);
        if (!member) return;

        if (!confirm(`Sei sicuro di voler riattivare ${member.name} ${member.surname}?`)) return;

        member.active = true;
        this.addActivity(`Membro riattivato: ${member.name} ${member.surname}`, 'member', new Date());
        
        await this.saveData();
        this.updateAllSections();
        
        this.showNotification(`${member.name} ${member.surname} riattivato`, 'success');
    }

    // Delete Assigned and/or Paid Fines
    async deleteAssignedAndPaidFines() {
        if (!confirm('Sei sicuro di voler azzerare completamente la cassa (multe e offerte libere)? Potrai ripristinare entro 30 minuti.')) {
            return;
        }

        // Create backup before deletion
        const backupData = {
            timestamp: new Date().toISOString(),
            members: JSON.parse(JSON.stringify(this.state.members)), // Deep copy
            categories: JSON.parse(JSON.stringify(this.state.categories)),
            activities: JSON.parse(JSON.stringify(this.state.activities)),
            globalDonations: JSON.parse(JSON.stringify(this.state.globalDonations || []))
        };

        // Generate PDF before deletion
        this.generateDeletionPDF();

        let deletedCount = 0;
        let totalDeletedAmount = 0;
        let deletedDonationsCount = 0;
        let totalDeletedDonationsAmount = 0;

        // Iterate through all members to delete fines
        this.state.members.forEach(member => {
            if (member.fines && member.fines.length > 0) {
                // Filter out assigned and paid fines
                const originalLength = member.fines.length;
                const originalAmount = member.fines.reduce((sum, fine) => sum + fine.amount, 0);
                
                // Keep only fines that are neither assigned nor paid (this should be empty in practice)
                member.fines = member.fines.filter(fine => {
                    // Remove all fines since they are all "assigned" by definition
                    // and we want to remove both assigned and paid ones
                    return false;
                });
                
                const deletedFines = originalLength - member.fines.length;
                deletedCount += deletedFines;
                totalDeletedAmount += originalAmount;
            }
        });

        // Delete global donations (offerte libere)
        if (this.state.globalDonations && this.state.globalDonations.length > 0) {
            deletedDonationsCount = this.state.globalDonations.length;
            totalDeletedDonationsAmount = this.state.globalDonations.reduce((sum, donation) => sum + donation.amount, 0);
            this.state.globalDonations = [];
        }

        // Store backup in localStorage with expiration
        localStorage.setItem('multeBackup', JSON.stringify(backupData));
        localStorage.setItem('multeBackupExpiry', (Date.now() + 30 * 60 * 1000).toString()); // 30 minutes

        // Add activity log
        const totalAmount = totalDeletedAmount + totalDeletedDonationsAmount;
        const activityMessage = `Cassa azzerata: ${deletedCount} multe (€${totalDeletedAmount}) + ${deletedDonationsCount} offerte libere (€${totalDeletedDonationsAmount})`;
        this.addActivity(activityMessage, 'fine', new Date());
        
        // Save data and update UI
        await this.saveData();
        this.updateAllSections();
        this.updateRestoreButton();
        
        this.showNotification(
            `Cassa azzerata: ${deletedCount} multe e ${deletedDonationsCount} offerte libere per un totale di €${totalAmount}. PDF generato automaticamente. Ripristino disponibile per 30 minuti.`, 
            'success'
        );
    }

    // Generate PDF for deletion backup
    generateDeletionPDF() {
        try {
            // Check if jsPDF is available - File locale v2.5.1
            if (!window.jspdf) {
                console.warn('jsPDF library not available, skipping PDF generation');
                return;
            }
            
            // Sintassi per jsPDF v2.5.1 locale
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Current date and time
            const now = new Date();
            const currentDate = now.toLocaleDateString('it-IT');
            const currentTime = now.toLocaleTimeString('it-IT');
            
            // Calculate totals at deletion time
            const totals = this.calculateTotals();
            
            // PDF Configuration
            const pageWidth = doc.internal.pageSize.width;
            const margin = 20;
            let yPosition = 30;
            
            // Helper function to add text
            const addText = (text, x, y, options = {}) => {
                const fontSize = options.fontSize || 12;
                const maxWidth = options.maxWidth || (pageWidth - 2 * margin);
                const align = options.align || 'left';
                
                doc.setFontSize(fontSize);
                if (options.bold) doc.setFont(undefined, 'bold');
                else doc.setFont(undefined, 'normal');
                
                if (align === 'center') {
                    doc.text(text, pageWidth / 2, y, { align: 'center' });
                } else {
                    const lines = doc.splitTextToSize(text, maxWidth);
                    doc.text(lines, x, y);
                    return lines.length * (fontSize * 0.35);
                }
                return fontSize * 0.35;
            };
            
            // Header
            addText('BACKUP ELIMINAZIONE MULTE', 0, yPosition, { fontSize: 20, bold: true, align: 'center' });
            yPosition += 15;
            addText(`Situazione al momento dell'eliminazione`, 0, yPosition, { fontSize: 14, align: 'center' });
            yPosition += 10;
            addText(`Data: ${currentDate} - Ora: ${currentTime}`, 0, yPosition, { fontSize: 12, align: 'center' });
            yPosition += 20;
            
            // Summary Section
            addText('RIEPILOGO FINANZIARIO', margin, yPosition, { fontSize: 16, bold: true });
            yPosition += 15;
            
            // Financial summary box with improved padding
            const boxHeight = 65;
            const boxPadding = 8;
            doc.setDrawColor(0);
            doc.setFillColor(240, 240, 240);
            doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, boxHeight, 'F');
            doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, boxHeight, 'S');
            
            // Calculate payment statistics
            let totalPaid = 0;
            let totalUnpaid = 0;
            this.state.members.forEach(member => {
                if (member.fines) {
                    member.fines.forEach(fine => {
                        const fineDate = fine.date ? new Date(fine.date) : new Date(0);
                        if (fineDate <= endDate) {
                            if (fine.paid) {
                                const paymentDate = fine.paymentDate ? new Date(fine.paymentDate) : fineDate;
                                if (paymentDate <= endDate) {
                                    totalPaid += fine.amount;
                                } else {
                                    totalUnpaid += fine.amount;
                                }
                            } else {
                                totalUnpaid += fine.amount;
                            }
                        }
                    });
                }
            });
            
            addText(`Totale in Cassa: ${this.formatCurrency(totals.totalCash)}`, margin + boxPadding, yPosition + boxPadding, { fontSize: 14, bold: true });
            addText(`• Multe Assegnate: ${this.formatCurrency(totals.totalFines)}`, margin + boxPadding, yPosition + boxPadding + 12, { fontSize: 12 });
            addText(`• ICS Partitelle: ${this.formatCurrency(totals.totalICS)}`, margin + boxPadding, yPosition + boxPadding + 22, { fontSize: 12 });
            addText(`• Offerte Libere: ${this.formatCurrency(totals.totalDonations)}`, margin + boxPadding, yPosition + boxPadding + 32, { fontSize: 12 });
            
            // Payment status section
            addText(`Versamenti:`, margin + boxPadding, yPosition + boxPadding + 45, { fontSize: 12, bold: true });
            addText(`• Già versato: ${this.formatCurrency(totalPaid)}`, margin + boxPadding + 15, yPosition + boxPadding + 55, { fontSize: 11 });
            addText(`• Da riscuotere: ${this.formatCurrency(totalUnpaid)}`, margin + boxPadding + 90, yPosition + boxPadding + 55, { fontSize: 11 });
            
            yPosition += boxHeight + 10;
            
            // Members details (simplified for backup)
            addText('DETTAGLIO MULTE ELIMINATE', margin, yPosition, { fontSize: 16, bold: true });
            yPosition += 15;
            
            this.state.members.forEach(member => {
                if (member.fines && member.fines.length > 0) {
                    const displayName = member.nickname || `${member.name} ${member.surname}`;
                    const totalAmount = member.fines.reduce((sum, fine) => sum + fine.amount, 0);
                    
                    if (yPosition > 250) {
                        doc.addPage();
                        yPosition = 30;
                    }
                    
                    addText(`• ${displayName}: ${this.formatCurrency(totalAmount)} (${member.fines.length} multe)`, margin + 5, yPosition, { fontSize: 12, bold: true });
                    yPosition += 10;
                }
            });
            
            // Save PDF
            const filename = `backup_eliminazione_${currentDate.replace(/\//g, '-')}_${currentTime.replace(/:/g, '-')}.pdf`;
            doc.save(filename);
            
        } catch (error) {
            console.error('Errore nella generazione del PDF:', error);
            this.showNotification('Errore nella generazione del PDF di backup', 'error');
        }
    }

    // Restore deleted fines
    async restoreDeletedFines() {
        const backupData = localStorage.getItem('multeBackup');
        const backupExpiry = localStorage.getItem('multeBackupExpiry');
        
        if (!backupData || !backupExpiry) {
            this.showNotification('Nessun backup disponibile per il ripristino', 'error');
            return;
        }
        
        if (Date.now() > parseInt(backupExpiry)) {
            localStorage.removeItem('multeBackup');
            localStorage.removeItem('multeBackupExpiry');
            this.updateRestoreButton();
            this.showNotification('Il backup è scaduto (30 minuti superati)', 'error');
            return;
        }
        
        if (!confirm('Sei sicuro di voler ripristinare le multe eliminate?')) {
            return;
        }
        
        try {
            const backup = JSON.parse(backupData);
            this.state.members = backup.members;
            this.state.categories = backup.categories;
            this.state.activities = backup.activities;
            this.state.globalDonations = backup.globalDonations || [];
            
            // Remove backup from localStorage
            localStorage.removeItem('multeBackup');
            localStorage.removeItem('multeBackupExpiry');
            
            // Add activity log
            this.addActivity('Ripristinate le multe e offerte libere eliminate', 'fine', new Date());
            
            // Save and update
            await this.saveData();
            this.updateAllSections();
            this.updateRestoreButton();
            
            this.showNotification('Multe ripristinate con successo', 'success');
            
        } catch (error) {
            console.error('Errore nel ripristino:', error);
            this.showNotification('Errore nel ripristino dei dati', 'error');
        }
    }

    // Update restore button visibility
    updateRestoreButton() {
        const restoreBtn = document.getElementById('restoreMulte');
        if (!restoreBtn) return;
        
        const backupData = localStorage.getItem('multeBackup');
        const backupExpiry = localStorage.getItem('multeBackupExpiry');
        
        if (backupData && backupExpiry && Date.now() <= parseInt(backupExpiry)) {
            restoreBtn.style.display = 'inline-block';
            // Update countdown
            const timeLeft = parseInt(backupExpiry) - Date.now();
            const minutesLeft = Math.ceil(timeLeft / (1000 * 60));
            restoreBtn.textContent = `Ripristina (${minutesLeft}min)`;
        } else {
            restoreBtn.style.display = 'none';
            // Clean up expired backup
            localStorage.removeItem('multeBackup');
            localStorage.removeItem('multeBackupExpiry');
        }
    }

    // Update button labels with dates
    updateButtonLabels() {
        // Get current date
        const today = new Date();
        const currentDateStr = today.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        // Get last day of previous month
        const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        const lastMonthDateStr = lastMonth.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        // Update button labels
        const btnReportPDF = document.getElementById('btnReportPDF');
        const btnReportTemp = document.getElementById('btnReportTemp');
        
        if (btnReportPDF) {
            btnReportPDF.textContent = `Report ${lastMonthDateStr}`;
        }
        
        if (btnReportTemp) {
            btnReportTemp.textContent = `Report ${currentDateStr}`;
        }
    }

    // PDF Download
    downloadPDF() {
        try {
            // Check if jsPDF is available - File locale v2.5.1
            if (!window.jspdf) {
                alert('Errore: Libreria PDF non disponibile. Funzionalità PDF temporaneamente non disponibile.');
                return;
            }
            
            // Sintassi per jsPDF v2.5.1 locale
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Calculate end date (last day of previous month)
            const today = new Date();
            const endDate = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of previous month
            const endDateString = endDate.toLocaleDateString('it-IT');
            
            // Calculate totals and filter data up to end date
            const totals = this.calculateTotalsUpToDate(endDate);
            const currentDate = new Date().toLocaleDateString('it-IT');
            
            // PDF Configuration
            const pageWidth = doc.internal.pageSize.width;
            const margin = 20;
            let yPosition = 30;
            
            // Helper function to add text with automatic line wrapping
            const addText = (text, x, y, options = {}) => {
                const fontSize = options.fontSize || 12;
                const maxWidth = options.maxWidth || (pageWidth - 2 * margin);
                const align = options.align || 'left';
                
                doc.setFontSize(fontSize);
                if (options.bold) doc.setFont(undefined, 'bold');
                else doc.setFont(undefined, 'normal');
                
                if (align === 'center') {
                    doc.text(text, pageWidth / 2, y, { align: 'center' });
                } else {
                    const lines = doc.splitTextToSize(text, maxWidth);
                    doc.text(lines, x, y);
                    return lines.length * (fontSize * 0.35); // Return height used
                }
                return fontSize * 0.35;
            };
            
            // Header
            addText('REPORT MENSILE SQUADRA', 0, yPosition, { fontSize: 20, bold: true, align: 'center' });
            yPosition += 15;
            addText(`Situazione al ${endDateString}`, 0, yPosition, { fontSize: 14, align: 'center' });
            yPosition += 10;
            addText(`Generato il: ${currentDate}`, 0, yPosition, { fontSize: 12, align: 'center' });
            yPosition += 20;
            
            // Summary Section
            addText('RIEPILOGO FINANZIARIO', margin, yPosition, { fontSize: 16, bold: true });
            yPosition += 15;
            
            // Financial summary box with improved padding and layout
            const boxHeight = 65;
            const boxPadding = 8;
            doc.setDrawColor(0);
            doc.setFillColor(240, 240, 240);
            doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, boxHeight, 'F');
            doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, boxHeight, 'S');
            
            // Main total with better spacing
            addText(`Totale in Cassa: ${this.formatCurrency(totals.totalCash)}`, margin + boxPadding, yPosition + 8, { fontSize: 14, bold: true });
            
            // Breakdown with proper spacing
            addText(`• Multe Assegnate: ${this.formatCurrency(totals.totalFines)}`, margin + boxPadding, yPosition + 20, { fontSize: 11 });
            addText(`• ICS Partitelle: ${this.formatCurrency(totals.totalICS)}`, margin + boxPadding, yPosition + 30, { fontSize: 11 });
            addText(`• Offerte Libere: ${this.formatCurrency(totals.totalDonations)}`, margin + boxPadding, yPosition + 40, { fontSize: 11 });
            
            // Payment status information
            addText(`Già versato: ${this.formatCurrency(totals.totalPaidAll)} | Da riscuotere: ${this.formatCurrency(totals.totalUnpaidAll)}`, margin + boxPadding, yPosition + 52, { fontSize: 10, bold: true });
            
            yPosition += boxHeight + 10;
            
            // Unpaid Fines Section
            addText('MULTE DA PAGARE', margin, yPosition, { fontSize: 16, bold: true });
            yPosition += 15;
            
            // Get all members with unpaid fines
            const membersWithUnpaidFines = this.state.members.filter(member => {
                if (!member.fines) return false;
                
                // Check if member has any unpaid fines up to end date
                return member.fines.some(fine => {
                    const fineDate = fine.date ? new Date(fine.date) : new Date(0);
                    if (fineDate > endDate) return false;
                    
                    // Check if fine is unpaid or payment was made after end date
                    if (!fine.paid) return true;
                    
                    const paymentDate = fine.paymentDate ? new Date(fine.paymentDate) : fineDate;
                    return paymentDate > endDate;
                });
            });
            
            if (membersWithUnpaidFines.length > 0) {
                membersWithUnpaidFines.forEach(member => {
                    // Check if we need a new page with better margin
                    if (yPosition > 240) {
                        doc.addPage();
                        yPosition = 30;
                    }
                    
                    // Calculate unpaid amount for this member
                    let unpaidAmount = 0;
                    const unpaidFines = member.fines.filter(fine => {
                        const fineDate = fine.date ? new Date(fine.date) : new Date(0);
                        if (fineDate > endDate) return false;
                        
                        // Check if fine is unpaid or payment was made after end date
                        if (!fine.paid) {
                            unpaidAmount += fine.amount;
                            return true;
                        }
                        
                        const paymentDate = fine.paymentDate ? new Date(fine.paymentDate) : fineDate;
                        if (paymentDate > endDate) {
                            unpaidAmount += fine.amount;
                            return true;
                        }
                        
                        return false;
                    });
                    
                    // Display member name with nickname if present (without quotes)
                    const displayName = member.nickname ? member.nickname : `${member.name} ${member.surname}`;
                    
                    addText(`• ${displayName}: ${this.formatCurrency(unpaidAmount)}`, margin + 5, yPosition, { fontSize: 12, bold: true });
                    yPosition += 8;
                    
                    // Show unpaid fines details
                    unpaidFines.forEach(fine => {
                        // Check page break before each fine detail
                        if (yPosition > 260) {
                            doc.addPage();
                            yPosition = 30;
                        }
                        
                        const category = this.state.categories[fine.category];
                        const categoryName = category ? category.name : fine.category;
                        const fineDate = new Date(fine.date).toLocaleDateString('it-IT');
                        
                        // Check if fine is older than 30 days
                        const today = new Date();
                        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
                        const isOldFine = new Date(fine.date) < thirtyDaysAgo;
                        
                        // Set text color to red for old fines
                        if (isOldFine) {
                            doc.setTextColor(255, 0, 0); // Red color
                        } else {
                            doc.setTextColor(0, 0, 0); // Black color
                        }
                        
                        addText(`  - ${categoryName}: ${this.formatCurrency(fine.amount)} (${fineDate})`, margin + 10, yPosition, { fontSize: 10 });
                        
                        // Reset color to black
                        doc.setTextColor(0, 0, 0);
                        
                        yPosition += 5;
                    });
                    
                    yPosition += 5;
                });
            } else {
                addText('Nessuna multa da pagare al momento.', margin + 5, yPosition, { fontSize: 12 });
                yPosition += 10;
            }
            
            // Categories breakdown
            yPosition += 15;
            
            // Check if we need a new page with better margin
            if (yPosition > 210) {
                doc.addPage();
                yPosition = 30;
            }
            
            addText('RIEPILOGO PER CATEGORIA', margin, yPosition, { fontSize: 16, bold: true });
            yPosition += 15;
            
            // Calculate category totals up to end date
            const categoryTotals = {};
            const macroCategoryTotals = {};
            
            this.state.members.forEach(member => {
                if (member.fines) {
                    member.fines.forEach(fine => {
                        const fineDate = fine.date ? new Date(fine.date) : new Date(0);
                        if (fineDate <= endDate) {
                            if (!categoryTotals[fine.category]) {
                                categoryTotals[fine.category] = { total: 0, paid: 0, count: 0 };
                            }
                            categoryTotals[fine.category].total += fine.amount;
                            categoryTotals[fine.category].count += 1;
                            if (fine.paid) {
                                const paymentDate = fine.paymentDate ? new Date(fine.paymentDate) : fineDate;
                                if (paymentDate <= endDate) {
                                    categoryTotals[fine.category].paid += fine.amount;
                                }
                            }
                            
                            // Calculate macro category totals
                            const category = this.state.categories[fine.category];
                            if (category && category.parentCategory) {
                                const macroKey = category.parentCategory;
                                if (!macroCategoryTotals[macroKey]) {
                                    macroCategoryTotals[macroKey] = { total: 0, paid: 0, count: 0 };
                                }
                                macroCategoryTotals[macroKey].total += fine.amount;
                                macroCategoryTotals[macroKey].count += 1;
                                if (fine.paid) {
                                    const paymentDate = fine.paymentDate ? new Date(fine.paymentDate) : fineDate;
                                    if (paymentDate <= endDate) {
                                        macroCategoryTotals[macroKey].paid += fine.amount;
                                    }
                                }
                            }
                        }
                    });
                }
            });
            
            // Display ICS first if present
            if (categoryTotals['ics']) {
                // Check page break
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 30;
                }
                
                const icsData = categoryTotals['ics'];
                addText(`• ICS:`, margin + 5, yPosition, { fontSize: 12, bold: true });
                yPosition += 8;
                addText(`  ${icsData.count} multe per ${this.formatCurrency(icsData.total)} totali (${this.formatCurrency(icsData.paid)} pagati, ${this.formatCurrency(icsData.total - icsData.paid)} da versare)`, margin + 10, yPosition, { fontSize: 10 });
                yPosition += 15;
            }
            
            // Display macro categories with their subcategories
            Object.entries(macroCategoryTotals).forEach(([macroKey, macroData]) => {
                // Check page break before each macro category
                if (yPosition > 240) {
                    doc.addPage();
                    yPosition = 30;
                }
                
                const macroCategory = this.state.categories[macroKey];
                const macroCategoryName = macroCategory ? macroCategory.name : macroKey;
                
                // Display macro category summary
                addText(`• ${macroCategoryName}:`, margin + 5, yPosition, { fontSize: 12, bold: true });
                yPosition += 8;
                addText(`  ${this.formatCurrency(macroData.total)} assegnate | ${this.formatCurrency(macroData.paid)} versate | ${this.formatCurrency(macroData.total - macroData.paid)} da versare`, margin + 10, yPosition, { fontSize: 10 });
                yPosition += 10;
                
                // Display subcategories under this macro category
                Object.entries(categoryTotals).forEach(([categoryKey, data]) => {
                    const category = this.state.categories[categoryKey];
                    if (category && category.parentCategory === macroKey) {
                        // Check page break before each subcategory
                        if (yPosition > 260) {
                            doc.addPage();
                            yPosition = 30;
                        }
                        
                        const categoryName = category.name;
                        addText(`    - ${categoryName}:`, margin + 15, yPosition, { fontSize: 11, bold: true });
                        yPosition += 6;
                        addText(`      ${data.count} multe per ${this.formatCurrency(data.total)} totali (${this.formatCurrency(data.paid)} pagati, ${this.formatCurrency(data.total - data.paid)} da versare)`, margin + 20, yPosition, { fontSize: 9 });
                        yPosition += 8;
                    }
                });
                
                yPosition += 5;
            });
            
            // Display any remaining categories that don't have a parent (excluding ICS already shown)
            Object.entries(categoryTotals).forEach(([categoryKey, data]) => {
                if (categoryKey !== 'ics') {
                    const category = this.state.categories[categoryKey];
                    if (!category || !category.parentCategory) {
                        // Check page break
                        if (yPosition > 250) {
                            doc.addPage();
                            yPosition = 30;
                        }
                        
                        const categoryName = category ? category.name : categoryKey;
                        addText(`• ${categoryName}:`, margin + 5, yPosition, { fontSize: 12, bold: true });
                        yPosition += 8;
                        addText(`  ${data.count} multe per ${this.formatCurrency(data.total)} totali (${this.formatCurrency(data.paid)} pagati, ${this.formatCurrency(data.total - data.paid)} da versare)`, margin + 10, yPosition, { fontSize: 10 });
                        yPosition += 10;
                    }
                }
            });
            
            // Add donations summary
            let totalDonations = 0;
            let donationsCount = 0;
            
            // Calculate member donations up to end date
            this.state.members.forEach(member => {
                if (member.donations) {
                    member.donations.forEach(donation => {
                        const donationDate = donation.date ? new Date(donation.date) : new Date(0);
                        if (donationDate <= endDate) {
                            totalDonations += donation.amount;
                            donationsCount++;
                        }
                    });
                }
            });
            
            // Add global donations up to end date
            if (this.state.globalDonations) {
                this.state.globalDonations.forEach(donation => {
                    const donationDate = donation.date ? new Date(donation.date) : new Date(0);
                    if (donationDate <= endDate) {
                        totalDonations += donation.amount;
                        donationsCount++;
                    }
                });
            }
            
            if (totalDonations > 0) {
                // Check page break
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 30;
                }
                
                totalDonations = Math.round(totalDonations * 100) / 100;
                addText(`• Offerte Libere:`, margin + 5, yPosition, { fontSize: 12, bold: true });
                yPosition += 8;
                addText(`  ${donationsCount} offerte per ${this.formatCurrency(totalDonations)} totali raccolti`, margin + 10, yPosition, { fontSize: 10 });
                yPosition += 10;
            }
            
            // MAGGIORI CONTRIBUENTI Section
            yPosition += 10;
            
            // Check page break before new section
            if (yPosition > 200) {
                doc.addPage();
                yPosition = 30;
            }
            
            addText('MAGGIORI CONTRIBUENTI', margin, yPosition, { fontSize: 16, bold: true });
            yPosition += 15;
            
            // Calculate member statistics for rankings
            const memberRankings = [];
            
            this.state.members.forEach(member => {
                if (!member.fines && !member.donations) return;
                
                const memberStats = this.getMemberStatsUpToDate(member.id, endDate);
                
                memberRankings.push({
                    name: member.nickname || member.name,
                    totalFines: memberStats.totalFines,
                    totalICS: memberStats.totalICS,
                    totalAssigned: memberStats.totalFines + memberStats.totalICS,
                    totalPaid: memberStats.totalPaid,
                    finesPaid: memberStats.paidAmount + memberStats.paidICS,
                    donations: memberStats.totalDonations
                });
            });
            
            // 1. Ranking by total amount of assigned fines
            addText('1. Classifica per ammontare economico multe assegnate:', margin + 5, yPosition, { fontSize: 12, bold: true });
            yPosition += 10;
            
            const finesRanking = memberRankings
                .filter(member => member.totalAssigned > 0)
                .sort((a, b) => b.totalAssigned - a.totalAssigned)
                .slice(0, 10);
            
            if (finesRanking.length === 0) {
                addText('Nessun membro con multe assegnate', margin + 10, yPosition, { fontSize: 10 });
                yPosition += 10;
            } else {
                finesRanking.forEach((member, index) => {
                    // Check page break
                    if (yPosition > 250) {
                        doc.addPage();
                        yPosition = 30;
                    }
                    
                    // Create breakdown text
                    let breakdown = '';
                    if (member.totalFines > 0 && member.totalICS > 0) {
                        breakdown = ` (${this.formatCurrency(member.totalFines)} multe + ${this.formatCurrency(member.totalICS)} ICS)`;
                    } else if (member.totalFines > 0) {
                        breakdown = ` (${this.formatCurrency(member.totalFines)} multe)`;
                    } else if (member.totalICS > 0) {
                        breakdown = ` (${this.formatCurrency(member.totalICS)} ICS)`;
                    }
                    
                    addText(`${index + 1}. ${member.name} - ${this.formatCurrency(member.totalAssigned)}${breakdown}`, margin + 10, yPosition, { fontSize: 10 });
                    yPosition += 6;
                });
            }
            
            yPosition += 10;
            
            // 2. Ranking by total amount paid (fines + donations)
            addText('2. Classifica per ammontare pagato (multe + offerte libere):', margin + 5, yPosition, { fontSize: 12, bold: true });
            yPosition += 10;
            
            // Calculate external donations
            const externalDonations = this.globalDonations
                .filter(donation => !donation.memberId)
                .reduce((sum, donation) => sum + donation.amount, 0);
            
            // Create ranking including external donations
            const paidRankingWithExternal = [...memberRankings
                .filter(member => member.totalPaid > 0)
                .sort((a, b) => b.totalPaid - a.totalPaid)];
            
            // Add external donations if any
            if (externalDonations > 0) {
                paidRankingWithExternal.push({
                    name: 'Esterni alla squadra',
                    totalPaid: externalDonations,
                    finesPaid: 0,
                    donations: externalDonations
                });
                paidRankingWithExternal.sort((a, b) => b.totalPaid - a.totalPaid);
            }
            
            const paidRanking = paidRankingWithExternal.slice(0, 10);
            
            if (paidRanking.length === 0) {
                addText('Nessun membro con pagamenti effettuati', margin + 10, yPosition, { fontSize: 10 });
                yPosition += 10;
            } else {
                paidRanking.forEach((member, index) => {
                    // Check page break
                    if (yPosition > 250) {
                        doc.addPage();
                        yPosition = 30;
                    }
                    
                    const breakdown = member.donations > 0 ? 
                        ` (${this.formatCurrency(member.finesPaid)} multe + ${this.formatCurrency(member.donations)} offerte)` : 
                        ` (${this.formatCurrency(member.finesPaid)} multe)`;
                    
                    addText(`${index + 1}. ${member.name} - ${this.formatCurrency(member.totalPaid)}${breakdown}`, margin + 10, yPosition, { fontSize: 10 });
                    yPosition += 6;
                });
            }
            
            yPosition += 10;
            
            // 3. Ranking by ICS assigned
            addText('3. Classifica per ICS assegnate:', margin + 5, yPosition, { fontSize: 12, bold: true });
            yPosition += 10;
            
            const icsRanking = memberRankings
                .filter(member => member.totalICS > 0)
                .sort((a, b) => b.totalICS - a.totalICS)
                .slice(0, 10);
            
            if (icsRanking.length === 0) {
                addText('Nessun membro con ICS assegnate', margin + 10, yPosition, { fontSize: 10 });
                yPosition += 10;
            } else {
                icsRanking.forEach((member, index) => {
                    // Check page break
                    if (yPosition > 250) {
                        doc.addPage();
                        yPosition = 30;
                    }
                    
                    addText(`${index + 1}. ${member.name} - ${this.formatCurrency(member.totalICS)}`, margin + 10, yPosition, { fontSize: 10 });
                    yPosition += 6;
                });
            }
            
            yPosition += 10;
            
            // 4. Ranking by free donations
            addText('4. Classifica per offerte libere:', margin + 5, yPosition, { fontSize: 12, bold: true });
            yPosition += 10;
            
            // Create donations ranking including external donations
            const donationsRankingWithExternal = [...memberRankings
                .filter(member => member.donations > 0)
                .sort((a, b) => b.donations - a.donations)];
            
            // Add external donations if any
            if (externalDonations > 0) {
                donationsRankingWithExternal.push({
                    name: 'Esterni alla squadra',
                    donations: externalDonations
                });
                donationsRankingWithExternal.sort((a, b) => b.donations - a.donations);
            }
            
            const donationsRanking = donationsRankingWithExternal.slice(0, 10);
            
            if (donationsRanking.length === 0) {
                addText('Nessun membro con offerte libere', margin + 10, yPosition, { fontSize: 10 });
                yPosition += 10;
            } else {
                donationsRanking.forEach((member, index) => {
                    // Check page break
                    if (yPosition > 250) {
                        doc.addPage();
                        yPosition = 30;
                    }
                    
                    addText(`${index + 1}. ${member.name} - ${this.formatCurrency(member.donations)}`, margin + 10, yPosition, { fontSize: 10 });
                    yPosition += 6;
                });
            }

            
            yPosition += 10;

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.text(`Pagina ${i} di ${pageCount} - Generato da Calcio Cash Flow`, pageWidth / 2, 285, { align: 'center' });
            }
            
            // Download the PDF
            const fileMonth = endDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
            const fileName = `Report_Squadra_${fileMonth.replace(' ', '_')}.pdf`;
            doc.save(fileName);
            
            this.showNotification('Report PDF generato e scaricato con successo!', 'success');
            
        } catch (error) {
            console.error('Errore nella generazione del PDF:', error);
            this.showNotification('Errore nella generazione del PDF. Riprova.', 'error');
        }
    }

    // Temporary PDF Download (all fines up to current date)
    downloadTemporaryPDF() {
        try {
            // Check if jsPDF is available - File locale v2.5.1
            if (!window.jspdf) {
                alert('Errore: Libreria PDF non disponibile. Funzionalità PDF temporaneamente non disponibile.');
                return;
            }
            
            // Sintassi per jsPDF v2.5.1 locale
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Use current date as end date (instead of last day of previous month)
            const today = new Date();
            const endDate = today; // Include all fines up to today
            const endDateString = endDate.toLocaleDateString('it-IT');
            
            // Calculate totals and filter data up to end date
            const totals = this.calculateTotalsUpToDate(endDate);
            const currentDate = new Date().toLocaleDateString('it-IT');
            
            // PDF Configuration
            const pageWidth = doc.internal.pageSize.width;
            const margin = 20;
            let yPosition = 30;
            
            // Helper function to add text with automatic line wrapping
            const addText = (text, x, y, options = {}) => {
                const fontSize = options.fontSize || 12;
                const maxWidth = options.maxWidth || (pageWidth - 2 * margin);
                const align = options.align || 'left';
                
                doc.setFontSize(fontSize);
                if (options.bold) doc.setFont(undefined, 'bold');
                else doc.setFont(undefined, 'normal');
                
                if (align === 'center') {
                    doc.text(text, pageWidth / 2, y, { align: 'center' });
                } else {
                    const lines = doc.splitTextToSize(text, maxWidth);
                    doc.text(lines, x, y);
                    return lines.length * (fontSize * 0.35); // Return height used
                }
                return fontSize * 0.35;
            };
            
            // Header
            addText('REPORT PROVVISORIO SQUADRA', 0, yPosition, { fontSize: 20, bold: true, align: 'center' });
            yPosition += 15;
            addText(`Situazione al ${endDateString} (TUTTE LE MULTE)`, 0, yPosition, { fontSize: 14, align: 'center' });
            yPosition += 10;
            addText(`Generato il: ${currentDate}`, 0, yPosition, { fontSize: 12, align: 'center' });
            yPosition += 20;
            
            // Summary Section
            addText('RIEPILOGO FINANZIARIO', margin, yPosition, { fontSize: 16, bold: true });
            yPosition += 15;
            
            // Financial summary box with improved padding and layout
            const boxHeight = 65;
            const boxPadding = 8;
            doc.setDrawColor(0);
            doc.setFillColor(240, 240, 240);
            doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, boxHeight, 'F');
            doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, boxHeight, 'S');
            
            // Main total with better spacing
            addText(`Totale in Cassa: ${this.formatCurrency(totals.totalCash)}`, margin + boxPadding, yPosition + 8, { fontSize: 14, bold: true });
            
            // Breakdown with proper spacing
            addText(`• Multe Assegnate: ${this.formatCurrency(totals.totalFines)}`, margin + boxPadding, yPosition + 20, { fontSize: 11 });
            addText(`• ICS Partitelle: ${this.formatCurrency(totals.totalICS)}`, margin + boxPadding, yPosition + 30, { fontSize: 11 });
            addText(`• Offerte Libere: ${this.formatCurrency(totals.totalDonations)}`, margin + boxPadding, yPosition + 40, { fontSize: 11 });
            
            // Payment status information
            addText(`Già versato: ${this.formatCurrency(totals.totalPaidAll)} | Da riscuotere: ${this.formatCurrency(totals.totalUnpaidAll)}`, margin + boxPadding, yPosition + 52, { fontSize: 10, bold: true });
            
            yPosition += boxHeight + 10;
            
            // Unpaid Fines Section
            addText('MULTE DA PAGARE', margin, yPosition, { fontSize: 16, bold: true });
            yPosition += 15;
            
            // Get all members with unpaid fines
            const membersWithUnpaidFines = this.state.members.filter(member => {
                if (!member.fines) return false;
                
                // Check if member has any unpaid fines up to end date
                return member.fines.some(fine => {
                    const fineDate = fine.date ? new Date(fine.date) : new Date(0);
                    if (fineDate > endDate) return false;
                    
                    // Check if fine is unpaid or payment was made after end date
                    if (!fine.paid) return true;
                    
                    const paymentDate = fine.paymentDate ? new Date(fine.paymentDate) : fineDate;
                    return paymentDate > endDate;
                });
            });
            
            if (membersWithUnpaidFines.length > 0) {
                membersWithUnpaidFines.forEach(member => {
                    // Check if we need a new page with better margin
                    if (yPosition > 240) {
                        doc.addPage();
                        yPosition = 30;
                    }
                    
                    // Calculate unpaid amount for this member
                    let unpaidAmount = 0;
                    const unpaidFines = member.fines.filter(fine => {
                        const fineDate = fine.date ? new Date(fine.date) : new Date(0);
                        if (fineDate > endDate) return false;
                        
                        // Check if fine is unpaid or payment was made after end date
                        if (!fine.paid) {
                            unpaidAmount += fine.amount;
                            return true;
                        }
                        
                        const paymentDate = fine.paymentDate ? new Date(fine.paymentDate) : fineDate;
                        if (paymentDate > endDate) {
                            unpaidAmount += fine.amount;
                            return true;
                        }
                        
                        return false;
                    });
                    
                    // Display member name with nickname if present (without quotes)
                    const displayName = member.nickname ? member.nickname : `${member.name} ${member.surname}`;
                    
                    addText(`• ${displayName}: ${this.formatCurrency(unpaidAmount)}`, margin + 5, yPosition, { fontSize: 12, bold: true });
                    yPosition += 8;
                    
                    // Show unpaid fines details
                    unpaidFines.forEach(fine => {
                        // Check page break before each fine detail
                        if (yPosition > 260) {
                            doc.addPage();
                            yPosition = 30;
                        }
                        
                        const category = this.state.categories[fine.category];
                        const categoryName = category ? category.name : fine.category;
                        const fineDate = new Date(fine.date).toLocaleDateString('it-IT');
                        
                        // Check if fine is older than 30 days
                        const today = new Date();
                        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
                        const isOldFine = new Date(fine.date) < thirtyDaysAgo;
                        
                        // Set text color to red for old fines
                        if (isOldFine) {
                            doc.setTextColor(255, 0, 0); // Red color
                        } else {
                            doc.setTextColor(0, 0, 0); // Black color
                        }
                        
                        addText(`  - ${categoryName}: ${this.formatCurrency(fine.amount)} (${fineDate})`, margin + 10, yPosition, { fontSize: 10 });
                        
                        // Reset color to black
                        doc.setTextColor(0, 0, 0);
                        
                        yPosition += 5;
                    });
                    
                    yPosition += 5;
                });
            } else {
                addText('Nessuna multa da pagare al momento.', margin + 5, yPosition, { fontSize: 12 });
                yPosition += 10;
            }
            
            // Categories breakdown
            yPosition += 15;
            
            // Check if we need a new page with better margin
            if (yPosition > 210) {
                doc.addPage();
                yPosition = 30;
            }
            
            addText('RIEPILOGO PER CATEGORIA', margin, yPosition, { fontSize: 16, bold: true });
            yPosition += 15;
            
            // Calculate category totals up to end date
            const categoryTotals = {};
            const macroCategoryTotals = {};
            
            this.state.members.forEach(member => {
                if (member.fines) {
                    member.fines.forEach(fine => {
                        const fineDate = fine.date ? new Date(fine.date) : new Date(0);
                        if (fineDate <= endDate) {
                            if (!categoryTotals[fine.category]) {
                                categoryTotals[fine.category] = { total: 0, paid: 0, count: 0 };
                            }
                            categoryTotals[fine.category].total += fine.amount;
                            categoryTotals[fine.category].count += 1;
                            if (fine.paid) {
                                const paymentDate = fine.paymentDate ? new Date(fine.paymentDate) : fineDate;
                                if (paymentDate <= endDate) {
                                    categoryTotals[fine.category].paid += fine.amount;
                                }
                            }
                            
                            // Calculate macro category totals
                            const category = this.state.categories[fine.category];
                            if (category && category.parentCategory) {
                                const macroKey = category.parentCategory;
                                if (!macroCategoryTotals[macroKey]) {
                                    macroCategoryTotals[macroKey] = { total: 0, paid: 0, count: 0 };
                                }
                                macroCategoryTotals[macroKey].total += fine.amount;
                                macroCategoryTotals[macroKey].count += 1;
                                if (fine.paid) {
                                    const paymentDate = fine.paymentDate ? new Date(fine.paymentDate) : fineDate;
                                    if (paymentDate <= endDate) {
                                        macroCategoryTotals[macroKey].paid += fine.amount;
                                    }
                                }
                            }
                        }
                    });
                }
            });
            
            // Display ICS first if present
            if (categoryTotals['ics']) {
                // Check page break
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 30;
                }
                
                const icsData = categoryTotals['ics'];
                addText(`• ICS:`, margin + 5, yPosition, { fontSize: 12, bold: true });
                yPosition += 8;
                addText(`  ${icsData.count} multe per ${this.formatCurrency(icsData.total)} totali (${this.formatCurrency(icsData.paid)} pagati, ${this.formatCurrency(icsData.total - icsData.paid)} da versare)`, margin + 10, yPosition, { fontSize: 10 });
                yPosition += 15;
            }
            
            // Display macro categories with their subcategories
            Object.entries(macroCategoryTotals).forEach(([macroKey, macroData]) => {
                // Check page break before each macro category
                if (yPosition > 240) {
                    doc.addPage();
                    yPosition = 30;
                }
                
                const macroCategory = this.state.categories[macroKey];
                const macroCategoryName = macroCategory ? macroCategory.name : macroKey;
                
                // Display macro category summary
                addText(`• ${macroCategoryName}:`, margin + 5, yPosition, { fontSize: 12, bold: true });
                yPosition += 8;
                addText(`  ${this.formatCurrency(macroData.total)} assegnate | ${this.formatCurrency(macroData.paid)} versate | ${this.formatCurrency(macroData.total - macroData.paid)} da versare`, margin + 10, yPosition, { fontSize: 10 });
                yPosition += 10;
                
                // Display subcategories under this macro category
                Object.entries(categoryTotals).forEach(([categoryKey, data]) => {
                    const category = this.state.categories[categoryKey];
                    if (category && category.parentCategory === macroKey) {
                        // Check page break before each subcategory
                        if (yPosition > 260) {
                            doc.addPage();
                            yPosition = 30;
                        }
                        
                        const categoryName = category.name;
                        addText(`    - ${categoryName}:`, margin + 15, yPosition, { fontSize: 11, bold: true });
                        yPosition += 6;
                        addText(`      ${data.count} multe per ${this.formatCurrency(data.total)} totali (${this.formatCurrency(data.paid)} pagati, ${this.formatCurrency(data.total - data.paid)} da versare)`, margin + 20, yPosition, { fontSize: 9 });
                        yPosition += 8;
                    }
                });
                
                yPosition += 5;
            });
            
            // Display any remaining categories that don't have a parent (excluding ICS already shown)
            Object.entries(categoryTotals).forEach(([categoryKey, data]) => {
                if (categoryKey !== 'ics') {
                    const category = this.state.categories[categoryKey];
                    if (!category || !category.parentCategory) {
                        // Check page break
                        if (yPosition > 250) {
                            doc.addPage();
                            yPosition = 30;
                        }
                        
                        const categoryName = category ? category.name : categoryKey;
                        addText(`• ${categoryName}:`, margin + 5, yPosition, { fontSize: 12, bold: true });
                        yPosition += 8;
                        addText(`  ${data.count} multe per ${this.formatCurrency(data.total)} totali (${this.formatCurrency(data.paid)} pagati, ${this.formatCurrency(data.total - data.paid)} da versare)`, margin + 10, yPosition, { fontSize: 10 });
                        yPosition += 10;
                    }
                }
            });
            
            // Add donations summary
            let totalDonations = 0;
            let donationsCount = 0;
            
            // Calculate member donations up to end date
            this.state.members.forEach(member => {
                if (member.donations) {
                    member.donations.forEach(donation => {
                        const donationDate = donation.date ? new Date(donation.date) : new Date(0);
                        if (donationDate <= endDate) {
                            totalDonations += donation.amount;
                            donationsCount++;
                        }
                    });
                }
            });
            
            // Add global donations up to end date
            if (this.state.globalDonations) {
                this.state.globalDonations.forEach(donation => {
                    const donationDate = donation.date ? new Date(donation.date) : new Date(0);
                    if (donationDate <= endDate) {
                        totalDonations += donation.amount;
                        donationsCount++;
                    }
                });
            }
            
            if (totalDonations > 0) {
                // Check page break
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 30;
                }
                
                totalDonations = Math.round(totalDonations * 100) / 100;
                addText(`• Offerte Libere:`, margin + 5, yPosition, { fontSize: 12, bold: true });
                yPosition += 8;
                addText(`  ${donationsCount} offerte per ${this.formatCurrency(totalDonations)} totali raccolti`, margin + 10, yPosition, { fontSize: 10 });
                yPosition += 10;
            }
            
            // MAGGIORI CONTRIBUENTI Section
            yPosition += 10;
            
            // Check page break before new section
            if (yPosition > 200) {
                doc.addPage();
                yPosition = 30;
            }
            
            addText('MAGGIORI CONTRIBUENTI', margin, yPosition, { fontSize: 16, bold: true });
            yPosition += 15;
            
            // Calculate member statistics for rankings
            const memberRankings = [];
            
            this.state.members.forEach(member => {
                if (!member.fines && !member.donations) return;
                
                const stats = this.getMemberStatsByPeriod(member.id, null, endDate);
                
                memberRankings.push({
                    name: member.nickname || member.name,
                    totalFines: stats.totalFines,
                    totalICS: stats.totalICS,
                    totalAssigned: stats.totalFines + stats.totalICS,
                    totalPaid: stats.totalPaid,
                    finesPaid: stats.paidAmount + stats.paidICS,
                    donations: stats.totalDonations
                });
            });
            
            // 1. Ranking by total amount of assigned fines
            addText('1. Classifica per ammontare economico multe assegnate:', margin + 5, yPosition, { fontSize: 12, bold: true });
            yPosition += 10;
            
            const finesRanking = memberRankings
                .filter(member => member.totalAssigned > 0)
                .sort((a, b) => b.totalAssigned - a.totalAssigned)
                .slice(0, 10);
            
            if (finesRanking.length === 0) {
                addText('Nessun membro con multe assegnate', margin + 10, yPosition, { fontSize: 10 });
                yPosition += 10;
            } else {
                finesRanking.forEach((member, index) => {
                    // Check page break
                    if (yPosition > 250) {
                        doc.addPage();
                        yPosition = 30;
                    }
                    
                    const breakdown = member.totalICS > 0 ? 
                        ` (${this.formatCurrency(member.totalFines)} multe + ${this.formatCurrency(member.totalICS)} ICS)` : 
                        ` (${this.formatCurrency(member.totalFines)} multe)`;
                    
                    addText(`${index + 1}. ${member.name} - ${this.formatCurrency(member.totalAssigned)}${breakdown}`, margin + 10, yPosition, { fontSize: 10 });
                    yPosition += 6;
                });
            }
            
            yPosition += 10;
            
            // 2. Ranking by total amount paid (fines + donations)
            addText('2. Classifica per ammontare pagato (multe + offerte libere):', margin + 5, yPosition, { fontSize: 12, bold: true });
            yPosition += 10;
            
            const paidRanking = memberRankings
                .filter(member => member.totalPaid > 0)
                .sort((a, b) => b.totalPaid - a.totalPaid)
                .slice(0, 10);
            
            if (paidRanking.length === 0) {
                addText('Nessun membro con pagamenti effettuati', margin + 10, yPosition, { fontSize: 10 });
                yPosition += 10;
            } else {
                paidRanking.forEach((member, index) => {
                    // Check page break
                    if (yPosition > 245) {
                        doc.addPage();
                        yPosition = 30;
                    }
                    
                    const breakdown = member.donations > 0 ? 
                        ` (${this.formatCurrency(member.finesPaid)} multe + ${this.formatCurrency(member.donations)} offerte)` : 
                        ` (${this.formatCurrency(member.finesPaid)} multe)`;
                    
                    addText(`${index + 1}. ${member.name} - ${this.formatCurrency(member.totalPaid)}${breakdown}`, margin + 10, yPosition, { fontSize: 10 });
                    yPosition += 6;
                });
            }
            
            yPosition += 10;
            
            // 3. Ranking by ICS assigned
            addText('3. Classifica per ICS assegnate:', margin + 5, yPosition, { fontSize: 12, bold: true });
            yPosition += 10;
            
            const icsRankingTempPDF = memberRankings
                .filter(member => member.totalICS > 0)
                .sort((a, b) => b.totalICS - a.totalICS)
                .slice(0, 10);
            
            if (icsRankingTempPDF.length === 0) {
                addText('Nessun membro con ICS assegnate', margin + 10, yPosition, { fontSize: 10 });
                yPosition += 10;
            } else {
                icsRankingTempPDF.forEach((member, index) => {
                     // Check page break
                     if (yPosition > 250) {
                         doc.addPage();
                         yPosition = 30;
                     }
                    
                    addText(`${index + 1}. ${member.name} - ${this.formatCurrency(member.totalICS)}`, margin + 10, yPosition, { fontSize: 10 });
                    yPosition += 6;
                });
            }
            
            yPosition += 10;
            
            // 4. Ranking by free donations
            addText('4. Classifica per offerte libere:', margin + 5, yPosition, { fontSize: 12, bold: true });
            yPosition += 10;
            
            // Create donations ranking including external donations
            const donationsRankingWithExternal = [...memberRankings
                .filter(member => member.donations > 0)
                .sort((a, b) => b.donations - a.donations)];
            
            // Add external donations if any
            if (externalDonations > 0) {
                donationsRankingWithExternal.push({
                    name: 'Esterni alla squadra',
                    donations: externalDonations
                });
                donationsRankingWithExternal.sort((a, b) => b.donations - a.donations);
            }
            
            const donationsRankingTempPDF = donationsRankingWithExternal.slice(0, 10);
            
            if (donationsRankingTempPDF.length === 0) {
                addText('Nessun membro con offerte libere', margin + 10, yPosition, { fontSize: 10 });
                yPosition += 10;
            } else {
                donationsRankingTempPDF.forEach((member, index) => {
                     // Check page break
                     if (yPosition > 250) {
                         doc.addPage();
                         yPosition = 30;
                     }
                    
                    addText(`${index + 1}. ${member.name} - ${this.formatCurrency(member.donations)}`, margin + 10, yPosition, { fontSize: 10 });
                    yPosition += 6;
                });
            }
            
            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.text(`Pagina ${i} di ${pageCount} - Report Provvisorio - Calcio Cash Flow`, pageWidth / 2, 285, { align: 'center' });
            }
            
            // Download the PDF
            const fileName = `Report_Provvisorio_${currentDate.replace(/\//g, '_')}.pdf`;
            doc.save(fileName);
            
            this.showNotification('Report PDF provvisorio generato e scaricato con successo!', 'success');
            
        } catch (error) {
            console.error('Errore nella generazione del PDF provvisorio:', error);
            this.showNotification('Errore nella generazione del PDF provvisorio. Riprova.', 'error');
        }
    }

    // Helper function to format monetary values
    formatCurrency(amount) {
        const rounded = Math.round(amount * 100) / 100;
        return `€ ${rounded.toFixed(2)}`;
    }

    // Notification System
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--danger-color)' : 'var(--secondary-color)'};
            color: white;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Global function to toggle fine payment
async function toggleFinePayment(memberId, fineIndex) {
    if (window.app) {
        await window.app.toggleFinePayment(memberId, fineIndex);
    }
}



// Delete Member Function
async function deleteMember(memberId) {
    if (window.app) {
        await window.app.deleteMember(memberId);
    }
}

// Reactivate Member Function
async function reactivateMember(memberId) {
    if (window.app) {
        await window.app.reactivateMember(memberId);
    }
}

// Global functions for tab management
function switchMulteTab(tabName) {
    if (window.app) {
        window.app.switchMulteTab(tabName);
    }
}

function switchRosaTab(tabName) {
    if (window.app) {
        window.app.switchRosaTab(tabName);
    }
}

function togglePaidFines(memberId) {
    if (window.app) {
        window.app.togglePaidFines(memberId);
    }
}

// Delete Assigned and Paid Fines Function
async function deleteAssignedAndPaidFines() {
    if (window.app) {
        await window.app.deleteAssignedAndPaidFines();
    }
}

// Restore Deleted Fines Function
async function restoreDeletedFines() {
    if (window.app) {
        await window.app.restoreDeletedFines();
    }
}

// Categories Management Functions
function openCategoriesModal() {
    const modal = document.getElementById('categoriesModal');
    modal.classList.add('active');
    renderCategoriesList();
    initializeCategoryForm();
}

function closeCategoriesModal() {
    const modal = document.getElementById('categoriesModal');
    modal.classList.remove('active');
}

function renderCategoriesList() {
    const container = document.getElementById('categoriesList');
    container.innerHTML = '';
    
    // Separate main categories and subcategories, include ICS in main categories
    const mainCategories = [];
    const subcategories = [];
    
    Object.entries(app.state.categories).forEach(([key, category]) => {
        if (category.type === 'subcategory') {
            subcategories.push([key, category]);
        } else {
            mainCategories.push([key, category]);
        }
    });
    
    // Render main categories first, then their subcategories
    mainCategories.forEach(([key, category]) => {
        const categoryEl = document.createElement('div');
        const isInactive = category.active === false;
        categoryEl.className = `category-item main-category${isInactive ? ' inactive' : ''}`;
        
        // Special handling for ICS category
        const isICS = key === 'ics';
        const deleteButton = isICS ? '' : (isInactive ? 
            `<button class="btn-reactivate" data-action="reactivateCategory" data-params='{"categoryKey":"${key}"}'>Riattiva</button>` :
                `<button class="btn-delete" data-action="deleteCategory" data-params='{"categoryKey":"${key}"}'>Rendi Inattiva</button>`);
        const specialLabel = isICS ? ' <span class="special-category">(Speciale)</span>' : '';
        const categoryTypeLabel = category.type === 'category' ? ' <span class="category-type">(Categoria)</span>' : '';
        const inactiveLabel = isInactive ? ' <span class="inactive-label">(Inattiva)</span>' : '';
        
        categoryEl.innerHTML = `
            <div class="category-info">
                <div class="category-name">${category.name}${specialLabel}${categoryTypeLabel}${inactiveLabel}</div>
                ${(category.type === 'subcategory' || key === 'ics') ? `<div class="category-price">€${category.amount}</div>` : ''}
            </div>
            <div class="category-actions">
                ${!isInactive ? `<button class="btn-edit" data-action="editCategory" data-params='{"categoryKey":"${key}"}'>Modifica</button>` : ''}
                ${deleteButton}
            </div>
        `;
        container.appendChild(categoryEl);
        
        // Add subcategories under this main category
        subcategories.forEach(([subKey, subcategory]) => {
            if (subcategory.parentCategory === key) {
                const subCategoryEl = document.createElement('div');
                const isSubInactive = subcategory.active === false;
                subCategoryEl.className = `category-item subcategory${isSubInactive ? ' inactive' : ''}`;
                
                const subDeleteButton = isSubInactive ? 
                `<button class="btn-reactivate" data-action="reactivateCategory" data-params='{"categoryKey":"${subKey}"}'>Riattiva</button>` :
                `<button class="btn-delete" data-action="deleteCategory" data-params='{"categoryKey":"${subKey}"}'>Rendi Inattiva</button>`;
                const subInactiveLabel = isSubInactive ? ' <span class="inactive-label">(Inattiva)</span>' : '';
                
                subCategoryEl.innerHTML = `
                    <div class="category-info">
                        <div class="category-name">↳ ${subcategory.name} <span class="category-type">(Sottocategoria)</span>${subInactiveLabel}</div>
                        <div class="category-price">€${subcategory.amount}</div>
                    </div>
                    <div class="category-actions">
                        ${!isSubInactive ? `<button class="btn-edit" data-action="editCategory" data-params='{"categoryKey":"${subKey}"}'>Modifica</button>` : ''}
                        ${subDeleteButton}
                    </div>
                `;
                container.appendChild(subCategoryEl);
            }
        });
    });
    
    // Add orphaned subcategories (subcategories without valid parent)
    subcategories.forEach(([subKey, subcategory]) => {
        if (!subcategory.parentCategory || !app.state.categories[subcategory.parentCategory]) {
            const subCategoryEl = document.createElement('div');
            const isOrphanInactive = subcategory.active === false;
            subCategoryEl.className = `category-item subcategory orphaned${isOrphanInactive ? ' inactive' : ''}`;
            
            const orphanDeleteButton = isOrphanInactive ? 
                `<button class="btn-reactivate" data-action="reactivateCategory" data-params='{"categoryKey":"${subKey}"}'>Riattiva</button>` :
                `<button class="btn-delete" data-action="deleteCategory" data-params='{"categoryKey":"${subKey}"}'>Rendi Inattiva</button>`;
            const orphanInactiveLabel = isOrphanInactive ? ' <span class="inactive-label">(Inattiva)</span>' : '';
            
            subCategoryEl.innerHTML = `
                <div class="category-info">
                    <div class="category-name">⚠ ${subcategory.name} <span class="category-type">(Sottocategoria orfana)</span>${orphanInactiveLabel}</div>
                    <div class="category-price">€${subcategory.amount}</div>
                </div>
                <div class="category-actions">
                    ${!isOrphanInactive ? `<button class="btn-edit" data-action="editCategory" data-params='{"categoryKey":"${subKey}"}'>Modifica</button>` : ''}
                    ${orphanDeleteButton}
                </div>
            `;
            container.appendChild(subCategoryEl);
        }
    });
}

function editCategory(categoryKey) {
    const category = app.state.categories[categoryKey];
    if (!category) return;
    
    // Find the specific category item by looking for buttons with the correct data-params attribute
    const container = document.getElementById('categoriesList');
    const editButtons = container.querySelectorAll('.btn-edit');
    
    editButtons.forEach(button => {
        const params = button.getAttribute('data-params');
        if (params && params.includes(`"${categoryKey}"`)) {
            const item = button.closest('.category-item');
            if (!item) return;
            
            // Check if already editing
            if (item.querySelector('.edit-input')) return;
            
            // Mostra campo prezzo per microcategorie e per ICS
            const priceField = (category.type === 'subcategory' || categoryKey === 'ics') ? 
                `<input type="number" class="edit-input" value="${category.amount}" step="0.01" id="edit-price-${categoryKey}">` : '';
            
            item.innerHTML = `
                <div class="category-info">
                    <input type="text" class="edit-input" value="${category.name}" id="edit-name-${categoryKey}">
                    ${priceField}
                </div>
                <div class="category-actions">
                    <button class="btn-save" data-action="saveCategory" data-params='{"categoryKey":"${categoryKey}"}'>Salva</button>
                <button class="btn-cancel" data-action="renderCategoriesList">Annulla</button>
                </div>
            `;
            item.dataset.category = categoryKey;
        }
    });
}

async function saveCategory(categoryKey) {
    const nameInput = document.getElementById(`edit-name-${categoryKey}`);
    const priceInput = document.getElementById(`edit-price-${categoryKey}`);
    const category = app.state.categories[categoryKey];
    
    if (!nameInput) return;
    
    const newName = nameInput.value.trim();
    if (!newName) {
        app.showNotification('Inserisci un nome valido', 'error');
        return;
    }
    
    // Aggiorna i dati della categoria
    const updatedCategory = {
        ...category,
        name: newName
    };
    
    // Gestisci il prezzo per microcategorie e per ICS
    if (category.type === 'subcategory' || categoryKey === 'ics') {
        if (!priceInput) {
            app.showNotification('Errore nel campo prezzo', 'error');
            return;
        }
        
        const newPrice = parseFloat(priceInput.value);
        if (isNaN(newPrice) || newPrice < 0) {
            app.showNotification('Inserisci un prezzo valido', 'error');
            return;
        }
        
        updatedCategory.amount = newPrice;
        if (categoryKey === 'ics') {
            updatedCategory.description = `€${newPrice} per partitella`;
        } else {
            updatedCategory.description = `€${newPrice} per ${newName.toLowerCase()}`;
        }
    }
    
    app.state.categories[categoryKey] = updatedCategory;
    
    const categoryType = categoryKey === 'ics' ? 'ICS' : (category.type === 'category' ? 'Macrocategoria' : 'Microcategoria');
    const priceText = (category.type === 'subcategory' || categoryKey === 'ics') ? ` (€${updatedCategory.amount})` : '';
    app.addActivity(`${categoryType} "${newName}" modificata${priceText}`, 'category', new Date());
    await app.saveData();
    app.updateAllSections();
    renderCategoriesList();
    app.showNotification('Categoria aggiornata con successo', 'success');
}

async function deleteCategory(categoryKey) {
    // Prevent deletion of ICS category
    if (categoryKey === 'ics') {
        app.showNotification('La categoria ICS non può essere eliminata', 'error');
        return;
    }
    
    const category = app.state.categories[categoryKey];
    if (!category) return;
    
    if (!confirm(`Sei sicuro di voler rendere inattiva la categoria "${category.name}"? I dati storici rimarranno salvati.`)) return;
    
    // Rendi la categoria inattiva invece di eliminarla
    app.state.categories[categoryKey].active = false;
    
    app.addActivity(`Categoria "${category.name}" resa inattiva`, 'category', new Date());
    await app.saveData();
    app.updateAllSections();
    renderCategoriesList();
    app.showNotification('Categoria resa inattiva', 'success');
}

// Funzione per riattivare una categoria
async function reactivateCategory(categoryKey) {
    const category = app.state.categories[categoryKey];
    if (!category) return;
    
    if (!confirm(`Sei sicuro di voler riattivare la categoria "${category.name}"?`)) return;
    
    app.state.categories[categoryKey].active = true;
    
    app.addActivity(`Categoria "${category.name}" riattivata`, 'category', new Date());
    await app.saveData();
    app.updateAllSections();
    renderCategoriesList();
    app.showNotification('Categoria riattivata', 'success');
}

function toggleParentCategorySelect() {
    const typeSelect = document.getElementById('newCategoryType');
    const parentGroup = document.getElementById('parentCategoryGroup');
    const priceGroup = document.getElementById('priceGroup');
    const priceInput = document.getElementById('newCategoryPrice');
    const parentSelect = document.getElementById('newCategoryParent');
    
    if (typeSelect.value === 'subcategory') {
        // Microcategoria: mostra campo padre e prezzo (obbligatorio)
        parentGroup.style.display = 'block';
        priceGroup.style.display = 'block';
        priceInput.required = true;
        parentSelect.required = true;
        
        // Aggiorna le opzioni delle macrocategorie disponibili
        updateParentCategoryOptions();
        
        // Focus sul campo prezzo per migliorare UX
        setTimeout(() => {
            if (priceInput.value === '') {
                priceInput.focus();
            }
        }, 100);
    } else {
        // Macrocategoria: nascondi campo padre e prezzo
        parentGroup.style.display = 'none';
        priceGroup.style.display = 'none';
        priceInput.required = false;
        parentSelect.required = false;
        
        // Pulisci i campi quando si passa a macrocategoria
        priceInput.value = '';
        parentSelect.value = '';
    }
}

// Inizializza lo stato corretto del form alla prima apertura
function initializeCategoryForm() {
    const typeSelect = document.getElementById('newCategoryType');
    const parentGroup = document.getElementById('parentCategoryGroup');
    const priceGroup = document.getElementById('priceGroup');
    const priceInput = document.getElementById('newCategoryPrice');
    const parentSelect = document.getElementById('newCategoryParent');
    
    // Imposta il valore di default su macrocategoria
    typeSelect.value = 'category';
    
    // Nascondi i campi padre e prezzo di default
    parentGroup.style.display = 'none';
    priceGroup.style.display = 'none';
    priceInput.required = false;
    parentSelect.required = false;
    
    // Aggiungi event listener per il cambio di tipo categoria
    typeSelect.removeEventListener('change', toggleParentCategorySelect); // Rimuovi listener esistenti
    typeSelect.addEventListener('change', toggleParentCategorySelect);
    
    // Inizializza lo stato corretto
    toggleParentCategorySelect();
}

function updateParentCategoryOptions() {
    const parentSelect = document.getElementById('newCategoryParent');
    parentSelect.innerHTML = '<option value="">Seleziona categoria padre</option>';
    
    // Add only main categories (not subcategories) and exclude ICS
    Object.entries(app.state.categories).forEach(([key, category]) => {
        if (category.type === 'category' && key !== 'ics') {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = category.name;
            parentSelect.appendChild(option);
        }
    });
}

// Global function for HTML onchange event
function updateMicroCategoriesSelect() {
    if (window.app) {
        const macroSelect = document.getElementById('fineMacroCategory');
        if (macroSelect) {
            window.app.updateMicroCategoriesSelect(macroSelect.value);
        }
    }
}

async function addNewCategory() {
    const nameInput = document.getElementById('newCategoryName');
    const priceInput = document.getElementById('newCategoryPrice');
    const typeSelect = document.getElementById('newCategoryType');
    const parentSelect = document.getElementById('newCategoryParent');
    
    const name = nameInput.value.trim();
    const type = typeSelect.value;
    const parentCategory = type === 'subcategory' ? parentSelect.value : null;
    
    if (!name) {
        app.showNotification('Inserisci un nome valido', 'error');
        return;
    }
    
    // Validazione prezzo solo per microcategorie
    let price = 0;
    if (type === 'subcategory') {
        price = parseFloat(priceInput.value);
        if (isNaN(price) || price < 0) {
            app.showNotification('Inserisci un prezzo valido per la microcategoria', 'error');
            return;
        }
        
        if (!parentCategory) {
            app.showNotification('Seleziona una macrocategoria padre per la microcategoria', 'error');
            return;
        }
    }
    
    // Check if category already exists
    const existingKey = Object.keys(app.state.categories).find(key => 
        app.state.categories[key].name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingKey) {
        app.showNotification('Categoria già esistente', 'error');
        return;
    }
    
    // Create new category key
    const newKey = name.toLowerCase().replace(/\s+/g, '_');
    
    // Crea categoria con o senza prezzo in base al tipo
    const categoryData = {
        name: name,
        type: type,
        parentCategory: parentCategory,
        active: true
    };
    
    if (type === 'subcategory') {
        // Solo le microcategorie hanno prezzo e descrizione
        categoryData.amount = price;
        categoryData.description = `€${price} per ${name.toLowerCase()}`;
    }
    
    app.state.categories[newKey] = categoryData;
    
    const categoryType = type === 'category' ? 'Macrocategoria' : 'Microcategoria';
    const parentText = parentCategory ? ` (sotto ${app.state.categories[parentCategory].name})` : '';
    const priceText = type === 'subcategory' ? ` (€${price})` : '';
    app.addActivity(`${categoryType} "${name}" creata${priceText}${parentText}`, 'category', new Date());
    await app.saveData();
    app.updateAllSections();
    renderCategoriesList();
    
    // Clear inputs
    nameInput.value = '';
    priceInput.value = '';
    typeSelect.value = 'category';
    parentSelect.value = '';
    toggleParentCategorySelect();
    
    app.showNotification(`${categoryType} aggiunta con successo`, 'success');
}

// Initialize the application when DOM is loaded
// Loading Screen Management
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const appContainer = document.getElementById('appContainer');
    
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
    }
    if (appContainer) {
        appContainer.classList.remove('app-visible');
        appContainer.classList.add('app-hidden');
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const appContainer = document.getElementById('appContainer');
    
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
    if (appContainer) {
        appContainer.classList.remove('app-hidden');
        appContainer.classList.add('app-visible');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Inizializzazione applicazione...');
        
        // Show loading screen
        showLoadingScreen();
        
        // Create app instance
        window.financeApp = new FinanceApp();
        window.app = window.financeApp;
        
        // Initialize global functions first
        initializeGlobalFunctions();
        
        // Initialize the app (setup event listeners, etc.)
        window.financeApp.init();
        
        // Load data asynchronously
        await window.financeApp.loadData();
        
        // Update all sections with loaded data
        window.financeApp.updateAllSections();
        
        // Small delay to ensure smooth transition
        setTimeout(() => {
            hideLoadingScreen();
            console.log('✅ Applicazione inizializzata con successo');
        }, 300);
        
    } catch (error) {
        console.error('❌ Errore durante l\'inizializzazione:', error);
        
        // Hide loading screen even on error
        hideLoadingScreen();
        
        // Try to initialize global functions anyway
        try {
            initializeGlobalFunctions();
        } catch (fallbackError) {
            console.error('❌ Errore anche nel fallback:', fallbackError);
        }
    }
});



// Mobile Menu Functions
function initializeMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', function() {
            toggleMobileMenu();
        });
        
        // Close menu when clicking on main content
        if (mainContent) {
            mainContent.addEventListener('click', function() {
                closeMobileMenu();
            });
        }
        
        // Close menu when clicking on nav links
        const navLinks = sidebar.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                closeMobileMenu();
            });
        });
        
        // Handle window resize
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                closeMobileMenu();
            }
        });
    }
}

function toggleMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.classList.toggle('active');
        sidebar.classList.toggle('open');
        
        // Prevent body scroll when menu is open
        if (sidebar.classList.contains('open')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
}

function closeMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.classList.remove('active');
        sidebar.classList.remove('open');
        document.body.style.overflow = '';
    }
}

// Function to initialize global functions
function initializeGlobalFunctions() {
    // Initialize mobile menu
    initializeMobileMenu();
    
    // Global functions for HTML onclick handlers
    window.showSection = (sectionId) => app.showSection(sectionId);
    window.addMember = async () => await app.addMember();
    window.assignFine = async () => await app.assignFine();
    window.assignICS = async () => await app.assignICS();
    window.downloadPDF = () => app.downloadPDF();
    window.filterStandings = (period) => app.filterStandings(period);

    // Member management functions
    window.deleteMember = deleteMember;
    window.toggleFinePayment = toggleFinePayment;
    window.openAddMemberModal = () => app.openAddMemberModal();
    window.closeAddMemberModal = () => app.closeModal(document.getElementById('addMemberModal'));
    window.addGlobalDonation = async () => await app.addGlobalDonation();
    window.toggleDonorInput = () => app.toggleDonorInput();
    
    // Categories modal functions
    window.openCategoriesModal = openCategoriesModal;
    window.closeCategoriesModal = closeCategoriesModal;
    window.editCategory = editCategory;
    window.saveCategory = saveCategory;
    window.deleteCategory = deleteCategory;
    window.reactivateCategory = reactivateCategory;
    window.addNewCategory = addNewCategory;
    window.renderCategoriesList = renderCategoriesList;
    window.toggleParentCategorySelect = toggleParentCategorySelect;
    window.updateParentCategoryOptions = updateParentCategoryOptions;
    window.initializeCategoryForm = initializeCategoryForm;
    
    // Multe management functions
    window.deleteAssignedAndPaidFines = deleteAssignedAndPaidFines;
    window.restoreDeletedFines = restoreDeletedFines;
    window.togglePaidFines = togglePaidFines;
}





// Add CSS for notifications and member details
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100%); }
    }
    
    .member-card {
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
    }
    
    .member-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .member-card.expanded {
        background: var(--primary-light);
    }
    
    .member-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
    }
    
    .member-expand-icon {
        transition: transform 0.3s ease;
        color: var(--text-secondary);
    }
    
    .member-card.expanded .member-expand-icon {
        transform: rotate(180deg);
    }
    
    .donation-form {
        display: flex;
        gap: 0.5rem;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color);
    }
    
    .donation-input {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
    }
    
    .btn-donate {
        padding: 0.5rem 1rem;
        background: var(--success-color);
        color: white;
        border: none;
        border-radius: var(--border-radius);
        cursor: pointer;
        font-size: 0.85rem;
    }
    
    .btn-donate:hover {
        background: #27ae60;
    }
    
    .member-actions {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color);
    }
    
    .fine-breakdown {
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-top: 0.25rem;
    }
    
    .subcategory-detail {
        background: var(--primary-light);
        padding: 0.1rem 0.3rem;
        border-radius: 3px;
        font-size: 0.75rem;
    }
    
    .member-info {
        flex: 1;
        min-width: 0;
    }
    
    .ranking-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem;
        background: white;
        border-radius: var(--border-radius);
        margin-bottom: 0.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .rank {
        font-size: 1.2rem;
        font-weight: bold;
        min-width: 2rem;
        text-align: center;
        border-top: 1px solid var(--border-color);
        text-align: right;
    }
    
    .btn-delete {
        padding: 0.5rem 1rem;
        background: var(--danger-color);
        color: white;
        border: none;
        border-radius: var(--border-radius);
        cursor: pointer;
        font-size: 0.85rem;
    }
    
    .btn-delete:hover {
        background: #c0392b;
    }
    
    .member-details {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color);
        animation: slideDown 0.3s ease;
    }
    
    @keyframes slideDown {
        from { opacity: 0; max-height: 0; }
        to { opacity: 1; max-height: 500px; }
    }
    
    .details-section {
        margin-bottom: 1rem;
    }
    
    .details-section h4 {
        margin-bottom: 0.5rem;
        color: var(--primary-color);
        font-size: 0.9rem;
    }
    
    .fine-detail, .donation-detail {
        background: white;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        border-radius: var(--border-radius);
        border-left: 3px solid var(--primary-color);
    }
    
    .subcategory {
        margin-left: 1.5rem;
        border-left: 2px solid #e0e0e0;
        padding-left: 1rem;
        background: #f8f9fa;
    }
    
    .subcategory .category-name {
        font-size: 0.9rem;
        color: #666;
    }
    
    .category-type {
        font-size: 0.75rem;
        color: #888;
        font-weight: normal;
    }
    
    .special-category {
        font-size: 0.75rem;
        color: #e74c3c;
        font-weight: bold;
    }
    
    .orphaned {
        border-left-color: #e74c3c;
        background: #fff5f5;
    }
    
    .orphaned .category-name {
        color: #e74c3c;
    }
    
    .subcategory-tab {
        margin-left: 1rem;
        font-size: 0.85rem;
        background: #f8f9fa;
        border-left: 3px solid #e0e0e0;
    }
    
    .subcategory-tab:hover {
        background: #e9ecef;
    }
    
    .subcategory-tab.active {
        background: var(--primary-light);
        border-left-color: var(--primary-color);
    }
    
    .orphaned-tab {
        border-left-color: #e74c3c;
        background: #fff5f5;
    }
    
    .orphaned-tab:hover {
        background: #ffe6e6;
    }
    
    .main-category-tab {
        font-weight: 600;
    }
    
    .fine-status-tabs {
        display: flex;
        gap: 0;
        margin-bottom: 1rem;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #e0e0e0;
        width: fit-content;
    }
    
    .status-tab-btn {
        padding: 0.5rem 1rem;
        border: none;
        background: white;
        color: #666;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        transition: all 0.2s ease;
        border-right: 1px solid #e0e0e0;
    }
    
    .status-tab-btn:last-child {
        border-right: none;
    }
    
    .status-tab-btn:hover {
        background: #f8f9fa;
    }
    
    .status-tab-btn.active {
        background: #333;
        color: white;
    }
    
    .status-tab-btn.active:hover {
        background: #444;
    }
    
    .fine-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.25rem;
    }
    
    .fine-category {
        font-weight: 600;
        color: var(--primary-color);
    }
    
    .fine-amount {
        font-weight: 600;
        color: var(--success-color);
    }
    
    .fine-date {
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    
    .fine-note {
        font-size: 0.85rem;
        color: var(--text-secondary);
        margin-bottom: 0.5rem;
    }
    
    .fine-payment {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
    }
    
    .fine-payment input[type="checkbox"] {
        margin: 0;
    }
    
    .donation-detail {
        border-left-color: var(--success-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .donation-amount {
        font-weight: 600;
        color: var(--success-color);
    }
    
    .donation-date {
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    
    .donation-note {
        font-size: 0.85rem;
        color: var(--text-secondary);
    }
    
    .no-data {
        text-align: center;
        color: var(--text-secondary);
        font-style: italic;
        padding: 1rem;
    }
    
    .category-stats {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color);
    }
    
    .category-stats .stat {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.25rem;
        font-size: 0.85rem;
    }
    
    .category-stats .label {
        color: var(--text-secondary);
    }
    
    .category-stats .value {
        font-weight: 600;
        color: var(--primary-color);
    }
`;
document.head.appendChild(notificationStyles);