mapboxgl.accessToken = 'pk.eyJ1IjoiZGFuaWxvbW9yYWlzIiwiYSI6ImNsdzZocmJ5eDFqenoyanFzenBoMTc4c28ifQ._RiYYX1oIBe7_MBpTyYWxQ';

document.addEventListener("DOMContentLoaded", function () {
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-49.851645, -6.530057], // Coordenadas de Canaã dos Carajás
        zoom: 12
    });

    let startPoint, endPoint, waypoints = [], schoolMarkers = [], escolasAtendidas = [];

    // Add map controls
    map.addControl(new mapboxgl.NavigationControl());

    const icons = {
        start: '/img/icones/inicio-icone.png',
        end: '/img/icones/inicio-icone.png',
        waypoint: '/img/icones/ponto-de-onibus.png',
        school: '/img/icones/escola-marcador.png'
    };

    map.on('click', function (e) {
        const coordinates = e.lngLat.toArray();
        if (!startPoint) {
            startPoint = coordinates;
            addMarker(coordinates, 'Ponto Inicial', icons.start);
        } else if (!endPoint) {
            endPoint = coordinates;
            addMarker(coordinates, 'Ponto Final', icons.end);
        } else {
            waypoints.push(coordinates);
            addMarker(coordinates, 'Ponto de Parada', icons.waypoint);
        }
    });

    function addMarker(coordinates, title, iconUrl) {
        const el = createMarkerElement(iconUrl);
        const marker = new mapboxgl.Marker({ element: el })
            .setLngLat(coordinates)
            .setPopup(new mapboxgl.Popup().setText(title))
            .addTo(map);
        return marker;
    }

    function createMarkerElement(iconUrl) {
        const el = document.createElement('div');
        el.className = 'marker';
        el.style.backgroundImage = `url(${iconUrl})`;
        el.style.width = '32px';
        el.style.height = '32px';
        el.style.backgroundSize = '100%';
        return el;
    }

    document.getElementById('gerarTracado').addEventListener('click', async function () {
        if (!startPoint || !endPoint) {
            alert('Por favor, selecione os pontos inicial e final.');
            return;
        }

        const waypointsStr = waypoints.concat(schoolMarkers.map(marker => marker.getLngLat().toArray())).map(p => p.join(',')).join(';');
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${startPoint[0]},${startPoint[1]};${waypointsStr};${endPoint[0]},${endPoint[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes.length > 0) {
            const route = data.routes[0];
            const coordinates = route.geometry.coordinates;
            const geojson = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                }
            };

            if (map.getSource('route')) {
                map.getSource('route').setData(geojson);
            } else {
                map.addLayer({
                    id: 'route',
                    type: 'line',
                    source: {
                        type: 'geojson',
                        data: geojson
                    },
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': '#3887be',
                        'line-width': 5,
                        'line-opacity': 0.75
                    }
                });
            }

            document.getElementById('distanciaTotal').value = (route.distance / 1000).toFixed(2);
            document.getElementById('tempoTotal').value = (route.duration / 60).toFixed(2);
        }
    });

    document.getElementById('rotaId').addEventListener('change', async function () {
        const rotaId = this.value;

        // Remove previous school markers
        schoolMarkers.forEach(marker => marker.remove());
        schoolMarkers = [];

        if (rotaId) {
            try {
                const response = await fetch(`/api/rotas/${rotaId}`);
                const rota = await response.json();
                const escolasResponse = await fetch(`/api/rotas/${rotaId}/escolas`);
                const escolas = await escolasResponse.json();
                schoolMarkers = escolas.map(escola => {
                    const coordinates = [escola.longitude, escola.latitude];
                    return addMarker(coordinates, escola.nome, icons.school);
                });
                escolasAtendidas = escolas.map(escola => escola.id);

                document.getElementById('nomeRota').value = rota.nome_rota;
            } catch (error) {
                console.error('Erro ao carregar rota e escolas:', error);
            }
        }
    });

    document.getElementById('tracadoForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const formData = new FormData(this);
        const data = {
            rotaId: parseInt(formData.get('rotaId')),
            nomeRota: formData.get('nomeRota'),
            distanciaTotal: parseFloat(formData.get('distanciaTotal')),
            tempoTotal: parseFloat(formData.get('tempoTotal')),
            pontoInicial: startPoint.join(','),
            pontoFinal: endPoint.join(','),
            pontosParada: waypoints.concat(schoolMarkers.map(marker => marker.getLngLat().toArray())).map(p => p.join(',')).join(';'),
            escolasAtendidas: escolasAtendidas
        };

        document.getElementById("loading").style.display = "block";

        try {
            const response = await fetch('/api/cadastrar-tracado-rota', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                alert('Traçado da Rota cadastrado com sucesso!');
                window.location.reload();
            } else if (response.status === 409) {
                const overwrite = confirm('Já existe um traçado cadastrado para essa rota. Deseja sobrescrever?');
                if (overwrite) {
                    const updateResponse = await fetch('/api/atualizar-tracado-rota', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(data),
                    });

                    if (updateResponse.ok) {
                        alert('Traçado da Rota atualizado com sucesso!');
                        window.location.reload();
                    } else {
                        const errorData = await updateResponse.json();
                        alert(`Erro ao atualizar traçado: ${errorData.error}`);
                    }
                }
            } else {
                const errorData = await response.json();
                alert(`Erro ao cadastrar traçado: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Erro ao enviar dados:', error);
            alert('Erro ao cadastrar traçado. Tente novamente mais tarde.');
        } finally {
            document.getElementById("loading").style.display = "none";
        }
    });

    async function carregarOpcoes() {
        try {
            const rotasResponse = await fetch('/api/rotas');
            const rotas = await rotasResponse.json();
            const rotaSelect = document.getElementById('rotaId');
            rotaSelect.innerHTML = '<option value="">Selecione uma rota</option>' + rotas.map(rota => `<option value="${rota.id}">${rota.identificador_unico} - ${rota.nome_rota}</option>`).join('');
        } catch (error) {
            console.error('Erro ao carregar opções:', error);
        }
    }

    carregarOpcoes();
});
