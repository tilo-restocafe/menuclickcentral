// ===================================================================
// GLOBAL STATE & INITIALIZATION
// ===================================================================
const state = {
    config: {
        GITHUB_USER: '',
        GITHUB_REPO: '',
        COMPROC_SUCURSAL_ID: '',
        PORT: '3000',
        hasToken: false,
        tokenMasked: ''
    },
    employees: [],
    closures: [],
    activeEmployee: null,
    githubConnected: false
};

document.addEventListener('DOMContentLoaded', async () => {
    setupViewNavigation();
    setupConfigForm();
    setupEmployeeForm();
    setupClosureForm();
    
    // Carga inicial de datos en todos los entornos
    await checkConfigStatus();
    await loadInitialData();
});

// ===================================================================
// VIEW ROUTING / NAVIGATION
// ===================================================================
function setupViewNavigation() {
    const navButtons = document.querySelectorAll('.nav-item');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            const targetView = btnEl.getAttribute('data-view');
            switchView(targetView);
        });
    });

    // Refresh button en dashboard
    const refreshBtn = document.getElementById('dash-btn-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const btnText = refreshBtn.innerText;
            refreshBtn.innerText = 'Cargando...';
            refreshBtn.disabled = true;
            await loadInitialData();
            refreshBtn.innerText = btnText;
            refreshBtn.disabled = false;
        });
    }
}

function switchView(viewName) {
    // Actualizar botones barra lateral
    document.querySelectorAll('.nav-item').forEach(btn => {
        if (btn.getAttribute('data-view') === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Mostrar sección correspondiente
    document.querySelectorAll('.view-section').forEach(sec => {
        if (sec.id === `view-${viewName}`) {
            sec.classList.remove('hidden');
        } else {
            sec.classList.add('hidden');
        }
    });

    // Actualizar título del Header
    const viewTitles = {
        dashboard: 'Panel de Control',
        cierres: 'Cierres de Caja Z',
        empleados: 'Gestión de Personal y Vales',
        config: 'Configuración de Integración'
    };
    document.getElementById('view-title').innerText = viewTitles[viewName] || 'MenuClick Central';

    // Cargas dinámicas
    if (viewName === 'cierres') {
        loadClosuresList();
    } else if (viewName === 'empleados') {
        loadEmployeesList();
    }
}

// ===================================================================
// CONFIGURATION & GITHUB CONNECTION
// ===================================================================
async function checkConfigStatus() {
    const badge = document.getElementById('github-status-badge');
    const badgeText = document.getElementById('github-status-text');
    
    badge.className = 'status-badge checking';
    badgeText.innerText = 'Comprobando conexión...';

    try {
        const response = await fetch('/api/config-status');
        const data = await response.json();
        
        state.config = data;
        
        // Cargar inputs del formulario
        const cfgUser = document.getElementById('cfg-github-user');
        if (cfgUser) cfgUser.value = data.GITHUB_USER || '';
        const cfgRepo = document.getElementById('cfg-github-repo');
        if (cfgRepo) cfgRepo.value = data.GITHUB_REPO || '';
        const cfgSuc = document.getElementById('cfg-sucursal-id');
        if (cfgSuc) cfgSuc.value = data.COMPROC_SUCURSAL_ID || '';
        const cfgPort = document.getElementById('cfg-port');
        if (cfgPort) cfgPort.value = data.PORT || '';
        const cfgToken = document.getElementById('cfg-github-token');
        if (cfgToken) cfgToken.value = data.hasToken ? '••••••••••••••••' : '';

        // Actualizar datos del panel de información lateral
        const infoUser = document.getElementById('info-git-user');
        if (infoUser) infoUser.innerText = data.GITHUB_USER || 'Sin configurar';
        const infoRepo = document.getElementById('info-git-repo');
        if (infoRepo) infoRepo.innerText = data.GITHUB_REPO || 'Sin configurar';
        const tokenSpan = document.getElementById('info-git-token-status');
        if (tokenSpan) {
            if (data.hasToken) {
                tokenSpan.innerText = `Activo (${data.tokenMasked})`;
                tokenSpan.className = 'val success';
            } else {
                tokenSpan.innerText = 'Falta configurar';
                tokenSpan.className = 'val danger';
            }
        }

        // Actualizar dashboard sucursal
        const dashSucName = document.getElementById('dash-sucursal-name');
        if (dashSucName) dashSucName.innerText = data.GITHUB_REPO ? `Repo: ${data.GITHUB_REPO}` : 'Sucursal';
        const dashSucId = document.getElementById('dash-sucursal-id');
        if (dashSucId) dashSucId.innerText = data.COMPROC_SUCURSAL_ID || 'Sin configurar';

        if (!data.GITHUB_USER || !data.GITHUB_REPO || !data.hasToken) {
            badge.className = 'status-badge disconnected';
            badgeText.innerText = 'Faltan credenciales de GitHub';
            state.githubConnected = false;
            return;
        }

        // Probar conexión a GitHub
        const testRes = await fetch('/api/test-github');
        const testData = await testRes.json();
        
        if (testData.success) {
            badge.className = 'status-badge connected';
            badgeText.innerText = 'Conectado a GitHub';
            state.githubConnected = true;
        } else {
            badge.className = 'status-badge disconnected';
            badgeText.innerText = 'Error al verificar token';
            state.githubConnected = false;
        }
    } catch (err) {
        badge.className = 'status-badge disconnected';
        badgeText.innerText = 'Error de red con servidor';
        state.githubConnected = false;
        console.error(err);
    }
}

function setupConfigForm() {
    const form = document.getElementById('config-form');
    const testBtn = document.getElementById('btn-test-config');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-save-config');
        const origText = submitBtn.innerText;
        submitBtn.innerText = 'Guardando...';
        submitBtn.disabled = true;

        const payload = {
            GITHUB_USER: document.getElementById('cfg-github-user').value.trim(),
            GITHUB_REPO: document.getElementById('cfg-github-repo').value.trim(),
            COMPROC_SUCURSAL_ID: document.getElementById('cfg-sucursal-id').value.trim(),
            PORT: document.getElementById('cfg-port').value.trim()
        };

        const rawToken = document.getElementById('cfg-github-token').value;
        // Solo enviar el token si el usuario escribió uno nuevo (no la máscara)
        if (rawToken && rawToken !== '••••••••••••••••') {
            payload.GITHUB_TOKEN = rawToken.trim();
        }

        try {
            const res = await fetch('/api/config-save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                await checkConfigStatus();
                if (state.githubConnected) {
                    await loadInitialData();
                    switchView('dashboard');
                }
            } else {
                alert('Error al guardar: ' + data.error);
            }
        } catch (err) {
            alert('Error de red al guardar: ' + err.message);
        } finally {
            submitBtn.innerText = origText;
            submitBtn.disabled = false;
        }
    });

    testBtn.addEventListener('click', async () => {
        testBtn.innerText = 'Probando...';
        testBtn.disabled = true;

        const payload = {
            GITHUB_USER: document.getElementById('cfg-github-user')?.value.trim() || '',
            GITHUB_REPO: document.getElementById('cfg-github-repo')?.value.trim() || ''
        };
        const rawToken = document.getElementById('cfg-github-token')?.value;
        if (rawToken && rawToken !== '••••••••••••••••') {
            payload.GITHUB_TOKEN = rawToken.trim();
        }

        try {
            const res = await fetch('/api/test-github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert('✅ Exito: ' + data.message);
                await checkConfigStatus();
            } else {
                alert('❌ Error: ' + data.error + (data.detalles ? '\n\nDetalles: ' + JSON.stringify(data.detalles) : ''));
            }
        } catch (err) {
            alert('❌ Error de comunicación con el servidor central: ' + err.message);
        } finally {
            testBtn.innerText = 'Probar Conexión';
            testBtn.disabled = false;
        }
    });
}

// ===================================================================
// DATA INGESTION & ROSTER SYNC
// ===================================================================
async function loadInitialData() {
    await Promise.all([
        loadEmployeesList(),
        loadClosuresList()
    ]);
    
    // Actualizar contadores en dashboard
    document.getElementById('dash-emp-count').innerText = state.employees.length;
    document.getElementById('dash-cierres-count').innerText = state.closures.length;
    
    renderRecentClosuresDashboard();
}

async function loadEmployeesList() {
    try {
        const response = await fetch('/api/empleados');
        const data = await response.json();
        if (data.success) {
            state.employees = data.empleados || [];
            renderEmployeesTable();
        } else {
            console.error("Error al traer empleados:", data.error);
        }
    } catch (e) {
        console.error("Error cargando empleados:", e);
    }
}
window.loadEmployeesList = loadEmployeesList;

async function loadClosuresList() {
    try {
        const response = await fetch('/api/cierres');
        const data = await response.json();
        if (data.success) {
            state.closures = data.closures || [];
            renderClosuresTable();
        } else {
            console.error("Error al traer cierres:", data.error);
        }
    } catch (e) {
        console.error("Error cargando cierres:", e);
    }
}

// ===================================================================
// EMPLOYEES CONTROLLER (NÓMINA Y VALES MANUALES)
// ===================================================================
function renderEmployeesTable() {
    const tbody = document.getElementById('empleados-list-body');
    const searchVal = document.getElementById('emp-search-input').value.toLowerCase().trim();
    
    tbody.innerHTML = '';
    
    const filtered = state.employees.filter(emp => 
        String(emp.id).toLowerCase().includes(searchVal) ||
        emp.nombre.toLowerCase().includes(searchVal) ||
        (emp.cargo && emp.cargo.toLowerCase().includes(searchVal))
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No se encontraron empleados.</td></tr>`;
        return;
    }

    filtered.forEach(emp => {
        const sueldo = parseFloat(emp.sueldo_base_mensual || 0);
        const vales = parseFloat(emp.vales_acumulados_mes || 0);
        const neto = sueldo - vales;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><code>${emp.id}</code></td>
            <td><strong>${emp.nombre}</strong></td>
            <td><span class="badge">${emp.cargo || 'General'}</span></td>
            <td>$${sueldo.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
            <td class="${vales > 0 ? 'danger' : 'text-muted'}">$${vales.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
            <td class="success">$${neto.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
            <td>
                <div class="badge-container">
                    <button type="button" class="btn btn-secondary btn-xs btn-emp-view" data-id="${emp.id}" onclick="openEmployeeDetails('${emp.id}')">🔍 Ver/Vales</button>
                    <button type="button" class="btn btn-secondary btn-xs btn-emp-edit" data-id="${emp.id}" onclick="openEmployeeForm('${emp.id}')">✏️ Editar</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Registrar eventos para los botones individuales
    tbody.querySelectorAll('.btn-emp-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const empId = e.currentTarget.getAttribute('data-id');
            openEmployeeDetails(empId);
        });
    });
    tbody.querySelectorAll('.btn-emp-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const empId = e.currentTarget.getAttribute('data-id');
            openEmployeeForm(empId);
        });
    });
}

function setupEmployeeForm() {
    // Configurar buscador
    document.getElementById('emp-search-input')?.addEventListener('input', renderEmployeesTable);

    // Botones de modals
    const newEmpBtn = document.getElementById('btn-nuevo-empleado');
    const syncEmpBtn = document.getElementById('btn-sync-empleados');
    const formModal = document.getElementById('modal-empleado-form');
    const closeFormBtn = document.getElementById('close-emp-form');
    const cancelFormBtn = document.getElementById('btn-cancel-emp-form');
    const employeeForm = document.getElementById('form-empleado');
    
    const detailModal = document.getElementById('modal-empleado-detail');
    const closeDetailBtn = document.getElementById('close-emp-detail');

    if (newEmpBtn) {
        newEmpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openEmployeeForm(null);
        });
    }
    
    closeFormBtn?.addEventListener('click', () => formModal?.classList.remove('active'));
    cancelFormBtn?.addEventListener('click', () => formModal?.classList.remove('active'));
    closeDetailBtn?.addEventListener('click', () => detailModal?.classList.remove('active'));

    if (syncEmpBtn) {
        syncEmpBtn.addEventListener('click', async () => {
            syncEmpBtn.innerText = 'Sincronizando...';
            syncEmpBtn.disabled = true;
            await loadEmployeesList();
            syncEmpBtn.innerText = 'Sincronizar';
            syncEmpBtn.disabled = false;
        });
    }

    const simularBtn = document.getElementById('btn-simular-datos');
    if (simularBtn) {
        simularBtn.addEventListener('click', () => simularDatosDemo());
    }

    const cierreMesBtn = document.getElementById('btn-cierre-mes-general');
    if (cierreMesBtn) {
        cierreMesBtn.addEventListener('click', async () => {
            await cierreDeMesGeneral();
        });
    }

    const liquidarEmpBtn = document.getElementById('btn-liquidar-empleado');
    if (liquidarEmpBtn) {
        liquidarEmpBtn.addEventListener('click', async () => {
            if (state.activeEmployee) {
                await liquidarEmpleadoIndividual(state.activeEmployee.id);
            }
        });
    }

    // Enviar formulario (Agregar / Editar Empleado)
    if (employeeForm) {
        employeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const empId = document.getElementById('emp-form-id').value;
            const nombre = document.getElementById('emp-nombre').value.trim();
        const cargo = document.getElementById('emp-cargo').value.trim();
        const sueldo = parseFloat(document.getElementById('emp-sueldo').value) || 0;

        let updatedList = [...state.employees];

        if (empId) {
            // Editar existente
            const empIdx = updatedList.findIndex(x => String(x.id) === String(empId));
            if (empIdx !== -1) {
                updatedList[empIdx].nombre = nombre;
                updatedList[empIdx].cargo = cargo;
                updatedList[empIdx].sueldo_base_mensual = sueldo;
                updatedList[empIdx].saldo_actual_sueldo = sueldo - (updatedList[empIdx].vales_acumulados_mes || 0);
            }
        } else {
            // Crear nuevo
            const newId = `emp-${Date.now()}`;
            const newEmp = {
                id: newId,
                nombre,
                cargo,
                sueldo_base_mensual: sueldo,
                vales_acumulados_mes: 0.00,
                saldo_actual_sueldo: sueldo,
                historial_vales: []
            };
            updatedList.push(newEmp);
        }

        const success = await saveEmployeesToGitHub(updatedList);
        if (success) {
            formModal.classList.remove('active');
            await loadEmployeesList();
            document.getElementById('dash-emp-count').innerText = state.employees.length;
        }
    });
    }

    // Formulario de Carga de Vales Manuales
    const formVale = document.getElementById('form-cargar-vale');
    if (formVale) {
        formVale.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.activeEmployee) return;

        const monto = parseFloat(document.getElementById('vale-monto').value) || 0;
        const concepto = document.getElementById('vale-concepto').value.trim();
        const fecha = document.getElementById('vale-fecha').value;

        if (monto <= 0) {
            alert("El monto debe ser mayor a cero.");
            return;
        }

        const newVale = {
            id_vale: `val-man-${Date.now()}`,
            fecha,
            hora: new Date().toLocaleTimeString('es-AR', { hour12: false }),
            concepto,
            monto,
            cierre_caja_origen_id: 'manual-central'
        };

        // Crear una copia modificada de la lista de empleados
        let updatedList = state.employees.map(emp => {
            if (String(emp.id) === String(state.activeEmployee.id)) {
                const hist = emp.historial_vales || [];
                const valesAcum = (emp.vales_acumulados_mes || 0) + monto;
                return {
                    ...emp,
                    vales_acumulados_mes: valesAcum,
                    saldo_actual_sueldo: (emp.sueldo_base_mensual || 0) - valesAcum,
                    historial_vales: [...hist, newVale]
                };
            }
            return emp;
        });

        const success = await saveEmployeesToGitHub(updatedList);
        if (success) {
            alert('Vale registrado exitosamente.');
            formVale.reset();
            // Cargar fecha de hoy por defecto de nuevo
            document.getElementById('vale-fecha').valueAsDate = new Date();
            
            // Recargar datos y volver a abrir la ficha del empleado
            await loadEmployeesList();
            openEmployeeDetails(state.activeEmployee.id);
        }
    });
    }

    // Manejo de tabs en el modal de detalle del empleado
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Cabeceras
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Paneles
            document.querySelectorAll('.tab-pane').forEach(pane => {
                if (pane.id === targetTab) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
        });
    });
}

function openEmployeeForm(empId = null) {
    const modal = document.getElementById('modal-empleado-form');
    const title = document.getElementById('emp-form-title');
    const form = document.getElementById('form-empleado');
    if (form) form.reset();

    if (empId && typeof empId === 'string') {
        if (title) title.innerText = 'Editar Datos Empleado';
        const emp = state.employees.find(x => String(x.id) === String(empId));
        if (emp) {
            if (document.getElementById('emp-form-id')) document.getElementById('emp-form-id').value = emp.id;
            if (document.getElementById('emp-nombre')) document.getElementById('emp-nombre').value = emp.nombre;
            if (document.getElementById('emp-cargo')) document.getElementById('emp-cargo').value = emp.cargo || '';
            if (document.getElementById('emp-sueldo')) document.getElementById('emp-sueldo').value = emp.sueldo_base_mensual || 0;
        }
    } else {
        if (title) title.innerText = 'Agregar Nuevo Empleado';
        if (document.getElementById('emp-form-id')) document.getElementById('emp-form-id').value = '';
    }

    if (modal) modal.classList.add('active');
}
window.openEmployeeForm = openEmployeeForm;

function openEmployeeDetails(empId) {
    const emp = state.employees.find(x => String(x.id) === String(empId));
    if (!emp) return;

    state.activeEmployee = emp;

    const modal = document.getElementById('modal-empleado-detail');
    document.getElementById('emp-detail-name').innerText = emp.nombre;
    
    const sueldo = parseFloat(emp.sueldo_base_mensual || 0);
    const vales = parseFloat(emp.vales_acumulados_mes || 0);
    const neto = sueldo - vales;

    document.getElementById('emp-detail-sueldo-base').innerText = `$${sueldo.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
    document.getElementById('emp-detail-vales').innerText = `$${vales.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
    document.getElementById('emp-detail-neto').innerText = `$${neto.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
    
    // Inyectar el ID en el form de vales
    document.getElementById('vale-emp-id').value = emp.id;
    // Setear fecha de hoy en el form de vales
    document.getElementById('vale-fecha').valueAsDate = new Date();

    // Renderizar historial de vales
    const tbody = document.getElementById('emp-vales-history-body');
    tbody.innerHTML = '';
    
    const hist = emp.historial_vales || [];
    if (hist.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No se registran vales en su historial.</td></tr>`;
    } else {
        // Ordenar vales por fecha descendente
        const sortedHist = [...hist].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
        sortedHist.forEach(vale => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>${vale.fecha}</code></td>
                <td>${vale.concepto}</td>
                <td class="danger">$${parseFloat(vale.monto).toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                <td>
                    <button class="btn btn-danger btn-xs btn-eliminar-vale" data-vale-id="${vale.id_vale}">Anular</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Registrar anulación
        tbody.querySelectorAll('.btn-eliminar-vale').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const valeId = e.currentTarget.getAttribute('data-vale-id');
                if (confirm('¿Está seguro de que desea anular este vale? Se reintegrará el dinero al saldo del empleado.')) {
                    await anularValeEmpleado(emp.id, valeId);
                }
            });
        });
    }

    // Resetear a pestaña activa: Historial
    document.querySelector('.tab-btn[data-tab="tab-historial"]').click();

    modal.classList.add('active');
}
window.openEmployeeDetails = openEmployeeDetails;

async function anularValeEmpleado(empId, valeId) {
    let updatedList = state.employees.map(emp => {
        if (String(emp.id) === String(empId)) {
            const hist = emp.historial_vales || [];
            const vale = hist.find(v => String(v.id_vale) === String(valeId));
            if (vale) {
                const montoVale = parseFloat(vale.monto || 0);
                const nuevoAcumulado = Math.max(0, (emp.vales_acumulados_mes || 0) - montoVale);
                return {
                    ...emp,
                    vales_acumulados_mes: nuevoAcumulado,
                    saldo_actual_sueldo: (emp.sueldo_base_mensual || 0) - nuevoAcumulado,
                    historial_vales: hist.filter(v => String(v.id_vale) !== String(valeId))
                };
            }
        }
        return emp;
    });

    const success = await saveEmployeesToGitHub(updatedList);
    if (success) {
        alert('Vale anulado correctamente.');
        await loadEmployeesList();
        openEmployeeDetails(empId);
    }
}

async function simularDatosDemo() {
    const simularBtn = document.getElementById('btn-simular-datos');
    if (simularBtn) {
        simularBtn.disabled = true;
        simularBtn.innerText = '⚡ Simulando...';
    }
    try {
        await fetch('/api/simular-demo', { method: 'POST' });
        await loadEmployeesList();
        await loadClosuresList();
        alert("⚡ ¡Modo Simulación Activo! Se cargaron 5 empleados con sus sueldos y vales, además de informes Z de ejemplo.");
    } catch(e) {
        console.error(e);
    } finally {
        if (simularBtn) {
            simularBtn.disabled = false;
            simularBtn.innerText = '⚡ Simular Datos Demo';
        }
    }
}
window.simularDatosDemo = simularDatosDemo;

// FUNCIONES: Cierre de Mes General y Liquidación Individual de Sueldo
async function cierreDeMesGeneral() {
    if (!state.employees || state.employees.length === 0) {
        alert("No hay empleados registrados en la nómina.");
        return;
    }

    const confirmMsg = `¿Confirmas el CIERRE DE MES GENERAL para todos los empleados?

Se realizará lo siguiente:
1. Se archivará el historial de vales del mes en registros pasados.
2. Se reiniciarán a $0 los Vales Acumulados de todos los empleados (vales_acumulados_mes = 0).
3. Se restaurará el Saldo Neto al Sueldo Base mensual de cada empleado.`;

    if (!confirm(confirmMsg)) return;

    const btn = document.getElementById('btn-cierre-mes-general');
    if (btn) {
        btn.disabled = true;
        btn.innerText = '⏳ Procesando Cierre...';
    }

    try {
        const fechaCierre = new Date().toISOString().split('T')[0];
        const updatedList = state.employees.map(emp => {
            const sueldoBase = parseFloat(emp.sueldo_base_mensual || 0);
            const valesMes = parseFloat(emp.vales_acumulados_mes || 0);
            const historialActual = emp.historial_vales || [];
            const historicoMeses = emp.historial_cierre_meses || [];

            if (valesMes > 0 || historialActual.length > 0) {
                historicoMeses.push({
                    fecha_cierre: fechaCierre,
                    sueldo_base: sueldoBase,
                    total_vales_deducidos: valesMes,
                    neto_pagado: sueldoBase - valesMes,
                    vales_detallados: historialActual
                });
            }

            return {
                ...emp,
                vales_acumulados_mes: 0,
                saldo_actual_sueldo: sueldoBase,
                historial_vales: [],
                historial_cierre_meses: historicoMeses,
                ultimo_cierre_mes: fechaCierre
            };
        });

        const success = await saveEmployeesToGitHub(updatedList);
        if (success) {
            state.employees = updatedList;
            renderEmployeesTable();
            alert("✅ ¡Cierre de Mes completado con éxito! Todos los vales se han reiniciado a $0 y los sueldos se restauraron al sueldo base.");
        }
    } catch(e) {
        console.error("Error en Cierre de Mes:", e);
        alert("Ocurrió un error al procesar el cierre: " + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🗓️ Cierre de Mes (Reiniciar Vales)';
        }
    }
}
window.cierreDeMesGeneral = cierreDeMesGeneral;

async function liquidarEmpleadoIndividual(empId) {
    const emp = state.employees.find(x => String(x.id) === String(empId));
    if (!emp) return;

    const sueldoBase = parseFloat(emp.sueldo_base_mensual || 0);
    const valesMes = parseFloat(emp.vales_acumulados_mes || 0);
    const netoAbonar = sueldoBase - valesMes;

    const confirmMsg = `¿Confirmas la LIQUIDACIÓN DE SUELDO para ${emp.nombre}?

- Sueldo Base: $${sueldoBase.toLocaleString('es-AR', {minimumFractionDigits: 2})}
- Vales Deducidos en el mes: $${valesMes.toLocaleString('es-AR', {minimumFractionDigits: 2})}
- Saldo Neto a abonar: $${netoAbonar.toLocaleString('es-AR', {minimumFractionDigits: 2})}

Sus vales del mes se reiniciarán a $0 y su saldo se restaurará al sueldo base.`;

    if (!confirm(confirmMsg)) return;

    const fechaCierre = new Date().toISOString().split('T')[0];
    const updatedList = state.employees.map(x => {
        if (String(x.id) === String(emp.id)) {
            const historialActual = x.historial_vales || [];
            const historicoMeses = x.historial_cierre_meses || [];
            if (valesMes > 0 || historialActual.length > 0) {
                historicoMeses.push({
                    fecha_cierre: fechaCierre,
                    sueldo_base: sueldoBase,
                    total_vales_deducidos: valesMes,
                    neto_pagado: netoAbonar,
                    vales_detallados: historialActual
                });
            }
            return {
                ...x,
                vales_acumulados_mes: 0,
                saldo_actual_sueldo: sueldoBase,
                historial_vales: [],
                historial_cierre_meses: historicoMeses,
                ultimo_cierre_mes: fechaCierre
            };
        }
        return x;
    });

    const success = await saveEmployeesToGitHub(updatedList);
    if (success) {
        state.employees = updatedList;
        renderEmployeesTable();
        openEmployeeDetails(emp.id);
        alert(`✅ Liquidación completada para ${emp.nombre}. Vales reiniciados a $0.`);
    }
}

async function saveEmployeesToGitHub(list) {
    try {
        const response = await fetch('/api/empleados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empleados: list })
        });
        const data = await response.json();
        if (data.success) {
            return true;
        } else {
            const detalles = data.detalles ? '\n\nDetalles: ' + (typeof data.detalles === 'object' ? JSON.stringify(data.detalles) : data.detalles) : '';
            alert('Error al guardar empleados en GitHub: ' + data.error + detalles);
            return false;
        }
    } catch (e) {
        alert('Error de red al guardar en GitHub: ' + e.message);
        return false;
    }
}

// ===================================================================
// CLOSURES CONTROLLER (CIERRES DE CAJA Z)
// ===================================================================
function renderClosuresTable() {
    const tbody = document.getElementById('cierres-list-body');
    const searchVal = document.getElementById('cierres-search-input').value.toLowerCase().trim();
    const filterTurno = document.getElementById('cierres-filter-turno').value;
    
    tbody.innerHTML = '';
    
    // Parsear cierres
    const parsedClosures = state.closures.map(c => {
        // Formato esperado: cierres/AÑO/MES/dia-DIA-TURNO.json
        // Ej: cierres/2026/07/dia-04-noche.json
        const parts = c.path.split('/');
        let anoMes = '-';
        let nombreArchivo = parts[parts.length - 1];
        let turno = '-';
        
        let fullDate = '-';
        if (parts.length >= 4) {
            anoMes = `${parts[1]}-${parts[2]}`;
            // extraer turno de 'dia-04-noche.json'
            const filename = parts[3];
            const fileParts = filename.replace('.json', '').split('-');
            if (fileParts.length >= 3) {
                turno = fileParts[2];
                fullDate = `${anoMes}-${fileParts[1]}`;
            }
        }

        return {
            ...c,
            anoMes,
            nombreArchivo,
            turno,
            fullDate
        };
    });

    let filtered = parsedClosures.filter(c => {
        const matchSearch = c.path.toLowerCase().includes(searchVal);
        const matchTurno = filterTurno === '' || c.turno === filterTurno;
        return matchSearch && matchTurno;
    });

    // Ordenar de más reciente a más antiguo
    filtered.sort((a, b) => b.path.localeCompare(a.path));

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No se encontraron cierres Z registrados.</td></tr>`;
        return;
    }

    filtered.forEach(c => {
        const tr = document.createElement('tr');
        const rowId = 'row-' + c.sha;
        tr.id = rowId;
        // Orden exacto de las columnas:
        // 1. Fecha/Hora, 2. Turno, 3. Débito, 4. Crédito, 5. QR, 6. Gastos/Ext., 7. Vales, 8. Efectivo, 9. Total Venta, 10. Acción
        tr.innerHTML = `
            <td id="fecha-${c.sha}"><span class="text-highlight">${c.fullDate}</span></td>
            <td><span class="badge">${c.turno.toUpperCase()}</span></td>
            <td id="deb-${c.sha}">-</td>
            <td id="cred-${c.sha}">-</td>
            <td id="qr-${c.sha}">-</td>
            <td id="gastos-${c.sha}">-</td>
            <td id="vales-${c.sha}">-</td>
            <td id="efec-${c.sha}"><span class="spinner" style="width:12px; height:12px; border-width:2px;"></span></td>
            <td id="total-${c.sha}">-</td>
            <td>
                <button class="btn btn-secondary btn-xs btn-cierre-view" data-path="${c.path}">🔍 Inspeccionar</button>
                <button class="btn btn-primary btn-xs btn-cierre-consolidar" data-date="${c.fullDate}">📅 Consolidar Día</button>
            </td>
        `;
        tbody.appendChild(tr);

        // Fetch asíncrono para llenar los datos
        fetch('/api/cierres/detalle?path=' + encodeURIComponent(c.path))
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    const ds = data.data.datos_sistema || {};
                    const cr = data.data.conteo_real || {};
                    const closure = data.data;
                    
                    // Parsear Hora desde el ID (cie-[timestamp])
                    let horaStr = '';
                    if (closure.id && closure.id.startsWith('cie-')) {
                        const ts = parseInt(closure.id.replace('cie-', ''));
                        if (!isNaN(ts)) {
                            const d = new Date(ts);
                            const hh = String(d.getHours()).padStart(2, '0');
                            const mm = String(d.getMinutes()).padStart(2, '0');
                            horaStr = ` ${hh}:${mm}`;
                        }
                    }

                    const elFecha = document.getElementById(`fecha-${c.sha}`);
                    const elDeb = document.getElementById(`deb-${c.sha}`);
                    const elCred = document.getElementById(`cred-${c.sha}`);
                    const elQr = document.getElementById(`qr-${c.sha}`);
                    const elGastos = document.getElementById(`gastos-${c.sha}`);
                    const elVales = document.getElementById(`vales-${c.sha}`);
                    const elEfec = document.getElementById(`efec-${c.sha}`);
                    const elTotal = document.getElementById(`total-${c.sha}`);
                    
                    if (elFecha) {
                        elFecha.innerHTML = `<span class="text-highlight">${c.fullDate}${horaStr}</span>`;
                    }
                    if (elDeb) elDeb.innerText = '$' + parseFloat(ds.tarjeta_debito || 0).toLocaleString('es-AR', {minimumFractionDigits: 0});
                    if (elCred) elCred.innerText = '$' + parseFloat(ds.tarjeta_credito || 0).toLocaleString('es-AR', {minimumFractionDigits: 0});
                    if (elQr) elQr.innerText = '$' + parseFloat(ds.qr_digital || 0).toLocaleString('es-AR', {minimumFractionDigits: 0});
                    
                    if (elGastos) {
                        const valGastos = parseFloat(ds.gastos || 0);
                        elGastos.innerHTML = valGastos > 0 ? `<span class="danger">$${valGastos.toLocaleString('es-AR', {minimumFractionDigits: 0})}</span>` : '-';
                    }
                    if (elVales) {
                        const valVales = parseFloat(ds.vales_deducidos || 0);
                        elVales.innerHTML = valVales > 0 ? `<span class="danger">$${valVales.toLocaleString('es-AR', {minimumFractionDigits: 0})}</span>` : '-';
                    }
                    if (elEfec) {
                        const efectivoCaja = parseFloat(ds.efectivo_teorico || 0) || Math.max(0, parseFloat(ds.ventas_totales || 0) - parseFloat(ds.tarjeta_debito || 0) - parseFloat(ds.tarjeta_credito || 0) - parseFloat(ds.qr_digital || 0));
                        elEfec.innerHTML = `<strong style="color:#2ecc71">$${efectivoCaja.toLocaleString('es-AR', {minimumFractionDigits: 0})}</strong>`;
                    }
                    if (elTotal) {
                        const totalVenta = parseFloat(ds.ventas_totales || 0);
                        elTotal.innerHTML = `<strong>$${totalVenta.toLocaleString('es-AR', {minimumFractionDigits: 0})}</strong>`;
                    }
                } else {
                    const elEfec = document.getElementById(`efec-${c.sha}`);
                    if (elEfec) elEfec.innerHTML = '<span class="text-muted">Error</span>';
                }
            })
            .catch(err => {
                const elEfec = document.getElementById(`efec-${c.sha}`);
                if (elEfec) elEfec.innerHTML = '<span class="text-muted">Error</span>';
            });
    });

    tbody.querySelectorAll('.btn-cierre-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const path = e.currentTarget.getAttribute('data-path');
            openCierreDetails(path);
        });
    });

    tbody.querySelectorAll('.btn-cierre-consolidar').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const date = e.currentTarget.getAttribute('data-date');
            consolidarDia(date);
        });
    });
}

function renderRecentClosuresDashboard() {
    const tbody = document.getElementById('dash-cierres-list');
    tbody.innerHTML = '';

    if (state.closures.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay cierres recientes en el sistema.</td></tr>`;
        return;
    }

    // Copiar, ordenar desc y tomar los primeros 5
    const recent = [...state.closures]
        .sort((a, b) => b.path.localeCompare(a.path))
        .slice(0, 5);

    recent.forEach(c => {
        const parts = c.path.split('/');
        const fecha = parts.length >= 4 ? `${parts[1]}-${parts[2]}-${parts[3].split('-')[1]}` : '-';
        const turno = parts.length >= 4 ? parts[3].split('-')[2].replace('.json', '') : '-';
        const sizeKb = (c.size / 1024).toFixed(2) + ' KB';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${fecha}</strong></td>
            <td><span class="badge">${turno.toUpperCase()}</span></td>
            <td><code>${c.path}</code></td>
            <td>${sizeKb}</td>
            <td>
                <button class="btn btn-secondary btn-xs btn-dash-view" data-path="${c.path}">Inspeccionar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-dash-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const path = e.currentTarget.getAttribute('data-path');
            openCierreDetails(path);
        });
    });
}

async function openCierreDetails(path) {
    const modal = document.getElementById('modal-cierre-detalle');
    const container = document.getElementById('cierre-detail-body');
    container.innerHTML = `<div class="text-center text-muted">Obteniendo informe de GitHub...</div>`;
    modal.classList.add('active');

    try {
        const response = await fetch(`/api/cierres/detalle?path=${encodeURIComponent(path)}`);
        const data = await response.json();
        
        if (data.success && data.data) {
            const cierre = data.data;
            const ds = cierre.datos_sistema || {};
            const cr = cierre.conteo_real || {};
            const vales = cierre.vales_detallados || [];

            const ventas = parseFloat(ds.ventas_totales || 0);
            const teorico = parseFloat(ds.efectivo_teorico || 0);
            const debito = parseFloat(ds.tarjeta_debito || 0);
            const credito = parseFloat(ds.tarjeta_credito || 0);
            const qr = parseFloat(ds.qr_digital || 0);
            const gastos = parseFloat(ds.gastos || 0);
            const valesDeducidos = parseFloat(ds.vales_deducidos || 0);
            const cajaNeta = parseFloat(ds.caja_neta_teorica || 0);
            const fisico = parseFloat(cr.efectivo_fisico || 0);
            const diferencia = parseFloat(cr.diferencia || 0);

            let diffClass = 'text-muted';
            if (diferencia < 0) diffClass = 'danger';
            else if (diferencia > 0) diffClass = 'warning';

            let valesHtml = '';
            if (vales.length === 0) {
                valesHtml = `<p class="text-muted text-center" style="grid-column: 1/-1; font-size: 0.85rem; padding: 1rem 0;">No se registraron vales deducidos en este turno.</p>`;
            } else {
                valesHtml = `
                    <div style="grid-column: 1/-1; width: 100%;" class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Empleado</th>
                                    <th>Detalle</th>
                                    <th>Importe</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${vales.map(v => `
                                    <tr>
                                        <td><strong>${v.empleadoNombre}</strong></td>
                                        <td>${v.detalle}</td>
                                        <td class="danger">$${parseFloat(v.monto).toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="cierre-details-view">
                    <!-- Planilla Resumen -->
                    <div class="cierre-group" style="grid-column: 1/-1;">
                        <h4>Planilla Resumen (Cierre de Caja)</h4>
                        <div class="form-row">
                            <div class="cierre-row"><span class="lbl">Fecha:</span><span class="val"><strong>${cierre.fecha_jornada}</strong></span></div>
                            <div class="cierre-row"><span class="lbl">Turno:</span><span class="val"><span class="badge">${cierre.turno.toUpperCase()}</span></span></div>
                            <div class="cierre-row"><span class="lbl">Responsable:</span><span class="val">${cierre.responsable_caja}</span></div>
                        </div>
                        <hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">
                        <div class="cierre-row"><span class="lbl">Total de Venta:</span><span class="val">$${ventas.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span></div>
                        <div class="cierre-row"><span class="lbl">Débito:</span><span class="val">$${debito.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span></div>
                        <div class="cierre-row"><span class="lbl">Crédito:</span><span class="val">$${credito.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span></div>
                        <div class="cierre-row"><span class="lbl">QR / MercadoPago:</span><span class="val">$${qr.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span></div>
                        <div class="cierre-row"><span class="lbl">Vales Deducidos:</span><span class="val danger">$${valesDeducidos.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span></div>
                        <div class="cierre-row"><span class="lbl">Gastos en Caja:</span><span class="val danger">$${gastos.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span></div>
                        
                        <div class="cierre-row" style="background: rgba(46, 204, 113, 0.15); padding: 12px; border-radius: 8px; margin-top: 12px; border: 1px solid rgba(46, 204, 113, 0.3);">
                            <span class="lbl" style="font-weight: bold; color: #2ecc71; font-size: 1.1rem;">TOTAL EN EFECTIVO (Venta - Tarjetas - QR):</span>
                            <span class="val" style="font-weight: bold; color: #2ecc71; font-size: 1.3rem;">$${(ventas - debito - credito - qr).toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>

                    <!-- Arqueo Real -->
                    <div class="cierre-group">
                        <h4>Arqueo Físico de Caja</h4>
                        <div class="cierre-row"><span class="lbl">Efectivo Teórico:</span><span class="val">$${teorico.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span></div>
                        <div class="cierre-row"><span class="lbl">Efectivo Físico:</span><span class="val">$${fisico.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span></div>
                        <div class="cierre-row"><span class="lbl">Diferencia:</span><span class="val ${diffClass}">$${diferencia.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span></div>
                        <div style="margin-top:0.75rem;">
                            <span class="lbl" style="font-size:0.75rem; color:var(--text-secondary); display:block; margin-bottom:0.25rem;">Notas:</span>
                            <p style="font-size:0.8rem; background:rgba(0,0,0,0.2); padding:0.5rem; border-radius:var(--radius-sm); border:1px solid var(--border-glass);">${cr.notes || cr.notas || 'Sin observaciones.'}</p>
                        </div>
                    </div>

                    <!-- Vales del Personal -->
                    <div class="cierre-group" style="grid-column: 1/-1;">
                        <h4>Detalle Vales de Empleados</h4>
                        ${valesHtml}
                    </div>

                    <!-- Resúmenes Principales -->
                    <div class="cierre-totals">
                        <div class="total-pill accent-pill">
                            <span class="lbl">Caja Neta Teórica</span>
                            <span class="val">$${cajaNeta.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div class="total-pill">
                            <span class="lbl">Efectivo Físico</span>
                            <span class="val">$${fisico.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div class="total-pill">
                            <span class="lbl">Diferencia Final</span>
                            <span class="val ${diffClass}">$${diferencia.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `<div class="danger text-center">Fallo al obtener detalle: ${data.error || 'Error desconocido'}</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div class="danger text-center">Error en la petición: ${e.message}</div>`;
    }
}

function setupClosureForm() {
    // Configurar buscador y filtros
    document.getElementById('cierres-search-input').addEventListener('input', renderClosuresTable);
    document.getElementById('cierres-filter-turno').addEventListener('change', renderClosuresTable);

    const modal = document.getElementById('modal-nuevo-cierre');
    const nuevoBtn = document.getElementById('btn-nuevo-cierre');
    const closeBtn = document.getElementById('close-nuevo-cierre');
    const cancelBtn = document.getElementById('btn-cancel-nuevo-cierre');
    const form = document.getElementById('form-nuevo-cierre');

    const modalDetail = document.getElementById('modal-cierre-detalle');
    const closeDetailBtn = document.getElementById('close-cierre-detail');

    nuevoBtn.addEventListener('click', () => {
        form.reset();
        document.getElementById('nc-fecha').valueAsDate = new Date();
        document.getElementById('nc-vales-container').innerHTML = `<div class="no-vales-msg text-muted">No se han registrado vales de personal para este cierre.</div>`;
        document.getElementById('nc-vales-total').value = 0;
        
        // Disparar recálculo de diferencia
        calcularDiferenciaWizard();
        modal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
    closeDetailBtn.addEventListener('click', () => modalDetail.classList.remove('active'));

    // Calcular diferencia en tiempo real
    const teoricoInput = document.getElementById('nc-efectivo-teorico');
    const fisicoInput = document.getElementById('nc-efectivo-fisico');
    
    const recalculateFields = [teoricoInput, fisicoInput];
    recalculateFields.forEach(input => {
        input.addEventListener('input', calcularDiferenciaWizard);
    });

    // Agregar vale dinámico al wizard
    const btnAgregarVale = document.getElementById('btn-nc-agregar-vale');
    btnAgregarVale.addEventListener('click', agregarValeFilaWizard);

    // Guardar Cierre Z
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const origText = submitBtn.innerText;
        submitBtn.innerText = 'Subiendo a GitHub...';
        submitBtn.disabled = true;

        const fecha_jornada = document.getElementById('nc-fecha').value;
        const turno = document.getElementById('nc-turno').value;
        const responsable_caja = document.getElementById('nc-responsable').value.trim();

        // Datos Sistema
        const ventas_totales = parseFloat(document.getElementById('nc-ventas').value) || 0;
        const efectivo_teorico = parseFloat(document.getElementById('nc-efectivo-teorico').value) || 0;
        const tarjeta_debito = parseFloat(document.getElementById('nc-tarjeta-deb').value) || 0;
        const tarjeta_credito = parseFloat(document.getElementById('nc-tarjeta-cred').value) || 0;
        const qr_digital = parseFloat(document.getElementById('nc-qr').value) || 0;
        const gastos = parseFloat(document.getElementById('nc-gastos').value) || 0;
        const vales_deducidos = parseFloat(document.getElementById('nc-vales-total').value) || 0;
        
        const caja_neta_teorica = ventas_totales - tarjeta_debito - tarjeta_credito - qr_digital - gastos - vales_deducidos;

        // Conteo Real
        const efectivo_fisico = parseFloat(document.getElementById('nc-efectivo-fisico').value) || 0;
        const diferencia = efectivo_fisico - efectivo_teorico;
        const notas = document.getElementById('nc-notas').value.trim();

        // Vales de personal detallados
        const vales_detallados = [];
        const valeFilas = document.querySelectorAll('.vale-item-form');
        
        valeFilas.forEach(row => {
            const selectEmp = row.querySelector('.wizard-vale-emp');
            const inputMonto = row.querySelector('.wizard-vale-monto');
            const inputDetalle = row.querySelector('.wizard-vale-detalle');

            const empId = selectEmp.value;
            const empNombre = selectEmp.options[selectEmp.selectedIndex].text;
            const monto = parseFloat(inputMonto.value) || 0;
            const detalle = inputDetalle.value.trim() || 'Vale de Personal';

            if (empId && monto > 0) {
                vales_detallados.push({
                    id: `val-cie-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                    tipo: 'vale',
                    detalle,
                    monto,
                    fecha: new Date(fecha_jornada + 'T22:00:00Z').toISOString(),
                    empleadoId: empId,
                    empleadoNombre: empNombre
                });
            }
        });

        const payload = {
            id: `cie-${Date.now()}`,
            fecha_jornada,
            turno,
            responsable_caja,
            datos_sistema: {
                ventas_totales,
                efectivo_teorico,
                tarjeta_debito,
                tarjeta_credito,
                qr_digital,
                gastos,
                vales_deducidos,
                caja_neta_teorica
            },
            conteo_real: {
                efectivo_fisico,
                diferencia,
                notas
            },
            vales_detallados
        };

        try {
            const response = await fetch('/api/recepcion-cierres', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success) {
                alert('Cierre Z subido con éxito a GitHub y vales aplicados.');
                modal.classList.remove('active');
                await loadInitialData();
            } else {
                alert('Error al procesar cierre: ' + data.error + '\n\nDetalles: ' + JSON.stringify(data.detalles));
            }
        } catch (err) {
            alert('Error de red al enviar el cierre Z: ' + err.message);
        } finally {
            submitBtn.innerText = origText;
            submitBtn.disabled = false;
        }
    });
}

function calcularDiferenciaWizard() {
    const teorico = parseFloat(document.getElementById('nc-efectivo-teorico').value) || 0;
    const fisico = parseFloat(document.getElementById('nc-efectivo-fisico').value) || 0;
    const diff = fisico - teorico;
    
    const diffInput = document.getElementById('nc-diferencia');
    diffInput.value = diff.toFixed(2);
    
    if (diff < 0) {
        diffInput.className = 'input-readonly danger';
    } else if (diff > 0) {
        diffInput.className = 'input-readonly warning';
    } else {
        diffInput.className = 'input-readonly success';
    }
}

function agregarValeFilaWizard() {
    const container = document.getElementById('nc-vales-container');
    const msg = container.querySelector('.no-vales-msg');
    if (msg) msg.remove();

    if (state.employees.length === 0) {
        alert("Primero debe tener empleados registrados en el sistema.");
        return;
    }

    const row = document.createElement('div');
    row.className = 'vale-item-form';

    // Generar dropdown de empleados
    const optionsHtml = state.employees.map(emp => `<option value="${emp.id}">${emp.nombre}</option>`).join('');
    
    row.innerHTML = `
        <select class="wizard-vale-emp" required>
            <option value="" disabled selected>Elegir Empleado</option>
            ${optionsHtml}
        </select>
        <input type="number" class="wizard-vale-monto" placeholder="0.00" min="0.01" step="0.01" value="0.00" required>
        <input type="text" class="wizard-vale-detalle" placeholder="Concepto (ej. Almuerzo)">
        <button type="button" class="btn btn-danger btn-xs btn-nc-quitar-vale" style="padding: 0.2rem 0.4rem; height: 32px;">×</button>
    `;

    // Botón para eliminar esta fila
    row.querySelector('.btn-nc-quitar-vale').addEventListener('click', () => {
        row.remove();
        if (container.querySelectorAll('.vale-item-form').length === 0) {
            container.innerHTML = `<div class="no-vales-msg text-muted">No se han registrado vales de personal para este cierre.</div>`;
        }
        recalcularTotalValesWizard();
    });

    // Cambiar input de monto recalculador
    row.querySelector('.wizard-vale-monto').addEventListener('input', recalcularTotalValesWizard);

    container.appendChild(row);
}

function recalcularTotalValesWizard() {
    let total = 0;
    document.querySelectorAll('.wizard-vale-monto').forEach(input => {
        total += parseFloat(input.value) || 0;
    });

    document.getElementById('nc-vales-total').value = total.toFixed(2);
}

// ----------------------------------------------------
// CONSOLIDACION DIARIA
// ----------------------------------------------------
const closeConsolidadoBtn = document.getElementById('close-consolidado');
if (closeConsolidadoBtn) {
    closeConsolidadoBtn.addEventListener('click', () => {
        const mod = document.getElementById('modal-consolidado');
        if (mod) mod.classList.remove('active');
    });
}

async function consolidarDia(dateStr) {
    if (!dateStr || dateStr === '-') return alert('Fecha inválida.');
    const [year, month, day] = dateStr.split('-');
    const dayStr = 'dia-' + day;
    
    // Encontrar cierres que coincidan con el año/mes/dia
    const targetClosures = state.closures.filter(c => c.path.includes('/' + year + '/' + month + '/' + dayStr + '-'));
    
    if (targetClosures.length === 0) {
        return alert('No hay cierres para este día.');
    }

    const modal = document.getElementById('modal-consolidado');
    const container = document.getElementById('consolidado-content');
    const title = document.getElementById('consolidado-title');
    
    title.innerText = 'Reporte Consolidado del Día: ' + dateStr;
    container.innerHTML = '<div class="text-center" style="padding:2rem;">Cargando cierres... <div class="spinner"></div></div>';
    modal.classList.add('active');

    try {
        let totalVentas = 0;
        let totalTeorico = 0;
        let totalDebito = 0;
        let totalCredito = 0;
        let totalQr = 0;
        let totalGastos = 0;
        let totalValesDeducidos = 0;
        let totalCajaNeta = 0;
        let totalFisico = 0;
        let totalDiferencia = 0;
        let allVales = [];
        
        let reportesLeidos = 0;

        for (const c of targetClosures) {
            const res = await fetch('/api/cierres/detalle?path=' + encodeURIComponent(c.path));
            const data = await res.json();
            if (data.success && data.data) {
                const cierre = data.data;
                const ds = cierre.datos_sistema || {};
                const cr = cierre.conteo_real || {};
                const vales = cierre.vales_detallados || [];

                totalVentas += parseFloat(ds.ventas_totales || 0);
                totalTeorico += parseFloat(ds.efectivo_teorico || 0);
                totalDebito += parseFloat(ds.tarjeta_debito || 0);
                totalCredito += parseFloat(ds.tarjeta_credito || 0);
                totalQr += parseFloat(ds.qr_digital || 0);
                totalGastos += parseFloat(ds.gastos || 0);
                totalValesDeducidos += parseFloat(ds.vales_deducidos || 0);
                totalCajaNeta += parseFloat(ds.caja_neta_teorica || 0);
                totalFisico += parseFloat(cr.efectivo_fisico || 0);
                totalDiferencia += parseFloat(cr.diferencia || 0);
                
                vales.forEach(v => {
                    v.turno = cierre.turno || '?';
                    allVales.push(v);
                });
                
                reportesLeidos++;
            }
        }
        
        if (reportesLeidos === 0) {
            container.innerHTML = '<div class="danger text-center">No se pudo leer el contenido de los cierres.</div>';
            return;
        }

        let diffClass = 'text-muted';
        if (totalDiferencia < 0) diffClass = 'danger';
        else if (totalDiferencia > 0) diffClass = 'warning';

        let valesHtml = '';
        if (allVales.length === 0) {
            valesHtml = '<p class="text-muted text-center" style="font-size: 0.85rem; padding: 1rem 0;">No se registraron vales en este día.</p>';
        } else {
            valesHtml = '<div class="table-container"><table><thead><tr><th>Turno</th><th>Empleado</th><th>Detalle</th><th>Importe</th></tr></thead><tbody>' + 
                allVales.map(v => '<tr><td><span class="badge">' + v.turno.toUpperCase() + '</span></td><td><strong>' + v.empleadoNombre + '</strong></td><td>' + v.detalle + '</td><td class="danger">$' + parseFloat(v.monto).toLocaleString('es-AR', {minimumFractionDigits: 2}) + '</td></tr>').join('') + 
                '</tbody></table></div>';
        }

        container.innerHTML = '<div class="cierre-details-view">' +
                '<div class="cierre-group" style="grid-column: 1/-1;">' +
                '<h4>Planilla Resumen Consolidada (' + reportesLeidos + ' cierres)</h4>' +
                '<div class="form-row">' +
                '<div class="cierre-row"><span class="lbl">Fecha:</span><span class="val"><strong>' + dateStr + '</strong></span></div>' +
                '<div class="cierre-row"><span class="lbl">Turno:</span><span class="val"><span class="badge">CONSOLIDADO</span></span></div>' +
                '</div>' +
                '<hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">' +
                '<div class="cierre-row"><span class="lbl">Total de Venta:</span><span class="val">$' + totalVentas.toLocaleString('es-AR', {minimumFractionDigits: 2}) + '</span></div>' +
                '<div class="cierre-row"><span class="lbl">Débito:</span><span class="val">$' + totalDebito.toLocaleString('es-AR', {minimumFractionDigits: 2}) + '</span></div>' +
                '<div class="cierre-row"><span class="lbl">Crédito:</span><span class="val">$' + totalCredito.toLocaleString('es-AR', {minimumFractionDigits: 2}) + '</span></div>' +
                '<div class="cierre-row"><span class="lbl">QR / MercadoPago:</span><span class="val">$' + totalQr.toLocaleString('es-AR', {minimumFractionDigits: 2}) + '</span></div>' +
                '<div class="cierre-row"><span class="lbl">Vales Totales:</span><span class="val danger">$' + totalValesDeducidos.toLocaleString('es-AR', {minimumFractionDigits: 2}) + '</span></div>' +
                '<div class="cierre-row"><span class="lbl">Gastos Totales:</span><span class="val danger">$' + totalGastos.toLocaleString('es-AR', {minimumFractionDigits: 2}) + '</span></div>' +
                '<div class="cierre-row" style="background: rgba(46, 204, 113, 0.15); padding: 12px; border-radius: 8px; margin-top: 12px; border: 1px solid rgba(46, 204, 113, 0.3);">' +
                '<span class="lbl" style="font-weight: bold; color: #2ecc71; font-size: 1.1rem;">TOTAL EN EFECTIVO (Venta - Tarjetas - QR):</span>' +
                '<span class="val" style="font-weight: bold; color: #2ecc71; font-size: 1.3rem;">$' + (totalVentas - totalDebito - totalCredito - totalQr).toLocaleString('es-AR', {minimumFractionDigits: 2}) + '</span>' +
                '</div></div>' +
                '<div class="cierre-group" style="grid-column: 1/-1;"><h4>Detalle de Todos los Vales del Día</h4>' + valesHtml + '</div>' +
                '<div class="cierre-totals">' +
                '<div class="total-pill accent-pill"><span class="lbl">Caja Neta Teórica Día</span><span class="val">$' + totalCajaNeta.toLocaleString('es-AR', {minimumFractionDigits: 2}) + '</span></div>' +
                '<div class="total-pill"><span class="lbl">Efectivo Físico Total</span><span class="val">$' + totalFisico.toLocaleString('es-AR', {minimumFractionDigits: 2}) + '</span></div>' +
                '<div class="total-pill"><span class="lbl">Diferencia Acumulada</span><span class="val ' + diffClass + '">$' + totalDiferencia.toLocaleString('es-AR', {minimumFractionDigits: 2}) + '</span></div>' +
                '</div></div>';

    } catch (e) {
        container.innerHTML = '<div class="danger text-center">Error al consolidar: ' + e.message + '</div>';
    }
}
