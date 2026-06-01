// --- 1. INICIALIZAÇÃO DO MAPA ---
const map = L.map('map').setView([-2.9045, -41.7760], 14);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// Variáveis Globais de Rota
let isDrawing = false;
let currentPoints = []; 
let currentPolyline = null; 
let routeMarkers = []; 
let displayedRoute = null; 

// Variáveis de GPS
let watchId = null;
let userMarker = null;
let userAccuracyCircle = null;

// --- 2. GPS TEMPO REAL ---
function toggleLocation() {
    const btn = document.getElementById('btn-location');

    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        
        if (userMarker) map.removeLayer(userMarker);
        if (userAccuracyCircle) map.removeLayer(userAccuracyCircle);
        userMarker = null;
        userAccuracyCircle = null;

        btn.innerHTML = '📍 Mostrar Minha Localização';
        btn.style.backgroundColor = '#17a2b8';
        return;
    }

    if (!navigator.geolocation) {
        alert("Seu navegador não suporta geolocalização.");
        return;
    }

    btn.innerHTML = '⏳ Buscando satélites...';

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            const latlng = [lat, lng];

            if (!userMarker) {
                userMarker = L.circleMarker(latlng, {
                    radius: 8, fillColor: '#007bff', color: '#fff', weight: 2, fillOpacity: 1
                }).addTo(map);
                
                userAccuracyCircle = L.circle(latlng, {
                    radius: accuracy, color: '#007bff', weight: 1, opacity: 0.2, fillOpacity: 0.1
                }).addTo(map);
                
                map.setView(latlng, 16);
                
                btn.innerHTML = '🛑 Parar Rastreamento';
                btn.style.backgroundColor = '#dc3545';
            } else {
                userMarker.setLatLng(latlng);
                userAccuracyCircle.setLatLng(latlng);
                userAccuracyCircle.setRadius(accuracy);
            }
        },
        (error) => {
            console.error(error);
            alert("Não foi possível acessar sua localização.");
            toggleLocation(); 
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
}

// --- 3. DESENHO NO MAPA ---
function startDrawing() {
    clearRouteFromMap();
    isDrawing = true;
    document.getElementById('map').classList.add('drawing-cursor');
    
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-finish').style.display = 'flex';
    document.getElementById('btn-cancel').style.display = 'flex';
}

map.on('click', function(e) {
    if (!isDrawing) return;

    currentPoints.push(e.latlng);

    const marker = L.circleMarker(e.latlng, {
        radius: 4, color: 'red', fillColor: '#f03', fillOpacity: 1
    }).addTo(map);
    routeMarkers.push(marker);

    if (currentPolyline) {
        map.removeLayer(currentPolyline);
    }
    currentPolyline = L.polyline(currentPoints, {
        color: 'red', weight: 4, opacity: 0.7
    }).addTo(map);
});

function finishAndSaveRoute() {
    const nameInput = document.getElementById('route-name');
    const routeName = nameInput.value.trim();

    if (!routeName) {
        alert("Dê um nome para a sua rota antes de salvar.");
        nameInput.focus();
        return;
    }

    if (currentPoints.length < 2) {
        alert("Clique no mapa pelo menos duas vezes para formar uma linha.");
        return;
    }

    const routeData = {
        id: Date.now().toString(),
        name: routeName,
        path: currentPoints
    };

    let savedRoutes = JSON.parse(localStorage.getItem('free_custom_routes')) || [];
    savedRoutes.push(routeData);
    localStorage.setItem('free_custom_routes', JSON.stringify(savedRoutes));

    alert(`Rota salva!`);
    
    nameInput.value = '';
    cancelDrawing(); 
    renderSavedRoutes(); 
}

function cancelDrawing() {
    isDrawing = false;
    document.getElementById('map').classList.remove('drawing-cursor');
    
    document.getElementById('btn-start').style.display = 'flex';
    document.getElementById('btn-finish').style.display = 'none';
    document.getElementById('btn-cancel').style.display = 'none';
    
    clearRouteFromMap();
}

function clearRouteFromMap() {
    if (currentPolyline) map.removeLayer(currentPolyline);
    if (displayedRoute) map.removeLayer(displayedRoute);
    routeMarkers.forEach(m => map.removeLayer(m));
    
    currentPoints = [];
    routeMarkers = [];
    currentPolyline = null;
    displayedRoute = null;
}

// --- 4. GERENCIAMENTO E EXPORTAÇÃO ---
function renderSavedRoutes() {
    const listContainer = document.getElementById('saved-routes-list');
    listContainer.innerHTML = ''; 

    let savedRoutes = JSON.parse(localStorage.getItem('free_custom_routes')) || [];

    if (savedRoutes.length === 0) {
        listContainer.innerHTML = '<p style="font-size: 13px; color: #888;">Nenhuma rota salva.</p>';
        return;
    }

    savedRoutes.forEach(route => {
        const routeDiv = document.createElement('div');
        routeDiv.className = 'route-item';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'route-header';
        headerDiv.onclick = () => loadSavedRoute(route.id);
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'route-name';
        nameSpan.innerText = route.name;
        
        headerDiv.appendChild(nameSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'route-actions';

        const gmapsBtn = document.createElement('button');
        gmapsBtn.className = 'action-btn btn-gmaps';
        gmapsBtn.innerText = 'Google Maps';
        gmapsBtn.onclick = (e) => {
            e.stopPropagation(); 
            openInGoogleMaps(route.id);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn btn-delete';
        deleteBtn.innerText = 'Excluir';
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); 
            deleteRoute(route.id);
        };

        actionsDiv.appendChild(gmapsBtn);
        actionsDiv.appendChild(deleteBtn);

        routeDiv.appendChild(headerDiv);
        routeDiv.appendChild(actionsDiv);
        listContainer.appendChild(routeDiv);
    });
}

function loadSavedRoute(id) {
    if (isDrawing) cancelDrawing(); 
    clearRouteFromMap(); 

    const savedRoutes = JSON.parse(localStorage.getItem('free_custom_routes')) || [];
    const route = savedRoutes.find(r => r.id === id);

    if (route) {
        displayedRoute = L.polyline(route.path, {
            color: '#007bff', weight: 5, opacity: 0.8
        }).addTo(map);

        map.fitBounds(displayedRoute.getBounds(), { padding: [20, 20] });
    }
}

// Algoritmo de Vértices para o Google Maps
function getTurnSharpness(p1, p2, p3) {
    const dx1 = p2.lng - p1.lng;
    const dy1 = p2.lat - p1.lat;
    const dx2 = p3.lng - p2.lng;
    const dy2 = p3.lat - p2.lat;

    const dotProduct = dx1 * dx2 + dy1 * dy2;
    const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (mag1 === 0 || mag2 === 0) return 1; 
    return dotProduct / (mag1 * mag2); 
}

function openInGoogleMaps(id) {
    const savedRoutes = JSON.parse(localStorage.getItem('free_custom_routes')) || [];
    const route = savedRoutes.find(r => r.id === id);

    if (!route || !route.path || route.path.length === 0) return;

    const path = route.path;
    let pointsToUse = [];

    if (path.length <= 10) {
        pointsToUse = path;
    } else {
        const startPoint = path[0];
        const endPoint = path[path.length - 1];
        let scoredPoints = [];

        for (let i = 1; i < path.length - 1; i++) {
            const sharpness = getTurnSharpness(path[i-1], path[i], path[i+1]);
            scoredPoints.push({ point: path[i], index: i, score: sharpness });
        }

        scoredPoints.sort((a, b) => a.score - b.score);
        let topVertices = scoredPoints.slice(0, 8);
        topVertices.sort((a, b) => a.index - b.index);

        pointsToUse.push(startPoint);
        topVertices.forEach(v => pointsToUse.push(v.point));
        pointsToUse.push(endPoint);
    }

    // URL oficial de rotas do Maps
    let url = "https://www.google.com/maps/dir/";
    pointsToUse.forEach(p => {
        url += `${p.lat},${p.lng}/`;
    });

    window.open(url, '_blank');
}

function deleteRoute(id) {
    if(!confirm("Deseja realmente excluir esta rota?")) return;

    let savedRoutes = JSON.parse(localStorage.getItem('free_custom_routes')) || [];
    savedRoutes = savedRoutes.filter(route => route.id !== id);
    localStorage.setItem('free_custom_routes', JSON.stringify(savedRoutes));
    
    clearRouteFromMap(); 
    renderSavedRoutes();
}

// Renderiza as rotas ao iniciar
window.onload = renderSavedRoutes;
