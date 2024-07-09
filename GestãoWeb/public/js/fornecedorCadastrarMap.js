// Variável global para armazenar o marcador
var marker;

// Função para inicializar o mapa
function initializeMap() {
    var map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: -6.530551137481605, lng: -49.85176024450633 },
        zoom: 12
    });

    // Adiciona um ouvinte de clique no mapa
    google.maps.event.addListener(map, 'click', function(event) {
        placeMarkerAndCaptureAddress(event.latLng, map);
    });

    function placeMarkerAndCaptureAddress(location, map) {
        // Atualiza os campos de latitude e longitude
        document.getElementById('latitudeFornecedor').value = location.lat();
        document.getElementById('longitudeFornecedor').value = location.lng();

        // Se o marcador já existe, atualiza a posição
        if (marker) {
            marker.setPosition(location);
        } else {
            // Caso contrário, adiciona um novo marcador com um ícone personalizado
            marker = new google.maps.Marker({
                position: location,
                map: map,
                icon: '/assets/img/icones/fornecedor-marcador.png' // Caminho para o ícone personalizado
            });
        }

        // Cria uma instância do serviço de Geocodificação
        var geocoder = new google.maps.Geocoder();
        geocoder.geocode({'location': location}, function(results, status) {
            if (status === google.maps.GeocoderStatus.OK) {
                if (results[0]) {
                    // Preenche os campos do formulário com as informações do endereço
                    var address_components = results[0].address_components;
                    address_components.forEach(function(component) {
                        var types = component.types;
                        if (types.includes('route')) {
                            document.getElementById('enderecoFornecedor').value = component.long_name;
                        }
                        if (types.includes('street_number')) {
                            document.getElementById('enderecoFornecedor').value += ', ' + component.long_name;
                        }
                    });
                } else {
                    console.log('Nenhum resultado encontrado');
                }
            } else {
                console.log('Geocodificador falhou devido a: ' + status);
            }
        });
    }
}

// Carrega a API do Google Maps assincronamente
function loadGoogleMapScript() {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyCNHjbosI2sw_FV2pGeuYdEJsvI0AwA49A&callback=initializeMap';
    script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyAnaQD9q_1LApNGxclN7jJvuatl6YPa9ww&callback=initializeMap';
   script.async = true;
    script.defer = true;
    document.body.appendChild(script);
}

// Chama a função de carregamento da API do Google Maps ao carregar a página
document.addEventListener('DOMContentLoaded', loadGoogleMapScript);
// Função chamada quando o botão de cadastro é clicado
function enviarCadastroFornecedor() {
    // Coleta os dados do formulário
    const nome = document.getElementById('nomeFornecedor').value;
    const telefone = document.getElementById('telefoneFornecedor').value;
    const email = document.getElementById('emailFornecedor').value;
    const endereco = document.getElementById('enderecoFornecedor').value;
    const latitude = document.getElementById('latitudeFornecedor').value;
    const longitude = document.getElementById('longitudeFornecedor').value;
    const descricao = document.getElementById('descricaoFornecedor').value;

    // Cria o objeto com os dados para enviar
    const dadosFornecedor = {
        nomeFornecedor: nome,
        telefoneFornecedor: telefone,
        emailFornecedor: email,
        enderecoFornecedor: endereco,
        latitudeFornecedor: latitude,
        longitudeFornecedor: longitude,
        descricaoFornecedor: descricao
    };
    

    // Envia os dados para o servidor usando Fetch API
    fetch('/cadastrar-fornecedor', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(dadosFornecedor)
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error('Erro ao cadastrar fornecedor');
        }
    })
    .then(data => {
        console.log('Sucesso:', data);
        alert('Fornecedor cadastrado com sucesso!');
        location.reload();
    })
    .catch((error) => {
        console.error('Erro:', error);
        alert('Erro ao cadastrar fornecedor.');
    });
}

