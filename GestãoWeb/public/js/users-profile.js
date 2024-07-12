document.addEventListener('DOMContentLoaded', async function () {
    try {
        const response = await fetch('/api/usuario-logado');
        if (response.ok) {
            const usuario = await response.json();
            if (usuario) {
                const usuarioNomeElement = document.getElementById('usuarioNome');
                const nomeCompletoMainElement = document.getElementById('nomeCompletoMain');
                const nomeCompletoMain2Element = document.getElementById('nomeCompletoMain2');
                const contatoMainElement = document.getElementById('contatoMain');
                const emailMainElement = document.getElementById('emailMain');
                const profileImageElement = document.getElementById('profile-image');
                const profileImage2Element = document.getElementById('profile-image2');
                const usuarioFuncaoMainElement = document.getElementById('usuarioFuncaoMain');
                const usuarioFuncaoMain2Element = document.getElementById('usuarioFuncaoMain2');

                if (usuarioNomeElement) usuarioNomeElement.textContent = usuario.nome || '';
                if (nomeCompletoMainElement) nomeCompletoMainElement.textContent = usuario.nome || '';
                if (nomeCompletoMain2Element) nomeCompletoMain2Element.textContent = usuario.nome || '';
                if (contatoMainElement) contatoMainElement.textContent = usuario.telefone || '';
                if (emailMainElement) emailMainElement.textContent = usuario.email || '';
                if (profileImageElement) profileImageElement.src = usuario.foto_perfil || '/img/user.png';
                if (profileImage2Element) profileImage2Element.src = usuario.foto_perfil || '/img/user.png';
                if (usuarioFuncaoMainElement) usuarioFuncaoMainElement.textContent = usuario.role || 'Setor/Função';
                if (usuarioFuncaoMain2Element) usuarioFuncaoMain2Element.textContent = usuario.role || 'Setor/Função';
            }
        } else {
            console.error('Erro ao carregar dados do usuário');
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }

    const logoutLinkElement = document.getElementById('logout-link');
    if (logoutLinkElement) {
        logoutLinkElement.addEventListener('click', async function () {
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
    }

    const uploadFormElement = document.getElementById('uploadForm');
    if (uploadFormElement) {
        uploadFormElement.addEventListener('submit', async function (event) {
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
                        if (profileImageElement) profileImageElement.src = data.foto_perfil;
                        if (profileImage2Element) profileImage2Element.src = data.foto_perfil;
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
    }
});
