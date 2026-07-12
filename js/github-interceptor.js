(function() {
    // Intercepta peticiones fetch para ejecución serverless (GitHub Pages, file:// o local)
    const isGitHubPages = window.location.hostname.endsWith('github.io');
    const isFileProtocol = window.location.protocol === 'file:';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // El interceptor se activa automáticamente en GitHub Pages, protocolo file://
    // o si el usuario fuerza el modo serverless mediante query params (?serverless=true)
    const active = isGitHubPages || isFileProtocol || window.location.search.includes('serverless=true') || !isLocalhost;
    
    if (!active) {
        console.log("MenuClick Central: Ejecutando en modo servidor Node.js local.");
        return;
    }
    
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

    // Guardar fetch original
    window.originalFetch = window.fetch.bind(window);

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
        
        // 3. GET /api/test-github
        if (urlStr.includes('/api/test-github')) {
            const config = getConfig();
            try {
                const res = await githubRequest('GET', `/repos/${config.GITHUB_USER}/${config.GITHUB_REPO}`);
                if (res.ok) {
                    return new Response(JSON.stringify({ success: true, message: "Conexión a GitHub exitosa y repositorio encontrado." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                } else {
                    return new Response(JSON.stringify({ success: false, error: "GitHub devolvió un error de conexión.", detalles: res.body }), { status: res.status || 400, headers: { 'Content-Type': 'application/json' } });
                }
            } catch(e) {
                return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }
        
        // 4. GET & POST /api/empleados
        if (urlStr.includes('/api/empleados')) {
            const method = options.method || 'GET';
            try {
                if (method === 'GET') {
                    const result = await githubRequest('GET', 'empleados.json');
                    if (result.ok && result.body) {
                        const contentText = atob(result.body.content.replace(/\s/g, ''));
                        const decodedText = decodeURIComponent(escape(contentText));
                        let list = [];
                        try { list = JSON.parse(decodedText); } catch (e) { list = []; }
                        return new Response(JSON.stringify({ success: true, sha: result.body.sha, empleados: list }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                    } else if (result.status === 404) {
                        return new Response(JSON.stringify({ success: true, sha: null, empleados: [], message: "El archivo empleados.json no existe en el repositorio." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                    } else {
                        return new Response(JSON.stringify({ error: "Error al traer empleados desde GitHub.", detalles: result.body }), { status: result.status, headers: { 'Content-Type': 'application/json' } });
                    }
                } else if (method === 'POST') {
                    const body = JSON.parse(options.body);
                    const { empleados } = body;
                    
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
                    
                    const writeRes = await githubRequest('PUT', 'empleados.json', payload);
                    if (writeRes.ok) {
                        return new Response(JSON.stringify({ success: true, message: "Lista de empleados actualizada en GitHub correctamente." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                    } else {
                        return new Response(JSON.stringify({ error: "Error al guardar empleados en GitHub.", detalles: writeRes.body }), { status: writeRes.status, headers: { 'Content-Type': 'application/json' } });
                    }
                }
            } catch(e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }
        
        // 5. GET /api/cierres/detalle
        if (urlStr.includes('/api/cierres/detalle')) {
            const urlObj = new URL(urlStr, window.location.origin);
            const filePath = urlObj.searchParams.get('path');
            try {
                const result = await githubRequest('GET', filePath);
                if (result.ok && result.body) {
                    const contentText = atob(result.body.content.replace(/\s/g, ''));
                    const decodedText = decodeURIComponent(escape(contentText));
                    let data = null;
                    try { data = JSON.parse(decodedText); } catch(e) { data = decodedText; }
                    return new Response(JSON.stringify({ success: true, path: filePath, sha: result.body.sha, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                } else {
                    return new Response(JSON.stringify({ error: `Error al obtener el cierre en la ruta: ${filePath}`, detalles: result.body }), { status: result.status, headers: { 'Content-Type': 'application/json' } });
                }
            } catch(e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }
        
        // 6. GET /api/cierres
        if (urlStr.includes('/api/cierres')) {
            try {
                let branch = 'main';
                const config = getConfig();
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
                } else {
                    return new Response(JSON.stringify({ error: "Error al listar cierres desde GitHub.", detalles: treeRes.body }), { status: treeRes.status, headers: { 'Content-Type': 'application/json' } });
                }
            } catch(e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }
        
        // 7. POST /api/recepcion-cierres
        if (urlStr.includes('/api/recepcion-cierres')) {
            try {
                const body = JSON.parse(options.body);
                const datosCierre = body;
                
                if (!datosCierre || !datosCierre.fecha_jornada || !datosCierre.turno) {
                    return new Response(JSON.stringify({ error: "Datos de cierre incompletos. Se requiere fecha_jornada y turno." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                const { fecha_jornada, turno } = datosCierre;
                const parts = fecha_jornada.split('-');
                const ano = parts[0], mes = parts[1], dia = parts[2];
                
                if (!ano || !mes || !dia) {
                    return new Response(JSON.stringify({ error: "Formato de fecha_jornada inválido. Debe ser YYYY-MM-DD." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                
                const pathCierre = `cierres/${ano}/${mes}/dia-${dia}-${turno}.json`;
                const logMensajes = [];
                
                // Subir Cierre a GitHub
                let shaCierre = null;
                const checkCierreRes = await githubRequest('GET', pathCierre);
                if (checkCierreRes.ok && checkCierreRes.body) {
                    shaCierre = checkCierreRes.body.sha;
                }
                
                const textoCierre = JSON.stringify(datosCierre, null, 2);
                const base64Cierre = btoa(unescape(encodeURIComponent(textoCierre)));
                
                const config = getConfig();
                const sucursalId = config.COMPROC_SUCURSAL_ID || '01';
                const paqueteCierre = {
                    message: `📊 MenuClick Central: Registro Cierre Z - Sucursal ${sucursalId} - ${fecha_jornada} ${turno}`,
                    content: base64Cierre
                };
                if (shaCierre) paqueteCierre.sha = shaCierre;
                
                const subidaCierreRes = await githubRequest('PUT', pathCierre, paqueteCierre);
                if (!subidaCierreRes.ok) {
                    return new Response(JSON.stringify({ error: "No se pudo subir el archivo de cierre a GitHub.", detalles: subidaCierreRes.body }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                }
                
                logMensajes.push(`✔️ Informe Z guardado correctamente en: ${pathCierre}`);
                
                // Descuento Automático de Vales
                const vales = datosCierre.vales_detallados || [];
                if (vales.length > 0) {
                    const checkEmpRes = await githubRequest('GET', 'empleados.json');
                    if (checkEmpRes.ok && checkEmpRes.body) {
                        const shaEmpleados = checkEmpRes.body.sha;
                        const textContent = atob(checkEmpRes.body.content.replace(/\s/g, ''));
                        const decodedText = decodeURIComponent(escape(textContent));
                        let empleadosList = [];
                        try { empleadosList = JSON.parse(decodedText); } catch(e) { empleadosList = []; }
                        
                        let empleadosModificados = 0;
                        for (const vale of vales) {
                            const montoVale = parseFloat(vale.monto || 0);
                            if (montoVale <= 0) continue;
                            
                            const empleado = empleadosList.find(e => 
                                (vale.empleadoId && String(e.id) === String(vale.empleadoId)) ||
                                (vale.empleadoNombre && e.nombre.toLowerCase().trim() === vale.empleadoNombre.toLowerCase().trim())
                            );
                            
                            if (empleado) {
                                if (empleado.sueldo_base_mensual === undefined) empleado.sueldo_base_mensual = 0.00;
                                if (empleado.vales_acumulados_mes === undefined) empleado.vales_acumulados_mes = 0.00;
                                if (empleado.historial_vales === undefined) empleado.historial_vales = [];
                                
                                const yaExisteVale = empleado.historial_vales.some(v => String(v.id_vale) === String(vale.id));
                                if (!yaExisteVale) {
                                    empleado.vales_acumulados_mes += montoVale;
                                    empleado.saldo_actual_sueldo = empleado.sueldo_base_mensual - empleado.vales_acumulados_mes;
                                    
                                    empleado.historial_vales.push({
                                        id_vale: vale.id,
                                        fecha: vale.fecha ? vale.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
                                        hora: vale.fecha ? new Date(vale.fecha).toLocaleTimeString('es-AR', { hour12: false }) : new Date().toLocaleTimeString('es-AR', { hour12: false }),
                                        concepto: vale.detalle || 'Vale de Personal',
                                        monto: montoVale,
                                        cierre_caja_origen_id: datosCierre.id || `cie-${Date.now()}`
                                    });
                                    empleadosModificados++;
                                }
                            }
                        }
                        
                        if (empleadosModificados > 0) {
                            const nuevoTextoEmp = JSON.stringify(empleadosList, null, 2);
                            const nuevoBase64Emp = btoa(unescape(encodeURIComponent(nuevoTextoEmp)));
                            const paqueteEmpleados = {
                                message: `👥 MenuClick Central: Descuento automático de vales - Cierre ${fecha_jornada} ${turno}`,
                                content: nuevoBase64Emp,
                                sha: shaEmpleados
                            };
                            const subidaEmpRes = await githubRequest('PUT', 'empleados.json', paqueteEmpleados);
                            if (subidaEmpRes.ok) {
                                logMensajes.push(`✔️ Se actualizaron los saldos de sueldo de ${empleadosModificados} empleado(s) en GitHub.`);
                            } else {
                                logMensajes.push(`⚠️ Se calcularon vales pero falló la actualización de empleados.json en GitHub.`);
                            }
                        } else {
                            logMensajes.push("ℹ️ No se requirieron modificaciones en empleados.json (los vales ya estaban registrados).");
                        }
                    } else {
                        logMensajes.push("⚠️ No se pudo descargar empleados.json de GitHub para registrar los vales.");
                    }
                } else {
                    logMensajes.push("ℹ️ Jornada sin vales registrados.");
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    mensaje: "Sincronización de Cierre Z exitosa.",
                    path_cierre: pathCierre,
                    bitacora: logMensajes
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } catch(e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }

        return window.originalFetch(url, options);
    };
})();
