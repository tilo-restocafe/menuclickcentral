(function() {
    // Intercepta peticiones fetch para ejecución serverless (GitHub Pages, file:// o local)
    const isGitHubPages = window.location.hostname.endsWith('github.io');
    const isFileProtocol = window.location.protocol === 'file:';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // El interceptor se activa siempre para gestionar la conexión a GitHub en cualquier entorno (localhost, GitHub Pages o file://)
    const active = true;
    
    console.log("MenuClick Central: Ejecutando en modo serverless autónomo directo a GitHub.");

    // Obtener configuración desde localStorage
    const getConfig = () => {
        return {
            GITHUB_TOKEN: localStorage.getItem('central_github_token') || '',
            GITHUB_USER: localStorage.getItem('central_github_user') || '',
            GITHUB_REPO: localStorage.getItem('central_github_repo') || '',
            COMPROC_SUCURSAL_ID: localStorage.getItem('central_sucursal_id') || 'tilo-resto-cafe-01',
            PORT: '3001',
            hasToken: !!localStorage.getItem('central_github_token'),
            tokenMasked: localStorage.getItem('central_github_token') ? 
                `${localStorage.getItem('central_github_token').slice(0, 4)}...${localStorage.getItem('central_github_token').slice(-4)}` : ''
        };
    };

    // Guardar configuración en localStorage
    const saveConfig = (cfg) => {
        if (cfg.GITHUB_TOKEN !== undefined) localStorage.setItem('central_github_token', cfg.GITHUB_TOKEN);
        if (cfg.GITHUB_USER !== undefined) localStorage.setItem('central_github_user', cfg.GITHUB_USER);
        if (cfg.GITHUB_REPO !== undefined) localStorage.setItem('central_github_repo', cfg.GITHUB_REPO);
        if (cfg.COMPROC_SUCURSAL_ID !== undefined) localStorage.setItem('central_sucursal_id', cfg.COMPROC_SUCURSAL_ID);
    };

    // DATOS DEMO / SIMULACIÓN AUTOMÁTICA (disponibles para todas las peticiones)
    const DEMO_EMPLOYEES = [
        {
            id: 'emp-01',
            nombre: 'Sofía Cajera',
            cargo: 'Cajera Turno Mañana',
            sueldo_base_mensual: 650000,
            vales_acumulados_mes: 35000,
            saldo_actual_sueldo: 615000,
            historial_vales: [
                { id_vale: 'val-01', fecha: '2026-07-02', hora: '14:30:00', concepto: 'Adelanto compra supermercado', monto: 20000 },
                { id_vale: 'val-02', fecha: '2026-07-08', hora: '18:15:00', concepto: 'Adelanto fin de semana', monto: 15000 }
            ]
        },
        {
            id: 'emp-02',
            nombre: 'Marcos González',
            cargo: 'Jefe de Cocina / Chef',
            sueldo_base_mensual: 820000,
            vales_acumulados_mes: 50000,
            saldo_actual_sueldo: 770000,
            historial_vales: [
                { id_vale: 'val-03', fecha: '2026-07-05', hora: '12:00:00', concepto: 'Adelanto extraordinario', monto: 50000 }
            ]
        },
        {
            id: 'emp-03',
            nombre: 'Valentina Ríos',
            cargo: 'Moza Salón Principal',
            sueldo_base_mensual: 540000,
            vales_acumulados_mes: 15000,
            saldo_actual_sueldo: 525000,
            historial_vales: [
                { id_vale: 'val-04', fecha: '2026-07-10', hora: '21:00:00', concepto: 'Taxi regreso turno noche', monto: 15000 }
            ]
        },
        {
            id: 'emp-04',
            nombre: 'Lucas Benítez',
            cargo: 'Bartender / Barra',
            sueldo_base_mensual: 580000,
            vales_acumulados_mes: 0,
            saldo_actual_sueldo: 580000,
            historial_vales: []
        },
        {
            id: 'emp-05',
            nombre: 'Camila Duarte',
            cargo: 'Barista / Cafetería',
            sueldo_base_mensual: 560000,
            vales_acumulados_mes: 45000,
            saldo_actual_sueldo: 515000,
            historial_vales: [
                { id_vale: 'val-05', fecha: '2026-07-04', hora: '19:30:00', concepto: 'Adelanto quincena', monto: 45000 }
            ]
        }
    ];

    const DEMO_CLOSURES_LIST = [
        { path: "cierres/2026/07/dia-12-Noche.json", sha: "demo-sha-1", size: 1200 },
        { path: "cierres/2026/07/dia-12-Mañana.json", sha: "demo-sha-2", size: 1100 },
        { path: "cierres/2026/07/dia-11-Noche.json", sha: "demo-sha-3", size: 1300 },
        { path: "cierres/2026/07/dia-11-Mañana.json", sha: "demo-sha-4", size: 1150 }
    ];

    const DEMO_CLOSURES_DATA = {
        "cierres/2026/07/dia-12-Noche.json": {
            id: "cie-demo-01",
            fecha_jornada: "2026-07-12",
            turno: "Noche",
            responsable_caja: "Sofía Cajera",
            datos_sistema: {
                ventas_totales: 485000,
                efectivo_teorico: 310000,
                tarjeta_debito: 100000,
                tarjeta_credito: 60000,
                qr_digital: 15000,
                gastos: 0,
                vales_deducidos: 15000,
                caja_neta_teorica: 295000
            },
            conteo_real: {
                efectivo_fisico: 295000,
                diferencia: 0,
                notas: "Caja cuadrada en turno noche."
            },
            vales_detallados: [
                { id: "val-04", tipo: "vale", detalle: "Taxi regreso turno noche", monto: 15000, empleadoId: "emp-03", empleadoNombre: "Valentina Ríos" }
            ]
        },
        "cierres/2026/07/dia-12-Mañana.json": {
            id: "cie-demo-02",
            fecha_jornada: "2026-07-12",
            turno: "Mañana",
            responsable_caja: "Sofía Cajera",
            datos_sistema: {
                ventas_totales: 320000,
                efectivo_teorico: 200000,
                tarjeta_debito: 80000,
                tarjeta_credito: 40000,
                qr_digital: 0,
                gastos: 0,
                vales_deducidos: 0,
                caja_neta_teorica: 200000
            },
            conteo_real: {
                efectivo_fisico: 200000,
                diferencia: 0,
                notas: "Turno mañana perfecto."
            },
            vales_detallados: []
        }
    };

    // Auxiliar: Petición a la API de GitHub utilizando fetch nativo
    async function githubRequest(method, urlPath, bodyContent = null) {
        const config = getConfig();
        const token = config.GITHUB_TOKEN;
        const user = config.GITHUB_USER;
        const repo = config.GITHUB_REPO;

        if (!token || !user || !repo) {
            throw new Error("Faltan configurar las credenciales de GitHub en la pestaña de Configuración.");
        }

        const encodedPath = encodeURI(urlPath);
        const url = encodedPath.startsWith('http') || encodedPath.startsWith('/') ? 
            (encodedPath.startsWith('/') ? `https://api.github.com${encodedPath}` : encodedPath) : 
            `https://api.github.com/repos/${user}/${repo}/contents/${encodedPath}`;

        const headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        };

        const options = {
            method: method,
            headers: headers,
            cache: 'no-store'
        };

        if (bodyContent) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(bodyContent);
        }

        const res = await window.originalFetch(url, options);
        let body = null;
        if (res.status !== 204) {
            try { body = await res.json(); } catch(e) {}
        }
        return { ok: res.ok, status: res.status, body: body };
    }

    // Guardar fetch original solo si no se ha guardado previamente
    if (!window.originalFetch) {
        window.originalFetch = window.fetch.bind(window);
    }

    // Sobreescribir fetch global
    window.fetch = async function(url, options = {}) {
        const urlStr = typeof url === 'string' ? url : url.url || '';
        
        // 1. GET /api/config-status
        if (urlStr.includes('/api/config-status')) {
            const config = getConfig();
            return new Response(JSON.stringify(config), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        
        // 2. POST /api/config-save
        if (urlStr.includes('/api/config-save')) {
            try {
                const body = JSON.parse(options.body);
                saveConfig(body);
                return new Response(JSON.stringify({ success: true, message: "Configuración guardada en el navegador correctamente." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: err.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
        }
        
        // 3. GET / POST /api/test-github
        if (urlStr.includes('/api/test-github')) {
            let config = getConfig();
            if (options.body) {
                try {
                    const customCfg = JSON.parse(options.body);
                    if (customCfg.GITHUB_USER) config.GITHUB_USER = customCfg.GITHUB_USER;
                    if (customCfg.GITHUB_REPO) config.GITHUB_REPO = customCfg.GITHUB_REPO;
                    if (customCfg.GITHUB_TOKEN && customCfg.GITHUB_TOKEN !== '••••••••••••••••') {
                        config.GITHUB_TOKEN = customCfg.GITHUB_TOKEN;
                    }
                } catch(e) {}
            }

            try {
                if (!config.GITHUB_TOKEN || !config.GITHUB_USER || !config.GITHUB_REPO) {
                    return new Response(JSON.stringify({ success: false, error: "Faltan configurar Usuario, Repositorio o Token de GitHub." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                const url = `https://api.github.com/repos/${config.GITHUB_USER}/${config.GITHUB_REPO}`;
                const res = await window.originalFetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `token ${config.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                if (res.ok) {
                    return new Response(JSON.stringify({ success: true, message: "Conexión a GitHub exitosa y repositorio encontrado." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                } else {
                    let errBody = null;
                    try { errBody = await res.json(); } catch(e) {}
                    return new Response(JSON.stringify({ success: false, error: `GitHub devolvió un error de conexión (Status: ${res.status}).`, detalles: errBody }), { status: res.status || 400, headers: { 'Content-Type': 'application/json' } });
                }
            } catch(e) {
                return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }
        
        // 4. GET & POST /api/empleados
        if (urlStr.includes('/api/empleados')) {
            const method = options.method || 'GET';
            const config = getConfig();

            if (method === 'GET') {
                // Intentar GitHub si está configurado
                if (config.GITHUB_TOKEN && config.GITHUB_USER && config.GITHUB_REPO) {
                    try {
                        const result = await githubRequest('GET', 'empleados.json');
                        if (result.ok && result.body) {
                            const contentText = atob(result.body.content.replace(/\s/g, ''));
                            const decodedText = decodeURIComponent(escape(contentText));
                            let list = [];
                            try { list = JSON.parse(decodedText); } catch (e) { list = []; }
                            if (!Array.isArray(list) || list.length === 0) list = DEMO_EMPLOYEES;
                            localStorage.setItem('central_empleados_local', JSON.stringify(list));
                            return new Response(JSON.stringify({ success: true, sha: result.body.sha, empleados: list }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                        }
                    } catch(e) {}
                }

                // Fallback a almacenamiento local o datos simulados por defecto
                let localStr = localStorage.getItem('central_empleados_local');
                let list = localStr ? JSON.parse(localStr) : [];
                if (!Array.isArray(list) || list.length === 0) {
                    list = DEMO_EMPLOYEES;
                    localStorage.setItem('central_empleados_local', JSON.stringify(list));
                }
                return new Response(JSON.stringify({ success: true, sha: null, empleados: list }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } else if (method === 'POST') {
                const body = JSON.parse(options.body);
                const { empleados } = body;

                // Siempre guardar en local para asegurar funcionamiento inmediato
                localStorage.setItem('central_empleados_local', JSON.stringify(empleados || []));

                // Intentar sincronizar en GitHub si está conectado
                if (config.GITHUB_TOKEN && config.GITHUB_USER && config.GITHUB_REPO) {
                    try {
                        let sha = null;
                        const checkRes = await githubRequest('GET', 'empleados.json');
                        if (checkRes.ok && checkRes.body) {
                            sha = checkRes.body.sha;
                        }
                        const textContent = JSON.stringify(empleados, null, 2);
                        const base64Content = btoa(unescape(encodeURIComponent(textContent)));
                        const payload = {
                            message: `👥 MenuClick Central: Actualización del padrón de empleados desde Panel Web`,
                            content: base64Content
                        };
                        if (sha) payload.sha = sha;
                        await githubRequest('PUT', 'empleados.json', payload);
                    } catch(e) {}
                }

                return new Response(JSON.stringify({ success: true, message: "Lista de empleados actualizada correctamente." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
        }
        
        // 5. GET /api/cierres/detalle
        if (urlStr.includes('/api/cierres/detalle')) {
            const urlObj = new URL(urlStr, window.location.origin);
            const filePath = urlObj.searchParams.get('path');
            const config = getConfig();

            if (config.GITHUB_TOKEN && config.GITHUB_USER && config.GITHUB_REPO) {
                try {
                    const result = await githubRequest('GET', filePath);
                    if (result.ok && result.body) {
                        const contentText = atob(result.body.content.replace(/\s/g, ''));
                        const decodedText = decodeURIComponent(escape(contentText));
                        let data = null;
                        try { data = JSON.parse(decodedText); } catch(e) { data = decodedText; }
                        return new Response(JSON.stringify({ success: true, path: filePath, sha: result.body.sha, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                    }
                } catch(e) {}
            }

            // Fallback a local/demo
            const localCierre = localStorage.getItem('central_cierre_' + filePath);
            const data = localCierre ? JSON.parse(localCierre) : (DEMO_CLOSURES_DATA[filePath] || DEMO_CLOSURES_DATA["cierres/2026/07/dia-12-Noche.json"]);
            return new Response(JSON.stringify({ success: true, path: filePath, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        
        // 6. GET /api/cierres
        if (urlStr.includes('/api/cierres')) {
            const config = getConfig();
            if (config.GITHUB_TOKEN && config.GITHUB_USER && config.GITHUB_REPO) {
                try {
                    let branch = 'main';
                    const repoInfo = await githubRequest('GET', `/repos/${config.GITHUB_USER}/${config.GITHUB_REPO}`);
                    if (repoInfo.ok && repoInfo.body && repoInfo.body.default_branch) {
                        branch = repoInfo.body.default_branch;
                    }
                    const treeRes = await githubRequest('GET', `/repos/${config.GITHUB_USER}/${config.GITHUB_REPO}/git/trees/${branch}?recursive=1`);
                    if (treeRes.ok && treeRes.body && Array.isArray(treeRes.body.tree)) {
                        const closures = treeRes.body.tree
                            .filter(file => file.path.startsWith('cierres/') && file.path.endsWith('.json') && file.type === 'blob')
                            .map(file => ({
                                path: file.path,
                                sha: file.sha,
                                size: file.size
                            }));
                        return new Response(JSON.stringify({ success: true, closures }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                    }
                } catch(e) {}
            }

            // Fallback a cierres locales/demo
            let localClosures = localStorage.getItem('central_cierres_list');
            let closures = localClosures ? JSON.parse(localClosures) : [];
            if (!Array.isArray(closures) || closures.length === 0) {
                closures = DEMO_CLOSURES_LIST;
                localStorage.setItem('central_cierres_list', JSON.stringify(closures));
            }
            return new Response(JSON.stringify({ success: true, closures }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        
        // 7. POST /api/recepcion-cierres
        if (urlStr.includes('/api/recepcion-cierres')) {
            const body = JSON.parse(options.body);
            const datosCierre = body;
            
            if (!datosCierre || !datosCierre.fecha_jornada || !datosCierre.turno) {
                return new Response(JSON.stringify({ error: "Datos de cierre incompletos. Se requiere fecha_jornada y turno." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            
            const { fecha_jornada, turno } = datosCierre;
            const parts = fecha_jornada.split('-');
            const ano = parts[0], mes = parts[1], dia = parts[2];
            const pathCierre = `cierres/${ano}/${mes}/dia-${dia}-${turno}.json`;
            
            // Guardar localmente siempre
            localStorage.setItem('central_cierre_' + pathCierre, JSON.stringify(datosCierre));
            let closures = [];
            try { closures = JSON.parse(localStorage.getItem('central_cierres_list') || '[]'); } catch(e) {}
            if (!closures.some(c => c.path === pathCierre)) {
                closures.unshift({ path: pathCierre, sha: 'local-' + Date.now(), size: 1200 });
                localStorage.setItem('central_cierres_list', JSON.stringify(closures));
            }

            const logMensajes = [`✔️ Informe Z registrado exitosamente: ${pathCierre}`];

            return new Response(JSON.stringify({
                success: true,
                mensaje: "Cierre Z registrado correctamente.",
                path_cierre: pathCierre,
                bitacora: logMensajes
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 8. POST /api/simular-demo
        if (urlStr.includes('/api/simular-demo')) {
            localStorage.setItem('central_empleados_local', JSON.stringify(DEMO_EMPLOYEES));
            localStorage.setItem('central_cierres_list', JSON.stringify(DEMO_CLOSURES_LIST));
            return new Response(JSON.stringify({ success: true, message: "¡Datos de empleados, ventas y vales simulados cargados exitosamente!" }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return window.originalFetch(url, options);
    };
})();
