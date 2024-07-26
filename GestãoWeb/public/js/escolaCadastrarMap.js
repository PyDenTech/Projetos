// Inicializar o mapa Leaflet
var map = L.map('map').setView([-6.52974, -49.851845], 13); // Coordenadas de exemplo

// Camadas de mapa
var satelliteLayer = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    maxZoom: 22,
    id: 'mapbox/satellite-v9',
    accessToken: 'pk.eyJ1IjoiZGFuaWxvbW9yYWlzIiwiYSI6ImNsdzZocmJ5eDFqenoyanFzenBoMTc4c28ifQ._RiYYX1oIBe7_MBpTyYWxQ' // Substitua pelo seu token de acesso do Mapbox
});

var streetsLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
});

// Adicionar camada de mapa de ruas por padrão
streetsLayer.addTo(map);

// Camada de marcadores
var markersLayer = L.layerGroup().addTo(map);

// Ícone personalizado
var customIcon = L.icon({
    iconUrl: '/img/icones/escola-marcador.png',
    iconSize: [32, 32], // Tamanho do ícone
    iconAnchor: [16, 32], // Ponto de ancoragem do ícone
    popupAnchor: [0, -32] // Ponto de ancoragem do popup
});

// Adicionar controle de camadas
var baseLayers = {
    "Mapa de Rua": streetsLayer,
    "Mapa de Satélite": satelliteLayer
};

var overlays = {
    "Marcadores": markersLayer
};

L.control.layers(baseLayers, overlays).addTo(map);

// Evento de clique no mapa para obter coordenadas e endereço
map.on('click', function (e) {
    var lat = e.latlng.lat;
    var lng = e.latlng.lng;

    // Remover marcador existente
    markersLayer.clearLayers();

    // Criar marcador com ícone personalizado
    var marker = L.marker([lat, lng], { icon: customIcon }).addTo(markersLayer);

    // Atualizar os campos de latitude e longitude
    document.getElementById('reglatEscola').value = lat;
    document.getElementById('reglonEscola').value = lng;

    // Geocodificar para obter o endereço completo
    fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng)
        .then(response => response.json())
        .then(data => {
            if (data.address) {
                document.getElementById('inputAddressEscola').value = data.address.road || '';
                document.getElementById('inputNumberEscola').value = data.address.house_number || '';
                document.getElementById('inputComplementEscola').value = data.address.neighbourhood || '';
                document.getElementById('inputNeighborhoodEscola').value = data.address.neighbourhood || '';
                document.getElementById('inputZipEscola').value = data.address.postcode || '';
                document.getElementById('fullAddress').value = data.display_name || '';
            }
        })
        .catch(error => console.error('Erro ao geocodificar:', error));
});


document.addEventListener('DOMContentLoaded', function () {
    carregarBairros();

    // Carregar bairros na lista
    function carregarBairros() {
        fetch('/api/bairros')
            .then(response => response.json())
            .then(data => {
                const listaBairros = document.getElementById('listaBairros');
                listaBairros.innerHTML = '';
                data.forEach(bairro => {
                    const option = document.createElement('option');
                    option.value = bairro.id;
                    option.textContent = bairro.nome;
                    listaBairros.appendChild(option);
                });
            })
            .catch(error => console.error('Erro ao carregar bairros:', error));
    }

    // Funções de filtro
    document.getElementById('filterBairros').addEventListener('input', function () {
        const filter = this.value.toLowerCase();
        const options = document.getElementById('listaBairros').options;
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            const text = option.text.toLowerCase();
            option.style.display = text.includes(filter) ? '' : 'none';
        }
    });

    document.getElementById('filterAtendidos').addEventListener('input', function () {
        const filter = this.value.toLowerCase();
        const options = document.getElementById('bairrosAtendidos').options;
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            const text = option.text.toLowerCase();
            option.style.display = text.includes(filter) ? '' : 'none';
        }
    });

    // Funções de adicionar e remover bairros
    document.getElementById('adicionarBtn').addEventListener('click', function () {
        const listaBairros = document.getElementById('listaBairros');
        const bairrosAtendidos = document.getElementById('bairrosAtendidos');
        while (listaBairros.selectedOptions.length > 0) {
            const option = listaBairros.selectedOptions[0];
            bairrosAtendidos.appendChild(option);
        }
        atualizarContador();
    });

    document.getElementById('removerBtn').addEventListener('click', function () {
        const bairrosAtendidos = document.getElementById('bairrosAtendidos');
        const listaBairros = document.getElementById('listaBairros');
        while (bairrosAtendidos.selectedOptions.length > 0) {
            const option = bairrosAtendidos.selectedOptions[0];
            listaBairros.appendChild(option);
        }
        atualizarContador();
    });

    function atualizarContador() {
        const contador = document.getElementById('bairrosAtendidos').options.length;
        document.getElementById('contadorBairros').textContent = contador;
    }

    // Concluir cadastro da escola
    document.getElementById('concluirCadastroEscola').addEventListener('click', async () => {
        const escolaForm = document.getElementById('escolaForm');
        const formData = new FormData(escolaForm);
        const bairrosAtendidos = Array.from(document.getElementById('bairrosAtendidos').options).map(option => option.value);
        formData.append('bairrosAtendidos', bairrosAtendidos.length ? JSON.stringify(bairrosAtendidos) : "[]");

        const data = {};
        formData.forEach((value, key) => {
            if (data[key]) {
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        });

        try {
            const response = await fetch('/api/cadastrar-escola', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                alert('Escola cadastrada com sucesso!');
                escolaForm.reset();
                document.getElementById('bairrosAtendidos').innerHTML = '';
                atualizarContador();
            } else {
                const errorData = await response.json();
                alert(`Erro ao cadastrar escola: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Erro ao enviar dados:', error);
            alert('Erro ao cadastrar escola. Tente novamente mais tarde.');
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {
    // Função para buscar e exibir a contagem de escolas
    function carregarContagemEscolas() {
        fetch('/api/contar-escolas')
            .then(response => response.json())
            .then(data => {
                const escolasAtendidasElement = document.getElementById('escolasAtendidas');
                escolasAtendidasElement.textContent = data.count;
            })
            .catch(error => console.error('Erro ao buscar contagem de escolas:', error));
    }

    // Carregar a contagem de escolas ao carregar a página
    carregarContagemEscolas();
});

