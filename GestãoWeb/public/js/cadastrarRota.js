document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("rotaForm");

    document.getElementById("salvarRota").addEventListener("click", async function () {
        const formData = new FormData(form);
        const areaUrbanaValue = document.querySelector("input[name='areaUrbana']:checked").value;

        const data = {
            identificadorUnico: formData.get("identificadorUnico"),
            tipoRota: formData.get("tipoRota"),
            nomeRota: formData.get("nomeRota"),
            horariosFuncionamento: Array.from(document.querySelectorAll("input[name='horariosFuncionamento']:checked")).map(el => el.value),
            dificuldadesAcesso: Array.from(document.querySelectorAll("input[name='dificuldadesAcesso']:checked")).map(el => el.value),
            areaUrbana: areaUrbanaValue === "true",
            escolasAtendidas: Array.from(document.getElementById("escolasAtendidas").selectedOptions).map(option => option.value),
            alunosAtendidos: Array.from(document.getElementById("alunosAtendidos").selectedOptions).map(option => option.value)
        };

        document.getElementById("loading").style.display = "block";

        try {
            const response = await fetch('/api/cadastrar-rota', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                alert('Rota cadastrada com sucesso!');
                form.reset();
            } else {
                const errorData = await response.json();
                alert(`Erro ao cadastrar rota: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Erro ao enviar dados:', error);
            alert('Erro ao cadastrar rota. Tente novamente mais tarde.');
        } finally {
            document.getElementById("loading").style.display = "none";
        }
    });

    async function carregarOpcoes() {
        try {
            const escolasResponse = await fetch('/api/escolas');
            const escolas = await escolasResponse.json();

            const escolasAtendidas = document.getElementById("escolasAtendidas");

            escolasAtendidas.innerHTML = escolas.map(escola => `<option value="${escola.id}">${escola.nome}</option>`).join('');
        } catch (error) {
            console.error('Erro ao carregar opções de escolas:', error);
        }
    }

    document.getElementById("escolasAtendidas").addEventListener("change", async function () {
        const escolasSelecionadas = Array.from(this.selectedOptions).map(option => option.value);

        if (escolasSelecionadas.length > 0) {
            try {
                const alunosResponse = await fetch(`/api/alunos?escolaIds=${escolasSelecionadas.join(',')}`);
                const alunos = await alunosResponse.json();
                const alunosAtendidos = document.getElementById("alunosAtendidos");

                alunosAtendidos.innerHTML = alunos.map(aluno => `<option value="${aluno.id}">${aluno.nome}</option>`).join('');
            } catch (error) {
                console.error('Erro ao carregar opções de alunos:', error);
            }
        } else {
            document.getElementById("alunosAtendidos").innerHTML = '';
        }
    });

    function filtrarOpcoes(event) {
        const input = event.target;
        const filter = input.value.toLowerCase();
        const select = document.getElementById(input.dataset.target);
        const options = select.getElementsByTagName("option");

        for (let i = 0; i < options.length; i++) {
            const txtValue = options[i].textContent || options[i].innerText;
            options[i].style.display = txtValue.toLowerCase().indexOf(filter) > -1 ? "" : "none";
        }
    }

    document.getElementById("escolasAtendidasInput").addEventListener("keyup", filtrarOpcoes);
    document.getElementById("escolasAtendidasInput").setAttribute("data-target", "escolasAtendidas");

    document.getElementById("alunosAtendidosInput").addEventListener("keyup", filtrarOpcoes);
    document.getElementById("alunosAtendidosInput").setAttribute("data-target", "alunosAtendidos");

    carregarOpcoes();
});
