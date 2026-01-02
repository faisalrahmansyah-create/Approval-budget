// =========================================================
// FILE: js/main.js (VERSION 3.3 - INSTANT LOGOUT)
// =========================================================

// --- 1. KONFIGURASI SUPABASE ---
const MY_SUPABASE_URL = 'https://bpblwknincxebfkunyvl.supabase.co'; 
const MY_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYmx3a25pbmN4ZWJma3VueXZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNjgyNDMsImV4cCI6MjA4Mjk0NDI0M30.IYFXTGhba2P29Ii4Xqui4Vb8e0fNc6pOOc-Sx8F6AFA'; 

if (MY_SUPABASE_URL.includes('xxxx') || !MY_SUPABASE_URL) {
    alert("PENTING: Isi URL & KEY Supabase di file js/main.js!");
}

const { createClient } = supabase;
const _db = createClient(MY_SUPABASE_URL, MY_SUPABASE_KEY);

// --- 2. GLOBAL VARIABLES ---
let currentUser = null; 
let modalForm = null;
let modalBudget = null;
let modalMasterCoa = null;
let modalMasterCabang = null;
let manageUsersModal = null; 
let modalRegister = null; 
let modalProfile = null; 
let modalCekBudget = null;

let allRequestData = [];  
let currentStatusFilter = 'pending';
let currentItems = []; // Array Keranjang Item

// --- 3. INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("App Init...");
    setupModals();
    setupEventListeners();
    await loadBranchesForDropdown();

    // Cek Sesi
    const { data: { session } } = await _db.auth.getSession();
    if (session) {
        bukaDashboard(session.user.id);
    }
});

// --- 4. SETUP MODALS & LISTENERS ---
function setupModals() {
    if(typeof bootstrap !== 'undefined'){
        const getModal = (id) => document.getElementById(id) ? new bootstrap.Modal(document.getElementById(id)) : null;

        modalForm = getModal('modalRequest');
        modalBudget = getModal('modalBudget');
        manageUsersModal = getModal('modalManageUsers');
        modalMasterCoa = getModal('modalMasterCoa');
        modalMasterCabang = getModal('modalMasterCabang');
        modalRegister = getModal('modalRegister');
        modalProfile = getModal('modalProfile');
        modalCekBudget = getModal('modalCekBudget');
    }
}

function setupEventListeners() {
    const addListener = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('submit', handler);
    };

    addListener('formLogin', handleLogin);
    addListener('formRegister', handleRegister);
    addListener('formRequest', handleRequestSubmit);
    addListener('formBudget', handleBudgetSubmit);
    addListener('formAddCoa', handleAddCoa);
    addListener('formAddBranch', handleAddBranch);
    addListener('formChangePass', handleGantiPassword);

    // Listener Dropdown Item (Cek Budget Real-time)
    document.getElementById('itemCoa')?.addEventListener('change', async function() {
        const coaId = this.value;
        const infoEl = document.getElementById('item-budget-info');
        if(!coaId) { infoEl.innerHTML = ''; return; }
        infoEl.innerHTML = 'Cek budget...';
        const d = new Date();
        const { data } = await _db.from('monthly_budgets').select('*')
            .eq('coa_id', coaId).eq('month', d.getMonth()+1).eq('year', d.getFullYear()).single();
        if (!data) infoEl.innerHTML = '<span class="text-danger">Budget null</span>';
        else {
            const sisa = data.budget_limit - data.current_usage;
            infoEl.innerHTML = `<span class="${sisa>0?'text-success':'text-danger'} fw-bold">Sisa: ${new Intl.NumberFormat('id-ID').format(sisa)}</span>`;
        }
    });
}

// --- 5. AUTH SYSTEM (FAST LOGIN/LOGOUT) ---

async function loadBranchesForDropdown() {
    const sel = document.getElementById('regBranch');
    if(!sel) return;
    sel.innerHTML = '<option value="">Pilih Cabang...</option>';
    sel.add(new Option('Kantor Pusat (Default)', 'PUSAT')); 
    try {
        const { data } = await _db.from('branches').select('*').order('name');
        if (data && data.length > 0) {
            sel.innerHTML = '<option value="">Pilih Cabang...</option>';
            if (!data.find(b => b.code === 'PUSAT')) sel.add(new Option('Kantor Pusat (Default)', 'PUSAT'));
            data.forEach(b => sel.add(new Option(b.name, b.code)));
        }
    } catch (e) { console.warn("Load cabang error, pakai default.", e); }
}

window.bukaModalRegister = function() {
    document.getElementById('formRegister').reset();
    if (modalRegister) modalRegister.show(); else new bootstrap.Modal(document.getElementById('modalRegister')).show();
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]'); 
    const txt = btn.innerHTML;
    
    try {
        btn.innerHTML = 'Memuat...'; btn.disabled = true;
        
        // Proses Login ke Server
        const { data, error } = await _db.auth.signInWithPassword({
            email: document.getElementById('email').value, 
            password: document.getElementById('password').value
        });
        
        if (error) throw error;
        
        // Login Berhasil -> Buka Dashboard
        bukaDashboard(data.user.id);
        
    } catch (error) { 
        Swal.fire('Gagal Login', error.message, 'error'); 
    } finally { 
        btn.innerHTML = txt; btn.disabled = false; 
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button'); const txt = btn.innerHTML;
    try {
        btn.innerHTML = '...'; btn.disabled = true;
        const branchVal = document.getElementById('regBranch').value;
        if(!branchVal) throw new Error("Pilih cabang!");

        const phoneVal = document.getElementById('regPhone') ? document.getElementById('regPhone').value : '';

        const { error } = await _db.auth.signUp({
            email: document.getElementById('regEmail').value, password: document.getElementById('regPass').value,
            options: { 
                data: { 
                    full_name: document.getElementById('regName').value, 
                    role: document.getElementById('regRole').value, 
                    division: document.getElementById('regDivision').value, 
                    branch: branchVal,
                    phone: phoneVal 
                } 
            }
        });
        if (error) throw error;
        Swal.fire('Sukses', 'Akun dibuat. Login sekarang.', 'success'); if(modalRegister) modalRegister.hide();
    } catch (error) { Swal.fire('Gagal', error.message, 'error'); } finally { btn.disabled = false; btn.innerHTML = txt; }
}

// LOGOUT CEPAT (INSTANT UI SWITCH)
window.logout = () => { 
    // 1. Matikan Dashboard, Nyalakan Login (Manipulasi Tampilan Langsung)
    const dashPage = document.getElementById('dashboard-page');
    const loginPage = document.getElementById('login-page');
    
    dashPage.style.display = 'none'; 
    loginPage.classList.remove('d-none');
    loginPage.classList.add('d-flex');
    loginPage.style.display = 'flex';

    // 2. Bersihkan Form Login biar rapi
    document.getElementById('formLogin').reset();

    // 3. Bersihkan Memori Lokal
    localStorage.clear(); 
    sessionStorage.clear();
    currentUser = null;
    allRequestData = [];
    currentItems = [];

    // 4. Logout Server di Background (Jangan ditunggu/await biar cepat)
    _db.auth.signOut(); 

    // 5. Notifikasi Kecil
    const Toast = Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 1500 });
    Toast.fire({ icon: 'success', title: 'Berhasil Keluar' });
};

// --- 6. DASHBOARD & UI ---

async function bukaDashboard(userId) {
    const loginPage = document.getElementById('login-page');
    const dashPage = document.getElementById('dashboard-page');
    
    // Switch Tampilan ke Dashboard
    if (loginPage) { loginPage.classList.remove('d-flex'); loginPage.classList.add('d-none'); loginPage.style.display = 'none'; }
    if (dashPage) { dashPage.classList.remove('d-none'); dashPage.style.display = 'block'; }

    try {
        const { data: profile, error } = await _db.from('profiles').select('*').eq('id', userId).single();
        if (error || !profile) throw new Error("Profil tidak ditemukan.");

        currentUser = profile;
        updateUIProfile(profile);
        setupRoleBasedMenu(profile);
        
        await loadRequests(); 
        await loadCoa(); 
    } catch (e) {
        // Jika gagal, kembalikan ke Login
        Swal.fire({ icon: 'error', title: 'Gagal Memuat Profil', text: 'Silakan login ulang.' });
        if (loginPage) { loginPage.classList.add('d-flex'); loginPage.classList.remove('d-none'); loginPage.style.display='flex'; }
        if (dashPage) dashPage.style.display='none';
    }
}

function updateUIProfile(profile) {
    document.getElementById('sidebar-name').innerText = profile.full_name;
    document.getElementById('sidebar-role').innerHTML = `${profile.role.toUpperCase()} - ${profile.division}<br><span class="badge bg-primary mt-1" style="font-size:10px">${profile.branch||'PUSAT'}</span>`;
    document.getElementById('sidebar-avatar').style.backgroundImage = `url('https://ui-avatars.com/api/?name=${profile.full_name}&background=random')`;
    document.getElementById('header-user').innerText = `Halo, ${profile.full_name}`;
}

function setupRoleBasedMenu(profile) {
    const setDisplay = (id, show) => { const el = document.getElementById(id); if(el) el.style.display = show ? 'flex' : 'none'; };
    const isAdmin = profile.role === 'pimpinan' || profile.role === 'akunting';
    setDisplay('menu-admin', isAdmin); setDisplay('menu-budget', isAdmin); setDisplay('menu-master-coa', isAdmin); setDisplay('menu-master-branch', isAdmin);
    const isStafMgr = profile.role === 'staf' || profile.role === 'manager';
    setDisplay('menu-cek-budget', isStafMgr);
    const fabBtn = document.querySelector('.fab-btn'); if(fabBtn) fabBtn.style.display = isStafMgr ? 'flex' : 'none';
}

// --- 7. LOAD DATA & SMART FILTER ---

async function loadRequests() {
    const area = document.getElementById('content-area');
    area.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-primary"></div></div>';

    let query = _db.from('budget_requests').select(`*, profiles:requester_id ( full_name )`).order('created_at', { ascending: false });

    if (currentUser.branch) query = query.eq('branch', currentUser.branch);
    if (currentUser.role === 'manager' || currentUser.role === 'staf') { if (currentUser.division) query = query.eq('division', currentUser.division); }
    if (currentUser.role === 'akunting') query = query.neq('status', 'pending_manager');
    if (currentUser.role === 'pimpinan') { query = query.neq('status', 'pending_manager'); query = query.neq('status', 'pending_accounting'); }

    const { data, error } = await query;
    if(error) { area.innerHTML = 'Error load data.'; return; }

    allRequestData = data || [];
    updateBadges();
    gantiTab('pending');
}

window.gantiTab = function(statusKey) {
    currentStatusFilter = statusKey; 
    const titles = { 'pending': 'Menunggu Approval', 'approved': 'Disetujui', 'rejected': 'Ditolak' };
    document.getElementById('header-title').innerText = titles[statusKey] || 'Dashboard';
    document.querySelectorAll('.sidebar-menu-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`menu-${statusKey}`)?.classList.add('active');
    lakukanPencarian(); 
    const sb = document.getElementById('sidebarMenu'); if(sb) bootstrap.Offcanvas.getInstance(sb)?.hide();
}

window.lakukanPencarian = function() {
    const k = document.getElementById('searchInput').value.toLowerCase();
    const r = currentUser.role;

    let filtered = allRequestData.filter(i => {
        const s = i.status;
        if (currentStatusFilter === 'pending') {
            if (r === 'staf') return s.includes('pending'); 
            if (r === 'manager') return s === 'pending_manager'; 
            if (r === 'akunting') return s === 'pending_accounting'; 
            if (r === 'pimpinan') return s === 'pending_pimpinan'; 
        }
        if (currentStatusFilter === 'approved') {
            if (r === 'staf') return s === 'approved'; 
            if (r === 'manager') return s !== 'pending_manager' && s !== 'rejected';
            if (r === 'akunting') return s === 'pending_pimpinan' || s === 'approved';
            if (r === 'pimpinan') return s === 'approved';
        }
        if (currentStatusFilter === 'rejected') return s === 'rejected';
        return false;
    });

    const final = filtered.filter(i => i.title.toLowerCase().includes(k) || (i.profiles?.full_name||'').toLowerCase().includes(k));
    renderList(final);
}

function updateBadges() {
    const r = currentUser.role;
    const p = allRequestData.filter(i => {
        const s = i.status;
        if (r === 'staf') return s.includes('pending');
        if (r === 'manager') return s === 'pending_manager';
        if (r === 'akunting') return s === 'pending_accounting';
        if (r === 'pimpinan') return s === 'pending_pimpinan';
        return false;
    }).length;
    const a = allRequestData.filter(i => {
        const s = i.status;
        if (r === 'staf') return s === 'approved';
        if (r === 'manager') return s !== 'pending_manager' && s !== 'rejected';
        if (r === 'akunting') return s === 'pending_pimpinan' || s === 'approved';
        if (r === 'pimpinan') return s === 'approved';
        return false;
    }).length;
    document.getElementById('badge-pending').innerText = p;
    document.getElementById('badge-approved').innerText = a;
    document.getElementById('stat-total').innerText = allRequestData.length;
}

function renderList(data) {
    const c = document.getElementById('content-area');
    if (data.length === 0) { c.innerHTML = `<div class="text-center text-muted mt-5 opacity-50"><p>Tidak ada data.</p></div>`; return; }
    let html = '';
    const fmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

    data.forEach(i => {
        let bg = i.status === 'approved' ? 'bg-success text-white' : (i.status === 'rejected' ? 'bg-danger text-white' : 'bg-warning text-dark');
        html += `
        <div class="card request-card p-3 border-0 mb-3 bg-white shadow-sm" style="border-radius:12px;">
            <div class="d-flex justify-content-between mb-2">
                <span class="text-muted fw-bold" style="font-size:11px;">#REQ-${i.id.substring(0,6).toUpperCase()}</span>
                <span class="badge rounded-pill ${bg}" style="font-size:10px;">${i.status.replace(/_/g,' ').toUpperCase()}</span>
            </div>
            <div class="mb-2">
                <h6 class="fw-bold mb-1 text-dark">${i.title}</h6>
                <div class="text-muted small">${i.profiles?.full_name||'-'} • ${i.division}</div>
            </div>
            <div class="d-flex justify-content-between align-items-end border-top pt-2">
                <div><h5 class="fw-bold text-primary mb-0">${fmt.format(i.amount)}</h5></div>
                <button onclick="downloadPdf('${i.id}')" class="btn btn-sm btn-outline-secondary rounded-pill px-3">PDF</button>
            </div>
            ${getButtonHtml(i)}
        </div>`;
    });
    c.innerHTML = html;
}

function getButtonHtml(i) {
    if (!currentUser) return '';
    let show = false;
    const s = i.status, r = currentUser.role;
    if (currentStatusFilter === 'pending') {
        if (r === 'manager' && s === 'pending_manager' && currentUser.division === i.division) show = true;
        if (r === 'akunting' && s === 'pending_accounting') show = true;
        if (r === 'pimpinan' && s === 'pending_pimpinan') show = true;
    }
    return show ? `<div class="d-flex gap-2 mt-3 pt-2 border-top bg-light p-2 rounded">
        <button onclick="prosesApproval('${i.id}','approve')" class="btn btn-success btn-sm flex-grow-1">SETUJUI</button>
        <button onclick="prosesApproval('${i.id}','reject')" class="btn btn-outline-danger btn-sm flex-grow-1">TOLAK</button>
    </div>` : '';
}

// APPROVAL + WA NOTIF
window.prosesApproval = async (id, action) => {
    let next = action === 'reject' ? 'rejected' : (currentUser.role === 'manager' ? 'pending_accounting' : (currentUser.role === 'akunting' ? 'pending_pimpinan' : 'approved'));
    
    if ((await Swal.fire({ title: 'Konfirmasi?', icon: 'question', showCancelButton: true })).isConfirmed) {
        Swal.fire({title: 'Memproses...', didOpen: () => Swal.showLoading()});
        
        let up = { status: next };
        if (currentUser.role === 'manager') up.manager_approver_id = currentUser.id;
        if (currentUser.role === 'akunting') up.accounting_approver_id = currentUser.id;
        if (currentUser.role === 'pimpinan') up.boss_approver_id = currentUser.id;
        
        const { error } = await _db.from('budget_requests').update(up).eq('id', id);
        
        if(!error) { 
            const { data: reqData } = await _db.from('budget_requests').select(`*, profiles:requester_id(full_name)`).eq('id', id).single();
            
            let btnText = 'Tutup';
            let showWA = false;
            let actionCode = '';

            if (action === 'reject') {
                btnText = '<i class="fa-brands fa-whatsapp"></i> Kabari Staf'; showWA = true; actionCode = 'reject';
            } else {
                if(currentUser.role === 'manager') { btnText = '<i class="fa-brands fa-whatsapp"></i> Lapor Finance'; showWA = true; actionCode = 'approve_manager'; }
                if(currentUser.role === 'akunting') { btnText = '<i class="fa-brands fa-whatsapp"></i> Lapor Pimpinan'; showWA = true; actionCode = 'approve_accounting'; }
                if(currentUser.role === 'pimpinan') { btnText = '<i class="fa-brands fa-whatsapp"></i> Kabari Staf'; showWA = true; actionCode = 'final_approve'; }
            }

            Swal.fire({
                title: 'Sukses!', text: 'Status berhasil diperbarui.', icon: 'success',
                showCancelButton: true, confirmButtonText: btnText, cancelButtonText: 'Tutup', confirmButtonColor: '#25D366'
            }).then((result) => {
                if(result.isConfirmed && showWA) kirimNotifWA(reqData, actionCode);
            });

            loadRequests(); 
        } else { Swal.fire('Error', error.message, 'error'); }
    }
}

// --- 8. MULTI-ITEM ---

async function loadCoa() {
    let query = _db.from('coa').select('*').order('code');
    if (currentUser.branch && currentUser.role !== 'akunting') query = query.eq('branch', currentUser.branch);
    if (currentUser.role !== 'akunting' && currentUser.role !== 'pimpinan') {
        if (currentUser.division) query = query.eq('division', currentUser.division);
    }
    const { data } = await query;
    const sel = document.getElementById('itemCoa');
    if (!sel) return;
    sel.innerHTML = '<option value="">Pilih Jenis Biaya...</option>';
    if (data && data.length > 0) data.forEach(c => sel.add(new Option(`[${c.code}] ${c.name}`, c.id)));
    else sel.innerHTML = `<option value="">Tidak ada akun.</option>`;
}

window.bukaModalRequest = () => { 
    document.getElementById('formRequest').reset(); 
    document.getElementById('item-budget-info').innerHTML = ''; 
    currentItems = []; 
    renderTabelItem();
    if(modalForm) modalForm.show(); 
};

window.tambahItemKeTabel = () => {
    const coaSelect = document.getElementById('itemCoa');
    const coaId = coaSelect.value;
    const coaText = coaSelect.options[coaSelect.selectedIndex]?.text;
    const desc = document.getElementById('itemDesc').value;
    const amount = parseInt(document.getElementById('itemAmount').value) || 0;

    if(!coaId || amount <= 0 || !desc) return Swal.fire('Lengkapi data item!', '', 'warning');

    currentItems.push({ coa_id: coaId, coa_name: coaText, description: desc, amount: amount });
    document.getElementById('itemDesc').value = '';
    document.getElementById('itemAmount').value = '';
    renderTabelItem();
};

window.hapusItem = (index) => {
    currentItems.splice(index, 1);
    renderTabelItem();
};

function renderTabelItem() {
    const tbody = document.getElementById('list-items-body');
    const totalEl = document.getElementById('total-request-display');
    const fmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits:0 });

    if(currentItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted fst-italic">Belum ada item</td></tr>';
        totalEl.innerText = 'Rp 0';
        return;
    }
    let html = ''; let grandTotal = 0;
    currentItems.forEach((item, idx) => {
        grandTotal += item.amount;
        html += `<tr><td>${item.coa_name}</td><td>${item.description}</td><td class="text-end">${fmt.format(item.amount)}</td><td class="text-center"><i onclick="hapusItem(${idx})" class="fa-solid fa-trash text-danger" style="cursor:pointer;"></i></td></tr>`;
    });
    tbody.innerHTML = html;
    totalEl.innerText = fmt.format(grandTotal);
}

// SUBMIT + WA
async function handleRequestSubmit(e) {
    e.preventDefault();
    const titleVal = document.getElementById('inputJudul').value;
    
    if (!titleVal) return Swal.fire('Judul wajib diisi!', '', 'warning');
    if (currentItems.length === 0) return Swal.fire('Minimal tambah 1 item biaya!', '', 'warning');

    const totalAmount = currentItems.reduce((sum, item) => sum + item.amount, 0);
    const btn = e.target.querySelector('button'); const txt = btn.innerHTML; 
    btn.innerHTML = 'Menyimpan...'; btn.disabled = true;

    try {
        const { data: headerData, error: headerError } = await _db.from('budget_requests')
            .insert({
                title: titleVal, amount: totalAmount, requester_id: currentUser.id,
                status: 'pending_manager', division: currentUser.division, branch: currentUser.branch
            }).select().single();
        if (headerError) throw headerError;

        const itemsToInsert = currentItems.map(item => ({
            request_id: headerData.id, coa_id: item.coa_id, description: item.description, amount: item.amount
        }));
        
        const { error: itemsError } = await _db.from('request_items').insert(itemsToInsert);

        if (itemsError) {
            await _db.from('budget_requests').delete().eq('id', headerData.id); 
            throw itemsError;
        }
        
        if(modalForm) modalForm.hide(); 
        
        Swal.fire({
            title: 'Berhasil!', text: 'Pengajuan tersimpan.', icon: 'success',
            showCancelButton: true, confirmButtonText: '<i class="fa-brands fa-whatsapp"></i> Kabari Manager',
            cancelButtonText: 'Tutup', confirmButtonColor: '#25D366'
        }).then((result) => {
            if(result.isConfirmed) {
                headerData.profiles = { full_name: currentUser.full_name };
                kirimNotifWA(headerData, 'submit');
            }
        });

        loadRequests();
    } catch (err) { Swal.fire('Gagal', err.message, 'error'); } 
    finally { btn.innerHTML = txt; btn.disabled = false; }
}

// --- 9. PROFILE & TTD ---
window.bukaModalProfile = function() {
    const elModal = document.getElementById('modalProfile'); if (!elModal || !currentUser) return;
    const myModal = new bootstrap.Modal(elModal);
    document.getElementById('profName').value = currentUser.full_name || '-';
    document.getElementById('profRole').value = (currentUser.role || '-').toUpperCase();
    document.getElementById('profDiv').value = `${currentUser.division} (${currentUser.branch||'PUSAT'})`;
    const imgEl = document.getElementById('img-ttd-preview'); const txtEl = document.getElementById('txt-ttd-empty');
    if (currentUser.signature_url) { imgEl.src = currentUser.signature_url; imgEl.style.display = 'block'; imgEl.style.margin = '0 auto'; if(txtEl) txtEl.style.display = 'none'; } 
    else { imgEl.style.display = 'none'; if(txtEl) txtEl.style.display = 'block'; }
    document.getElementById('formChangePass').reset();
    myModal.show();
};
window.uploadTTD = async () => {
    const file = document.getElementById('inputFileTTD').files[0]; if (!file) return Swal.fire('Pilih file!', '', 'warning');
    const btn = document.querySelector('#tabInfo button'); const txt = btn.innerHTML; btn.innerHTML = 'Uploading...'; btn.disabled = true;
    try {
        const fileName = `${currentUser.id}_SIGN.${file.name.split('.').pop()}`; 
        const { error } = await _db.storage.from('signatures').upload(fileName, file, { upsert: true });
        if (error) throw error;
        const { data: urlData } = _db.storage.from('signatures').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl + '?t=' + Date.now();
        await _db.from('profiles').update({ signature_url: publicUrl }).eq('id', currentUser.id);
        currentUser.signature_url = publicUrl;
        document.getElementById('img-ttd-preview').src = publicUrl; document.getElementById('img-ttd-preview').style.display = 'block'; document.getElementById('txt-ttd-empty').style.display = 'none';
        Swal.fire({ toast: true, icon: 'success', title: 'TTD Disimpan' });
    } catch (err) { Swal.fire('Gagal', err.message, 'error'); } finally { btn.innerHTML = txt; btn.disabled = false; }
};
async function handleGantiPassword(e) {
    e.preventDefault();
    const p1 = document.getElementById('newPass').value; const p2 = document.getElementById('confirmPass').value;
    if (p1 !== p2) return Swal.fire('Password tidak sama!', '', 'warning');
    const { error } = await _db.auth.updateUser({ password: p1 });
    if (error) Swal.fire('Gagal', error.message, 'error'); else Swal.fire('Sukses', 'Password diubah', 'success');
}

// --- 10. PDF GENERATOR ---
window.downloadPdf = async (id) => {
    const item = allRequestData.find(x => x.id === id); if (!item) return;
    Swal.fire({ title: 'Menyiapkan Dokumen...', didOpen: () => Swal.showLoading() });
    try {
        const { data: full } = await _db.from('budget_requests').select(`*, requester:requester_id(full_name, signature_url), manager:manager_approver_id(signature_url), accounting:accounting_approver_id(signature_url), boss:boss_approver_id(signature_url)`).eq('id', id).single();
        const { data: items } = await _db.from('request_items').select(`*, coa:coa_id(name, code)`).eq('request_id', id);
        
        const fmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
        const d = new Date(item.created_at);

        document.getElementById('pdf-code').innerText = 'REQ-' + item.id.substring(0,8).toUpperCase();
        document.getElementById('pdf-date').innerText = d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('pdf-requester-name').innerText = full.requester?.full_name || 'Staf';
        document.getElementById('pdf-division').innerText = item.division;
        document.getElementById('pdf-branch').innerText = item.branch || 'PUSAT';
        document.getElementById('pdf-title').innerText = item.title;
        document.getElementById('pdf-status').innerText = item.status.replace('_', ' ').toUpperCase();
        document.getElementById('pdf-print-date').innerText = new Date().toLocaleString('id-ID');

        const tbody = document.getElementById('pdf-items-body');
        let htmlRows = '';
        if (items && items.length > 0) {
            items.forEach((row, index) => {
                const coaLabel = row.coa ? `${row.coa.code} - ${row.coa.name}` : '-';
                htmlRows += `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${index + 1}</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${coaLabel}</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${row.description}</td><td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${fmt.format(row.amount)}</td></tr>`;
            });
        } else { htmlRows = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #999;">- Rincian item tidak tersedia (Data Lama) -</td></tr>`; }
        tbody.innerHTML = htmlRows;
        document.getElementById('pdf-grand-total').innerText = fmt.format(item.amount);

        const setSig = (imgId, txtId, usr, show) => {
            const i = document.getElementById(imgId), t = document.getElementById(txtId);
            if(show && usr && usr.signature_url) { i.src = usr.signature_url; i.style.display='block'; t.style.display='none'; }
            else { i.style.display='none'; t.style.display='block'; if(item.status==='rejected') t.innerText='(Ditolak)'; }
        }
        
        const imgReq = document.getElementById('sign-req-img');
        if (full.requester?.signature_url) { imgReq.src = full.requester.signature_url; imgReq.style.display = 'block'; } else { imgReq.style.display = 'none'; }
        document.getElementById('sign-req-name').innerText = full.requester?.full_name || 'Pemohon';

        setSig('sign-mgr-img', 'sign-mgr-placeholder', full.manager, item.status!=='pending_manager' && item.status!=='rejected');
        setSig('sign-acc-img', 'sign-acc-placeholder', full.accounting, item.status==='pending_pimpinan' || item.status==='approved');
        setSig('sign-boss-img', 'sign-boss-placeholder', full.boss, item.status==='approved');
        const stamp = document.getElementById('pdf-rejected-stamp'); stamp.style.opacity = (item.status==='rejected') ? '0.4' : '0';
        
        await html2pdf().set({ margin: [10,10,10,10], filename: `REQ_${item.id.substring(0,6)}.pdf`, image: {type:'jpeg',quality:0.98}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} }).from(document.getElementById('pdf-template')).save(); Swal.close();
    } catch(e) { Swal.fire('Error PDF', e.message, 'error'); }
}

// --- 11. ADMIN UTILS ---
window.bukaModalMasterCabang = () => { if(modalMasterCabang) modalMasterCabang.show(); loadBranchListAdmin(); };
async function loadBranchListAdmin() {
    const ul = document.getElementById('list-branch-body'); ul.innerHTML = 'Loading...';
    const { data } = await _db.from('branches').select('*').order('name');
    if(data) ul.innerHTML = data.map(b => `<li class="list-group-item d-flex justify-content-between"><div><b>${b.code}</b> - ${b.name}</div><button onclick="hapusCabang('${b.id}')" class="btn btn-sm btn-outline-danger">Hapus</button></li>`).join('');
}
async function handleAddBranch(e) {
    e.preventDefault();
    const { error } = await _db.from('branches').insert({ code: document.getElementById('newBranchCode').value.toUpperCase(), name: document.getElementById('newBranchName').value });
    if(!error) { document.getElementById('formAddBranch').reset(); loadBranchListAdmin(); loadBranchesForDropdown(); Swal.fire('Sukses','Cabang ditambah','success'); }
}
window.hapusCabang = async (id) => { if(confirm('Hapus cabang ini?')) { await _db.from('branches').delete().eq('id', id); loadBranchListAdmin(); loadBranchesForDropdown(); }};

window.bukaModalMasterCoa = async () => { 
    if(modalMasterCoa) modalMasterCoa.show(); 
    const sel = document.getElementById('newCoaBranch');
    if(sel) { const { data } = await _db.from('branches').select('*').order('name'); sel.innerHTML = '<option value="">Pilih Cabang...</option>'; if(data) data.forEach(b => sel.add(new Option(b.name, b.code))); }
    loadMasterCoaList(); 
};
async function loadMasterCoaList() {
    const tb = document.getElementById('list-coa-body'); tb.innerHTML = 'Loading...';
    const { data } = await _db.from('coa').select('*').order('branch').order('division').order('code');
    if(data) tb.innerHTML = data.map(i => `<tr><td class="fw-bold">${i.code}</td><td>${i.name}</td><td>${i.division}</td><td><span class="badge bg-info text-dark">${i.branch||'-'}</span></td><td class="text-end"><button onclick="hapusCoa('${i.id}')" class="btn btn-sm btn-outline-danger">Hapus</button></td></tr>`).join('');
}
async function handleAddCoa(e) {
    e.preventDefault();
    const { error } = await _db.from('coa').insert({ code: document.getElementById('newCoaCode').value, name: document.getElementById('newCoaName').value, division: document.getElementById('newCoaDivision').value, branch: document.getElementById('newCoaBranch').value });
    if(!error) { document.getElementById('formAddCoa').reset(); loadMasterCoaList(); Swal.fire('Tersimpan','','success'); }
}
window.hapusCoa = async (id) => { if(confirm('Hapus?')) { await _db.from('coa').delete().eq('id', id); loadMasterCoaList(); }};

window.bukaModalBudget = async () => { if(modalBudget) modalBudget.show(); const { data } = await _db.from('coa').select('*').order('division'); const s = document.getElementById('budgetCoa'); s.innerHTML='<option value="">Pilih...</option>'; data.forEach(c => s.add(new Option(`[${c.branch||'ALL'}] ${c.name} (${c.code})`, c.id))); };
async function handleBudgetSubmit(e) {
    e.preventDefault();
    const item = { coa_id: document.getElementById('budgetCoa').value, month: document.getElementById('budgetMonth').value, year: document.getElementById('budgetYear').value, budget_limit: document.getElementById('budgetAmount').value, current_usage: 0 };
    const { data: ex } = await _db.from('monthly_budgets').select('id').match({coa_id: item.coa_id, month: item.month, year: item.year}).single();
    if(ex) await _db.from('monthly_budgets').update({budget_limit: item.budget_limit}).eq('id', ex.id); else await _db.from('monthly_budgets').insert(item);
    modalBudget.hide(); Swal.fire('Sukses', 'Anggaran diset', 'success');
}
window.bukaModalManageUsers = () => { if(manageUsersModal) manageUsersModal.show(); loadAllUsers(); };
async function loadAllUsers() {
    const el = document.getElementById('user-list-container'); el.innerHTML = 'Loading...';
    const { data } = await _db.from('profiles').select('*').order('full_name');
    el.innerHTML = data.map(u => `<div class="list-group-item d-flex justify-content-between"><div><b>${u.full_name}</b><br><small>${u.role}-${u.division} (${u.branch})</small></div>${currentUser.id!==u.id ? `<button onclick="hapusUser('${u.id}')" class="btn btn-sm btn-danger">Hapus</button>` : ''}</div>`).join('');
}
window.hapusUser = async (id) => { if(confirm('Hapus user?')) { await _db.from('profiles').delete().eq('id', id); loadAllUsers(); }};

window.bukaModalCekBudget = async () => {
    if(modalCekBudget) modalCekBudget.show();
    const c = document.getElementById('list-budget-staf'); c.innerHTML = '<div class="text-center my-3"><div class="spinner-border text-primary"></div><p class="small text-muted mt-2">Menghitung...</p></div>';
    try {
        let qCoa = _db.from('coa').select('*').eq('division', currentUser.division);
        if(currentUser.branch) qCoa = qCoa.eq('branch', currentUser.branch);
        const { data: listCoa } = await qCoa;
        if(!listCoa || listCoa.length === 0) { c.innerHTML = '<div class="text-center text-muted p-3">Belum ada Pos Biaya.</div>'; return; }
        const d = new Date();
        const { data: listBudget } = await _db.from('monthly_budgets').select('*').eq('month', d.getMonth()+1).eq('year', d.getFullYear());
        let html = '';
        const fmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits:0 });
        listCoa.forEach(coa => {
            const b = listBudget ? listBudget.find(x => x.coa_id === coa.id) : null;
            const limit = b ? b.budget_limit : 0; const usage = b ? b.current_usage : 0; const sisa = limit - usage;
            let p = 0; if(limit > 0) p = Math.round((usage/limit)*100); if(p>100) p=100;
            let col = 'bg-success'; if(p>50) col='bg-warning'; if(p>85) col='bg-danger';
            html += `<div class="card p-3 border-0 shadow-sm bg-light"><div class="d-flex justify-content-between align-items-center mb-1"><h6 class="fw-bold mb-0 text-dark">${coa.name}</h6><small class="text-muted">${coa.code}</small></div><div class="d-flex justify-content-between small text-muted mb-2"><span>Terpakai: <b>${fmt.format(usage)}</b></span><span>Plafon: ${fmt.format(limit)}</span></div><div class="progress" style="height:10px;border-radius:10px;"><div class="progress-bar ${col}" style="width:${p}%"></div></div><div class="text-end mt-1"><small class="${sisa<0?'text-danger fw-bold':'text-primary fw-bold'}">Sisa: ${fmt.format(sisa)}</small></div></div>`;
        });
        c.innerHTML = html;
    } catch (err) { c.innerHTML = `<div class="alert alert-danger small">Gagal: ${err.message}</div>`; }
};

window.prosesImportMasterCoa = async () => { processExcel('inputExcelCoa', async rows => {
    const data = []; rows.forEach(r => { if(r['KODE']&&r['NAMA']) data.push({code:String(r['KODE']), name:r['NAMA'], division:r['DIVISI']||'UMUM', branch:r['CABANG']||'PUSAT'}); });
    const { error } = await _db.from('coa').upsert(data, {onConflict:'code'});
    if(!error) { loadMasterCoaList(); Swal.fire('Sukses Import','','success'); }
}); };
window.downloadTemplateMaster = () => { XLSX.writeFile(XLSX.utils.book_new(XLSX.utils.json_to_sheet([{ "KODE": "IT-01", "NAMA": "Server", "DIVISI": "IT", "CABANG": "JKT" }])), "Template_Master_COA.xlsx"); };
window.downloadTemplate = () => { XLSX.writeFile(XLSX.utils.book_new(XLSX.utils.json_to_sheet([{ "KODE_COA": "IT-01", "TAHUN": 2025, "JAN": 10000000, "FEB": 10000000 }])), "Template_Budget.xlsx"); };
window.prosesImportExcel = async () => { processExcel('inputExcel', async rows => {
    const { data: listCoa } = await _db.from('coa').select('id, code'); const map = {}; listCoa.forEach(c => map[String(c.code).trim()] = c.id);
    const mapBulan = { 1:'JAN', 2:'FEB', 3:'MAR', 4:'APR', 5:'MEI', 6:'JUN', 7:'JUL', 8:'AGU', 9:'SEP', 10:'OKT', 11:'NOV', 12:'DES' };
    for (let r of rows) {
        let coaId = map[String(r['KODE_COA']||r['KODE']).trim()];
        if(coaId) { for(let b=1; b<=12; b++) { let val = r[mapBulan[b]]; if(val) {
            const criteria = { coa_id: coaId, month: b, year: r['TAHUN']||2025 };
            const { data: ex } = await _db.from('monthly_budgets').select('id').match(criteria).single();
            if(ex) await _db.from('monthly_budgets').update({budget_limit: val}).eq('id', ex.id); else await _db.from('monthly_budgets').insert({...criteria, budget_limit: val, current_usage: 0});
        }}}
    }
    if(modalBudget) modalBudget.hide(); Swal.fire('Selesai', 'Import budget selesai.', 'success');
}); };
async function processExcel(inputId, callback) {
    const f = document.getElementById(inputId).files[0]; if(!f) return Swal.fire('Pilih file!', '', 'warning');
    Swal.showLoading(); const r = new FileReader();
    r.onload = async e => { try { await callback(XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), {type:'array'}).Sheets[XLSX.read(new Uint8Array(e.target.result), {type:'array'}).SheetNames[0]])); } catch(err){ Swal.fire('Error', err.message, 'error'); }};
    r.readAsArrayBuffer(f);
}

// --- 13. FITUR WA HELPER ---
async function kirimNotifWA(requestData, action) {
    let targetRole = ''; let message = ''; let targetPhone = ''; 
    const judul = requestData.title;
    const pemohon = requestData.profiles?.full_name || 'Staf';
    const nominal = new Intl.NumberFormat('id-ID').format(requestData.amount);
    const linkApp = window.location.href;

    if (action === 'submit') { targetRole = 'manager'; message = `*PENGAJUAN BARU*\n\nHalo Manager,\nAda pengajuan baru dari *${pemohon}*.\n\nJudul: ${judul}\nNominal: Rp ${nominal}\n\nMohon dicek.\n🔗 ${linkApp}`; } 
    else if (action === 'approve_manager') { targetRole = 'akunting'; message = `*BUTUH VERIFIKASI*\n\nHalo Finance,\nPengajuan *${judul}* (Rp ${nominal}) sudah disetujui Manager.\nMohon verifikasi.\n\n🔗 ${linkApp}`; }
    else if (action === 'approve_accounting') { targetRole = 'pimpinan'; message = `*BUTUH PERSETUJUAN*\n\nHalo Pimpinan,\nPengajuan *${judul}* senilai Rp ${nominal} sudah diverifikasi Finance.\nMohon persetujuan akhir.\n\n🔗 ${linkApp}`; }
    else if (action === 'final_approve') { targetRole = 'requester'; message = `*KABAR GEMBIRA!* 🥳\n\nHalo ${pemohon},\nPengajuan Anda *${judul}* senilai Rp ${nominal} telah *DISETUJUI SEPENUHNYA*.\n\nTerima kasih!`; }
    else if (action === 'reject') { targetRole = 'requester'; message = `*INFO PENGAJUAN*\n\nMohon maaf ${pemohon},\nPengajuan *${judul}* saat ini *DITOLAK* / dikembalikan.\n\n🔗 ${linkApp}`; }

    try {
        if (targetRole === 'requester') {
            const { data } = await _db.from('profiles').select('phone').eq('id', requestData.requester_id).single();
            if(data) targetPhone = data.phone;
        } else {
            let query = _db.from('profiles').select('phone').eq('role', targetRole);
            if (targetRole === 'manager') { query = query.eq('division', requestData.division); if(requestData.branch) query = query.eq('branch', requestData.branch); }
            const { data } = await query.limit(1);
            if(data && data.length > 0) targetPhone = data[0].phone;
        }

        if (targetPhone) {
            if(targetPhone.startsWith('0')) targetPhone = '62' + targetPhone.slice(1);
            window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`, '_blank');
        } else {
            Swal.fire({icon: 'info', title: 'Nomor Tidak Ditemukan', text: 'Membuka WA manual...', confirmButtonText: 'Buka WA'}).then(() => { window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank'); });
        }
    } catch (err) { console.error("Gagal kirim WA", err); }
}