document.addEventListener('DOMContentLoaded', function () {
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

    // Funções para alternar entre as camadas
    document.getElementById('satelliteViewBtn').addEventListener('click', function () {
        map.removeLayer(streetsLayer);
        satelliteLayer.addTo(map);
    });

    document.getElementById('mapViewBtn').addEventListener('click', function () {
        map.removeLayer(satelliteLayer);
        streetsLayer.addTo(map);
    });

    // Função para carregar escolas e adicionar marcadores no mapa
    function carregarEscolas() {
        fetch('/api/escolas')
            .then(response => response.json())
            .then(data => {
                const tableBody = document.getElementById('escolasTableBody');
                tableBody.innerHTML = ''; // Limpar tabela existente
                data.forEach(escola => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${escola.id}</td>
                        <td>${escola.nome}</td>
                        <td>${escola.inep}</td>
                        <td>${escola.latitude}</td>
                        <td>${escola.longitude}</td>
                        <td>${escola.logradouro}</td>
                        <td>${escola.numero}</td>
                        <td>${escola.complemento}</td>
                        <td>${escola.bairro}</td>
                        <td>${escola.cep}</td>
                        <td>${escola.area_urbana ? 'Sim' : 'Não'}</td>
                        <td>
                            <button class="btn btn-warning btn-sm" onclick="editarEscola(${escola.id})">Editar</button>
                            <button class="btn btn-danger btn-sm" onclick="excluirEscola(${escola.id})">Excluir</button>
                        </td>
                    `;
                    tableBody.appendChild(row);

                    // Adicionar marcador no mapa
                    if (escola.latitude && escola.longitude) {
                        L.marker([escola.latitude, escola.longitude]).addTo(map)
                            .bindPopup(`<b>${escola.nome}</b><br>${escola.logradouro}, ${escola.numero}`);
                    }
                });
            })
            .catch(error => console.error('Erro ao carregar escolas:', error));
    }

    carregarEscolas();

    // Função para carregar bairros relacionados e não relacionados à escola
    function carregarBairrosEscola(escolaId) {
        fetch(`/api/escolas/${escolaId}/bairros`)
            .then(response => response.json())
            .then(data => {
                const listaBairros = document.getElementById('editListaBairros');
                const listaAtendidos = document.getElementById('bairrosEditAtendidos');

                // Limpar listas existentes
                listaBairros.innerHTML = '';
                listaAtendidos.innerHTML = '';

                // Carregar bairros atendidos
                data.bairrosAtendidos.forEach(bairro => {
                    const option = document.createElement('option');
                    option.value = bairro.id;
                    option.textContent = bairro.nome;
                    listaAtendidos.appendChild(option);
                });

                // Carregar bairros não atendidos
                data.bairrosNaoAtendidos.forEach(bairro => {
                    const option = document.createElement('option');
                    option.value = bairro.id;
                    option.textContent = bairro.nome;
                    listaBairros.appendChild(option);
                });
            })
            .catch(error => console.error('Erro ao carregar bairros da escola:', error));
    }

    // Editar escola
    window.editarEscola = function (id) {
        fetch(`/api/escolas/${id}`)
            .then(response => response.json())
            .then(data => {
                document.getElementById('editEscolaId').value = data.id;
                document.getElementById('editEscolaNome').value = data.nome;
                document.getElementById('editEscolaINEP').value = data.inep;
                document.getElementById('editEscolaLatitude').value = data.latitude;
                document.getElementById('editEscolaLongitude').value = data.longitude;
                document.getElementById('editEscolaLogradouro').value = data.logradouro;
                document.getElementById('editEscolaNumero').value = data.numero;
                document.getElementById('editEscolaComplemento').value = data.complemento;
                document.getElementById('editEscolaBairro').value = data.bairro;
                document.getElementById('editEscolaCep').value = data.cep;
                document.getElementById('editEscolaAreaUrbana').value = data.area_urbana ? '1' : '0';

                // Carregar bairros atendidos pela escola
                carregarBairrosEscola(data.id);
                $('#editModal').modal('show');
            })
            .catch(error => console.error('Erro ao carregar dados da escola:', error));
    };

    // Adicionar e remover bairros no modal de edição
    document.getElementById('adicionarEditBairroBtn').addEventListener('click', function () {
        moverOpcoes('editListaBairros', 'bairrosEditAtendidos');
    });

    document.getElementById('removerEditBairroBtn').addEventListener('click', function () {
        moverOpcoes('bairrosEditAtendidos', 'editListaBairros');
    });

    function moverOpcoes(origemId, destinoId) {
        const origem = document.getElementById(origemId);
        const destino = document.getElementById(destinoId);
        Array.from(origem.selectedOptions).forEach(option => {
            destino.appendChild(option);
        });
    }

    // Salvar edição de bairros
    document.getElementById('salvarEdicaoBtn').addEventListener('click', () => {
        const id = document.getElementById('editEscolaId').value;
        const bairrosAtendidos = Array.from(document.getElementById('bairrosEditAtendidos').options).map(option => ({
            id: option.value,
            nome: option.textContent
        }));

        const data = {
            bairros_atendidos: bairrosAtendidos
        };

        fetch(`/api/escolas/${id}/bairros`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
            .then(response => response.json())
            .then(result => {
                alert('Bairros atualizados com sucesso!');
                $('#editModal').modal('hide');
                carregarEscolas(); // Atualizar a lista de escolas
            })
            .catch(error => console.error('Erro ao atualizar bairros da escola:', error));
    });

    // Excluir escola
    window.excluirEscola = function (id) {
        if (confirm('Tem certeza que deseja excluir esta escola?')) {
            fetch(`/api/excluir-escola/${id}`, {
                method: 'DELETE'
            })
                .then(response => response.json())
                .then(result => {
                    alert('Escola excluída com sucesso!');
                    carregarEscolas();
                })
                .catch(error => console.error('Erro ao excluir escola:', error));
        }
    };
});
