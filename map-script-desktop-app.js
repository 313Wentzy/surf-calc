let userSingleDrops = [];
let userDropmaps = [];
let userRoles = [];

// Create a Promise for user data fetching
const userDataPromise = fetch('/wp-json/discord-auth/v1/user-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
})
    .then(r => r.ok ? r.json() : { user_single_drops: [], user_dropmaps: [], roles: [] })
    .then(userData => {
        userSingleDrops = userData.user_single_drops || [];
        userDropmaps = userData.user_dropmaps || [];
        userRoles = userData.roles || [];
    })
    .catch(err => {
        console.error('Failed to load user data:', err);
        userSingleDrops = [];
        userDropmaps = [];
        userRoles = [];
    });

(async () => {
    await refreshToken();
})();

// For refreshing user data on new refresh token calls.
async function refreshUserData() {
    const r = await fetch('/wp-json/discord-auth/v1/user-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
    const u = r.ok ? await r.json() : { user_single_drops: [], user_dropmaps: [], roles: [] };
    userSingleDrops = u.user_single_drops || [];
    userDropmaps = u.user_dropmaps || [];
    userRoles = u.roles || [];
}


let map = L.map('map', {
    crs: L.CRS.Simple,
    center: [-128, 128],
    zoom: 3,
    maxZoom: 7,
    minZoom: 1,
    attributionControl: false
});

// =============================================================================
// CONFIGURATION - Load from your leaflet_calibration.json
// =============================================================================

const LEAFLET_CALIBRATION = {
    leaflet_size: 3000,      // actually world size (0–3000)
    island_offset_x: 861.88, // world X where the island’s left edge starts
    island_offset_y: 835.42, // world Y where the island’s top edge starts
    island_width: 1548.52,   // island width in world units
    island_height: 1380.07   // island height in world units
};
// =============================================================================


// === COMPLETE DESKTOP AGENT SYSTEM ===

// Your map world size (matches Leaflet CRS.Simple setup)
const WORLD_SIZE = 3000;

// Global variables
let ws = null;
let wsReconnectInterval = null;
let currentJWT = null;
let wsConnected = false;
let agentConnected = false;
let tokenUpdateInterval = null;

// Server endpoints
const SERVER_API_URL = 'https://serverapi-4rtc.onrender.com';
const WS_URL = 'wss://serverapi-4rtc.onrender.com/agent';
const LOCAL_AGENT_URL = 'http://localhost:30123';

// Desktop Window System Variables
let agentWindow = null;
let desktopIcon = null;
let isDraggingIcon = false;
let isDraggingWindow = false;
let isResizingWindow = false;
let iconOffset = { x: 0, y: 0 };
let windowOffset = { x: 0, y: 0 };
let resizeStart = { width: 0, height: 0, x: 0, y: 0 };

// === Missing Function Definitions ===

// Launch Desktop App Function
async function launchDesktopApp() {
    showAuthModal();
}

// Show Auth Modal
function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.add('show');
    }
}

// Hide Auth Modal
function hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Confirm Launch App
async function confirmLaunchApp() {
    if (!currentJWT) {
        currentJWT = await refreshToken();
    }
    
    if (!currentJWT) {
        showNotification('Failed to get authentication token. Please log in.', 'error');
        hideAuthModal();
        return;
    }
    
    try {
        // Send token to local agent
        const response = await fetch(`${LOCAL_AGENT_URL}/auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            mode: 'cors',
            body: JSON.stringify({ token: currentJWT })
        });
        
        if (response.ok) {
            log('AGENT', 'Authentication token sent to desktop app');
            showNotification('Desktop agent authenticated. It should connect shortly.', 'success');
            hideAuthModal();
            
            // Check connection status after a moment
            setTimeout(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping' }));
                }
            }, 2000);
        } else {
            throw new Error('Failed to send token to desktop app');
        }
    } catch (error) {
        log('AGENT', `Error launching app: ${error.message}`, 'err');
        showNotification('Could not connect to desktop app. Make sure it is running.', 'error');
        hideAuthModal();
    }
}

// Token Update Interval Function
function startTokenUpdateInterval() {
    // Clear any existing interval
    if (tokenUpdateInterval) {
        clearInterval(tokenUpdateInterval);
    }
    
    // Set up periodic token updates (every 10 minutes)
    tokenUpdateInterval = setInterval(async () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            const newToken = await refreshToken();
            if (newToken) {
                ws.send(JSON.stringify({
                    type: 'token:update',
                    token: newToken
                }));
                log('AUTH', 'Token refreshed and sent to server');
            }
        }
    }, 10 * 60 * 1000); // 10 minutes
}

// Initialize Desktop System
function initDesktopSystem() {
    desktopIcon = document.getElementById('desktop-icon');
    agentWindow = document.getElementById('agent-window');
    
    if (!desktopIcon || !agentWindow) {
        console.error('Desktop icon or agent window not found');
        return;
    }
    
    // Set initial window position (center of screen)
    const windowWidth = 600;
    const windowHeight = 400;
    agentWindow.style.left = `${(window.innerWidth - windowWidth) / 2}px`;
    agentWindow.style.top = `${(window.innerHeight - windowHeight) / 2}px`;
    
    // Desktop Icon Click Handler
    desktopIcon.addEventListener('click', (e) => {
        if (!isDraggingIcon) {
            toggleAgentWindow();
        }
    });
    
    // Desktop Icon Drag
    desktopIcon.addEventListener('mousedown', startDragIcon);
    
    // Window Header Drag
    const windowHeader = agentWindow.querySelector('.window-header');
    if (windowHeader) {
        windowHeader.addEventListener('mousedown', startDragWindow);
    }
    
    // Window Resize
    const resizeHandle = agentWindow.querySelector('.window-resize-handle');
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', startResizeWindow);
    }
    
    // Window Close Button
    const closeBtn = document.getElementById('btnCloseWindow');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            agentWindow.style.display = 'none';
            showNotification('Agent window closed', 'info');
        });
    }
    
    // Global mouse handlers
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

// Toggle Agent Window
function toggleAgentWindow() {
    if (agentWindow.style.display === 'none' || !agentWindow.style.display) {
        agentWindow.style.display = 'flex';
        showNotification('Agent window opened', 'success');
        // Auto-connect if not connected
        if (!wsConnected) {
            connectWebSocket();
        }
    } else {
        agentWindow.style.display = 'none';
    }
}

// Desktop Icon Dragging
function startDragIcon(e) {
    if (e.target.closest('.desktop-icon')) {
        isDraggingIcon = true;
        const rect = desktopIcon.getBoundingClientRect();
        iconOffset.x = e.clientX - rect.left;
        iconOffset.y = e.clientY - rect.top;
        desktopIcon.classList.add('dragging');
        document.body.classList.add('no-select');
        e.preventDefault();
    }
}

// Window Dragging
function startDragWindow(e) {
    if (!e.target.closest('button') && !e.target.closest('.status-indicator')) {
        isDraggingWindow = true;
        const rect = agentWindow.getBoundingClientRect();
        windowOffset.x = e.clientX - rect.left;
        windowOffset.y = e.clientY - rect.top;
        document.body.classList.add('no-select');
        e.preventDefault();
    }
}

// Window Resizing
function startResizeWindow(e) {
    isResizingWindow = true;
    const rect = agentWindow.getBoundingClientRect();
    resizeStart.width = rect.width;
    resizeStart.height = rect.height;
    resizeStart.x = e.clientX;
    resizeStart.y = e.clientY;
    document.body.classList.add('no-select');
    e.preventDefault();
}

// Handle Mouse Move
function handleMouseMove(e) {
    if (isDraggingIcon) {
        const x = e.clientX - iconOffset.x;
        const y = e.clientY - iconOffset.y;
        
        const maxX = window.innerWidth - desktopIcon.offsetWidth;
        const maxY = window.innerHeight - desktopIcon.offsetHeight;
        const minY = 60;
        
        const finalX = Math.max(0, Math.min(x, maxX));
        const finalY = Math.max(minY, Math.min(y, maxY));
        
        desktopIcon.style.left = `${finalX}px`;
        desktopIcon.style.bottom = 'auto';
        desktopIcon.style.top = `${finalY}px`;
    }
    
    if (isDraggingWindow) {
        const x = e.clientX - windowOffset.x;
        const y = e.clientY - windowOffset.y;
        
        const maxX = window.innerWidth - agentWindow.offsetWidth;
        const maxY = window.innerHeight - agentWindow.offsetHeight;
        const minY = 60;
        
        const finalX = Math.max(0, Math.min(x, maxX));
        const finalY = Math.max(minY, Math.min(y, maxY));
        
        agentWindow.style.left = `${finalX}px`;
        agentWindow.style.top = `${finalY}px`;
    }
    
    if (isResizingWindow) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        const newWidth = Math.max(500, resizeStart.width + deltaX);
        const newHeight = Math.max(300, resizeStart.height + deltaY);
        
        agentWindow.style.width = `${newWidth}px`;
        agentWindow.style.height = `${newHeight}px`;
    }
}

// Handle Mouse Up
function handleMouseUp() {
    if (isDraggingIcon) {
        isDraggingIcon = false;
        desktopIcon.classList.remove('dragging');
        document.body.classList.remove('no-select');
        setTimeout(() => { isDraggingIcon = false; }, 100);
    }
    
    if (isDraggingWindow) {
        isDraggingWindow = false;
        document.body.classList.remove('no-select');
    }
    
    if (isResizingWindow) {
        isResizingWindow = false;
        document.body.classList.remove('no-select');
    }
}

// Notification System
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 4000);
}

// Helper functions for leaflet coordinate conversion

function pixelCoordsToLeafletNew(pixel, imageWidth, imageHeight, mapBounds = null) {
    if (!pixel || imageWidth <= 0 || imageHeight <= 0) {
        console.warn('pixelCoordsToLeafletNew: invalid inputs', pixel, imageWidth, imageHeight);
        return null;
    }

    const bounds = mapBounds || estimateMapBounds(imageWidth, imageHeight);

    const normX = (pixel.x - bounds.x) / bounds.width;
    const normY = (pixel.y - bounds.y) / bounds.height;

    // screenshot → normalized → world → Leaflet
    const { wx, wy } = normalizedToWorld(normX, normY);
    return worldToLeaflet(wx, wy);   // ← uses your existing 0–3000 → lat/lng mapping
}


function placeBusRouteFromAnalysis(startCoords, endCoords, analysisData) {
    if (markers.length >= 2) {
        resetMarkers(false);
        if (solidLine) { solidLine.remove(); solidLine = null; }
        if (solidLine2) { solidLine2.remove(); solidLine2 = null; }
        if (dashedLine) { dashedLine.remove(); dashedLine = null; }
        
        markers.forEach(m => {
            if (m.options.icon === BusIcon) map.removeLayer(m);
        });
        markers = [];
    }
    
    const startMarker = L.marker([startCoords.lat, startCoords.lng], {
        icon: BusIcon,
        draggable: true
    }).addTo(map).setZIndexOffset(1000);
    
    startMarker.on('dragstart', () => {
        isDragging = true;
        resetMarkers(false);
        if (solidLine) { solidLine.remove(); solidLine = null; }
        if (solidLine2) { solidLine2.remove(); solidLine2 = null; }
        if (dashedLine) { dashedLine.remove(); dashedLine = null; }
    });
    startMarker.on('dragend', () => {
        setTimeout(() => { isDragging = false; }, 50);
        debouncedUpdatePattern();
        if (!solveButton.disabled) solveButton.click();
    });
    startMarker.on('drag', () => { updateLine(); updatePattern(); });
    
    markers.push(startMarker);
    
    const endMarker = L.marker([endCoords.lat, endCoords.lng], {
        icon: BusIcon,
        draggable: true
    }).addTo(map).setZIndexOffset(1000);
    
    endMarker.on('dragstart', () => {
        isDragging = true;
        resetMarkers(false);
        if (solidLine) { solidLine.remove(); solidLine = null; }
        if (solidLine2) { solidLine2.remove(); solidLine2 = null; }
        if (dashedLine) { dashedLine.remove(); dashedLine = null; }
    });
    endMarker.on('dragend', () => {
        setTimeout(() => { isDragging = false; }, 50);
        debouncedUpdatePattern();
        if (!solveButton.disabled) solveButton.click();
    });
    endMarker.on('drag', () => { updateLine(); updatePattern(); });
    
    markers.push(endMarker);
    
    if (markers.length > 1) {
        drawLineWithPattern();
        requestAnimationFrame(animateMarkers);
    }
    
    map.fitBounds([
        [startCoords.lat, startCoords.lng],
        [endCoords.lat, endCoords.lng]
    ], { padding: [50, 50] });
    
    document.querySelector('.calculate-button').classList.add('pulse');
    
    if (destinationMarkers.length === currentSelection) {
        setTimeout(() => {
            if (!solveButton.disabled) solveButton.click();
        }, 500);
    }
    
    log('MAP', `Bus route placed: (${startCoords.lat.toFixed(2)}, ${startCoords.lng.toFixed(2)}) → (${endCoords.lat.toFixed(2)}, ${endCoords.lng.toFixed(2)})`);
}

// WebSocket Connection Management
function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        return;
    }

    log('WS', 'Connecting to server...');
    updateWSStatus('connecting');
    
    ws = new WebSocket(WS_URL);
    
    ws.onopen = async () => {
        log('WS', 'Connected to server');
        wsConnected = true;
        updateWSStatus('connected');
        
        if (wsReconnectInterval) {
            clearInterval(wsReconnectInterval);
            wsReconnectInterval = null;
        }
        
        if (!currentJWT) {
            currentJWT = await refreshToken();
        }
        
        if (currentJWT) {
            const helloMsg = {
                type: 'hello',
                token: currentJWT,
                role: 'page',
                version: '1.0.0'
            };
            ws.send(JSON.stringify(helloMsg));
            log('AUTH', 'Sent authentication');
        }
        
        startTokenUpdateInterval();
    };
    
    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleWebSocketMessage(msg);
        } catch (e) {
            log('WS', `Parse error: ${e.message}`, 'err');
        }
    };
    
    ws.onerror = (error) => {
        log('WS', 'Connection error', 'err');
        wsConnected = false;
        updateWSStatus('error');
    };
    
    ws.onclose = () => {
        log('WS', 'Disconnected from server');
        wsConnected = false;
        agentConnected = false;
        updateWSStatus('disconnected');
        updateAgentStatus(false);
        
        if (!wsReconnectInterval) {
            wsReconnectInterval = setInterval(() => {
                log('WS', 'Reconnecting...');
                connectWebSocket();
            }, 5000);
        }
    };
}

// =============================================================================
// COORDINATE TRANSFORMATION FUNCTIONS
// =============================================================================

/**
 * Detect approximate map bounds from screenshot dimensions.
 * This estimates where the island is within the screenshot.
 * 
 * For more accurate results, the Python script provides map_bounds
 * which should be used when available.
 */
function estimateMapBounds(imageWidth, imageHeight) {
    // Typical Fortnite UI layout:
    // - Map is roughly centered but offset due to UI elements
    // - Left side has some HUD elements
    // - Right side might have minimap/compass
    
    // These values work for 1920x1080 and similar aspect ratios
    const estimatedX = imageWidth * 0.25;      // ~25% from left
    const estimatedY = imageHeight * 0.09;     // ~9% from top  
    const estimatedWidth = imageWidth * 0.53;  // ~53% of screen width
    const estimatedHeight = imageHeight * 0.85; // ~85% of screen height
    
    return {
        x: estimatedX,
        y: estimatedY,
        width: estimatedWidth,
        height: estimatedHeight
    };
}

/**
 * Convert pixel coordinates to normalized (0-1) coordinates within map bounds.
 * 
 * @param {number} pixelX - X coordinate in pixels
 * @param {number} pixelY - Y coordinate in pixels
 * @param {Object} mapBounds - Map bounds {x, y, width, height}
 * @returns {Object} Normalized coordinates {x, y} in range 0-1
 */
function pixelToNormalized(pixelX, pixelY, mapBounds) {
    const normX = (pixelX - mapBounds.x) / mapBounds.width;
    const normY = (pixelY - mapBounds.y) / mapBounds.height;
    return { x: normX, y: normY };
}

/**
 * Convert normalized coordinates (0-1) to Leaflet map coordinates.
 * Uses the calibration data to map to the correct position on the Leaflet tile layer.
 * 
 * @param {number} normX - Normalized X (0-1)
 * @param {number} normY - Normalized Y (0-1)
 * @param {Object} calibration - Calibration data (default: LEAFLET_CALIBRATION)
 * @returns {Object} Leaflet coordinates {x, y}
 */
function normalizedToWorld(normX, normY, calibration = LEAFLET_CALIBRATION) {
    const wx = calibration.island_offset_x + normX * calibration.island_width;
    const wy = calibration.island_offset_y + normY * calibration.island_height;
    return { wx, wy };
}


/**
 * Convert pixel coordinates to Leaflet coordinates.
 * This is the main transformation function.
 * 
 * @param {Object} pixel - Pixel coordinates {x, y}
 * @param {number} imageWidth - Source image width
 * @param {number} imageHeight - Source image height
 * @param {Object} mapBounds - Optional map bounds from detection result
 * @param {Object} calibration - Optional calibration override
 * @returns {Object} Leaflet coordinates {lat, lng} for L.marker()
 */
function pixelToLeafletCoords(pixel, imageWidth, imageHeight, mapBounds = null, calibration = LEAFLET_CALIBRATION) {
    if (!pixel || !imageWidth || !imageHeight) {
        console.warn('pixelToLeafletCoords: invalid inputs', pixel, imageWidth, imageHeight);
        return null;
    }

    const bounds = mapBounds || estimateMapBounds(imageWidth, imageHeight);

    // screenshot → normalized
    const norm = pixelToNormalized(pixel.x, pixel.y, bounds);

    // normalized → world → Leaflet
    const { wx, wy } = normalizedToWorld(norm.x, norm.y, calibration);
    return worldToLeaflet(wx, wy);
}

/**
 * Transform complete bus route detection result to Leaflet coordinates.
 * Handles both old-style results (startCoords/endCoords) and new-style (normalized/leaflet).
 * 
 * @param {Object} analysisResult - Result from image:analyze:result
 * @returns {Object} Transformed result with Leaflet coordinates
 */
function transformBusRouteCoords(analysisResult) {
    const result = { ...analysisResult };

    // If server provides world-space coords (0–3000), convert them here
    if (result.leaflet && result.leaflet.start && result.leaflet.end) {
        const { start, end } = result.leaflet;

        // These are 0–3000 world coords -> map them into Leaflet lat/lng
        result.startLeaflet = worldToLeaflet(start.x, start.y);
        result.endLeaflet   = worldToLeaflet(end.x,   end.y);

        return result;
    }

    // Legacy format: transform from pixel coords
    if (result.startCoords && result.endCoords && result.imageWidth && result.imageHeight) {
        const mapBounds = result.map_bounds || estimateMapBounds(result.imageWidth, result.imageHeight);
        
        result.startLeaflet = pixelToLeafletCoords(
            result.startCoords, 
            result.imageWidth, 
            result.imageHeight,
            mapBounds
        );
        
        result.endLeaflet = pixelToLeafletCoords(
            result.endCoords,
            result.imageWidth,
            result.imageHeight,
            mapBounds
        );
    }
    
    return result;
}


/**
 * Convert Leaflet coordinates to format expected by worldToLeaflet/existing code.
 * This bridges the new coordinate system with existing code.
 */
function leafletCoordsToLegacy(leafletCoords) {
    // Your existing worldToLeaflet expects world coordinates
    // In CRS.Simple, world coords map directly
    return {
        lat: leafletCoords.lat,
        lng: leafletCoords.lng
    };
}

// Handle WebSocket Messages
function handleWebSocketMessage(msg) {
    switch (msg.type) {
        case 'hello/ok':
            log('AUTH', `Authenticated as ${msg.role}`);
            break;
            
        case 'agent:status':
            agentConnected = msg.connected;
            updateAgentStatus(msg.connected, msg.version);
            if (msg.connected) {
                log('AGENT', `Desktop agent connected (v${msg.version})`);
            } else {
                log('AGENT', 'Desktop agent disconnected');
            }
            break;
            
        case 'monitor:list':
            if (msg.monitors && Array.isArray(msg.monitors)) {
                updateMonitorList(msg.monitors);
                log('MONITOR', `Received ${msg.monitors.length} monitors`);
            }
            break;
            
        case 'capture:image':
            if (msg.pngBase64) {
                log('CAPTURE', 'Screenshot received, analyzing route...');
                
                const analysisLoadingId = createNotification({
                    text: 'Analyzing bus route from screenshot...',
                    loading: true,
                    color: '#0a1018'
                });
                
                ws.send(JSON.stringify({
                    type: 'image:analyze',
                    imageData: msg.pngBase64
                }));
                
                window.currentAnalysisLoadingId = analysisLoadingId;
            }
            break;

        case 'image:analyze:result':
            if (window.currentAnalysisLoadingId) {
                removeNotification(window.currentAnalysisLoadingId);
                window.currentAnalysisLoadingId = null;
            }

            if (!msg.success) {
                // No bus route detected
                log('ANALYSIS', `No route: ${msg.error || msg.reason || 'unknown'}`, 'warn');
                createNotification({
                    text: `No bus route detected: ${msg.error || 'Check screenshot'}`,
                    loading: false,
                    color: '#ff5757',
                    time: 4000
                });
                break;
            }
                    
            log('ANALYSIS', `Route detected: ${msg.direction} @ ${msg.angle_deg?.toFixed(1) || msg.angle?.toFixed(1)}°`);
            
            // Transform coordinates using new system
            const transformedResult = transformBusRouteCoords(msg);
            
            if (!transformedResult.startLeaflet || !transformedResult.endLeaflet) {
                log('ANALYSIS', 'Failed to transform coordinates', 'err');
                createNotification({
                    text: 'Route detected but coordinate transform failed',
                    loading: false,
                    color: '#ff5757',
                    time: 3000
                });
                break;
            }
            
            // Place bus route on map
            placeBusRouteFromAnalysis(
                transformedResult.startLeaflet,
                transformedResult.endLeaflet,
                transformedResult
            );
            
            createNotification({
                text: `Bus route detected! Direction: ${msg.direction || 'N/A'}`,
                loading: false,
                color: '#0a1018',
                time: 3000
            });
            
            // Update bus image if annotated image is provided
            if (msg.annotatedImage) {
                const busImg = document.getElementById('bus');
                if (busImg) {
                    busImg.src = msg.annotatedImage;
                }
            }
            break;

        case 'image:analyze:error':
            if (window.currentAnalysisLoadingId) {
                removeNotification(window.currentAnalysisLoadingId);
                window.currentAnalysisLoadingId = null;
            }
            
            log('ANALYSIS', `Analysis failed: ${msg.error}`, 'err');
            createNotification({
                text: 'Route analysis failed. Try again.',
                loading: false,
                color: '#ff5757',
                time: 3000
            });
            break;
            
        case 'error':
            log('ERROR', msg.reason, 'err');
            if (msg.reason === 'auth_failed') {
                refreshToken().then(token => {
                    if (token && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'token:update',
                            token: token
                        }));
                    }
                });
            }
            break;
    }
}

// UI Updates
function updateWSStatus(status) {
    const statusEl = document.getElementById('ws-status');
    if (!statusEl) return;
    
    statusEl.className = `status-indicator ${status}`;
    const textEl = statusEl.querySelector('.status-text');
    
    switch (status) {
        case 'connected':
            textEl.textContent = 'Connected';
            const btnConnect = document.getElementById('btnConnect');
            if (btnConnect) btnConnect.textContent = 'Disconnect';
            break;
        case 'connecting':
            textEl.textContent = 'Connecting...';
            break;
        case 'error':
            textEl.textContent = 'Error';
            break;
        default:
            textEl.textContent = 'Disconnected';
            const btnConn = document.getElementById('btnConnect');
            if (btnConn) btnConn.textContent = 'Connect';
    }
}

function updateAgentStatus(connected, version = '') {
    const btnLaunch = document.getElementById('btnLaunchApp');
    if (!btnLaunch) return;
    
    if (connected) {
        btnLaunch.disabled = true;
        btnLaunch.textContent = 'Agent Connected';
    } else {
        btnLaunch.disabled = false;
        btnLaunch.textContent = 'Launch Agent';
    }
}

function updateMonitorList(monitors) {
    const selectEl = document.getElementById('selMonitors');
    if (!selectEl) return;
    
    selectEl.innerHTML = '<option value="">-- Select Monitor --</option>';
    monitors.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.label || `Monitor ${m.id}`;
        selectEl.appendChild(opt);
    });
}

// Logging
function log(tag, msg, type = 'log') {
    const logEl = document.getElementById('log');
    if (!logEl) return;
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-time">${timestamp}</span> <span class="log-tag ${type}">[${tag}]</span> ${msg}`;
    logEl.appendChild(entry);
    
    while (logEl.children.length > 100) {
        logEl.removeChild(logEl.firstChild);
    }
    
    logEl.scrollTop = logEl.scrollHeight;
}

// Button Actions
function requestMonitors() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'monitor:list' }));
        log('MONITOR', 'Requesting monitor list...');
    } else {
        showNotification('Not connected to server', 'error');
    }
}

function setSelectedMonitor() {
    const selectedId = document.getElementById('selMonitors').value;
    if (!selectedId) {
        showNotification('Please select a monitor', 'warning');
        return;
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
            type: 'monitor:set', 
            monitorId: parseInt(selectedId) 
        }));
        log('MONITOR', `Setting monitor ${selectedId}`);
    }
}

function captureSelectedMonitor() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'capture:selected' }));
        log('CAPTURE', 'Requesting screenshot...');
    } else {
        showNotification('Not connected to server', 'error');
    }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize desktop window system
    initDesktopSystem();
    
    // Get JWT token
    if (typeof userDataPromise !== 'undefined') {
        await userDataPromise;
    }
    currentJWT = localStorage.getItem('jwt_token');
    if (!currentJWT && typeof refreshToken === 'function') {
        currentJWT = await refreshToken();
    }
    
    // Auto-connect WebSocket
    setTimeout(() => {
        connectWebSocket();
    }, 1000);
    
    // Wire up buttons
    const btnConnect = document.getElementById('btnConnect');
    if (btnConnect) {
        btnConnect.addEventListener('click', () => {
            if (wsConnected) {
                if (ws) ws.close();
                showNotification('Disconnecting...', 'info');
            } else {
                connectWebSocket();
            }
        });
    }
    
    const btnLaunchApp = document.getElementById('btnLaunchApp');
    if (btnLaunchApp) {
        btnLaunchApp.addEventListener('click', launchDesktopApp);
    }
    
    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            }
        });
    }
    
    const btnRefreshMonitors = document.getElementById('btnRefreshMonitors');
    if (btnRefreshMonitors) {
        btnRefreshMonitors.addEventListener('click', requestMonitors);
    }
    
    const btnSetMonitor = document.getElementById('btnSetMonitor');
    if (btnSetMonitor) {
        btnSetMonitor.addEventListener('click', setSelectedMonitor);
    }
    
    const btnCapture = document.getElementById('btnCapture');
    if (btnCapture) {
        btnCapture.addEventListener('click', captureSelectedMonitor);
    }
    
    // Modal handlers
    const btnModalOpen = document.getElementById('btnModalOpen');
    if (btnModalOpen) {
        btnModalOpen.addEventListener('click', confirmLaunchApp);
    }
    
    const btnModalCancel = document.getElementById('btnModalCancel');
    const btnCloseModal = document.getElementById('btnCloseModal');
    if (btnModalCancel) {
        btnModalCancel.addEventListener('click', hideAuthModal);
    }
    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', hideAuthModal);
    }
    
    // Periodic heartbeat
    setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
        }
    }, 30000);
    
    log('APP', 'Desktop agent system initialized');
});

// === YOUR EXISTING MAP CODE CONTINUES BELOW ===

let url = templateDirectoryUri + '/in_house_maps/38.01/{z}/{x}/{y}.webp';

L.tileLayer(url, {
    maxZoom: 7,
    noWrap: true,
    bounds: [
        [-256, 0], // Top left corner
        [0, 256]   // Bottom right corner
    ],
}).addTo(map);

// Initialize the feature group to store editable layers
let editableLayers = new L.FeatureGroup();
map.addLayer(editableLayers);

// Remove zoom control from the map
map.zoomControl.remove();


const MIN_LNG = 0;
const MAX_LNG = 256;
const MIN_LAT = -256;
const MAX_LAT = 0;

const WORLD_W = 3000; // meters
const WORLD_H = 3000; // meters

function leafletToWorld(lat, lng) {
    const nx = (lng - MIN_LNG) / (MAX_LNG - MIN_LNG);
    const ny = 1 - ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT));
    const wx = nx * WORLD_W; // 0..3000
    const wy = ny * WORLD_H; // 0..3000
    return { wx, wy };
}
function worldToLeaflet(wx, wy) {
    const lng = MIN_LNG + (wx / WORLD_W) * (MAX_LNG - MIN_LNG);
    const lat = MIN_LAT + (1 - (wy / WORLD_H)) * (MAX_LAT - MIN_LAT);
    return { lat, lng };
}


// Define the common shape options
var commonShapeOptions = {
    color: '#004999', // Red color for all shapes
    weight: 5,
    opacity: 1
};

// Define the draw options with common shape options
var drawOptions = {
    polyline: {
        shapeOptions: commonShapeOptions
    },
    polygon: {
        shapeOptions: commonShapeOptions
    },
    rectangle: {
        shapeOptions: commonShapeOptions
    },
    circle: {
        shapeOptions: commonShapeOptions
    },
    marker: false,
    circlemarker: false
};

// Define drawing options for different shapes
let drawControl = new L.Control.Draw({
    draw: drawOptions,
    edit: {
        featureGroup: editableLayers,
        remove: true  // Enable option to delete features
    }
});
//map.addControl(drawControl);


map.on('draw:created', function (e) {
    var type = e.layerType,
        layer = e.layer;

    // Add the new layer to the editable feature group
    editableLayers.addLayer(layer);
});

// Disable click event when drawing starts
map.on(L.Draw.Event.DRAWSTART, function (e) {
    map.off('click', handleMapClick);
});

// Re-enable click event with a slight delay after drawing is done
map.on('draw:created', function (e) {
    setTimeout(function () {
        map.on('click', handleMapClick);
    }, 10); // Delay the re-attachment of the click listener

    // Add the new layer to the editable feature group
    editableLayers.addLayer(e.layer);
});

// Functionality to be disabled on the preview site
var solveButton = document.getElementById('solveButton');

// Holds the current calculation, allows it to be aborted and start a new one.
let activeController = null;

// Flight profile chart instance
let flightChart = null;

// ---- API + JWT helpers ----------------------------------------------------
const API_BASE = 'https://api.dropmazter.com:8443';

// JWT token requesting
async function refreshToken() {
    try {
        // Use the new endpoint URL to request a new JWT token
        const response = await fetch('/wp-json/discord-auth/v1/token/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include'  // Ensure cookies are included in the request
        });

        const data = await response.json();

        if (data.token) {
            // Store the new token in localStorage
            localStorage.setItem('jwt_token', data.token);

            // Update user data arrays with new token
            refreshUserData();
            return data.token;
        } else {
            throw new Error('Failed to refresh token');
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
        // Handle token refresh failure (e.g., redirect to login)
        return null;
    }
}

async function sessionHeartbeat() {
    // Prefer current token; only refresh if missing
    let jwt = localStorage.getItem('jwt_token');
    if (!jwt) jwt = await refreshToken();
    if (!jwt) return;
    try {
        await fetch(`${API_BASE}/session/heartbeat/${encodeURIComponent(jwt)}`);
    } catch { }
}

// keep the session warm
setInterval(sessionHeartbeat, 45_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) sessionHeartbeat(); });
window.addEventListener('focus', sessionHeartbeat);

// Function to handle click events
function handleMapClick(e) {
    onClick(e);
}

// === VORTEX: destination-only precompute helper (session-aware) ============
async function precomputeForDestination(destIndex, latlng) {
    try {
        // Map coords -> world meters
        const { wx: x, wy: y } = leafletToWorld(latlng.lat, latlng.lng);
        const jwt = localStorage.getItem('jwt_token')
        if (!jwt) {
            console.warn('[precompute] skipped (no JWT). Optimize will auto-precompute on server.');
            return;
        }
        const destNum = (destIndex + 1) | 0; // 1..4
        const url = `${API_BASE}/vortex/precompute/${encodeURIComponent(jwt)}/${destNum}/${x}/${y}`;
        const res = await fetch(url);
        if (!res.ok) {
            console.warn('Vortex precompute failed', await res.text());
        } else {
            // Optional: read npz path if you ever want to show it
            // const j = await res.json();
            // console.log('Vortex precompute ok', j);
        }
    } catch (e) {
        console.warn('Vortex precompute error', e);
        jwt = await refreshToken();
    }
}

function snapToGrid(latlng, options = {}) {
    const { stepPx = 1, toCenters = true } = options; // stepPx: 1=every pixel, 2=every meter

    // Normalize Leaflet -> [0..1]
    const nx = (latlng.lng - 0) / 256;
    const ny = (latlng.lat + 256) / 256;

    // [0..6000) pixel coords (top-left origin, y down)
    let hx = nx * 6000;
    let hy = ny * 6000;

    if (toCenters) {
        // snap to pixel centers with optional step
        hx = Math.round((hx - 0.5) / stepPx) * stepPx + 0.5;
        hy = Math.round((hy - 0.5) / stepPx) * stepPx + 0.5;

        // clamp to valid center range
        hx = Math.min(Math.max(hx, 0.5), 5999.5);
        hy = Math.min(Math.max(hy, 0.5), 5999.5);
    } else {
        // snap to pixel grid lines (corners), less ideal for sampling
        hx = Math.round(hx / stepPx) * stepPx;
        hy = Math.round(hy / stepPx) * stepPx;

        // clamp to valid index range
        hx = Math.min(Math.max(hx, 0), 5999);
        hy = Math.min(Math.max(hy, 0), 5999);
    }

    // Map back to Leaflet
    const snappedLng = (hx / 6000) * 256;
    const snappedLat = -256 + (hy / 6000) * 256;

    return L.latLng(snappedLat, snappedLng);
}



// Notification and loading handling
(function () {
    let notificationContainer = null;
    let notificationId = 0;
    const notifications = {};

    function ensureContainerExists() {
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            document.body.appendChild(notificationContainer);
        }
    }

    function createNotification({ text = '', loading = false, color = '#0a1018', time = 5000 }) {
        ensureContainerExists();
        notificationId++;
        const id = notificationId;
        const notification = document.createElement('div');
        notification.classList.add('notification');
        notification.style.backgroundColor = color;

        if (loading) {
            notification.classList.add('loading');

            const iconContainer = document.createElement('div');
            iconContainer.classList.add('icon-container');

            const spinner = document.createElement('div');
            spinner.classList.add('spinner');
            iconContainer.appendChild(spinner);

            // Do not create the checkmark here

            notification.appendChild(iconContainer);

            const message = document.createElement('div');
            message.innerText = text;
            notification.appendChild(message);

            notifications[id] = { element: notification, iconContainer: iconContainer };
        } else {
            const message = document.createElement('div');
            message.innerText = text;
            notification.appendChild(message);

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.classList.add('close-btn2');
            closeBtn.onclick = () => removeNotification(id);
            notification.appendChild(closeBtn);

            // Progress bar
            const progressBar = document.createElement('div');
            progressBar.classList.add('progress-bar');
            progressBar.style.animationDuration = time + 'ms';
            notification.appendChild(progressBar);

            // Remove after time
            const timeout = setTimeout(() => {
                removeNotification(id);
            }, time);
            notifications[id] = { element: notification, timeout };
        }

        notificationContainer.appendChild(notification);

        return id;
    }

    function removeNotification(id) {
        return new Promise((resolve) => {
            const notification = notifications[id];
            if (notification) {
                const element = notification.element;

                // Handle loading notification with spinner-to-checkmark transformation
                if (element.classList.contains('loading')) {
                    element.classList.add('done');

                    const iconContainer = notification.iconContainer;

                    // Remove spinner
                    const spinner = iconContainer.querySelector('.spinner');
                    if (spinner) spinner.remove();

                    // Create and append the checkmark
                    const checkmark = document.createElement('div');
                    checkmark.classList.add('checkmark');

                    const stem = document.createElement('div');
                    stem.classList.add('checkmark_stem');
                    checkmark.appendChild(stem);

                    const kick = document.createElement('div');
                    kick.classList.add('checkmark_kick');
                    checkmark.appendChild(kick);

                    iconContainer.appendChild(checkmark);

                    // Delay before hiding the notification
                    setTimeout(() => triggerHideAndRemove(element, id, resolve), 1000);
                } else {
                    triggerHideAndRemove(element, id, resolve);
                }
            } else {
                resolve();
            }
        });
    }

    // Helper function for hiding and removing notifications
    function triggerHideAndRemove(element, id, resolve) {
        element.classList.add('hide'); // Trigger CSS hide animation
        setTimeout(() => {
            element.remove(); // Remove element after animation ends
            delete notifications[id]; // Clean up notification data
            resolve(); // Resolve the promise
        }, 300); // Match CSS transition duration
    }


    // Expose functions globally
    window.createNotification = createNotification;
    window.removeNotification = removeNotification;

})();

// For toggling chests and floor loot
const IconTypes = {
    CHESTS: { type: 'chests', url: templateDirectoryUri + '/imgs/chest.png' },
    OTHER: { type: 'other_chests', url: templateDirectoryUri + '/imgs/other_chest.png' }
};


const coords_url = "https://api.dropmazter.com:8443/get_spawns"
let chest_coords;

fetch(coords_url)
    .then(response => response.json())
    .then(data => {
        chest_coords = data;
        const loadingId = createNotification({
            text: 'Chests spawns loaded!',
            loading: false,
            color: '#0a1018',
            time: 2000,
        });
    })
    .catch(error => {
        const loadingId = createNotification({
            text: 'Failed to load chest spawns.',
            loading: false,
            color: '#0a1018',
            time: 2000,
        });
        console.error("Error calling the API", error);
    });

let JumpIcon = L.icon({
    iconUrl: templateDirectoryUri + '/imgs/jump.png', // Ensure this path is correct
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, 0]
});
let DeployIcon = L.icon({
    iconUrl: templateDirectoryUri + '/imgs/deploy2.png', // Ensure this path is correct
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, 0]
});
let DeployIconHigh = L.icon({
    iconUrl: templateDirectoryUri + '/imgs/deploy2_high.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, 0]
});

let LaunchPadIcon = L.icon({
    iconUrl: templateDirectoryUri + '/imgs/launchpad.png', // Ensure this path is correct
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, 0]
});

const destination_colors = ['#FFA400', '#9000ff', '#00baff', '#ff5757'];
const height_adjusted_destination_color = '#577BFE';

var destinationMarkers = []

function makeDestIcon(index, heightoffset = false) {
    // Select color based on destination index unless its with a height offset, then use that color.
    var color = heightoffset ? height_adjusted_destination_color : destination_colors[index];
    var svgContentDest = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 128 128">
            <defs>
                <style>
                    .cls-${index + 1} {
                        fill: ${color};
                        stroke: #fff;
                        stroke-linecap: round;
                        stroke-width: 20px;
                    }
                </style>
            </defs>
            <circle class="cls-${index + 1}" cx="64" cy="64" r="54"/>
        </svg>
    `;

    return L.divIcon({
        className: 'custom-marker',
        html: svgContentDest,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, 0]
    })
}

// For displaying in the floating selector
const svgContentDest1STATIC = `
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 128 128">
    <defs>
        <style>
            .cls-155 {
                fill: ${destination_colors[0]};
                stroke: #fff;
                stroke-linecap: round;
                stroke-width: 20px;
            }
        </style>
    </defs>
    <circle class="cls-155" cx="64" cy="64" r="54"/>
</svg>
`;
// For displaying in the floating selector
const svgContentDest2STATIC = `
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 128 128">
    <defs>
        <style>
            .cls-255 {
                fill: ${destination_colors[1]};
                stroke: #fff;
                stroke-linecap: round;
                stroke-width: 20px;
            }
        </style>
    </defs>
    <circle class="cls-255" cx="64" cy="64" r="54"/>
</svg>
`;

// For displaying in the floating selector
const svgContentDest3STATIC = `
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 128 128">
    <defs>
        <style>
            .cls-355 {
                fill: ${destination_colors[2]};
                stroke: #fff;
                stroke-linecap: round;
                stroke-width: 20px;
            }
        </style>
    </defs>
    <circle class="cls-355" cx="64" cy="64" r="54"/>
</svg>
`;
// For displaying in the floating selector
const svgContentDest4STATIC = `
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 128 128">
    <defs>
        <style>
            .cls-455 {
                fill: ${destination_colors[3]};
                stroke: #fff;
                stroke-linecap: round;
                stroke-width: 20px;
            }
        </style>
    </defs>
    <circle class="cls-455" cx="64" cy="64" r="54"/>
</svg>
`;

// Holds all dest markers
const destination_markers = []

let BusIcon = L.divIcon({
    className: "custom-icon", // Optional, for styling
    html: `<img src="${templateDirectoryUri}/imgs/GoFasterStripeAnchor.svg" width="50" height="50">`,
    iconSize: [60, 60],
    iconAnchor: [25, 25]
});


// For 1 or 2 destinations.
const sliderTrack = document.getElementById('floating-slider-track');
const sliderToggle = document.getElementById('floating-slider-toggle');
const options = [
    document.querySelector('.floating-slider-option-1'),
    document.querySelector('.floating-slider-option-2'),
    document.querySelector('.floating-slider-option-3'),
    document.querySelector('.floating-slider-option-4')
];

// Add Static SVG Icons for Each Option
options[0].innerHTML = `<div class="icon-wrapper">${svgContentDest1STATIC}</div>`;
options[1].innerHTML = `
    <div class="icon-wrapper">${svgContentDest1STATIC}</div>
    <div class="icon-wrapper">${svgContentDest2STATIC}</div>
`;
options[2].innerHTML = `
    <div class="icon-wrapper">${svgContentDest1STATIC}</div>
    <div class="icon-wrapper">${svgContentDest2STATIC}</div>
    <div class="icon-wrapper">${svgContentDest3STATIC}</div>
`;
options[3].innerHTML = `
    <div class="icon-wrapper">${svgContentDest1STATIC}</div>
    <div class="icon-wrapper">${svgContentDest2STATIC}</div>
    <div class="icon-wrapper">${svgContentDest3STATIC}</div>
    <div class="icon-wrapper">${svgContentDest4STATIC}</div>
`;
// State Management
let currentSelection = 1; // Start on the left option

// Update visibility of height adjustment sliders and manual inputs based on currentSelection
function updateHeightAdjustmentVisibility() {
    // Loop through sliders and manual inputs
    for (let i = 1; i <= 4; i++) {
        const slider = document.getElementById(`slider${i}`);
        const manual = document.getElementById(`manual${i}`);

        if (i === 1 || i <= currentSelection) {
            // Always show slider1, show others based on selection
            slider.style.display = 'initial';
            manual.style.display = 'initial';
        } else {
            // Hide sliders and manual inputs not in selection
            slider.style.display = 'none';
            manual.style.display = 'none';
        }
    }
}

// Update Slider Position and Active Option
function updateFloatingSlider() {
    const collapsedLeftPositions = ['0%', '25%', '50%', '75%'];
    sliderToggle.style.left = collapsedLeftPositions[currentSelection - 1];

    // Highlight Active Option
    options.forEach((option, index) => {
        option.classList.remove('active');
    });
    options[currentSelection - 1].classList.add('active');
    updateHeightAdjustmentVisibility();
}
sliderTrack.classList.add('collapsed');
sliderTrack.style.width = '80px';
sliderToggle.style.left = '50%';
updateFloatingSlider();

// Handle Click on Track
sliderTrack.addEventListener('click', (event) => {
    const clickPosition = event.offsetX;
    const trackWidth = sliderTrack.offsetWidth;
    const segmentWidth = trackWidth / 4;

    // Determine target selection (1–4)
    let targetSelection = 4;
    if (clickPosition < segmentWidth) {
        targetSelection = 1;
    } else if (clickPosition < segmentWidth * 2) {
        targetSelection = 2;
    } else if (clickPosition < segmentWidth * 3) {
        targetSelection = 3;
    }

    currentSelection = targetSelection;

    // If we reduced the number of destinations, remove extras from the map
    // Keep only indices [0 .. targetSelection-1]
    while (destinationMarkers.length > targetSelection) {
        const m = destinationMarkers.pop();
        map.removeLayer(m);
    }

    updateFloatingSlider();
});



// Collapse on Mouse Leave
sliderTrack.addEventListener('mouseleave', () => {
    sliderTrack.classList.add('collapsed');
    sliderTrack.style.width = '80px';
    sliderToggle.style.left = '50%';
    updateFloatingSlider();
});

// Expand on Mouse Enter
sliderTrack.addEventListener('mouseenter', () => {
    sliderTrack.classList.remove('collapsed');
    sliderTrack.style.width = '350px';
    options.forEach(option => option.classList.add('visible'));
});



let bus_start;
let bus_end;
let destiantion;
let markers = [];
let polyline = null;
let solidLine = null;
let solidLine2 = null;
let dashedLine = null;
let isDragging = false;

// Right click to clear points
map.on('contextmenu', async function () {
    resetMarkers();
    patternMarkers.forEach(function (marker) {
        map.removeLayer(marker);
    });
    patternMarkers = [];
    // Reset lines
    if (solidLine) {
        solidLine.remove();
        solidLine = null;
    }
    if (solidLine2) {
        solidLine2.remove();
        solidLine2 = null;
    }
    if (dashedLine) {
        dashedLine.remove();
        dashedLine = null;
    }
    // Clear all destination markers
    destinationMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    destinationMarkers.length = 0; // reset the array

    removePulseGracefully('.calculate-button');

});

// Disable dragging when right mouse button is pressed
map.getContainer().addEventListener('mousedown', function (event) {
    if (event.button === 2) {  // Right mouse button
        map.dragging.disable();
    }
});

map.getContainer().addEventListener('mouseup', function (event) {
    if (event.button === 2) {  // Right mouse button
        map.dragging.enable();
    }
});



var deploy_point_for_dest;

map.on('click', handleMapClick);

function onClick(e) {
    if (isDragging) {
        isDragging = false;
        return;
    }

    // If solve button is disabled, do nothing.
    if (solveButton.disabled) return;

    // --- Auto-clear bus markers when all destinations are placed
    // and at least two bus anchors already exist. We clear but DON'T early-return,
    // so this same click can place a fresh bus marker right away.
    if (destinationMarkers.length === currentSelection && markers.length >= 2) {
        // Keep destinations; clear route artifacts first (jump/deploy/lines/stripes),
        // then remove the bus markers themselves so the next click can place new ones.
        resetMarkers(false); // keep bus anchors for drag cases, but remove jump/deploy/etc.

        // Reset any lines/patterns
        if (solidLine) { solidLine.remove(); solidLine = null; }
        if (solidLine2) { solidLine2.remove(); solidLine2 = null; }
        if (dashedLine) { dashedLine.remove(); dashedLine = null; }

        // Also remove any GoFasterStripe pattern markers
        if (typeof patternMarkers !== 'undefined' && patternMarkers.length) {
            patternMarkers.forEach(m => map.removeLayer(m));
            patternMarkers = [];
        }

        // Finally remove the bus markers themselves
        if (markers && markers.length) {
            markers.forEach(m => map.removeLayer(m));
            markers = [];
        }



        // Also stop any button pulse until we have ≥2 markers again
        removePulseGracefully('.calculate-button');
    }

    // --- Place bus markers ---
    if (
        (currentSelection === destinationMarkers.length) && // only when all destinations are placed
        markers.length <= 3
    ) {
        const marker = L.marker(e.latlng, { icon: BusIcon, draggable: true })
            .addTo(map)
            .setZIndexOffset(1000);

        marker.on('dragstart', () => {
            isDragging = true;
            resetMarkers(false);
            if (solidLine) { solidLine.remove(); solidLine = null; }
            if (solidLine2) { solidLine2.remove(); solidLine2 = null; }
            if (dashedLine) { dashedLine.remove(); dashedLine = null; }
        });
        marker.on('dragend', () => {
            setTimeout(() => { isDragging = false; }, 50);
            debouncedUpdatePattern();
            if (!solveButton.disabled) solveButton.click();
        });
        marker.on('drag', () => { updateLine(); updatePattern(); });

        markers.push(marker);

        // Auto-calc when we have enough anchors
        if ((currentSelection === destinationMarkers.length) && markers.length >= 2) {
            solveButton.click();
        }
    }

    // --- Place destination markers ---
    if (destinationMarkers.length < currentSelection) {
        const index = destinationMarkers.length; // 0-based index
        const hasOffset = getHeightOffset(index) !== 0;

        const destMarker = L.marker(e.latlng, {
            icon: makeDestIcon(index, hasOffset),
            draggable: true
        })
            .addTo(map)
            .setZIndexOffset(2000);

        const snapped = snapToGrid(destMarker.getLatLng());
        destMarker.setLatLng(snapped);

        precomputeForDestination(index, destMarker.getLatLng());

        destMarker.on('dragstart', () => {
            resetMarkers(false);
            if (solidLine) { solidLine.remove(); solidLine = null; }
            if (solidLine2) { solidLine2.remove(); solidLine2 = null; }
            if (dashedLine) { dashedLine.remove(); dashedLine = null; }
        });
        destMarker.on('dragend', async (event) => {
            const pos = event.target.getLatLng();
            destMarker.setLatLng(snapToGrid(pos));
            try { await precomputeForDestination(index, destMarker.getLatLng()); } catch { }
            if (!solveButton.disabled) solveButton.click();
        });

        destinationMarkers.push(destMarker);
    }

    if (markers.length > 1) {
        drawLineWithPattern();
        requestAnimationFrame(animateMarkers);
    }
    if (markers.length >= 2) {
        document.querySelector('.calculate-button').classList.add('pulse');
    } else {
        removePulseGracefully('.calculate-button');
    }
}

// Register the enterkey for the solve button
document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        var solveBTN = document.getElementById('solveButton');
        if (solveBTN.disabled === false) {
            solveBTN.click();
        }
    }
});

// Offset distance to offset the lines drawn
const dashed_line_draw_offset = 1;
const solid_line_draw_offset = 1;


// Get the current pathname
var currentPathname = window.location.pathname;

// Solve drop
document.getElementById('solveButton').addEventListener('click', async function () {
    // cancel any ongoing fetch
    if (activeController) {
        try { activeController.abort(); } catch { }
    }

    // new controller for this run
    activeController = new AbortController();

    if (solveButton.disabled === true) return;

    // Show modal if no markers
    if (markers.length < 2) {
        toggleModal('tutorialmodal');
        return;
    }

    if (markers.length >= 4) {
        resetMarkers(false);
        // Reset lines
        if (solidLine) { solidLine.remove(); solidLine = null; }
        if (solidLine2) { solidLine2.remove(); solidLine2 = null; }
        if (dashedLine) { dashedLine.remove(); dashedLine = null; }
        removePulseGracefully('.calculate-button');
    }

    removePulseGracefully('.calculate-button');

    // Shared state for this click
    const data = [];
    const totalTimes = [];
    let busCoords, destinationMarker, destiantionCoords; // keeping original var name used in URL

    // Disable solve button while calculating
    solveButton.disabled = true;
    setDestDragging(false); // Disable dragging while calculating.

    // Disable dragging on all markers (do this once up-front)
    try {
        markers.forEach(marker => marker.options.icon === BusIcon ? pass : marker.dragging.disable());
        // disable dragging while caculating on all destination markers
        destinationMarkers.forEach(marker => {
            marker.dragging.disable();
        });

    } catch { /* safe-guard: ignore if any missing */ }

    // Helper: compute one route for a given destination index
    const calculateRoute = async (index) => {
        const dest = destinationMarkers[index];
        if (!dest) return;

        // Map marker positions to coordinates
        busCoords = markers.map(marker => {
            const latlng = marker.getLatLng();
            const { wx: x, wy: y } = leafletToWorld(latlng.lat, latlng.lng);
            return {
                x: x,
                y: y,
            };
        });

        destinationMarker = dest;
        destiantionCoords = (() => {
            const latlng = destinationMarker.getLatLng();
            const { wx: x, wy: y } = leafletToWorld(latlng.lat, latlng.lng);
            return {
                x: x,
                y: y,
            };
        })();

        // Get height offset
        const heightOffset = getHeightOffset(index);
        applyRainbowEffect(destinationMarker);

        // Try request (with at most one retry on JWT refresh)
        let request_completed = false;
        try {
            for (let i = 0; i < 2; i++) {
                // session-aware optimize, with retry on 401
                const jwt = localStorage.getItem('jwt_token')
                if (!jwt) {
                    createNotification({ text: 'Please sign in to calculate.', loading: false, color: '#0a1018', time: 2500 });
                    let jwt = await refreshToken();
                    return;
                }
                const destNum = (index + 1) | 0; // 1..4
                let apiUrl =
                    `${API_BASE}/vortex/optimize/${encodeURIComponent(jwt)}/${destNum}` +
                    `/${busCoords[0].x}/${busCoords[0].y}/${busCoords[1].x}/${busCoords[1].y}` +
                    `/${destiantionCoords.x}/${destiantionCoords.y}`;

                let response = await fetch(apiUrl, { signal: activeController.signal });
                if (response.status === 401) {
                    // token likely expired -> refresh and retry once
                    jwt = await refreshToken();
                    if (!jwt) {
                        createNotification({ text: 'Session expired. Please sign in again.', loading: false, color: '#0a1018', time: 2500 });
                        return;
                    }
                    apiUrl =
                        `${API_BASE}/vortex/optimize/${encodeURIComponent(jwt)}/${destNum}` +
                        `/${busCoords[0].x}/${busCoords[0].y}/${busCoords[1].x}/${busCoords[1].y}` +
                        `/${destiantionCoords.x}/${destiantionCoords.y}`;
                    response = await fetch(apiUrl, { signal: activeController.signal });
                }
                if (!response.ok) {
                    jwt = await refreshToken();
                    console.warn('Vortex optimize failed', response.status, await response.text());
                    createNotification({ text: 'Route calc failed. Try again.', loading: false, color: '#0a1018', time: 2500 });
                    return;
                }
                const responseData = await response.json(); // ← parse ONCE
                data[index] = responseData;
                totalTimes[index] = responseData.jump_to_deploy_time + responseData.time_from_deploy_to_ground;
                request_completed = true;
                break; // success, stop retrying
            }

            if (!request_completed) {
                createNotification({
                    text: 'Calculation failed.',
                    loading: false,
                    color: '#0a1018',
                    time: 2000,
                });
            }
        } catch (error) {
            if (error.name === 'AbortError') return; // silently ignore

            createNotification({
                text: 'Calculation failed.',
                loading: false,
                color: '#0a1018',
                time: 2000,
            });
            console.error("Error calling the API", error);
        } finally {
            // Make sure that the rainbow effect is stopped after calculation attempt
            stopRainbowEffect(destinationMarker);
        }
    };

    // Sequentially calculate routes and pick best
    const loadingId = createNotification({
        text: 'Calculating Fastest Route',
        loading: true,
        color: '#0a1018'
    });

    try {
        // calculate one, two, three or four routes depending on currentSelection
        for (let i = 0; i < currentSelection; i++) {
            try {
                await calculateRoute(i);
            } catch (error) {
                console.error(`Failed to calculate route for input: ${i}`, error);
            }
        }
    } finally {
        // Ensure the notification is removed even if errors occur
        removeNotification(loadingId);
    }

    // Determine the best data based on total times
    const candidates = totalTimes
        .map((t, i) => ({ t, i }))
        .filter(o => Number.isFinite(o.t));

    if (candidates.length === 0) {
        createNotification({ text: 'No route could be calculated.', loading: false, color: '#0a1018', time: 4000 });
        solveButton.disabled = false; // re-enable before returning
        return;
    }

    const bestRouteIndex = candidates.reduce((a, b) => (b.t < a.t ? b : a)).i;
    const selectedData = data[bestRouteIndex];
    destinationMarker = destinationMarkers[bestRouteIndex];

    // Set the two helper images in the sidebar.
    const sourceImage = templateDirectoryUri + '/imgs/apollo_terrain_3000_C6_S4_V3.png'; // source image
    const busImageSize = 400;
    const deployImageSize = 200;
    replaceImageWithSmallBus(sourceImage, selectedData.jump_point_x, selectedData.jump_point_y, busImageSize, "busimg", busCoords[0], busCoords[1]);
    replaceImageWithSmallPin(sourceImage, selectedData.deploy_point_x, selectedData.deploy_point_y, deployImageSize, "deployimg", busCoords[0], busCoords[1]);

    const { lat: jumpLat, lng: jumpLng } = worldToLeaflet(selectedData.jump_point_x, selectedData.jump_point_y);
    const jumpPoint = {
        lat: jumpLat,
        lng: jumpLng,
    };
    const { lat: deployLat, lng: deployLng } = worldToLeaflet(selectedData.deploy_point_x, selectedData.deploy_point_y);
    const deployPoint = {
        lat: deployLat,
        lng: deployLng,
    };

    // Sidebar logic
    // Update the sidebar content
    document.getElementById('deployHeight').innerText = `${selectedData.deploy_height.toFixed(1)}m`;
    document.getElementById('etaDeployPoint').innerText = `${selectedData.jump_to_deploy_time.toFixed(1)}s`;
    document.getElementById('glideTime').innerText = `${selectedData.time_from_deploy_to_ground.toFixed(1)}s`;
    document.getElementById('totalEta').innerText = `${(selectedData.jump_to_deploy_time + selectedData.time_from_deploy_to_ground).toFixed(1)}s`;

    // Update the responsive flight chart
    updateFlightChart(selectedData);

    // Launchpad coords
    const { lat: lpLat, lng: lpLng } = worldToLeaflet(selectedData["launch_pad_x"], selectedData["launch_pad_y"]);
    // keep later usage [launch_pad_y, launch_pad_x] = [lat, lng]
    const launch_pad_x = lpLng;  // lng
    const launch_pad_y = lpLat;  // lat
    const { lat: dfdLat, lng: dfdLng } = worldToLeaflet(selectedData["deploy_point_for_dest_x"], selectedData["deploy_point_for_dest_y"]);
    const deploy_point_for_dest_x = dfdLat;
    const deploy_point_for_dest_y = dfdLng;

    // Convert deploy point for marker placement
    const jumpMarker = L.marker([jumpPoint.lat, jumpPoint.lng], { icon: JumpIcon, draggable: false }).addTo(map).setZIndexOffset(1000);
    const deployIcon = selectedData.is_high_deploy_marker == 0 ? DeployIcon : DeployIconHigh;
    const deployMarker = L.marker([deployPoint.lat, deployPoint.lng], { icon: deployIcon, draggable: false }).addTo(map).setZIndexOffset(2500);


    if (launch_pad_x != 0 && launch_pad_y != 0) {
        const launchPadMarker = L.marker([launch_pad_y, launch_pad_x], { icon: LaunchPadIcon, draggable: false, interactive: false }).addTo(map).setZIndexOffset(1000);
        markers.push(launchPadMarker);
    }

    markers.push(jumpMarker, deployMarker);

    // Remember these so zoom changes can keep the gap perfect
    currentJumpMarker = jumpMarker;
    currentDeployMarker = deployMarker;
    currentDestinationMarker = destinationMarker; // the chosen best route
    if (launch_pad_x != 0 && launch_pad_y != 0) {
        currentLaunchPadMarker = launchPadMarker;
    }

    // Remove previous dotted and dashed lines if present
    if (solidLine) solidLine.remove();
    if (solidLine2) solidLine2.remove();
    if (dashedLine) dashedLine.remove();

    if (launch_pad_x != 0 && launch_pad_y != 0) {
        solidLine = L.polyline(
            [
                [launch_pad_y, launch_pad_x],
                [destinationMarker.getLatLng().lat, destinationMarker.getLatLng().lng]
            ],
            { color: 'white', weight: 4, interactive: false }
        ).addTo(map);
    } else {
        // Adjust line between deploy point and destination
        const destinationOffset = getOffsetPoint(
            [destinationMarker.getLatLng().lat, destinationMarker.getLatLng().lng],  // destination as end
            [deployPoint.lat, deployPoint.lng],                                           // deploy point as start
            solid_line_draw_offset
        );
        solidLine = L.polyline(
            [
                [destinationMarker.getLatLng().lat, destinationMarker.getLatLng().lng],
                destinationOffset
            ],
            { color: 'white', weight: 4, interactive: false }
        ).addTo(map);
    }

    dashedLine = L.polyline(
        [[jumpPoint.lat, jumpPoint.lng], [deployPoint.lat, deployPoint.lng]],
        { color: 'white', dashArray: '15, 10', weight: 4, lineCap: 'round', interactive: false }
    ).addTo(map);

    // Draw (or redraw) the lines with pixel-based gaps
    redrawConnectionLines();

    // Re-enable solve button regardless of success/failure
    solveButton.disabled = false;
    setDestDragging(true); // Same for dest drag.
});

// Function to calculate a point slightly before the end point
// Used for drawing dashed and solid line
function getOffsetPoint(start, end, offsetDistance) {
    const lat1 = start[0], lon1 = start[1];
    const lat2 = end[0], lon2 = end[1];

    const d = Math.sqrt((lat2 - lat1) ** 2 + (lon2 - lon1) ** 2);
    const ratio = Math.max(0, (d - offsetDistance) / d);  // Ensure ratio is not negative

    return [
        lat1 + (lat2 - lat1) * ratio,
        lon1 + (lon2 - lon1) * ratio
    ];
}

// --- Pixel-based gaps so they look consistent at any zoom ---
const GAP_TO_DEPLOY_PX = 12;  // space before the deploy pin
const GAP_TO_JUMP_PX = 6;   // optional: leave a bit of room near jump icon
const GAP_TO_DEST_PX = 6;   // optional: leave a bit of room near destination dot

// Global refs so we can recalc on zoom
let currentJumpMarker = null;
let currentDeployMarker = null;
let currentDestinationMarker = null;
let currentLaunchPadMarker = null;

// Shorten a line by pixel distances at the start/end, regardless of zoom.
function offsetLineByPixels(startLL, endLL, startOffsetPx = 0, endOffsetPx = 0) {
    const z = map.getZoom();
    let p1 = map.project(startLL, z);
    let p2 = map.project(endLL, z);

    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return [startLL, endLL];

    // If the requested offsets exceed the line length, clamp to a tiny segment.
    const total = Math.min(len - 1, Math.max(0, startOffsetPx + endOffsetPx));
    const ux = dx / len, uy = dy / len;

    const p1a = L.point(p1.x + ux * startOffsetPx, p1.y + uy * startOffsetPx);
    const p2a = L.point(p2.x - ux * endOffsetPx, p2.y - uy * endOffsetPx);

    return [map.unproject(p1a, z), map.unproject(p2a, z)];
}

// Create/update the two route lines with dynamic pixel gaps near the deploy marker
function redrawConnectionLines() {
    // Clean up old polylines if present
    if (dashedLine) { dashedLine.remove(); dashedLine = null; }
    if (solidLine) { solidLine.remove(); solidLine = null; }
    if (solidLine2) { solidLine2.remove(); solidLine2 = null; }

    if (!currentDeployMarker) return;
    const deployLL = currentDeployMarker.getLatLng();

    // D A S H E D : jump → deploy (trim near both ends so the icons are clear)
    if (currentJumpMarker) {
        const jumpLL = currentJumpMarker.getLatLng();
        const [a, b] = offsetLineByPixels(jumpLL, deployLL, GAP_TO_JUMP_PX, GAP_TO_DEPLOY_PX);
        dashedLine = L.polyline([a, b], {
            color: 'white',
            dashArray: '15, 10',
            weight: 4,
            lineCap: 'round',
            interactive: false
        }).addTo(map);
    }

    // S O L I D : destination → deploy (unless you're on a launch pad path)
    if (currentLaunchPadMarker) {
        // Your original launch pad → destination line stays as-is (no deploy offset needed).
        solidLine = L.polyline(
            [currentLaunchPadMarker.getLatLng(), currentDestinationMarker.getLatLng()],
            { color: 'white', weight: 4, interactive: false }
        ).addTo(map);
    } else if (currentDestinationMarker) {
        const destLL = currentDestinationMarker.getLatLng();
        const [a, b] = offsetLineByPixels(destLL, deployLL, GAP_TO_DEST_PX, GAP_TO_DEPLOY_PX);
        solidLine = L.polyline([a, b], {
            color: 'white', weight: 4, interactive: false
        }).addTo(map);
    }
}

// =========================
// Flight Profile Chart JS
// =========================
function updateFlightChart(result) {
    try {
        // Times (used only to scale glide length)
        const tFree = Number(result?.jump_to_deploy_time) || 0;
        const tGlide = Number(result?.time_from_deploy_to_ground) || 0;
        const deployHeight = Number(result?.deploy_height) || 100;        // meters
        const hOverDest = Number(result?.high_marker_dest_height) || 0;// meters AGL over destination
        console.log(hOverDest)

        // === Fixed bus start altitude ===
        const startAlt = 830; // meters above 0

        // === Theta samples → piecewise slopes ===
        const thetaListRaw = Array.isArray(result?.angles?.theta) ? result.angles.theta : [];
        const thetaList = thetaListRaw.length ? thetaListRaw : [-60]; // fallback single segment
        const nSeg = thetaList.length;

        // === Choose how many extra points we want for glide portion ===
        const glideSamples = 80;

        // === Decide end conditions (destination lock) ===
        const glideEndAltAbs = Math.max(hOverDest + 40, 60); // absolute altitude where glide ends

        // === We'll generate terrain to match total point count (nSeg+1 for free-fall + glideSamples) ===
        const totalPts = nSeg + 1 + glideSamples;
        const terrain = generateMockTerrain(totalPts);

        // === Deploy altitude: hug minimum legal altitude at free-fall end (index nSeg) ===
        let deployAlt = terrain[nSeg] + deployHeight;
        if (deployAlt >= startAlt - 5) deployAlt = startAlt - 5; // ensure we actually descend

        // === Build free-fall path as piecewise segments following theta ===
        // We solve for D_free so that sum(di * r_i) == (startAlt - deployAlt),
        // with equal segment widths di = D_free / nSeg, r_i = -tan(theta_i).
        const rMin = Math.tan(5 * Math.PI / 180); // guard against near-horizontal
        const rVals = thetaList.map(d => {
            const r = -Math.tan((d * Math.PI) / 180);
            if (!isFinite(r) || r < rMin) return rMin;
            return r;
        });
        const avgR = rVals.reduce((a, b) => a + b, 0) / nSeg;
        const dZTot = startAlt - deployAlt; // positive
        let D_free = dZTot / Math.max(avgR, rMin);
        if (!isFinite(D_free) || D_free <= 0) D_free = 300;

        // Distances & altitudes arrays (start point + one point per segment end)
        const distances = [0];
        const alts = [startAlt];
        const di = D_free / nSeg;
        for (let i = 0; i < nSeg; i++) {
            const x = distances[distances.length - 1] + di;
            const y = alts[alts.length - 1] - rVals[i] * di;
            distances.push(x);
            alts.push(y);
        }

        // === Glide distances/altitudes ===
        // SHORT TRANSITION (decreasing vertical acceleration) → then CONSTANT vertical-speed descent.
        // Guarantees: (1) strictly non-increasing altitude, (2) no overshoot below final altitude,
        // (3) visually noticeable early descent.
        const D_glide = Math.max(300, (tFree > 0 ? (tGlide / tFree) : 1) * D_free) * 0.5;
        const xStart = distances[distances.length - 1];

        // --- Transition duration: longer by default (visible) and depends on final free-fall pitch.
        const TRANS_BASE = 0.45;           // seconds, default "visible" catch
        const TRANS_EXTRA_AT_90 = 0.35;    // add up to +0.35s more by -90°
        const cutoffDeg = -40;
        const thetaFinal = thetaList[nSeg - 1] ?? -60;
        const needsTrans = thetaFinal <= cutoffDeg;
        const norm = needsTrans ? (Math.min(90, Math.abs(thetaFinal)) - 40) / 50 : 0; // 0..1 for [-40..-90]
        const tTransSec = needsTrans ? (TRANS_BASE + TRANS_EXTRA_AT_90 * norm) : 0;
        const fracTrans = (tGlide > 0) ? clamp(tTransSec / tGlide, 0, 0.60) : 0; // cap ≤ 60% of glide
        const D_trans = D_glide * fracTrans;
        const transSamplesPlan = Math.round(glideSamples * fracTrans);

        // Slopes (drop per horizontal meter)
        const r_last = rVals[nSeg - 1]; // from free-fall
        const r_target = Math.max(rMin / 3, (deployAlt - glideEndAltAbs) / Math.max(1, D_glide));

        // Drop budget so we never force a later climb:
        const totalDrop = Math.max(0, deployAlt - glideEndAltAbs);
        const minDropLeft = Math.min(Math.max(10, totalDrop * 0.15), totalDrop); // leave ≥10m or 15% for constant
        const dropBudgetTrans = Math.min(totalDrop - minDropLeft, totalDrop);     // ≤ total drop

        let x = xStart;
        let y = deployAlt;
        let transSamplesUsed = 0;
        let dropAccum = 0;

        // --- 1) Transition: slope eases from r_last → r_target.
        // Bias easing so it's steeper early (more visible), but clamp to dropBudgetTrans.
        if (transSamplesPlan > 0 && dropBudgetTrans > 0) {
            const dx = D_trans / transSamplesPlan;
            for (let i = 1; i <= transSamplesPlan; i++) {
                const t = i / transSamplesPlan;
                const gamma = 0.85;                             // <1 → stronger early descent
                const te = 1 - Math.pow(1 - t, gamma);
                const r_t = r_target + (r_last - r_target) * easeOutCubic(te); // >= r_target
                let stepDrop = r_t * dx;                        // positive "drop" amount
                // Clamp so we never overshoot below the final altitude:
                const remainingBudget = dropBudgetTrans - dropAccum;
                if (stepDrop > remainingBudget) stepDrop = remainingBudget;
                x += dx;
                y -= stepDrop;                                   // apply drop (monotonic)
                if (y < glideEndAltAbs) y = glideEndAltAbs;     // hard floor at final altitude
                distances.push(x);
                alts.push(y);
                dropAccum += stepDrop;
                transSamplesUsed++;
                if (dropAccum >= dropBudgetTrans - 1e-6) break; // transition done; save some for constant
            }
        }

        // --- 2) Constant descent to the endpoint (strictly non-increasing).
        const D_done = x - xStart;
        const D_lin = Math.max(0, D_glide - D_done);
        const remainingDrop = Math.max(0, y - glideEndAltAbs);
        const remainingSamples = Math.max(0, glideSamples - transSamplesUsed);
        if (D_lin > 0 && remainingSamples > 0) {
            const dxLin = D_lin / remainingSamples;
            const mConst = -(remainingDrop / Math.max(1, D_lin)); // dy/dx ≤ 0
            for (let i = 1; i <= remainingSamples; i++) {
                x += dxLin;
                y += mConst * dxLin;
                if (y < glideEndAltAbs) y = glideEndAltAbs;     // guard FP drift
                distances.push(x);
                alts.push(y);
            }
            alts[alts.length - 1] = glideEndAltAbs;             // snap exactly
        } else {
            // No horizontal left or no samples: ensure last point is exact.
            if (alts[alts.length - 1] !== glideEndAltAbs) {
                distances.push(xStart + D_glide);
                alts.push(glideEndAltAbs);
            }
        }
        // Build a separate dataset for the straight-down "wait then drop" line (no smoothing).
        let dropData = [];
        if (hOverDest > 0) {
            const xEndGlide = distances[distances.length - 1];   // destination x
            const finalAlt = alts[alts.length - 1];             // glideEndAltAbs
            const groundAtDest = Math.max(0, finalAlt - hOverDest);
            dropData = [{ x: xEndGlide, y: finalAlt }, { x: xEndGlide, y: groundAtDest }];
        }

        const minDeployAltLine = terrain.map(h => h + 100);// terrain + deployHeight

        // Glide data starts exactly at deploy; no overlap with free-fall
        const glideData = distances.slice(nSeg).map((x, i) => ({ x, y: alts[nSeg + i] }));

        // --- Tight x-range to destination (use nearly the full chart width)
        const xEnd = distances[distances.length - 1];
        const xMargin = clamp(0.02 * xEnd, 10, 40); // small but visible margin

        // ---- Angle labels for Y ticks (map altitude -> the θ of the segment at that height)
        // Build segments [y_high,y_low] with their theta, only for free-fall portion.
        const segs = [];
        for (let i = 0; i < nSeg; i++) {
            const y1 = alts[i], y2 = alts[i + 1];
            segs.push({
                yHi: Math.max(y1, y2),
                yLo: Math.min(y1, y2),
                theta: thetaList[i]
            });
        }
        // Tick formatter: show θ where the tick lies inside a free-fall segment; otherwise blank.
        const angleTickFormatter = (value) => {
            // Hide anything below deploy altitude
            if (value < alts[nSeg]) return '';
            // Above start? Use first segment's θ
            if (value > alts[0]) return `${Math.round(segs[0].theta)}°`;
            for (const s of segs) {
                if (value <= s.yHi && value >= s.yLo) return `${Math.round(s.theta)}°`;
            }
            return '';
        };

        // Build datasets (no secondary axis / no pitch series)
        const datasets = [
            // Free-fall altitude (solid blue) as θ-segment profile
            {
                label: 'Diving',
                data: distances.slice(0, nSeg + 1).map((x, i) => ({ x, y: alts[i] })),
                parsing: false,
                pointRadius: 0,
                borderWidth: 2,
                borderDash: [],
                borderColor: '#2f80ed',
                yAxisID: 'y',
                order: 1,
            },
            // Glide altitude (dashed red)
            {
                label: 'Glide',
                data: glideData,
                parsing: false,
                pointRadius: 0,
                borderWidth: 2,
                borderDash: [],
                tension: 0.38,
                cubicInterpolationMode: 'monotone',
                borderJoinStyle: 'round',
                borderCapStyle: 'round',
                borderColor: '#FF6B6B',
                yAxisID: 'y',
                order: 2,
            },
            // Min deploy (terrain + deployHeight)
            {
                label: `Automatic Deploy (100m)`,
                data: distances.map((x, i) => ({ x, y: minDeployAltLine[i] })),
                parsing: false,
                pointRadius: 0,
                borderWidth: 1.5,
                borderDash: [6, 5],
                borderColor: '#ffe68d',
                yAxisID: 'y',
                order: 3,
            },
            // Vertical drop at destination (drawn last so it's on top)
            {
                label: '',
                data: dropData,
                parsing: false,
                pointRadius: 0,
                borderWidth: 2,
                borderDash: [],
                tension: 0,
                cubicInterpolationMode: 'default',
                borderColor: '#FF6B6B',
                yAxisID: 'y',
                order: 3,
            },
        ];

        // Init or update chart
        const ctx = document.getElementById('flightChart');
        if (!ctx) return;

        const config = {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#ffffff', boxWidth: 12, filter: (legendItem) => legendItem.text !== '' }
                    },
                    tooltip: {
                        callbacks: {
                            title(items) {
                                const d = items[0]?.parsed?.x ?? 0;
                                return `distance = ${d.toFixed(0)} m`;
                            },
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: Math.round(xEnd + xMargin),
                        ticks: { color: '#c9c9c9' },
                        grid: { color: 'rgba(255,255,255,0.08)' },
                        title: { display: true, text: 'Distance traveled (m)', color: '#c9c9c9' }
                    },
                    y: {
                        position: 'left',
                        min: 0,
                        max: startAlt,                // keep the same vertical range; just relabel
                        ticks: {
                            color: '#c9c9c9',
                            callback: (val) => angleTickFormatter(val)
                        },
                        grid: { color: 'rgba(255,255,255,0.06)' },
                    },
                    y2: {
                        position: 'right',
                        min: 0,
                        max: startAlt,
                        ticks: { display: false },   // remove 1.0, 0.8, ...
                        grid: { display: false },
                        title: { display: true, text: 'Descent Angle', color: '#c9c9c9' }
                    }
                }
            }
        };

        if (flightChart) {
            flightChart.data = config.data;
            flightChart.options = config.options;
            flightChart.update();
        } else {
            flightChart = new Chart(ctx, config);
        }
    } catch (e) {
        console.warn('Flight chart update skipped:', e);
    }
}

// Helpers
function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOut(t) { return 0.5 * (1 - Math.cos(Math.PI * t)); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function generateMockTerrain(N) {
    const arr = new Array(N).fill(0);

    // bounds
    const maxHeight = 120;
    const minHeight = 0;

    // pick a loose "biome" profile to vary look across runs
    const profile = Math.random();
    let jitterAmp, baseStep, peakCount;
    if (profile < 0.30) {          // plains
        jitterAmp = 2 + Math.random() * 8;
        baseStep = 1 + Math.random() * 2;
        peakCount = 1 + Math.floor(Math.random() * 2);   // 1–2 subtle features
    } else if (profile < 0.75) {   // hills
        jitterAmp = 6 + Math.random() * 20;
        baseStep = 1.5 + Math.random() * 4;
        peakCount = 2 + Math.floor(Math.random() * 3);   // 2–4
    } else {                       // mountains
        jitterAmp = 10 + Math.random() * 40;
        baseStep = 2 + Math.random() * 6;
        peakCount = 3 + Math.floor(Math.random() * 3);   // 3–5
    }

    // start somewhere interesting with a gentle global slope
    let v = 10 + Math.random() * 80;
    const slope = (Math.random() * 2 - 1) * (maxHeight * 0.15) / N; // ±15% over width

    // a few random peaks/valleys as smooth Gaussians
    const features = [];
    for (let k = 0; k < peakCount; k++) {
        const center = Math.random() * (N - 1);
        const width = N * (0.08 + Math.random() * 0.25); // 8–33% of length
        const amp = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 70);
        features.push({ center, width, amp });
    }

    // sometimes add a “coastal” drop near one edge
    if (Math.random() < 0.25) {
        const leftCoast = Math.random() < 0.5;
        const coastWidth = N * (0.06 + Math.random() * 0.12);
        const coastAmp = -(20 + Math.random() * 60);
        features.push({
            center: leftCoast ? coastWidth * 0.6 : N - coastWidth * 0.6,
            width: coastWidth,
            amp: coastAmp
        });
    }

    // smoother large-scale drift than a plain random walk
    let drift = 0;
    for (let i = 0; i < N; i++) {
        // slow-changing step -> rolling hills, fewer jaggies
        drift += (Math.random() - 0.5) * baseStep * 0.3;
        drift *= 0.95; // persistence

        v += drift + slope;

        // add the Gaussian features
        let gsum = 0;
        for (const f of features) {
            const d = i - f.center;
            gsum += f.amp * Math.exp(-(d * d) / (2 * f.width * f.width));
        }

        // local detail
        const jitter = (Math.random() - 0.5) * jitterAmp;

        arr[i] = v + gsum + jitter;
    }

    // variable smoothing (softens noise, keeps shapes)
    const passes = 1 + Math.floor(Math.random() * 2);      // 1–2
    const radius = 1 + Math.floor(Math.random() * 2);      // kernel radius 1–2 (3–5 tap)
    for (let p = 0; p < passes; p++) {
        const out = arr.slice();
        for (let i = 0; i < N; i++) {
            let sum = 0, count = 0;
            for (let r = -radius; r <= radius; r++) {
                const j = i + r;
                if (j >= 0 && j < N) {
                    const w = (r === 0 ? 2 : 1); // slight center weight
                    sum += arr[j] * w;
                    count += w;
                }
            }
            out[i] = sum / count;
        }
        for (let i = 0; i < N; i++) arr[i] = out[i];
    }

    // occasional terracing for cliffs/plateaus (rare and subtle)
    if (Math.random() < 0.20) {
        const stepHeight = 6 + Math.random() * 10;
        const bias = Math.random() * stepHeight;
        for (let i = 0; i < N; i++) {
            if (arr[i] > 15 && arr[i] < maxHeight - 15) {
                arr[i] = Math.round((arr[i] - bias) / stepHeight) * stepHeight + bias;
            }
        }
        // quick soften
        for (let i = 1; i < N - 1; i++) {
            arr[i] = (arr[i - 1] + arr[i] * 2 + arr[i + 1]) / 4;
        }
    }

    // clamp to bounds
    for (let i = 0; i < N; i++) {
        arr[i] = Math.max(minHeight, Math.min(maxHeight, arr[i]));
    }

    return arr;
}

function createTerrainGradient(ctx, chartArea) {
    const { ctx: g, chartArea: area } = ctx.chart;
    if (!area) return 'rgba(110, 98, 84, 0.35)';
    const grd = g.createLinearGradient(0, area.top, 0, area.bottom);
    grd.addColorStop(0, 'rgba(110, 98, 84, 0.35)');   // lighter top
    grd.addColorStop(1, 'rgba(87, 69, 54, 0.55)');    // darker base
    return grd;
}

// Recompute gaps whenever the zoom changes
map.on('zoomend', () => {
    if (markers.length > 2) redrawConnectionLines();
});


// For the bus pattern
// Debounce helper – adjust the wait (in ms) as needed.
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Wrap updatePattern in a debounce to limit how often it runs
const debouncedUpdatePattern = debounce(updatePattern, 50);

map.on('zoomend', function () {
    // Recalculate and update markers on zoom change
    if (markers.length > 1) {
        drawLineWithPattern();
    }
});

function drawLineWithPattern() {
    if (markers.length > 1) {
        let latlngs = calculatePointsForLine(markers[0].getLatLng(), markers[1].getLatLng(), map);
        updatePatternMarkers(latlngs);
    }
}

function updateLine() {
    if (polyline) {
        polyline.setLatLngs([markers[0].getLatLng(), markers[1].getLatLng()]);
    }
}


function resetMarkers(full_clear = true) {
    replaceImageWithPlaceholder(templateDirectoryUri + "/imgs/analysis_placeholder_bus.png", "busimg");
    replaceImageWithPlaceholder(templateDirectoryUri + "/imgs/analysis_placeholder_deploy.png", "deployimg");
    if (full_clear) {
        // remove EVERYTHING
        markers.forEach(m => map.removeLayer(m));
        markers = [];

        // also remove all destination markers
        destinationMarkers.forEach(m => map.removeLayer(m));
        destinationMarkers.length = 0;

        // also clear pattern markers (GoFasterStripe icons)
        patternMarkers.forEach(m => map.removeLayer(m));
        patternMarkers = [];
    } else {
        // PARTIAL CLEAR: keep only bus markers and all destination markers
        markers = markers.filter(m => {
            const isBus = m?.options?.icon === BusIcon;
            if (!isBus) {
                map.removeLayer(m); // removes deploy/jump/stripe/etc.
            }
            return isBus;
        });
    }

    // Clear the simple polyline if present
    if (polyline) {
        map.removeLayer(polyline);
        polyline = null;
    }
}

let patternMarkers = [];

function updatePatternMarkers(latlngs) {
    const currentStart = markers[0].getLatLng();
    const currentEnd = markers[1].getLatLng();

    if (!start || !end || !start.equals(currentStart) || !end.equals(currentEnd)) {
        start = map.project(currentStart, map.getMaxZoom());
        end = map.project(currentEnd, map.getMaxZoom());
        angle = calculateAngle(start, end);
    }

    updateMarkers(latlngs, angle);
    markers[0].setRotationAngle(angle);
    markers[1].setRotationAngle(angle);
}

let start, end, angle;  // These are now stored outside the function to be reused.

function updateMarkers(latlngs, angle) {
    const count = latlngs.length;
    const currentCount = patternMarkers.length;
    let marker, currentLatLng;

    // Use a plain for-loop for performance and avoid extra array iterations.
    for (let i = 0; i < count; i++) {
        const newLatLng = latlngs[i];
        if (i < currentCount) {
            marker = patternMarkers[i];
            currentLatLng = marker.getLatLng();

            // Only update if there is a meaningful change.
            if (currentLatLng.lat !== newLatLng.lat || currentLatLng.lng !== newLatLng.lng) {
                marker.setLatLng(newLatLng);
            }
            // Update the rotation angle (could also check if angle has changed significantly)
            marker.setRotationAngle(angle);
        } else {
            // Create new marker if needed
            marker = createMarker(newLatLng, angle);
            patternMarkers.push(marker);
        }
    }

    // Remove any extra markers if the new set is smaller.
    if (currentCount > count) {
        for (let i = count; i < currentCount; i++) {
            map.removeLayer(patternMarkers[i]);
        }
        // Shorten the array.
        patternMarkers.length = count;
    }
}

function createMarker(latlng, angle) {
    return L.marker(latlng, {
        icon: L.icon({
            iconUrl: templateDirectoryUri + '/imgs/GoFasterStripe.svg',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        }),
        rotationAngle: angle,
        interactive: false
    }).addTo(map);
}

function calculatePointsForLine(startLatLng, endLatLng, map, offsetDistance = 30) {
    let points = [];
    let startPoint = map.project(startLatLng, map.getZoom());
    let endPoint = map.project(endLatLng, map.getZoom());

    let direction = endPoint.subtract(startPoint);
    let length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    let offset = direction.multiplyBy(offsetDistance / length);

    // Offset endpoints if needed
    startPoint = startPoint.add(offset);
    endPoint = endPoint.subtract(offset);

    const distance = startPoint.distanceTo(endPoint);
    const targetPointsPerScreenDistance = calculateDensity(1920, 75);
    const screenDistance = (map.getSize().x + map.getSize().y) / 2;
    let numberOfPoints = Math.round(distance / screenDistance * targetPointsPerScreenDistance);
    numberOfPoints = Math.max(numberOfPoints, 1);

    for (let i = 0; i <= numberOfPoints; i++) {
        const fraction = i / numberOfPoints;
        const point = startPoint.multiplyBy(1 - fraction).add(endPoint.multiplyBy(fraction));
        points.push(map.unproject(point, map.getZoom()));
    }
    return points;
}

function calculateDensity(referenceWidth, referencePoints) {
    const screenWidth = window.innerWidth;
    const scale = screenWidth / referenceWidth;
    return Math.round(referencePoints * scale);
}


function calculateAngle(start, end) {
    let dy = end.y - start.y;
    let dx = end.x - start.x;
    let theta = Math.atan2(dy, dx); // range (-PI, PI]
    theta *= 180 / Math.PI; // rads to degs, range (-180, 180]
    if (theta < 0) theta = 360 + theta; // range [0, 360)
    return theta;
}

function updatePattern() {
    if (markers.length >= 2) {
        let latlngs = calculatePointsForLine(markers[0].getLatLng(), markers[1].getLatLng(), map);
        updatePatternMarkers(latlngs);
    }
}


let startTime = null;

function animateMarkers(timestamp) {
    if (!startTime) startTime = timestamp;
    let elapsed = timestamp - startTime;

    patternMarkers.forEach((marker, index) => {
        // Adjust the phase calculation by subtracting the index from the total number of markers
        // This will make the wave start from the last marker and move towards the first
        let reverseIndex = patternMarkers.length - 1 - index;
        let phase = elapsed * 0.005 + reverseIndex * 1.5; // Adjust '0.5' to change the wavelength
        let opacity = (Math.sin(phase) + 1) / 2 * 1.0 + 0.3; // Oscillates between 0.2 and 1
        marker.getElement().style.opacity = opacity;
    });

    requestAnimationFrame(animateMarkers);
}

document.getElementById('toggle').addEventListener('click', function () {
    let sidebar = document.getElementById('sidebar');
    let sidebarContent = document.querySelector('.sidebar-content');
    if (sidebar.style.transform === 'translateX(0%)') {
        sidebar.style.transform = 'translateX(100%)'; // Hide the sidebar
        sidebarContent.style.display = 'none'; // Also hide the content
    } else {
        sidebar.style.transform = 'translateX(0%)'; // Show the sidebar
        sidebarContent.style.display = 'block'; // Show the content
    }
});


/**
 ** HELPER FUNCTIONS
 */
const qSel = (obj) => document.querySelector(obj);
const qSelAll = (obj) => document.querySelectorAll(obj);

/**
 ** GLOBAL VARIABLES
 */
const nav = qSel('#nav');
const nav_container = qSel('#nav_icon');
nav_container.classList.add('mouseDistanceCloser');

/**
 ** OPEN SIDEBAR
 */
nav_container.addEventListener('click', () => {
    let sidebar = document.getElementById('sidebar');
    let sidebarContent = document.querySelector('.sidebar-content');
    let nav = document.querySelector('.nav');

    // Toggle sidebar
    if (sidebar.style.transform === 'translateX(0%)') {
        sidebar.style.transform = 'translateX(100%)'; // Hide the sidebar
        sidebarContent.style.display = 'none'; // Also hide the content
    } else {
        sidebar.style.transform = 'translateX(0%)'; // Show the sidebar
        sidebarContent.style.display = 'block'; // Show the content
    }
});




/**
 ** MOUSE TRACK EVENT 
 if (innerWidth > 10) {
    // Mouse move event
    window.addEventListener('mousemove', e => {
        const mouseY = Math.round((e.y * 100) / innerHeight);
        const mouseX = Math.round((e.x * 100) / innerWidth);
        
        // Check mouse distance to nav
        if (!nav.classList.contains('open') && mouseX >= 80) { // Changed condition for right side
        nav_container.style.top = `${mouseY}%`;
        nav_container.classList.add('mouseDistance');
    } else {
        nav_container.classList.remove('mouseDistance');
    nav_container.style.top = '50%';
}
 
mouseX > 0 ?
nav_container.classList.add('mouseDistanceCloser') :
nav_container.classList.remove('mouseDistanceCloser');
 
if (nav.classList.contains('open') || (mouseY >= 90 || mouseY <= 20)) resetNavIcon();
});
};
*/


/**
 ** RESET NAV ICON
 */
function resetNavIcon() {
    nav_container.classList.remove('mouseDistance');
    nav_container.classList.remove('mouseDistanceCloser');
    nav_container.style.top = '50%';
}


// Map offset from in-game map to in-house leaflet map
const MAP_OFFSET_X = -85;  // x-axis shift in pixels
const MAP_OFFSET_Y = -5;   // y-axis shift in pixels

// Function to draw an icon at a specified direction on the canvas
function replaceImageWithSmallBus(sourceImagePath, centerX, centerY, newSize, class_name, start, end) {
    // Create a new image element
    let sourceImage = new Image();

    // CORS
    sourceImage.crossOrigin = 'anonymous';
    // Set the source path of the image
    sourceImage.src = sourceImagePath;

    // Event listener to wait for the image to load
    sourceImage.onload = function () {
        // Create a canvas element
        let canvas = document.createElement('canvas');
        canvas.width = newSize;
        canvas.height = newSize;
        let ctx = canvas.getContext('2d');

        // Apply offset to coordinates for the new map
        let adjustedCenterX = centerX + MAP_OFFSET_X;
        let adjustedCenterY = centerY + MAP_OFFSET_Y;

        // Calculate coordinates for the cropped area
        let startX = adjustedCenterX - newSize / 2;
        let startY = adjustedCenterY - newSize / 2;

        // Draw the cropped portion of the source image onto the canvas
        ctx.drawImage(sourceImage, startX, startY, newSize, newSize, 0, 0, newSize, newSize);

        // Convert canvas to data URL
        let newImageSrc = canvas.toDataURL();

        // Get all elements with the specified class name
        let testImages = document.querySelectorAll('.' + class_name);

        // Replace each image with the new smaller image
        testImages.forEach(function (image) {
            // Replace the source of the image with the new smaller image
            image.src = newImageSrc;

            // Remove existing bus icon if present
            let existingBusIcon = image.parentNode.querySelector('.bus-icon');
            if (existingBusIcon) {
                existingBusIcon.parentNode.removeChild(existingBusIcon);
            }

            // Create and append bus icon image
            if (image.id === 'bus') {
                let busIcon = new Image();
                busIcon.src = templateDirectoryUri + '/imgs/bus_icon_trail.png';
                busIcon.classList.add('bus-icon');
                let rotate_angle = calculateAngle(start, end);
                busIcon.style.transform = 'translate(-50%, -50%) rotate(' + rotate_angle + 'deg)';
                image.parentNode.appendChild(busIcon);
            }
        });
    };
}

function replaceImageWithSmallPin(sourceImagePath, centerX, centerY, newSize, class_name, start, end) {
    // Create a new image element
    let sourceImage = new Image();
    // CORS
    sourceImage.crossOrigin = 'anonymous';
    // Set the source path of the image
    sourceImage.src = sourceImagePath;

    // Event listener to wait for the image to load
    sourceImage.onload = function () {
        // Create a canvas element
        let canvas = document.createElement('canvas');
        sourceImage.crossOrigin = 'anonymous';
        canvas.width = newSize;
        canvas.height = newSize;
        let ctx = canvas.getContext('2d');

        // Apply offset to coordinates for the new map
        let adjustedCenterX = centerX + MAP_OFFSET_X;
        let adjustedCenterY = centerY + MAP_OFFSET_Y;

        // Calculate coordinates for the cropped area
        let startX = adjustedCenterX - newSize / 2;
        let startY = adjustedCenterY - newSize / 2;

        // Draw the cropped portion of the source image onto the canvas
        ctx.drawImage(sourceImage, startX, startY, newSize, newSize, 0, 0, newSize, newSize);

        // Convert canvas to data URL
        let newImageSrc = canvas.toDataURL();

        // Get all elements with the specified class name
        let testImages = document.querySelectorAll('.' + class_name);

        // Replace each image with the new smaller image
        testImages.forEach(function (image) {
            // Replace the source of the image with the new smaller image
            image.src = newImageSrc;

            // Remove existing pin icon if present
            let existingPinIcon = image.parentNode.querySelector('.pin-icon');
            if (existingPinIcon) {
                existingPinIcon.parentNode.removeChild(existingPinIcon);
            }

            // Create and append pin icon image
            if (image.id === 'deploy') {
                let PinIcon = new Image();
                PinIcon.src = templateDirectoryUri + '/imgs/location-pin.png';
                PinIcon.classList.add('pin-icon');
                PinIcon.style.transform = 'translate(-50%, 235%)';
                image.parentNode.appendChild(PinIcon);
            }
        });
    };
}

function replaceImageWithPlaceholder(sourceImagePath, class_name) {
    // Create a new image element
    let sourceImage = new Image();
    // CORS
    sourceImage.crossOrigin = 'anonymous';
    // Set the source path of the image
    sourceImage.src = sourceImagePath;

    // Event listener to wait for the image to load
    sourceImage.onload = function () {
        // Create a canvas element
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');

        // Set canvas dimensions to match the source image
        canvas.width = sourceImage.width;
        canvas.height = sourceImage.height;

        // Draw the full source image onto the canvas
        ctx.drawImage(sourceImage, 0, 0, sourceImage.width, sourceImage.height);

        // Convert canvas to a data URL
        let newImageSrc = canvas.toDataURL();

        // Get all elements with the specified class name
        let testImages = document.querySelectorAll('.' + class_name);

        // Replace each image's source with the new placeholder image
        testImages.forEach(function (image) {
            // Remove the 'pin-icon' if it exists
            let pinIcon = image.parentNode.querySelector('.pin-icon');
            if (pinIcon) {
                pinIcon.remove();
            }

            // Remove the 'bus-icon' if it exists
            let busIcon = image.parentNode.querySelector('.bus-icon');
            if (busIcon) {
                busIcon.remove();
            }

            // Replace the source of the image
            image.src = newImageSrc;

        });
    };

    // Error handling for image loading
    sourceImage.onerror = function () {
        console.error('Error loading the source image:', sourceImagePath);
    };
}




function loot_toggle(currentIconType) {
    // Assuming currentIconType is one of the values from IconTypes
    const iconType = IconTypes[currentIconType.type.toUpperCase()]; // Make sure the input is correctly capitalized
    if (iconType) {
        // Call manageIcons with the currently active icon type
        manageIcons(chest_coords[iconType.type].map(item => item.coords), iconType);
    } else {
        console.error('Invalid icon type provided');
    }
}

let iconsMap = new Map(); // Store icons by a key identifier

function manageIcons(coordsArray, iconType) {
    const iconKey = iconType.type;
    let iconClusterGroup = iconsMap.get(iconKey);

    if (!iconClusterGroup) {
        iconClusterGroup = L.markerClusterGroup({
            maxClusterRadius: 40, // Adjust this to your preference
            iconCreateFunction: function (cluster) {
                return L.divIcon({
                    html: `<div class="cluster-marker" style="background-image: url(${iconType.url}); width: 40px; height: 40px; position: relative; display: flex; align-items: center; justify-content: center;">
                                <span style="background: rgba(0,0,0,0.75); color: white; border-radius: 10px; padding: 2px 5px;">${cluster.getChildCount()}</span>
                           </div>`,
                    className: 'marker-cluster-custom',
                    iconSize: L.point(30, 30),
                    iconAnchor: L.point(15, 15)
                });
            }
        });
        iconsMap.set(iconKey, iconClusterGroup);
        map.addLayer(iconClusterGroup);
    } else {
        iconClusterGroup.clearLayers(); // Clear previous markers
    }

    coordsArray.forEach(coord => {
        if (coord[0] !== undefined && coord[1] !== undefined) {
            const adjustedLat = coord[0];
            const adjustedLng = coord[1];
            const marker = L.marker([adjustedLat, adjustedLng], {
                icon: L.icon({
                    iconUrl: iconType.url,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                })
            }).on('click', onClick);
            iconClusterGroup.addLayer(marker);
        }
    });
}



document.addEventListener('DOMContentLoaded', function () {
    const checkboxes = {
        'vbtn-checkbox1': IconTypes.CHESTS,
        'vbtn-checkbox2': IconTypes.OTHER
    };

    Object.keys(checkboxes).forEach(function (checkboxId) {
        const checkbox = document.getElementById(checkboxId);
        checkbox.addEventListener('change', function () {
            const iconType = checkboxes[checkboxId];
            const iconData = chest_coords[iconType.type];

            if (checkbox.checked && iconData) {
                let flattenedCoords = [];
                if (Array.isArray(iconData)) {
                    // Direct array of items
                    flattenedCoords = iconData.reduce((acc, item) => acc.concat(item.coords), []);
                } else {
                    // Object with nested arrays, iterate over each key in the object
                    Object.values(iconData).forEach(nestedArray => {
                        nestedArray.forEach(item => {
                            flattenedCoords = flattenedCoords.concat(item.coords);
                        });
                    });
                }
                manageIcons(flattenedCoords, iconType);
            } else {
                manageIcons([], iconType); // Hide icons if unchecked or no data
            }
        });
    });
});

function toggleModal(modalId) {
    var modalElement = document.getElementById(modalId);
    var modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement, {});

    // Check if the modal is already showing
    if (modalElement.classList.contains('show')) {
        modal.hide(); // Close the modal
    } else {
        modal.show(); // Show the modal
    }
}


// Manual height adjustment sliders and inputs
const slider1 = document.getElementById('slider1');
const manual1 = document.getElementById('manual1');

const slider2 = document.getElementById('slider2');
const manual2 = document.getElementById('manual2');

const slider3 = document.getElementById('slider3');
const manual3 = document.getElementById('manual3');

const slider4 = document.getElementById('slider4');
const manual4 = document.getElementById('manual4');

// Conversion constants
const TILE_TO_METERS = 3.84; // 1 tile = 3.84 meters
const MIN_TILES = -4;
const MAX_TILES = 4;
const STEP_TILES = 0.5; // Step in tiles
const STEP_METERS = STEP_TILES * TILE_TO_METERS; // Step in meters

// Create marks
function createMarks(sliderMarks) {
    sliderMarks.innerHTML = ''; // Clear existing marks
    for (let i = MIN_TILES; i <= MAX_TILES; i += STEP_TILES) {
        const mark = document.createElement('div');
        mark.className = 'mark';
        mark.style.left = `${((i - MIN_TILES) / (MAX_TILES - MIN_TILES)) * 92 + 3.6}%`;
        sliderMarks.appendChild(mark);

        if (i % 1 === 0 || i === MIN_TILES || i === MAX_TILES) { // Add labels for whole numbers only
            const label = document.createElement('div');
            label.className = 'mark-label';
            label.textContent = parseInt(i.toFixed(1)); // Display in tiles
            label.style.left = `${((i - MIN_TILES) / (MAX_TILES - MIN_TILES)) * 92 + 4}%`;
            sliderMarks.appendChild(label);
        }
    }
}

// Get slider mark containers
const sliderMarks1 = document.querySelector('.slider-marks');

// Initialize marks for both sliders
createMarks(sliderMarks1);

// Update functions
manual1.addEventListener('input', () =>
    updateSlider(manual1, slider1, destinationMarkers, 0)
);
manual2.addEventListener('input', () =>
    updateSlider(manual2, slider2, destinationMarkers, 1)
);
manual3.addEventListener('input', () =>
    updateSlider(manual3, slider3, destinationMarkers, 2)
);
manual4.addEventListener('input', () =>
    updateSlider(manual4, slider4, destinationMarkers, 3)
);
slider1.addEventListener('input', () =>
    updateManual(slider1, manual1, destinationMarkers, 0)
);
slider2.addEventListener('input', () =>
    updateManual(slider2, manual2, destinationMarkers, 1)
);
slider3.addEventListener('input', () =>
    updateManual(slider3, manual3, destinationMarkers, 2)
);
slider4.addEventListener('input', () =>
    updateManual(slider4, manual4, destinationMarkers, 3)
);

function updateManual(slider, manual, destinationMarkers, index) {

    // Convert slider value (meters) back to tiles for display
    const tileValue = parseFloat(slider.value) / TILE_TO_METERS;
    manual.value = tileValue.toFixed(2);

    // Update destination marker icon
    if (parseFloat(manual.value) != 0) {
        if (!destinationMarkers[index]) {
            return;
        }
        destinationMarkers[index].setIcon(makeDestIcon(index, true));
    } else {
        if (!destinationMarkers[index]) {
            return;
        }
        destinationMarkers[index].setIcon(makeDestIcon(index, false));
    }
}


function updateSlider(manual, slider, destinationMarkers, index) {

    // Convert manual input (tiles) to meters for the slider
    let tileValue = parseFloat(manual.value.replace(',', '.'));

    if (isNaN(tileValue)) {
        tileValue = 0;
    } else {
        tileValue = Math.max(MIN_TILES, Math.min(MAX_TILES, tileValue));
    }

    manual.value = tileValue.toFixed(2);
    slider.value = (tileValue * TILE_TO_METERS).toFixed(2); // Convert to meters for slider

    // Update destination marker icon
    if (parseFloat(manual.value) != 0) {
        if (!destinationMarkers[index]) {
            return;
        }
        destinationMarkers[index].setIcon(makeDestIcon(index, true));
    } else {
        if (!destinationMarkers[index]) {
            return;
        }
        destinationMarkers[index].makeDestIcon(index, false);
    }
}

// Function to get the value of the manual element
function getHeightOffset(index) {
    const manuals = [manual1, manual2, manual3, manual4];
    const v = parseFloat((manuals[index]?.value ?? 0).toString().replace(',', '.')) || 0;
    return v * TILE_TO_METERS;
}

// Tooltips
document.addEventListener('DOMContentLoaded', function () {
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    })
});


// Reset button
const button = document.getElementById('resetButton');

button.addEventListener('click', () => {
    button.classList.add('reset-button-pressed');

    // Reset markers
    resetMarkers();
    patternMarkers.forEach(function (marker) {
        map.removeLayer(marker);
    });
    patternMarkers = [];
    // Reset lines
    if (solidLine) {
        solidLine.remove();
        solidLine = null;
    }
    if (solidLine2) {
        solidLine2.remove();
        solidLine2 = null;
    }
    if (dashedLine) {
        dashedLine.remove();
        dashedLine = null;
    }
    // Clear all destination markers
    destinationMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    destinationMarkers.length = 0; // reset the array

    removePulseGracefully('.calculate-button');

    setTimeout(() => {
        button.classList.remove('reset-button-pressed');
    }, 200); // Change the delay as needed
});

function applyRainbowEffect(marker) {
    // Get the DOM element for the marker's icon
    const iconElement = marker.getElement();
    if (!iconElement) return;

    // Select the <circle> element inside the SVG
    const circleElement = iconElement.querySelector('circle');
    if (!circleElement) return;

    // Store the original class in a custom attribute if not already stored
    if (!circleElement.dataset.originalClass) {
        circleElement.dataset.originalClass = circleElement.getAttribute('class');
    }

    // Add the full rainbow animation class for infinite animation
    circleElement.classList.add('rainbow-effect-full');
}

function stopRainbowEffect(marker) {
    // Get the DOM element for the marker's icon
    const iconElement = marker.getElement();
    if (!iconElement) return;

    // Select the <circle> element inside the SVG
    const circleElement = iconElement.querySelector('circle');
    if (!circleElement) return;

    // Remove the rainbow animation class
    circleElement.classList.remove('rainbow-effect-full');

    // Restore the original class from the stored attribute
    if (circleElement.dataset.originalClass) {
        circleElement.setAttribute('class', circleElement.dataset.originalClass);
    }
}

function removePulseGracefully(elementSelector) {
    const element = document.querySelector(elementSelector);

    if (element) {
        const computedStyle = window.getComputedStyle(element);
        const animationName = computedStyle.animationName;
        const iterationCount = computedStyle.animationIterationCount;

        if (animationName !== 'none') {
            // Temporarily add a one-time animationend listener
            const handleAnimationEnd = () => {
                element.classList.remove('pulse'); // Remove the class
                element.removeEventListener('animationend', handleAnimationEnd); // Clean up listener
                if (iterationCount === 'infinite') {
                    element.style.animationIterationCount = ''; // Reset to default
                }
            };

            // Attach the event listener
            element.addEventListener('animationend', handleAnimationEnd);

            if (iterationCount === 'infinite') {
                // Set iteration count to 1 to allow animationend to fire
                element.style.animationIterationCount = '1';
            }
        } else {
            // No animation is running; remove the class immediately
            element.classList.remove('pulse');
        }
    }
}

// Helper for turning on and off destination marker dragging
function setDestDragging(enabled) {
    (destinationMarkers || []).forEach(m => {
        if (!m || !m.dragging) return;
        try {
            enabled ? m.dragging.enable() : m.dragging.disable();
        } catch (_) { }
    });
}
// --- Agent Panel State and Utilities ---

const MAX_LOG_LINES = 100;

/**
 * Gets the base URL for the desktop agent's local web server.
 * This is the public facing connection endpoint.
 * @returns {string} The URL for the agent's API.
 */
function getAgentApiUrl() {
  // Using the public facing URL as requested.
  // The Rust desktop agent is expected to register itself here.
  return 'https://serverapi-4rtc.onrender.com';
}

/**
 * Logs a message to the UI log area.
 * @param {string} tag - A tag for the log entry (e.g., 'API', 'WS').
 * @param {string} msg - The message content.
 * @param {('log'|'warn'|'err')} type - The severity type.
 */
function log(tag, msg, type = 'log') {
  const logEl = document.getElementById('log');
  if (!logEl) return;

  const entry = document.createElement('div');
  entry.innerHTML = `<span class="tag ${type === 'warn' ? 'warn' : type === 'err' ? 'err' : ''}">${tag}</span> ${msg}`;
  logEl.appendChild(entry);

  // Keep log size managed
  if (logEl.children.length > MAX_LOG_LINES) {
    logEl.removeChild(logEl.children[0]);
  }

  // Auto-scroll to bottom
  logEl.scrollTop = logEl.scrollHeight;
}

/**
 * Shows an in-app message box instead of an alert().
 * @param {string} message - The message to display.
 */
function showMessageBox(message) {
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-box-text');
    const closeButton = document.getElementById('message-box-close');

    if (messageBox && messageText && closeButton) {
        messageText.textContent = message;
        messageBox.classList.add('show');
        
        // Remove 'show' class when the close button is clicked
        const removeMessageBox = () => {
            messageBox.classList.remove('show');
            closeButton.removeEventListener('click', removeMessageBox);
        };
        closeButton.addEventListener('click', removeMessageBox);

        // Optional: Auto-hide after 5 seconds
        setTimeout(() => {
            messageBox.classList.remove('show');
        }, 5000);
    } else {
        console.warn("MessageBox elements not found in DOM.");
    }
}
