document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("rotaForm");

    document.getElementById("salvarRota").addEventListener("click", async function () {
        const formData = new FormData(form);
        const data = {
            tipoRota: formData.get("tipoRota"),
            nomeRota: formData.get("nomeRota"),
            horariosFuncionamento: Array.from(document.querySelectorAll("input[name='horariosFuncionamento']:checked")).map(el => el.value),
            dificuldadesAcesso: Array.from(document.querySelectorAll("input[name='dificuldadesAcesso']:checked")).map(el => el.value),
            escolasAtendidas: Array.from(document.getElementById("escolasAtendidas").selectedOptions).map(option => option.value),
            alunosAtendidos: Array.from(document.getElementById("alunosAtendidos").selectedOptions).map(option => option.value)
        };

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

    carregarOpcoes();
});
