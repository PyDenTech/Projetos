document.addEventListener('DOMContentLoaded', async function () {
    try {
        const response = await fetch('/api/usuario-logado');
        if (response.ok) {
            const usuario = await response.json();
            if (usuario) {
                document.getElementById('usuarioNome').textContent = usuario.nome || '';
                document.getElementById('nomeCompletoMain').textContent = usuario.nome || '';
                document.getElementById('nomeCompletoMain2').textContent = usuario.nome || '';
                document.getElementById('contatoMain').textContent = usuario.telefone || '';
                document.getElementById('emailMain').textContent = usuario.email || '';
                document.getElementById('profile-image').src = usuario.foto_perfil || '/img/user.png';
                document.getElementById('profile-image2').src = usuario.foto_perfil || '/img/user.png';
                document.getElementById('usuarioFuncaoMain').textContent = usuario.role || 'Setor/Função';
                document.getElementById('usuarioFuncaoMain2').textContent = usuario.role || 'Setor/Função';
            }
        } else {
            console.error('Erro ao carregar dados do usuário');
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }

    document.getElementById('logout-link').addEventListener('click', async function () {
        try {
            const response = await fetch('/logout', { method: 'POST' });
            if (response.ok) {
                window.location.href = '/';
            } else {
                console.error('Erro ao fazer logout');
            }
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        }
    });

    document.getElementById('uploadForm').addEventListener('submit', async function (event) {
        event.preventDefault();

        const formData = new FormData();
        const fileInput = document.getElementById('fileInput');

        if (fileInput.files.length > 0) {
            formData.append('foto_perfil', fileInput.files[0]);

            try {
                const response = await fetch('/api/upload-foto-perfil', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    document.getElementById('profile-image2').src = data.foto_perfil;
                    document.getElementById('profile-image').src = data.foto_perfil;
                    alert('Foto de perfil atualizada com sucesso!');
                } else {
                    const errorData = await response.json();
                    alert(`Erro ao atualizar foto de perfil: ${errorData.error}`);
                }
            } catch (error) {
                console.error('Erro ao enviar dados:', error);
                alert('Erro ao atualizar foto de perfil. Tente novamente mais tarde.');
            }
        } else {
            alert('Por favor, selecione uma imagem para upload.');
        }
    });
});
