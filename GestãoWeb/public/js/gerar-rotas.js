document.addEventListener("DOMContentLoaded", function () {
    const rotaSelect = document.getElementById("rotaSelect");
    const mapElement = document.getElementById("map");
    const definirPontoInicialBtn = document.getElementById("definirPontoInicial");
    const adicionarPontoParadaBtn = document.getElementById("adicionarPontoParada");
    const definirPontoFinalBtn = document.getElementById("definirPontoFinal");
    const definirEscolaBtn = document.getElementById("definirEscola");
    const gerarRotaBtn = document.getElementById("gerarRota");
    const salvarRotaBtn = document.getElementById("salvarRota");

    let map;
    let directionsService;
    let directionsRenderer;
    let pontoInicial;
    let pontoFinal;
    let pontosParada = [];
    let escolas = [];
    let modoSelecionado = '';

    async function carregarRotas() {
        try {
            const response = await fetch('/api/rotas');
            const rotas = await response.json();
            rotaSelect.innerHTML = rotas.map(rota => `<option value="${rota.id}">${rota.nome_rota}</option>`).join('');
        } catch (error) {
            console.error('Erro ao carregar rotas:', error);
        }
    }

    function initMap() {
        const canaaDosCarajas = { lat: -6.49719, lng: -49.87577 };
        map = new google.maps.Map(mapElement, {
            center: canaaDosCarajas,
            zoom: 13,
        });

        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
        });

        map.addListener('click', function (event) {
            const { latLng } = event;
            const location = { lat: latLng.lat(), lng: latLng.lng() };

            if (modoSelecionado === 'pontoInicial') {
                pontoInicial = location;
                new google.maps.Marker({
                    position: location,
                    map: map,
                    label: 'I',
                });
            } else if (modoSelecionado === 'pontoFinal') {
                pontoFinal = location;
                new google.maps.Marker({
                    position: location,
                    map: map,
                    label: 'F',
                });
            } else if (modoSelecionado === 'pontoParada') {
                pontosParada.push(location);
                new google.maps.Marker({
                    position: location,
                    map: map,
                    label: `${pontosParada.length}`,
                });
            } else if (modoSelecionado === 'escola') {
                escolas.push(location);
                new google.maps.Marker({
                    position: location,
                    map: map,
                    label: 'E',
                });
            }

            modoSelecionado = '';
        });
    }

    function gerarRota() {
        if (!pontoInicial || !pontoFinal) {
            alert('Por favor, defina o ponto inicial e o ponto final.');
            return;
        }

        const waypoints = [...pontosParada, ...escolas].map(parada => ({
            location: parada,
            stopover: true,
        }));

        const request = {
            origin: pontoInicial,
            destination: pontoFinal,
            waypoints: waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
        };

        directionsService.route(request, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                directionsRenderer.setDirections(result);
            } else {
                console.error('Erro ao gerar rota:', status);
                alert('Erro ao gerar rota. Tente novamente mais tarde.');
            }
        });
    }

    async function salvarRota() {
        const rotaId = rotaSelect.value;

        if (!rotaId) {
            alert('Por favor, selecione uma rota.');
            return;
        }

        try {
            const response = await fetch('/api/salvar-rota-gerada', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    rotaId: rotaId,
                    pontoInicial: pontoInicial,
                    pontoFinal: pontoFinal,
                    pontosParada: pontosParada,
                    escolas: escolas,
                }),
            });

            if (response.ok) {
                alert('Rota gerada salva com sucesso!');
            } else {
                const errorData = await response.json();
                console.error('Erro ao salvar rota gerada:', errorData);
                alert(`Erro ao salvar rota gerada: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Erro ao salvar rota gerada:', error);
            alert('Erro ao salvar rota gerada. Tente novamente mais tarde.');
        }
    }

    definirPontoInicialBtn.addEventListener('click', () => {
        modoSelecionado = 'pontoInicial';
    });

    adicionarPontoParadaBtn.addEventListener('click', () => {
        modoSelecionado = 'pontoParada';
    });

    definirPontoFinalBtn.addEventListener('click', () => {
        modoSelecionado = 'pontoFinal';
    });

    definirEscolaBtn.addEventListener('click', () => {
        modoSelecionado = 'escola';
    });

    gerarRotaBtn.addEventListener('click', gerarRota);
    salvarRotaBtn.addEventListener('click', salvarRota);

    carregarRotas();
    initMap();
});
